/** Cozy Furnitures brand mark: rounded sofa glyph + wordmark. */
export function Logo({
  variant = 'dark',
  size = 'md',
  withTagline = false,
  className = '',
}: {
  variant?: 'dark' | 'light';
  size?: 'sm' | 'md' | 'lg';
  light?: boolean;
  withTagline?: boolean;
  className?: string;
}) {
  const text = variant === 'light' ? 'text-white' : 'text-ink-dark';
  const sub = variant === 'light' ? 'text-white/70' : 'text-ink-muted';
  const dims = { sm: { glyph: 26, title: 'text-lg', sub: 'text-[9px]' }, md: { glyph: 34, title: 'text-[23px]', sub: 'text-[10.5px]' }, lg: { glyph: 44, title: 'text-[30px]', sub: 'text-xs' } }[size];

  return (
    <span className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      <SofaGlyph className="shrink-0" width={dims.glyph} height={dims.glyph} />
      <span className="flex flex-col leading-none">
        <span className={`font-heading font-extrabold tracking-tight ${dims.title} ${text}`}>
          Cozy<span className="text-brand"> Furnitures</span>
        </span>
        {withTagline && <span className={`mt-1 font-semibold uppercase tracking-[0.28em] ${dims.sub} ${sub}`}>Comfort for every home</span>}
      </span>
    </span>
  );
}

export function SofaGlyph({ className = '', ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden {...props}>
      <rect x="4" y="8" width="6.5" height="6.5" rx="2.6" fill="#0d6f61" />
      <rect x="37.5" y="8" width="6.5" height="6.5" rx="2.6" fill="#0d6f61" />
      <path d="M10.5 8h27a4 4 0 0 1 4 4v10h-35V12a4 4 0 0 1 4-4z" fill="#108474" />
      <rect x="6.5" y="14" width="35" height="12" rx="4" fill="#3ea08d" />
      <rect x="4" y="22" width="40" height="12" rx="5" fill="#108474" />
      <rect x="6.5" y="30" width="8" height="6.5" rx="2.5" fill="#0a594e" />
      <rect x="33.5" y="30" width="8" height="6.5" rx="2.5" fill="#0a594e" />
      <rect x="13" y="24" width="22" height="4" rx="2" fill="#6fbfae" />
    </svg>
  );
}
