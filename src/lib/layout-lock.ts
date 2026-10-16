import type { Prisma } from '@prisma/client';

/**
 * Takes the database write lock inside a transaction and confirms the layout still exists, in one statement.
 *
 * SQLite allows one writer at a time, and a transaction only takes the write lock at its first write. A check that a
 * layout exists (or that no product uses it) followed later by a write is therefore not safe on its own: a delete and
 * a move could both check, then both write, leaving products pointing at a deleted layout. Calling this as the FIRST
 * statement of every transaction that deletes a layout or points products at one makes those transactions run one
 * after the other, so the check that follows sees the other one's result.
 *
 * Raw SQL on purpose: it changes nothing (`position = position`) and so does not bump the @updatedAt column the
 * editor uses to detect changes made elsewhere.
 */
export async function lockLayout(tx: Prisma.TransactionClient, where: { id: number } | { key: string }): Promise<boolean> {
  const n =
    'id' in where
      ? await tx.$executeRaw`UPDATE "ProductLayout" SET "position" = "position" WHERE "id" = ${where.id}`
      : await tx.$executeRaw`UPDATE "ProductLayout" SET "position" = "position" WHERE "key" = ${where.key}`;
  return n > 0;
}
