import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

export const AUTH_FILE = `tests/.auth/admin-${process.env.E2E_AGENT ?? 'default'}.json`;

/** Tiny .env reader (no dependency): KEY=value, optional quotes, # comments. */
function readDotEnv(): Record<string, string> {
  const file = path.resolve(__dirname, '../../.env');
  if (!existsSync(file)) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
}

/** A variable from the environment, else from .env (e.g. NEXT_PUBLIC_SITE_NAME, which the build inlined). */
export function envValue(key: string): string | undefined {
  return process.env[key] ?? readDotEnv()[key];
}

/** E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD, else ADMIN_EMAIL / ADMIN_PASSWORD from .env. */
export function adminCredentials(): { email: string; password: string } {
  const env = readDotEnv();
  const email = process.env.E2E_ADMIN_EMAIL ?? env.ADMIN_EMAIL;
  const password = process.env.E2E_ADMIN_PASSWORD ?? env.ADMIN_PASSWORD;
  if (!email || !password) throw new Error('Set E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD or ADMIN_EMAIL/ADMIN_PASSWORD in .env');
  return { email, password };
}
