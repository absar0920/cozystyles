import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

/** Must match the subject options offered by the storefront contact form. */
const ALLOWED_SUBJECTS = new Set(['General', 'Sales', 'Complaint', 'Corporate', 'Careers']);

const LIMITS = {
  name: 120,
  email: 200,
  phone: 40,
  message: 5000,
} as const;

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function bad(error: string) {
  return NextResponse.json({ ok: false, error }, { status: 400 });
}

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return bad('Invalid request body — expected JSON.');
  }
  if (typeof payload !== 'object' || payload === null) {
    return bad('Invalid request body — expected a JSON object.');
  }

  const body = payload as Record<string, unknown>;
  const name = str(body.name);
  const email = str(body.email);
  const phone = str(body.phone);
  const message = str(body.message);
  const subjectRaw = str(body.subject);
  const subject = ALLOWED_SUBJECTS.has(subjectRaw) ? subjectRaw : 'General';

  if (!name) return bad('Please enter your name.');
  if (name.length > LIMITS.name) return bad('Name is too long.');
  if (!message) return bad('Please enter a message.');
  if (message.length > LIMITS.message) return bad('Message is too long — please keep it under 5000 characters.');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return bad('Please enter a valid email address.');
  if (email.length > LIMITS.email) return bad('Email address is too long.');
  if (phone.length > LIMITS.phone) return bad('Phone number is too long.');

  try {
    await prisma.contactSubmission.create({
      data: { name, email, phone, subject, message },
    });
  } catch {
    return NextResponse.json({ ok: false, error: 'Could not save your message. Please try again.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
