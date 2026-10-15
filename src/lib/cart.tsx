'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type CartItem = {
  key: string; // `${productId}:${variantId}`
  productId: number;
  variantId: number;
  handle: string;
  title: string;
  variantTitle: string;
  price: number;
  compareAtPrice: number | null;
  image: string;
  qty: number;
};

type CartContextValue = {
  items: CartItem[];
  count: number;
  subtotal: number;
  savings: number;
  hydrated: boolean;
  /** Adds (or increments) a line. Opens the cart drawer like the live site unless `opts.openDrawer === false`. */
  addItem: (item: Omit<CartItem, 'key' | 'qty'>, qty?: number, opts?: { openDrawer?: boolean }) => void;
  setQty: (key: string, qty: number) => void;
  removeItem: (key: string) => void;
  clear: () => void;
  /** Cart drawer (side panel) state — mounted once by the store layout. */
  drawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = 'iw-cart-v1';

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setItems(parsed);
      }
    } catch {
      // ignore corrupt cart
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items, hydrated]);

  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  const addItem = useCallback((item: Omit<CartItem, 'key' | 'qty'>, qty = 1, opts?: { openDrawer?: boolean }) => {
    const key = `${item.productId}:${item.variantId}`;
    if (opts?.openDrawer !== false) setDrawerOpen(true);
    setItems((prev) => {
      const existing = prev.find((i) => i.key === key);
      if (existing) return prev.map((i) => (i.key === key ? { ...i, qty: Math.min(99, i.qty + qty) } : i));
      return [...prev, { ...item, key, qty }];
    });
  }, []);

  const setQty = useCallback((key: string, qty: number) => {
    setItems((prev) =>
      qty <= 0 ? prev.filter((i) => i.key !== key) : prev.map((i) => (i.key === key ? { ...i, qty: Math.min(99, qty) } : i)),
    );
  }, []);

  const removeItem = useCallback((key: string) => setItems((prev) => prev.filter((i) => i.key !== key)), []);
  const clear = useCallback(() => setItems([]), []);

  const value = useMemo<CartContextValue>(() => {
    const count = items.reduce((s, i) => s + i.qty, 0);
    const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
    const savings = items.reduce(
      (s, i) => s + (i.compareAtPrice && i.compareAtPrice > i.price ? (i.compareAtPrice - i.price) * i.qty : 0),
      0,
    );
    return { items, count, subtotal, savings, hydrated, addItem, setQty, removeItem, clear, drawerOpen, openDrawer, closeDrawer };
  }, [items, hydrated, addItem, setQty, removeItem, clear, drawerOpen, openDrawer, closeDrawer]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
