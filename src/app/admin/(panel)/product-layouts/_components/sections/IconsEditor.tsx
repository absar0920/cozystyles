'use client';

import { SortableList } from '@/components/admin/SortableList';
import { IconPicker } from '@/components/admin/IconPicker';
import { TextArea, TextInput } from '@/components/admin/ui';
import { MAX_ICON_TEXT, MAX_ICON_TITLE, type IconBlockValues } from '@/lib/product-layout-draft';
import { MAX_ICON_BLOCKS } from '@/lib/product-layout-sections';
import { DEFAULT_ICON } from '@/lib/product-layout-icons';
import { AddButton, EditorField, FieldError, RemoveButton, inputError, itemKey, useUndoRemove, type SectionEditorProps } from './common';

/** "Icons row" (SPEC §3.3): up to 8 blocks, each an icon from the ready-made set, a title and a short text. */
export function IconsEditor({ section, setValues, errors }: SectionEditorProps<'icons'>) {
  const blocks = section.values.blocks;
  const setBlocks = (next: IconBlockValues[]) => setValues({ blocks: next });
  const patch = (key: string, p: Partial<IconBlockValues>) => setValues((cur) => ({ blocks: cur.blocks.map((b) => (b.key === key ? { ...b, ...p } : b)) }));
  const undo = useUndoRemove<IconBlockValues>((update) => setValues((cur) => ({ blocks: update(cur.blocks) })));
  return (
    <div className="grid gap-3" data-field="blocks">
      <FieldError message={errors.blocks} />
      <SortableList
        items={blocks}
        getKey={(b) => b.key}
        onReorder={setBlocks}
        ariaLabel="Icons"
        renderItem={(b, ctl) => {
          const tErr = errors[`blocks.${b.key}.title`];
          const xErr = errors[`blocks.${b.key}.text`];
          return (
            <div data-testid="icon-block" className="rounded-xl border border-gray-200 bg-white p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="flex items-center">
                  {ctl.handle}
                  <span className="text-sm font-semibold text-gray-700">Icon {ctl.index + 1}</span>
                </span>
                <span className="flex items-center">
                  {ctl.arrows}
                  {blocks.length > 1 && <RemoveButton label={`Remove icon ${ctl.index + 1}`} onClick={() => undo.remove(b, ctl.index, `Icon ${ctl.index + 1}`)} />}
                </span>
              </div>
              <div className="flex gap-3">
                <div className="shrink-0">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">Icon</span>
                  <IconPicker value={b.icon} onChange={(icon) => patch(b.key, { icon })} />
                </div>
                <div className="grid min-w-0 flex-1 gap-3">
                  <EditorField label="Title" field={`blocks.${b.key}.title`} error={tErr} htmlFor={`${b.key}-title`}>
                    <TextInput id={`${b.key}-title`} value={b.title} maxLength={MAX_ICON_TITLE} onChange={(e) => patch(b.key, { title: e.target.value })} className={inputError(tErr)} />
                  </EditorField>
                  <EditorField label="Text" hint="Press Enter to start a new line." field={`blocks.${b.key}.text`} error={xErr} htmlFor={`${b.key}-text`}>
                    <TextArea
                      id={`${b.key}-text`}
                      data-plain-text=""
                      rows={3}
                      value={b.text}
                      maxLength={MAX_ICON_TEXT}
                      showCount
                      onChange={(e) => patch(b.key, { text: e.target.value })}
                      className={inputError(xErr)}
                    />
                  </EditorField>
                </div>
              </div>
            </div>
          );
        }}
      />
      {undo.notice}
      <AddButton
        onClick={() => setBlocks([...blocks, { key: itemKey('b'), icon: DEFAULT_ICON, title: '', text: '' }])}
        disabled={blocks.length >= MAX_ICON_BLOCKS}
        disabledReason={`An icons row can have up to ${MAX_ICON_BLOCKS} icons.`}
      >
        + Add icon
      </AddButton>
    </div>
  );
}
