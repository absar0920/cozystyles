'use client';

import type { Editor } from '@tiptap/react';
import type { RefObject } from 'react';
import { resolveLinkTargetsAction } from '@/app/admin/actions/links';
import type { LinkTarget } from '@/lib/links';
import { LinkPicker } from '../LinkPicker';
import { Popover } from '../Popover';

/** Toolbar link dialog: a LinkPicker (pick a page or type a web address) plus "Remove link". */
export function LinkPopover({
  editor,
  open,
  anchorRef,
  onClose,
}: {
  editor: Editor;
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  onClose: () => void;
}) {
  const current = (editor.getAttributes('link').href as string | undefined) ?? '';

  const insertLink = (href: string, text: string) => {
    editor
      .chain()
      .focus()
      .insertContent({ type: 'text', text, marks: [{ type: 'link', attrs: { href } }] })
      .run();
  };

  const apply = (href: string, target?: LinkTarget | null) => {
    if (!href) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      onClose();
      return;
    }
    if (editor.state.selection.empty && !editor.isActive('link')) {
      // Nothing selected: insert the target's name ("Privacy Policy", "Sofas") as the link text, never a raw path.
      // Typed web addresses, e-mail and phone links use the address itself.
      const plain = href.replace(/^https?:\/\//i, '').replace(/^mailto:|^tel:/i, '').replace(/\/$/, '');
      if (target && !target.missing && target.kind !== 'external') insertLink(href, target.label);
      else if (href.startsWith('/')) {
        // a store address typed by hand: look up its name
        const { from } = editor.state.selection;
        void resolveLinkTargetsAction([href])
          .then((map) => map[href])
          .catch(() => undefined)
          .then((t) => {
            editor.commands.setTextSelection(Math.min(from, editor.state.doc.content.size));
            insertLink(href, t && !t.missing && t.kind !== 'external' ? t.label : 'this page');
          });
      } else insertLink(href, plain);
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
    }
    onClose();
  };

  return (
    <Popover open={open} anchorRef={anchorRef} onClose={onClose} title={current ? 'Edit link' : 'Add a link'} width={380} testId="editor-link-popover">
      <p className="mb-2 text-xs text-gray-500">
        Select the words to turn into a link, then choose where they lead. With nothing selected, the name of the page you pick is added as the link.
      </p>
      <LinkPicker value={current} onChange={apply} allowEmpty={false} />
      {current && (
        <button
          type="button"
          onClick={() => {
            editor.chain().focus().extendMarkRange('link').unsetLink().run();
            onClose();
          }}
          className="mt-3 inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-red-200 text-sm font-semibold text-red-600 hover:bg-red-50"
        >
          Remove link
        </button>
      )}
    </Popover>
  );
}
