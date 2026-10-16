import type { Metadata } from 'next';
import { resolveLinkTargets } from '@/lib/link-targets';
import { AdminPageHeader, Tabs } from '@/components/admin/ui';
import { ViewOnStoreLink } from '@/components/admin/ViewOnStoreLink';
import { MENU_TABS, loadMenuTree, type MenuNodeInput } from './_lib/tree';
import { MenuEditor } from './_components/MenuEditor';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Menus',
  robots: { index: false, follow: false },
};

function collectHrefs(nodes: MenuNodeInput[], out: Set<string>) {
  for (const n of nodes) {
    if (n.href) out.add(n.href);
    collectHrefs(n.children, out);
  }
  return out;
}

/** Menus (SPEC §5.5): one tab per storefront menu; the whole tree is edited and saved at once. */
export default async function MenusPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const current = MENU_TABS.find((t) => t.tab === sp.tab) ?? MENU_TABS[0];
  const tree = await loadMenuTree(current.location);
  const targets = await resolveLinkTargets([...collectHrefs(tree, new Set())]);

  return (
    <div className="pb-28">
      <AdminPageHeader title="Menus" subtitle="The links in the top menu and the website footer" actions={<ViewOnStoreLink href="/" />} />
      <Tabs
        ariaLabel="Menus"
        items={MENU_TABS.map((t) => ({ label: t.label, href: `/admin/menus?tab=${t.tab}`, active: t.tab === current.tab, hint: t.hint }))}
      />
      <MenuEditor key={current.location} location={current.location} maxDepth={current.maxDepth} initialTree={tree} initialTargets={targets} />
    </div>
  );
}
