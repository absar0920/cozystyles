/** Live page sizes: collections load 26 per page (infinite scroll), search shows 12 (numbered). */
export const COLLECTION_PER_PAGE = 26;

/**
 * /collections/all lists every product; /collections/frontpage and /collections/all-1 redirect there. A collection
 * row can never take these addresses (its page would not be reachable).
 */
export const RESERVED_COLLECTION_HANDLES: readonly string[] = ['all', 'frontpage', 'all-1'];
export const SEARCH_PER_PAGE = 12;
