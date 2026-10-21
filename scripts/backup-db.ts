/**
 * Dump the local MySQL database to prisma/backups/db-YYYYMMDD-HHMMSS.sql and print the path.
 *
 *   npm run db:backup
 *
 * Uses `mariadb-dump` inside the docker-compose container (`npm run db:up`), so nothing has to be installed on the
 * machine. On Hostinger use hPanel instead: Databases → phpMyAdmin → Export (and the daily backups).
 * Back up the uploads folder (UPLOADS_DIR, default storage/uploads) together with the database.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..');
const CONTAINER = 'cozystyles-mysql';

function databaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envFile = path.join(ROOT, '.env');
  if (existsSync(envFile)) {
    const m = readFileSync(envFile, 'utf8').match(/^\s*DATABASE_URL\s*=\s*"?([^"\n]+)"?/m);
    if (m) return m[1].trim();
  }
  throw new Error('DATABASE_URL is not set.');
}

function stamp(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

/** Dumps the database and returns the backup path. */
export function backupDatabase(label = ''): string {
  const url = new URL(databaseUrl());
  if (url.protocol !== 'mysql:') throw new Error(`Only MySQL databases can be backed up (DATABASE_URL=${url.protocol}…).`);
  const db = url.pathname.replace(/^\//, '');
  const sql = execFileSync(
    'docker',
    ['exec', CONTAINER, 'mariadb-dump', `-u${decodeURIComponent(url.username)}`, `-p${decodeURIComponent(url.password)}`, '--single-transaction', db],
    { maxBuffer: 1024 * 1024 * 1024 },
  );
  const dir = path.join(ROOT, 'prisma', 'backups');
  mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, `db-${stamp()}${label ? `-${label}` : ''}.sql`);
  writeFileSync(dest, sql);
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
