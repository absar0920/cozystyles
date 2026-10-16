import { notFound } from 'next/navigation';
import { LayoutEditor } from '../_components/LayoutEditor';
import { loadLayoutEditorData } from '../_lib/load';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Edit product page layout' };

export default async function EditProductLayoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  if (!/^\d+$/.test(id)) notFound();
  const data = await loadLayoutEditorData(Number(id));
  if (!data) notFound();
  const one = (k: string) => (typeof sp[k] === 'string' ? (sp[k] as string) : '');
  const fromId = /^\d+$/.test(one('from')) ? Number(one('from')) : null;
  const copiedFrom = /^\d+$/.test(one('copied')) ? Number(one('copied')) : null;
  const known = (n: number | null) => (n != null && data.layouts.some((l) => l.id === n && l.id !== data.layout.id) ? n : null);
  const flash = copiedFrom != null ? 'copied' : one('created') === '1' ? 'created' : one('own') === '1' ? 'own' : null;
  const error = one('error') === 'in-use' ? 'in-use' : one('error') === 'protected' ? 'protected' : null;
  return (
    <LayoutEditor
      data={data}
      flash={flash}
      openRename={one('rename') === '1'}
      moveFromId={known(fromId)}
      copiedFromId={known(copiedFrom)}
      serverError={error}
    />
  );
}
