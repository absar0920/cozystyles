import { prisma } from '@/lib/db';
import { STORE_TIME_ZONE } from '@/lib/dates';
import { splitTags } from '@/components/pages/blog-data';

export { splitTags };

/** Today as YYYY-MM-DD in the store's time zone (default date of a new post). */
export function storeToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: STORE_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

/** Distinct authors and tags of every post (published or not), A–Z, for the editor's suggestions. */
export async function blogSuggestions(): Promise<{ authorSuggestions: string[]; tagSuggestions: string[] }> {
  const rows = await prisma.page.findMany({ where: { kind: 'BLOG' }, select: { author: true, tags: true } });
  const uniq = (list: string[]) => {
    const seen = new Map<string, string>();
    for (const v of list) if (v && !seen.has(v.toLowerCase())) seen.set(v.toLowerCase(), v);
    return [...seen.values()].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));
  };
  return {
    authorSuggestions: uniq(rows.map((r) => r.author.trim())),
    tagSuggestions: uniq(rows.flatMap((r) => splitTags(r.tags))),
  };
}
