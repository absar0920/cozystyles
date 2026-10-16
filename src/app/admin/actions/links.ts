'use server';

import { requireAdmin } from '@/lib/admin-guard';
import { resolveLinkTargets, searchLinkTargets } from '@/lib/link-targets';
import type { LinkTarget } from '@/lib/links';

export async function searchLinkTargetsAction(query: string): Promise<LinkTarget[]> {
  await requireAdmin();
  return searchLinkTargets(String(query ?? ''));
}

export async function resolveLinkTargetsAction(hrefs: string[]): Promise<Record<string, LinkTarget>> {
  await requireAdmin();
  const list = (Array.isArray(hrefs) ? hrefs : []).filter((h): h is string => typeof h === 'string').slice(0, 300);
  return resolveLinkTargets(list);
}
