import type { Prisma } from '@prisma/client';

/**
 * Locks a layout's row for the rest of the transaction and confirms the layout still exists, in one statement.
 *
 * A check that a layout exists (or that no product uses it) followed later by a write is not safe on its own: a
 * delete and a move could both check, then both write, leaving products pointing at a deleted layout. Calling this as
 * the FIRST statement of every transaction that deletes a layout or points products at one makes those transactions
 * wait for each other (InnoDB row lock via SELECT … FOR UPDATE), so the check that follows sees the other one's result.
 *
 * A locking read changes nothing, so the @updatedAt column the editor uses to detect changes made elsewhere stays put.
 */
export async function lockLayout(tx: Prisma.TransactionClient, where: { id: number } | { key: string }): Promise<boolean> {
  const rows =
    'id' in where
      ? await tx.$queryRaw<{ id: number }[]>`SELECT id FROM \`ProductLayout\` WHERE id = ${where.id} FOR UPDATE`
      : await tx.$queryRaw<{ id: number }[]>`SELECT id FROM \`ProductLayout\` WHERE \`key\` = ${where.key} FOR UPDATE`;
  return rows.length > 0;
}
