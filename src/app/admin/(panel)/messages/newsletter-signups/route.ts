import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAdminOrNull } from '@/lib/admin-guard';

export const dynamic = 'force-dynamic';

/** A cell a spreadsheet will not read as a formula ("=…", "+…", "-…", "@…" get a leading apostrophe). */
function cell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/**
 * Admin → Messages → Newsletter sign-ups → "Download sign-ups (CSV)": one row per email address (first sign-up
 * date), oldest first. There is no mailing service; this list is how the owner takes the sign-ups elsewhere.
 */
export async function GET() {
  if (!(await getAdminOrNull())) return NextResponse.json({ ok: false, error: 'Please sign in again.' }, { status: 401 });

  const rows = await prisma.contactSubmission.findMany({
    where: { subject: 'Newsletter' },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: { email: true, createdAt: true },
  });
  const seen = new Set<string>();
  const lines = ['Email,Signed up'];
  for (const r of rows) {
    const email = r.email.trim();
    const key = email.toLowerCase();
    if (!email || seen.has(key)) continue;
    seen.add(key);
    lines.push(`${cell(email)},${r.createdAt.toISOString().slice(0, 10)}`);
  }

  return new NextResponse(`${lines.join('\r\n')}\r\n`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="newsletter-signups.csv"',
      'Cache-Control': 'no-store',
    },
  });
}
