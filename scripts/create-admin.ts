/**
 * Create (or reset) the admin login from ADMIN_EMAIL / ADMIN_PASSWORD in .env.
 * Touches only the AdminUser table — use on a fresh, empty database.
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.ADMIN_EMAIL ?? 'admin@interwood.local').toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? 'Interwood@2026';
  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.adminUser.upsert({
    where: { email },
    update: { passwordHash },
    create: { email, passwordHash, name: 'Interwood Admin', role: 'SUPERADMIN' },
  });
  console.log(`Admin ready: ${email}`);
}

main().finally(() => prisma.$disconnect());
