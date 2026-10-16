/** Admin-only icons: inline SVG, `currentColor`, sized by className (default 1.25rem). */
type P = { className?: string };

const base = (className?: string) => ({
  className: className ?? 'h-5 w-5',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
});

export const GripIcon = ({ className }: P) => (
  <svg {...base(className)} stroke="none" fill="currentColor">
    <circle cx="9" cy="6" r="1.6" />
    <circle cx="15" cy="6" r="1.6" />
    <circle cx="9" cy="12" r="1.6" />
    <circle cx="15" cy="12" r="1.6" />
    <circle cx="9" cy="18" r="1.6" />
    <circle cx="15" cy="18" r="1.6" />
  </svg>
);
export const ArrowUpIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M12 19V5M5 12l7-7 7 7" />
  </svg>
);
export const ArrowDownIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M12 5v14M19 12l-7 7-7-7" />
  </svg>
);
export const ArrowLeftIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M19 12H5M12 19l-7-7 7-7" />
  </svg>
);
export const ArrowRightIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M5 12h14M12 5l7 7-7 7" />
  </svg>
);
export const UploadIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
  </svg>
);
export const ImageIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <path d="M21 15l-5-5L5 21" />
  </svg>
);
export const LinkIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);
export const ExternalLinkIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" />
  </svg>
);
export const CopyIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);
export const EyeIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
export const WarningIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <path d="M12 9v4M12 17h.01" />
  </svg>
);
export const BoldIcon = ({ className }: P) => (
  <svg {...base(className)} strokeWidth={2.5}>
    <path d="M6 4h8a4 4 0 0 1 0 8H6zM6 12h9a4 4 0 0 1 0 8H6z" />
  </svg>
);
export const ItalicIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M19 4h-9M14 20H5M15 4L9 20" />
  </svg>
);
export const UnderlineIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M6 3v7a6 6 0 0 0 12 0V3M4 21h16" />
  </svg>
);
export const H2Icon = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M4 6v12M12 6v12M4 12h8M16 10a2.5 2.5 0 1 1 4.2 1.8L16 18h5" />
  </svg>
);
export const H3Icon = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M4 6v12M12 6v12M4 12h8M16.5 8h4l-2.5 3.5a2.5 2.5 0 1 1-2 4" />
  </svg>
);
export const ListBulletIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M9 6h11M9 12h11M9 18h11" />
    <circle cx="4.5" cy="6" r="1" fill="currentColor" />
    <circle cx="4.5" cy="12" r="1" fill="currentColor" />
    <circle cx="4.5" cy="18" r="1" fill="currentColor" />
  </svg>
);
export const ListNumberIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M10 6h11M10 12h11M10 18h11M4 4h1v4M4 8h2M3.5 14.5a1.2 1.2 0 1 1 2 1L3.5 18H6" />
  </svg>
);
export const AlignLeftIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M3 6h18M3 10h12M3 14h18M3 18h12" />
  </svg>
);
export const AlignCenterIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M3 6h18M6 10h12M3 14h18M6 18h12" />
  </svg>
);
export const AlignRightIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M3 6h18M9 10h12M3 14h18M9 18h12" />
  </svg>
);
export const PaletteIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M12 3a9 9 0 0 0 0 18c1.1 0 1.7-.9 1.4-1.9-.3-.9.3-1.9 1.3-1.9H17a4 4 0 0 0 4-4c0-5.5-4-10.2-9-10.2z" />
    <circle cx="7.5" cy="11" r="1" fill="currentColor" />
    <circle cx="10" cy="7" r="1" fill="currentColor" />
    <circle cx="14.5" cy="7" r="1" fill="currentColor" />
  </svg>
);
export const YoutubeIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <rect x="2" y="5" width="20" height="14" rx="4" />
    <path d="M10 9l5 3-5 3z" fill="currentColor" />
  </svg>
);
export const UndoIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M3 7v6h6" />
    <path d="M3 13a9 9 0 1 0 3-7.7L3 8" />
  </svg>
);
export const RedoIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M21 7v6h-6" />
    <path d="M21 13a9 9 0 1 1-3-7.7L21 8" />
  </svg>
);
export const SearchIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4.3-4.3" />
  </svg>
);
export const CloseIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
);
export const TrashIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
  </svg>
);
export const ChatIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.6 8.6 0 0 1-4-1L3 20l1.2-4.4A8.4 8.4 0 1 1 21 11.5z" />
  </svg>
);
export const KeyIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <circle cx="7.5" cy="15.5" r="4.5" />
    <path d="M10.7 12.3L21 2M16 7l3 3M18 5l2 2" />
  </svg>
);
export const ImagesIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <rect x="2" y="6" width="16" height="14" rx="2" />
    <path d="M6 2h14a2 2 0 0 1 2 2v12M2 16l5-5 5 5" />
  </svg>
);
export const DocumentIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6M8 13h8M8 17h5" />
  </svg>
);
export const NewspaperIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M4 4h13v16H6a2 2 0 0 1-2-2zM17 8h3v10a2 2 0 0 1-2 2" />
    <path d="M8 8h5M8 12h5M8 16h3" />
  </svg>
);
