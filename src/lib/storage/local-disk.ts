import 'server-only';
import { createReadStream } from 'node:fs';
import { mkdir, readdir, rename, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { isUploadKey } from '@/lib/storage/keys';
import type { StorageBackend } from '@/lib/storage';

function rootDir(): string {
  return path.resolve(process.env.UPLOADS_DIR ?? path.join(process.cwd(), 'storage/uploads'));
}

/** Validates the key and resolves it inside the root (defeats path traversal). */
function fileFor(key: string): string {
  if (!isUploadKey(key)) throw new Error('Invalid upload key');
  const root = rootDir();
  const file = path.resolve(root, key);
  if (!file.startsWith(root + path.sep)) throw new Error('Invalid upload key');
  return file;
}

async function* walk(dir: string, root: string): AsyncGenerator<{ key: string; mtime: Date }> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      yield* walk(full, root);
    } else if (e.isFile()) {
      const key = path.relative(root, full).split(path.sep).join('/');
      if (!isUploadKey(key)) continue;
      const s = await stat(full).catch(() => null);
      if (s) yield { key, mtime: s.mtime };
    }
  }
}

let instance: StorageBackend | null = null;

export function localDiskStorage(): StorageBackend {
  if (instance) return instance;
  instance = {
    async put(key, data) {
      const file = fileFor(key);
      await mkdir(path.dirname(file), { recursive: true });
      const tmp = `${file}.tmp`;
      await writeFile(tmp, data);
      await rename(tmp, file);
    },
    async get(key) {
      const file = fileFor(key);
      const s = await stat(file).catch(() => null);
      if (!s || !s.isFile()) return null;
      const body = Readable.toWeb(createReadStream(file)) as unknown as ReadableStream<Uint8Array>;
      return { body, size: s.size, contentType: 'image/webp', mtime: s.mtime };
    },
    async delete(key) {
      await unlink(fileFor(key)).catch((e: NodeJS.ErrnoException) => {
        if (e.code !== 'ENOENT') throw e;
      });
    },
    async exists(key) {
      const s = await stat(fileFor(key)).catch(() => null);
      return !!s?.isFile();
    },
    list(prefix = '') {
      const root = rootDir();
      const start = prefix ? path.resolve(root, prefix) : root;
      if (start !== root && !start.startsWith(root + path.sep)) return (async function* () {})();
      return walk(start, root);
    },
  };
  return instance;
}
