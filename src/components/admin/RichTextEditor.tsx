'use client';

import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import { NodeSelection } from '@tiptap/pm/state';
import { useEffect, useId, useRef, useState } from 'react';
import { richTextExtensions } from './rich-text/extensions';
import { Toolbar } from './rich-text/Toolbar';

export type RichTextEditorProps = {
  /** hidden input carrying current HTML */
  name?: string;
  /** initial HTML (already sanitised) */
  value: string;
  onChange?: (html: string) => void;
  label?: string;
  hint?: string;
  placeholder?: string;
  /** px, default 260 */
  minHeight?: number;
  /** default both true */
  features?: { images?: boolean; youtube?: boolean };
  ariaLabel?: string;
  /** true locks the text (e.g. while the form is saving) */
  readOnly?: boolean;
};

/**
 * Tiptap rich text editor (no raw HTML mode). The hidden input starts with `value` and is only rewritten by
 * user edits, so loading never marks the form dirty. The server sanitises again on save.
 */
export function RichTextEditor({ name, value, onChange, label, hint, placeholder, minHeight = 260, features, ariaLabel, readOnly = false }: RichTextEditorProps) {
  const [html, setHtml] = useState(value);
  const [empty, setEmpty] = useState(false);
  const lastEmitted = useRef(value);
  const hiddenRef = useRef<HTMLInputElement>(null);
  const userChange = useRef(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const id = useId();
  const images = features?.images ?? true;
  // position of a just-added photo whose "Describe the photo" bar stays open while the cursor sits after it
  const [altPos, setAltPos] = useState<number | null>(null);
  const altPosRef = useRef<number | null>(null);
  altPosRef.current = altPos;
  const youtube = features?.youtube ?? true;

  const editor = useEditor({
    immediatelyRender: false,
    extensions: richTextExtensions(),
    content: value,
    editorProps: {
      attributes: {
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-label': ariaLabel ?? label ?? 'Text',
        class: 'admin-rte px-4 py-3 outline-none',
        style: `min-height:${minHeight}px`,
      },
    },
    onCreate: ({ editor: e }) => setEmpty(e.isEmpty),
    onTransaction: ({ editor: e, transaction }) => {
      const p = altPosRef.current;
      if (p == null || !transaction.docChanged) return;
      const mapped = transaction.mapping.mapResult(p, 1);
      const next = !mapped.deleted && e.state.doc.nodeAt(mapped.pos)?.type.name === 'image' ? mapped.pos : null;
      if (next !== p) {
        altPosRef.current = next;
        setAltPos(next);
      }
    },
    onUpdate: ({ editor: e, transaction }) => {
      setEmpty(e.isEmpty);
      if (!transaction.docChanged) return;
      const next = e.getHTML();
      lastEmitted.current = next;
      userChange.current = true;
      setHtml(next);
      onChangeRef.current?.(next);
    },
  });

  // dirty tracking: bubbling `input` on the hidden input after user edits only
  useEffect(() => {
    if (!userChange.current) return;
    userChange.current = false;
    hiddenRef.current?.dispatchEvent(new Event('input', { bubbles: true }));
  }, [html]);

  // a parent reset (e.g. after save) replaces the content without marking dirty
  useEffect(() => {
    if (!editor || value === lastEmitted.current) return;
    lastEmitted.current = value;
    editor.commands.setContent(value, { emitUpdate: false });
    setHtml(value);
    setEmpty(editor.isEmpty);
  }, [value, editor]);

  useEffect(() => {
    if (editor && editor.isEditable === readOnly) editor.setEditable(!readOnly, false);
  }, [readOnly, editor]);

  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      if (!e) return { selectedImage: null as number | null };
      const sel = e.state.selection;
      return { selectedImage: sel instanceof NodeSelection && sel.node.type.name === 'image' ? sel.from : null };
    },
  });

  const imagePos = state?.selectedImage ?? altPos;
  const imageNode = editor && imagePos != null ? editor.state.doc.nodeAt(imagePos) : null;
  const image = imageNode?.type.name === 'image' && imagePos != null ? { pos: imagePos, alt: String(imageNode.attrs.alt ?? '') } : null;
  const setAlt = (alt: string) => {
    if (!editor || !image) return;
    const node = editor.state.doc.nodeAt(image.pos);
    if (node?.type.name !== 'image') return;
    editor.view.dispatch(editor.state.tr.setNodeMarkup(image.pos, undefined, { ...node.attrs, alt }));
  };

  return (
    <div data-testid="rich-text-editor">
      {label && (
        <label htmlFor={`${id}-area`} className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
          {label}
        </label>
      )}
      <div id={`${id}-area`} className="overflow-clip rounded-lg border border-gray-300 bg-white focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20">
        {editor ? (
          <>
            <Toolbar editor={editor} images={images} youtube={youtube} onImageInserted={setAltPos} />
            {image && (
              <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 bg-amber-50 px-3 py-2">
                <label className="flex min-w-0 flex-1 items-center gap-2 text-xs font-semibold text-gray-700">
                  <span className="shrink-0">Describe the photo</span>
                  <input
                    key={image.pos}
                    defaultValue={image.alt}
                    placeholder="e.g. Walnut dining table with six chairs"
                    onChange={(e) => setAlt(e.target.value)}
                    className="min-w-0 flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-xs font-normal outline-none focus:border-brand"
                  />
                </label>
                {altPos != null && state?.selectedImage == null && (
                  <button
                    type="button"
                    onClick={() => setAltPos(null)}
                    className="min-h-8 rounded-md border border-gray-300 bg-white px-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    Done
                  </button>
                )}
              </div>
            )}
            <div className="relative">
              {placeholder && empty && (
                <p className="pointer-events-none absolute left-4 top-3 text-sm text-gray-400" aria-hidden>
                  {placeholder}
                </p>
              )}
              <EditorContent editor={editor} />
            </div>
          </>
        ) : (
          <div aria-hidden className="animate-pulse">
            <div className="h-12 border-b border-gray-200 bg-gray-50" />
            <div className="space-y-2 px-4 py-3" style={{ minHeight }}>
              <div className="h-3 w-3/4 rounded bg-gray-100" />
              <div className="h-3 w-1/2 rounded bg-gray-100" />
            </div>
          </div>
        )}
      </div>
      {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
      {name && <input ref={hiddenRef} type="hidden" name={name} value={html} />}
    </div>
  );
}
