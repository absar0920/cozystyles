/** Delete-confirmation bullets for a product (SPEC §5.1.8). Client-safe. */
export function deleteBullets(c: { combinations: number; photos: number; reviews: number; links: string[] }): string[] {
  return [
    `The product and its ${c.combinations} combination${c.combinations === 1 ? '' : 's'}`,
    `${c.photos} photo${c.photos === 1 ? '' : 's'} (uploaded photos not used anywhere else are deleted)`,
    // reviews only exist in imported demo data; the store has no review feature
    ...(c.reviews > 0 ? [`${c.reviews} customer review${c.reviews === 1 ? '' : 's'}`] : []),
    ...c.links,
  ];
}
