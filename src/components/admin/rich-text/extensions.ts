import { Mark } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { TextAlign } from '@tiptap/extension-text-align';
import { Color, TextStyle } from '@tiptap/extension-text-style';
import { Image } from '@tiptap/extension-image';
import { Youtube } from '@tiptap/extension-youtube';

// Schema-only marks (no toolbar button): existing <sup>/<sub> (e.g. "19<sup>th</sup> June") survive editing.
const Superscript = Mark.create({
  name: 'superscript',
  excludes: 'subscript',
  parseHTML: () => [{ tag: 'sup' }, { style: 'vertical-align', getAttrs: (v) => (v === 'super' ? null : false) }],
  renderHTML: () => ['sup', 0],
});
const Subscript = Mark.create({
  name: 'subscript',
  excludes: 'superscript',
  parseHTML: () => [{ tag: 'sub' }, { style: 'vertical-align', getAttrs: (v) => (v === 'sub' ? null : false) }],
  renderHTML: () => ['sub', 0],
});

/**
 * Editor schema. All six heading levels and `justify` are in the schema so existing content survives a
 * load + save unchanged; the toolbar only creates h2/h3 and left/center/right (decision 14).
 */
export function richTextExtensions() {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3, 4, 5, 6] },
      code: false,
      codeBlock: false,
      blockquote: false,
      horizontalRule: false,
      strike: false,
      // no forced target/rel: the sanitiser adds target=_blank + rel only for links to other sites
      link: { openOnClick: false, autolink: true, defaultProtocol: 'https', HTMLAttributes: { target: null, rel: null } },
    }),
    TextAlign.configure({ types: ['heading', 'paragraph'], alignments: ['left', 'center', 'right', 'justify'] }),
    TextStyle,
    Color,
    Superscript,
    Subscript,
    // Image and YouTube stay in the schema even when their buttons are hidden, so existing content survives.
    Image.configure({ inline: false }),
    Youtube.configure({ nocookie: true, width: 640, height: 360 }),
  ];
}

/** Store teal, terracotta, red, gold, grey, black, green ("Default" = no colour). */
export const TEXT_COLORS: { name: string; hex: string }[] = [
  { name: 'Store teal', hex: '#103a3a' },
  { name: 'Terracotta', hex: '#c25b41' },
  { name: 'Red', hex: '#ae2828' },
  { name: 'Gold', hex: '#a19a7e' },
  { name: 'Grey', hex: '#7b7b7b' },
  { name: 'Black', hex: '#000000' },
  { name: 'Green', hex: '#21b259' },
];

/** YouTube video id from a watch / youtu.be / shorts / embed link, else null. */
export function youtubeId(input: string): string | null {
  const s = input.trim();
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www|m)\./, '');
  let id: string | null = null;
  if (host === 'youtu.be') id = url.pathname.slice(1).split('/')[0];
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (url.pathname === '/watch') id = url.searchParams.get('v');
    else {
      const m = url.pathname.match(/^\/(?:shorts|embed|live)\/([^/?#]+)/);
      id = m?.[1] ?? null;
    }
  }
  return id && /^[A-Za-z0-9_-]{6,20}$/.test(id) ? id : null;
}
