'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ComponentType } from 'react';
import { LogoutButton } from './LogoutButton';
import {
  CheckIcon,
  CubeIcon,
  EditIcon,
  FilterIcon,
  HeartIcon,
  MailIcon,
  MenuIcon,
  PackageIcon,
  StarIcon,
  TruckIcon,
  UserIcon,
  XIcon,
} from '@/components/icons';

type NavItem = {
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  badge?: 'pendingOrders' | 'newMessages';
  badgeStyle?: string;
};

const NAV: NavItem[] = [
  { label: 'Dashboard', href: '/admin', icon: CubeIcon },
  { label: 'Orders', href: '/admin/orders', icon: PackageIcon, badge: 'pendingOrders', badgeStyle: 'bg-amber-400 text-brand-950' },
  { label: 'Products', href: '/admin/products', icon: TruckIcon },
  { label: 'Collections', href: '/admin/collections', icon: CheckIcon },
  { label: 'Reviews', href: '/admin/reviews', icon: StarIcon },
  { label: 'Banners', href: '/admin/banners', icon: HeartIcon },
  { label: 'Menus', href: '/admin/menus', icon: FilterIcon },
  { label: 'Pages', href: '/admin/pages', icon: EditIcon },
  { label: 'Messages', href: '/admin/messages', icon: MailIcon, badge: 'newMessages', badgeStyle: 'bg-red-500 text-white' },
  { label: 'Settings', href: '/admin/settings', icon: UserIcon },
];

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
}

export function Sidebar({
  adminName,
  adminEmail,
  pendingOrders = 0,
  newMessages = 0,
}: {
  adminName: string;
  adminEmail: string;
  pendingOrders?: number;
  newMessages?: number;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) =>
    href === '/admin' ? pathname === '/admin' : pathname === href || pathname.startsWith(`${href}/`);

  const badgeValue = (item: NavItem) =>
    item.badge === 'pendingOrders' ? pendingOrders : item.badge === 'newMessages' ? newMessages : 0;

  const navLinks = (onNavigate?: () => void) => (
    <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
      {NAV.map((item) => {
        const active = isActive(item.href);
        const badge = badgeValue(item);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
              active
                ? 'bg-white/10 text-white shadow-[inset_2px_0_0_0_#3ea08d]'
                : 'text-white/60 hover:bg-white/5 hover:text-white'
            }`}
          >
            <Icon className={`h-[18px] w-[18px] shrink-0 ${active ? 'text-brand-300' : 'text-white/40 group-hover:text-white/80'}`} />
            <span className="truncate">{item.label}</span>
            {badge > 0 && (
              <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold leading-none ${item.badgeStyle}`}>
                {badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );

  const adminBlock = (compact = false) => (
    <div className={`border-t border-white/10 ${compact ? 'p-4' : 'p-4'}`}>
      <div className="mb-3 flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-500 font-heading text-xs font-bold text-white">
          {initials(adminName)}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-white">{adminName}</span>
          <span className="block truncate text-xs text-white/40">{adminEmail}</span>
        </span>
      </div>
      <LogoutButton />
    </div>
  );

  return (
    <>
      {/* ---------- Desktop sidebar ---------- */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-brand-900 lg:flex">
        <div className="flex h-16 shrink-0 items-center border-b border-white/10 px-6">
          <Link href="/admin" className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/logo.png" alt="Interwood" className="h-7 w-auto brightness-0 invert" width={120} height={28} />
            <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white/70">
              Admin
            </span>
          </Link>
        </div>
        {navLinks()}
        {adminBlock()}
      </aside>

      {/* ---------- Mobile top bar ---------- */}
      <header className="fixed inset-x-0 top-0 z-30 flex h-16 items-center justify-between border-b border-white/10 bg-brand-900 px-4 lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open admin menu"
          className="flex h-10 w-10 items-center justify-center rounded-lg text-white hover:bg-white/10"
        >
          <MenuIcon className="h-5 w-5" />
        </button>
        <Link href="/admin" className="flex items-center gap-2" onClick={() => setOpen(false)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/logo.png" alt="Interwood" className="h-6 w-auto brightness-0 invert" width={110} height={24} />
          <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white/70">
            Admin
          </span>
        </Link>
        <Link
          href="/"
          className="rounded-lg px-2 py-1.5 text-xs font-semibold text-white/60 hover:text-white"
          target="_blank"
          rel="noreferrer"
        >
          Storefront
        </Link>
      </header>

      {/* ---------- Mobile drawer ---------- */}
      <div
        className={`fixed inset-0 z-40 bg-black/60 transition-opacity duration-200 lg:hidden ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={() => setOpen(false)}
        aria-hidden
      />
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] -translate-x-full flex-col bg-brand-900 transition-transform duration-200 ease-out lg:hidden ${
          open ? 'translate-x-0' : ''
        }`}
        aria-label="Admin navigation"
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-white/10 px-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/logo.png" alt="Interwood" className="h-6 w-auto brightness-0 invert" width={110} height={24} />
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>
        {navLinks(() => setOpen(false))}
        {adminBlock(true)}
      </aside>
    </>
  );
}
