'use client';

import { useEditorState, type Editor } from '@tiptap/react';
import { useRef, useState, type ReactNode } from 'react';
import { Popover } from '../Popover';
import { uploadImage } from '../upload-client';
import { ACCEPT_IMAGES } from '../upload-client';
import {
  AlignCenterIcon,
  AlignLeftIcon,
  AlignRightIcon,
  BoldIcon,
  H2Icon,
  H3Icon,
  ImageIcon,
  ItalicIcon,
  LinkIcon,
  ListBulletIcon,
  ListNumberIcon,
  PaletteIcon,
  RedoIcon,
  UnderlineIcon,
  UndoIcon,
  YoutubeIcon,
} from '../icons';
import { LinkPopover } from './LinkPopover';
import { TEXT_COLORS, youtubeId } from './extensions';

function Btn({
  label,
  active,
  disabled,
  onClick,
  children,
  btnRef,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
  btnRef?: React.Ref<HTMLButtonElement>;
}) {
  return (
    <button
      ref={btnRef}
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`inline-flex h-10 w-10 items-center justify-center rounded-lg transition disabled:opacity-30 ${
        active ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-200' : 'text-gray-600 hover:bg-gray-100 hover:text-ink-dark'
      }`}
    >
      {children}
    </button>
  );
}

const Sep = () => <span className="mx-0.5 hidden h-6 w-px self-center bg-gray-200 sm:block" aria-hidden />;

export function Toolbar({
  editor,
  images = true,
  youtube = true,
  onImageInserted,
}: {
  editor: Editor;
  images?: boolean;
  youtube?: boolean;
  onImageInserted?: (pos: number) => void;
}) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      h2: e.isActive('heading', { level: 2 }),
      h3: e.isActive('heading', { level: 3 }),
      bullet: e.isActive('bulletList'),
      ordered: e.isActive('orderedList'),
      link: e.isActive('link'),
      // justify (kept from old content) shows no active alignment
      left: e.isActive({ textAlign: 'left' }),
      center: e.isActive({ textAlign: 'center' }),
      right: e.isActive({ textAlign: 'right' }),
      color: (e.getAttributes('textStyle').color as string | undefined) ?? null,
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });
  const [linkOpen, setLinkOpen] = useState(false);
  const [colorOpen, setColorOpen] = useState(false);
  const [ytOpen, setYtOpen] = useState(false);
  const [ytUrl, setYtUrl] = useState('');
  const [ytError, setYtError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const linkRef = useRef<HTMLButtonElement>(null);
  const colorRef = useRef<HTMLButtonElement>(null);
  const ytRef = useRef<HTMLButtonElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const c = () => editor.chain().focus();

  const insertImage = async (file: File | undefined) => {
    if (!file) return;
    setUploadError(null);
    setUploading(0);
    try {
      const res = await uploadImage(file, 'editor', setUploading);
      const from = editor.state.selection.from;
      c().setImage({ src: res.url, alt: '' }).run();
      // Find the new image and put the cursor in the paragraph after it (never leave the photo selected:
      // the next keystroke would replace it). The "Describe the photo" bar is driven by onImageInserted.
      let imagePos = -1;
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === 'image' && node.attrs.src === res.url && (imagePos < 0 || Math.abs(pos - from) < Math.abs(imagePos - from))) imagePos = pos;
        return true;
      });
      if (imagePos >= 0) {
        const image = editor.state.doc.nodeAt(imagePos)!;
        const after = imagePos + image.nodeSize;
        const next = editor.state.doc.resolve(after).nodeAfter;
        if (next?.type.name === 'paragraph') editor.chain().focus().setTextSelection(after + 1).run();
        else editor.chain().focus().insertContentAt(after, { type: 'paragraph' }).setTextSelection(after + 1).run();
        onImageInserted?.(imagePos);
      }
    } catch (e) {
      setUploadError((e as Error).message);
    } finally {
      setUploading(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const addYoutube = () => {
    const id = youtubeId(ytUrl);
    if (!id) {
      setYtError("That doesn't look like a YouTube link");
      return;
    }
    c().setYoutubeVideo({ src: `https://www.youtube.com/watch?v=${id}` }).run();
    setYtOpen(false);
    setYtUrl('');
    setYtError(null);
  };

  return (
    <div className="sticky top-16 z-20 border-b border-gray-200 bg-gray-50 px-1.5 py-1 lg:top-0">
      <div role="toolbar" aria-label="Formatting" className="flex flex-wrap items-center gap-0.5">
        <Btn label="Bold" active={s.bold} onClick={() => c().toggleBold().run()}>
          <BoldIcon className="h-4 w-4" />
        </Btn>
        <Btn label="Italic" active={s.italic} onClick={() => c().toggleItalic().run()}>
          <ItalicIcon className="h-4 w-4" />
        </Btn>
        <Btn label="Underline" active={s.underline} onClick={() => c().toggleUnderline().run()}>
          <UnderlineIcon className="h-4 w-4" />
        </Btn>
        <Sep />
        <Btn label="Heading" active={s.h2} onClick={() => c().toggleHeading({ level: 2 }).run()}>
          <H2Icon className="h-4 w-4" />
        </Btn>
        <Btn label="Subheading" active={s.h3} onClick={() => c().toggleHeading({ level: 3 }).run()}>
          <H3Icon className="h-4 w-4" />
        </Btn>
        <Sep />
        <Btn label="Bullet list" active={s.bullet} onClick={() => c().toggleBulletList().run()}>
          <ListBulletIcon className="h-4 w-4" />
        </Btn>
        <Btn label="Numbered list" active={s.ordered} onClick={() => c().toggleOrderedList().run()}>
          <ListNumberIcon className="h-4 w-4" />
        </Btn>
        <Sep />
        <Btn label="Link" active={s.link} btnRef={linkRef} onClick={() => setLinkOpen((o) => !o)}>
          <LinkIcon className="h-4 w-4" />
        </Btn>
        <Sep />
        <Btn label="Align left" active={s.left} onClick={() => c().setTextAlign('left').run()}>
          <AlignLeftIcon className="h-4 w-4" />
        </Btn>
        <Btn label="Align center" active={s.center} onClick={() => c().setTextAlign('center').run()}>
          <AlignCenterIcon className="h-4 w-4" />
        </Btn>
        <Btn label="Align right" active={s.right} onClick={() => c().setTextAlign('right').run()}>
          <AlignRightIcon className="h-4 w-4" />
        </Btn>
        <Sep />
        <Btn label="Text colour" active={!!s.color} btnRef={colorRef} onClick={() => setColorOpen((o) => !o)}>
          <span className="relative">
            <PaletteIcon className="h-4 w-4" />
            <span className="absolute -bottom-1 left-0 right-0 h-0.5 rounded" style={{ background: s.color ?? 'transparent' }} />
          </span>
        </Btn>
        {images && (
          <Btn label="Add photo" disabled={uploading != null} onClick={() => fileRef.current?.click()}>
            <ImageIcon className="h-4 w-4" />
          </Btn>
        )}
        {youtube && (
          <Btn label="Add YouTube video" btnRef={ytRef} onClick={() => setYtOpen((o) => !o)}>
            <YoutubeIcon className="h-4 w-4" />
          </Btn>
        )}
        <Sep />
        <Btn label="Undo" disabled={!s.canUndo} onClick={() => c().undo().run()}>
          <UndoIcon className="h-4 w-4" />
        </Btn>
        <Btn label="Redo" disabled={!s.canRedo} onClick={() => c().redo().run()}>
          <RedoIcon className="h-4 w-4" />
        </Btn>
      </div>
      {uploading != null && <p className="px-1.5 pb-1 text-xs text-gray-600">Uploading photo… {uploading}%</p>}
      {uploadError && (
        <p role="alert" className="px-1.5 pb-1 text-xs font-medium text-red-600">
          {uploadError}
        </p>
      )}
      <input ref={fileRef} type="file" accept={ACCEPT_IMAGES} className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => void insertImage(e.target.files?.[0])} />

      <LinkPopover editor={editor} open={linkOpen} anchorRef={linkRef} onClose={() => setLinkOpen(false)} />

      <Popover open={colorOpen} anchorRef={colorRef} onClose={() => setColorOpen(false)} title="Text colour" width={260}>
        <div className="grid grid-cols-4 gap-1.5">
          <button
            type="button"
            onClick={() => {
              c().unsetColor().run();
              setColorOpen(false);
            }}
            className="flex min-h-11 flex-col items-center justify-center rounded-lg text-[10px] text-gray-600 hover:bg-gray-100"
          >
            <span className="h-6 w-6 rounded-full border-2 border-dashed border-gray-300" />
            Default
          </button>
          {TEXT_COLORS.map((col) => (
            <button
              key={col.hex}
              type="button"
              title={col.name}
              aria-label={col.name}
              onClick={() => {
                c().setColor(col.hex).run();
                setColorOpen(false);
              }}
              className={`flex min-h-11 flex-col items-center justify-center rounded-lg text-[10px] text-gray-600 hover:bg-gray-100 ${
                s.color?.toLowerCase() === col.hex ? 'ring-2 ring-brand-400' : ''
              }`}
            >
              <span className="h-6 w-6 rounded-full" style={{ background: col.hex }} />
              {col.name}
            </button>
          ))}
        </div>
      </Popover>

      <Popover open={ytOpen} anchorRef={ytRef} onClose={() => setYtOpen(false)} title="Add a YouTube video" width={360}>
        <label className="block text-xs font-semibold text-gray-600">
          Paste the YouTube link
          <input
            autoFocus
            value={ytUrl}
            onChange={(e) => {
              setYtUrl(e.target.value);
              setYtError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addYoutube();
              }
            }}
            placeholder="https://www.youtube.com/watch?v=…"
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm font-normal outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
        </label>
        {ytError && <p className="mt-1 text-xs font-medium text-red-600">{ytError}</p>}
        <button
          type="button"
          onClick={addYoutube}
          className="mt-3 inline-flex min-h-10 w-full items-center justify-center rounded-lg bg-brand text-sm font-semibold text-white hover:bg-brand-600"
        >
          Add video
        </button>
      </Popover>
    </div>
  );
}
