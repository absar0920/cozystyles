'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useCart } from '@/lib/cart';
import { EmptyCartIcon, MinusIcon, PlusIcon, ThemeTrashIcon } from '@/components/icons';
import { Price, formatRs } from '@/components/ui/Price';
import { cartRecommendations, type PredictiveProduct } from '@/components/layout/actions';

const NOTE_KEY = 'iw-cart-note';

/**
 * Live side cart (`#Cart-Drawer`): slides in from the right over a blurred grey overlay.
 * Opened by the header cart icon and after every addItem (see useCart().openDrawer).
 */
export function CartDrawer() {
  const { items, subtotal, hydrated, drawerOpen, closeDrawer, setQty, removeItem } = useCart();
  const pathname = usePathname();
  const [recs, setRecs] = useState<PredictiveProduct[]>([]);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState('');

  // close when the route changes (e.g. Buy Now → /checkout, VIEW CART)
  useEffect(() => {
    closeDrawer();
  }, [pathname, closeDrawer]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeDrawer();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [drawerOpen, closeDrawer]);

  useEffect(() => {
    try {
      setNote(localStorage.getItem(NOTE_KEY) ?? '');
    } catch {
      /* ignore */
    }
  }, []);

  const idsKey = items.map((i) => i.productId).join(',');
  useEffect(() => {
    if (!drawerOpen || !idsKey) {
      if (!idsKey) setRecs([]);
      return;
    }
    let cancelled = false;
    cartRecommendations(idsKey.split(',').map(Number))
      .then((r) => !cancelled && setRecs(r))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [drawerOpen, idsKey]);

  const empty = hydrated && items.length === 0;

  return (
    <>
      <div
        className={`click-capture fixed inset-0 z-[10000] transition-opacity duration-[250ms] ease-theme ${drawerOpen ? 'visible opacity-100' : 'invisible opacity-0'}`}
        onClick={closeDrawer}
        aria-hidden
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Cart"
        aria-hidden={!drawerOpen}
        className={`fixed bottom-0 right-0 top-0 z-[10001] flex w-[calc(100vw-30px)] max-w-[600px] flex-col overflow-y-auto bg-white text-accent transition-[transform,visibility] duration-[250ms] ease-theme ${
          drawerOpen ? 'visible translate-x-0' : 'invisible translate-x-full'
        }`}
      >
        {/* header */}
        <div className="sticky top-0 z-[2] bg-white px-5 pt-5 md:px-10 md:pt-10">
          <div className="mb-[15px] flex items-end justify-between border-b border-line pb-5 md:mb-[30px]">
            <h4 className="m-0 text-[28px] font-semibold leading-none text-accent md:text-[30px]">Cart</h4>
            <button type="button" onClick={closeDrawer} className="text-[13px] font-medium leading-none text-accent hover:text-accent2">
              Close
            </button>
          </div>
        </div>

        {empty ? (
          <div className="flex flex-1 flex-col items-center justify-center px-5 pb-5 text-center md:px-10 md:pb-10">
            <EmptyCartIcon className="mb-[45px] text-accent" />
            <p className="mb-5 text-[17px] leading-[1.7] text-accent">Your cart is currently empty.</p>
            <Link href="/search" onClick={closeDrawer} className="btn-accent2">
              <span>Start Shopping</span>
            </Link>
          </div>
        ) : (
          <>
            <div className="flex flex-1 flex-col px-5 md:px-10">
              <ul>
                {items.map((item) => (
                  <li key={item.key} className="mb-[30px] flex items-start md:items-center">
                    <Link href={`/products/${item.handle}`} onClick={closeDrawer} className="mr-[15px] block h-[57px] w-[75px] shrink-0 md:mr-[30px] md:h-[76px] md:w-[100px]">
                      {item.image && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.image} alt={item.title} className="h-full w-full object-contain" />
                      )}
                    </Link>
                    <div className="min-w-0 flex-1">
                      <Link href={`/products/${item.handle}`} onClick={closeDrawer} className="block text-[15px] font-normal leading-[1.4] text-accent hover:text-accent2">
                        {item.title}
                      </Link>
                      <Price price={item.price} className="block leading-[12.6px] md:leading-[24.5px]" />
                      {item.variantTitle && <div className="mt-[5px] text-[12px] leading-[1.4] text-accent">{item.variantTitle}</div>}
                      <div className="mt-[11px] flex items-center md:mt-2">
                        <div className="qty h-[30px] w-[77px] px-[25px]">
                          <button type="button" aria-label="Decrease quantity" onClick={() => setQty(item.key, item.qty - 1)}>
                            <MinusIcon className="h-2.5 w-2.5" />
                          </button>
                          <input
                            type="number"
                            min={0}
                            value={item.qty}
                            aria-label="Quantity"
                            onChange={(e) => setQty(item.key, Math.max(0, Number(e.target.value) || 0))}
                          />
                          <button type="button" aria-label="Increase quantity" onClick={() => setQty(item.key, item.qty + 1)}>
                            <PlusIcon className="h-2.5 w-2.5" />
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeItem(item.key)}
                          aria-label={`Remove ${item.title}`}
                          className="ml-5 text-[#e02b27] hover:opacity-70"
                        >
                          <ThemeTrashIcon />
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>

              {recs.length > 0 && (
                <div className="mt-auto border-t border-line pb-[30px] pt-[25px]">
                  <p className="mb-5 text-[12px] font-semibold uppercase leading-none tracking-btn text-accent">You may also like</p>
                  <div className="no-scrollbar -mx-5 flex gap-5 overflow-x-auto px-5 md:-mx-10 md:px-10">
                    {recs.map((p) => (
                      <Link
                        key={p.handle}
                        href={`/products/${p.handle}`}
                        onClick={closeDrawer}
                        className="group flex w-[215px] shrink-0 items-start"
                      >
                        <span className="mr-3 block h-[57px] w-[75px] shrink-0 md:h-[76px] md:w-[100px]">
                          {p.image && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={p.image} alt="" loading="lazy" className="h-full w-full object-contain" />
                          )}
                        </span>
                        <span className="min-w-0">
                          <span className="line-clamp-2 block text-[13px] leading-[1.4] text-accent group-hover:text-accent2">{p.title}</span>
                          <span className="block text-[12px] font-medium leading-[13.2px] tracking-[.24px] text-accent md:leading-[21px]">{formatRs(p.price)}</span>
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* footer */}
            <div className="relative bg-panel p-5 md:px-10 md:py-[30px]">
              <div className="mb-5 text-right">
                <button
                  type="button"
                  onClick={() => setNoteOpen(true)}
                  className="text-[12px] font-medium uppercase leading-none text-accent underline underline-offset-2 hover:text-accent2"
                >
                  {note ? 'Edit order note' : 'Add order note'}
                </button>
              </div>
              <div className="flex items-start justify-between text-[15px] leading-[26.25px] text-accent">
                <div className="min-w-0 flex-1 pr-5 md:max-w-[297px] md:pr-0">
                  <div>Subtotal</div>
                  <p className="m-0 mt-[5px] text-[12px] leading-[20.4px] text-accent">Installations and shipping calculated at checkout</p>
                </div>
                <span className="font-medium">{formatRs(subtotal)}</span>
              </div>
              <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <Link href="/cart" onClick={closeDrawer} className="btn-outline">
                  <span>View cart</span>
                </Link>
                <Link href="/checkout" onClick={closeDrawer} className="btn">
                  <span>Checkout</span>
                </Link>
              </div>

              {/* order note slide-up */}
              <div
                className={`absolute inset-x-0 bottom-0 bg-panel p-5 md:px-10 md:py-[30px] shadow-[0_-10px_15px_rgba(0,0,0,.05)] transition-[transform,visibility] duration-[250ms] ease-theme ${
                  noteOpen ? 'visible translate-y-0' : 'invisible translate-y-full'
                }`}
              >
                <label htmlFor="cart-note" className="mb-5 block text-[12px] font-medium uppercase leading-[21px] tracking-[.24px] text-accent">
                  Add order note
                </label>
                <textarea
                  id="cart-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="input mb-5 !min-h-[110px] bg-white"
                />
                <button
                  type="button"
                  className="btn btn-full"
                  onClick={() => {
                    try {
                      localStorage.setItem(NOTE_KEY, note);
                    } catch {
                      /* ignore */
                    }
                    setNoteOpen(false);
                  }}
                >
                  <span>Save</span>
                </button>
              </div>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
