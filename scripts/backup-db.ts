/**
 * Copy the SQLite database to prisma/backups/dev-YYYYMMDD-HHMMSS.db and print the path.
 *
 *   npm run db:backup
 *
 * The file comes from DATABASE_URL (`file:./dev.db` resolves against prisma/, like Prisma does).
 * Back up storage/uploads together with the database: uploaded photos live there.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..');

function databaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envFile = path.join(ROOT, '.env');
  if (existsSync(envFile)) {
    const m = readFileSync(envFile, 'utf8').match(/^\s*DATABASE_URL\s*=\s*"?([^"\n]+)"?/m);
    if (m) return m[1].trim();
  }
  return 'file:./dev.db';
}

/** Absolute path of the SQLite file. */
export function databaseFile(): string {
  const url = databaseUrl();
  if (!url.startsWith('file:')) throw new Error(`Only SQLite file databases can be backed up (DATABASE_URL=${url}).`);
  const p = url.slice('file:'.length).split('?')[0];
  return path.isAbsolute(p) ? p : path.resolve(ROOT, 'prisma', p);
}

function stamp(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

/** Copies the database file and returns the backup path. */
export function backupDatabase(label = ''): string {
  const src = databaseFile();
  if (!existsSync(src)) throw new Error(`Database file not found: ${src}`);
  const dir = path.join(ROOT, 'prisma', 'backups');
  mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, `dev-${stamp()}${label ? `-${label}` : ''}.db`);
  copyFileSync(src, dest);
  return dest;
}

if (require.main === module) {
  try {
    console.log(backupDatabase());
  } catch (e) {
    console.error((e as Error).message);
    process.exit(1);
  }
}
