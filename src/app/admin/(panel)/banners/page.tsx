import type { Metadata } from 'next';
import type { Banner as BannerModel } from '@prisma/client';
import { prisma } from '@/lib/db';
import { saveBannerAction, toggleBannerAction, deleteBannerAction } from '@/app/admin/actions/content';
import { AdminCard, AdminPageHeader, Field, Select, TextInput } from '@/components/admin/ui';
import { SubmitButton } from '@/components/admin/SubmitButton';
import { PlusIcon } from '@/components/icons';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Banners',
  robots: { index: false, follow: false },
};

const BANNER_LOCATIONS = [
  { value: 'HOME_HERO', label: 'Home — Hero slider', hint: 'Large rotating hero banner. Desktop 1200×462, mobile 450×700.' },
  { value: 'HOME_STRIP_1', label: 'Home — Promo strip 1', hint: 'First promotional strip below the hero.' },
  { value: 'HOME_STRIP_2', label: 'Home — Promo strip 2', hint: 'Second promotional strip below the hero.' },
  { value: 'HOME_GRID', label: 'Home — Grid tiles', hint: 'Small tiles in the category/lookbook grid.' },
  { value: 'POPUP', label: 'Site popup', hint: 'Promotional popup shown over the storefront.' },
] as const;

const locationLabel = (value: string) => BANNER_LOCATIONS.find((l) => l.value === value)?.label ?? value;

const ghostBtn =
  'inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:bg-gray-50';

type BannerRow = BannerModel;

export default async function BannersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const saved = sp.saved === '1';
  const deletedFlag = sp.deleted === '1';
  const requested =
    typeof sp.location === 'string' && BANNER_LOCATIONS.some((l) => l.value === sp.location) ? sp.location : 'HOME_HERO';

  const banners = await prisma.banner.findMany({ orderBy: [{ location: 'asc' }, { position: 'asc' }, { id: 'asc' }] });
  const nextPosition = (location: string) =>
    banners.filter((b) => b.location === location).reduce((max, b) => Math.max(max, b.position), -1) + 1;

  return (
    <div>
      <AdminPageHeader
        title="Banners"
        subtitle="Hero slides, promo strips, grid tiles and popups rendered on the storefront"
      />

      {(saved || deletedFlag) && (
        <div
          className={`mb-4 rounded-lg border px-4 py-3 text-sm font-medium ${
            saved ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'
          }`}
        >
          {saved ? 'Banner saved. Storefront updated.' : 'Banner deleted.'}
        </div>
      )}

      {/* ---------------------------------------------------------- add banner */}
      <div className="mb-8">
        <AdminCard title="Add a banner">
          <BannerForm key={`add-${requested}`} locationDefault={requested} positionDefault={nextPosition(requested)} />
        </AdminCard>
      </div>

      {/* ------------------------------------------------------- banner groups */}
      <div className="space-y-10">
        {BANNER_LOCATIONS.map((loc) => {
          const group = banners.filter((b) => b.location === loc.value);
          return (
            <section key={loc.value}>
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-heading text-base font-bold text-ink-dark">
                  {loc.label}
                  <span className="ml-2 rounded-full bg-gray-200 px-2 py-0.5 text-[11px] font-semibold text-gray-600">
                    {group.length}
                  </span>
                </h2>
                <p className="text-xs text-gray-400">{loc.hint}</p>
              </div>

              {group.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-300 bg-white/60 px-6 py-8 text-center text-sm text-gray-400">
                  No banners in this location yet — use the form above to add one.
                </div>
              ) : (
                <div className="space-y-4">
                  {group.map((banner) => (
                    <BannerCard key={banner.id} banner={banner} />
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- banner card */

function BannerCard({ banner }: { banner: BannerRow }) {
  return (
    <section id={`banner-${banner.id}`} className="scroll-mt-24">
      <AdminCard>
        <div className="space-y-5">
          {/* Previews + row actions */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <figure className="w-56">
                <div className="aspect-[1200/462] w-full overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                  {banner.image ? (
                    <img src={banner.image} alt="" width={224} height={86} className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-[11px] text-gray-300">No image</span>
                  )}
                </div>
                <figcaption className="mt-1 text-[11px] text-gray-400">Desktop · 1200×462</figcaption>
              </figure>
              <figure className="w-24">
                <div className="aspect-[450/700] w-full overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                  {banner.mobileImage ? (
                    <img src={banner.mobileImage} alt="" width={96} height={150} className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center p-1 text-center text-[10px] leading-tight text-gray-300">
                      Falls back to desktop
                    </span>
                  )}
                </div>
                <figcaption className="mt-1 text-[11px] text-gray-400">Mobile · 450×700</figcaption>
              </figure>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                  banner.active ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-500'
                }`}
              >
                {banner.active ? 'Active' : 'Inactive'}
              </span>
              <form action={toggleBannerAction}>
                <input type="hidden" name="id" value={banner.id} />
                <button type="submit" className={ghostBtn}>
                  {banner.active ? 'Deactivate' : 'Activate'}
                </button>
              </form>
              <details className="relative inline-block text-left">
                <summary className="inline-flex cursor-pointer select-none items-center rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50 [&::-webkit-details-marker]:hidden">
                  Delete
                </summary>
                <div className="absolute right-0 z-10 mt-2 w-64 rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
                  <p className="text-xs text-gray-500">
                    Permanently delete this {locationLabel(banner.location)} banner? This cannot be undone.
                  </p>
                  <form action={deleteBannerAction} className="mt-2">
                    <input type="hidden" name="id" value={banner.id} />
                    <button
                      type="submit"
                      className="w-full rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700"
                    >
                      Yes, delete permanently
                    </button>
                  </form>
                </div>
              </details>
            </div>
          </div>

          <BannerForm banner={banner} locationDefault={banner.location} positionDefault={banner.position} />
        </div>
      </AdminCard>
    </section>
  );
}

/* ---------------------------------------------------------------- banner form */

function BannerForm({
  banner,
  locationDefault,
  positionDefault,
}: {
  banner?: BannerRow;
  locationDefault: string;
  positionDefault: number;
}) {
  const isEdit = banner != null;
  return (
    <form action={saveBannerAction} className="space-y-4">
      {isEdit && <input type="hidden" name="id" value={banner.id} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="Headline" hint="Big text shown over the banner image.">
            <TextInput name="title" defaultValue={banner?.title ?? ''} placeholder="Wedding Season Sale" />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Subtitle">
            <TextInput name="subtitle" defaultValue={banner?.subtitle ?? ''} placeholder="Up to 40% off — complete packages for your new home" />
          </Field>
        </div>
        <Field label="CTA label" hint="Button text. Leave empty to hide the button.">
          <TextInput name="ctaLabel" defaultValue={banner?.ctaLabel ?? ''} placeholder="Shop Wedding Packages" />
        </Field>
        <Field label="CTA link" hint="Where the CTA (and the banner) points, e.g. /collections/sofas">
          <TextInput name="href" defaultValue={banner?.href ?? ''} placeholder="/collections/all" />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Desktop image URL" hint="Local path (e.g. /images/banners/home-02.webp) or a full https:// URL. Required.">
            <TextInput name="image" defaultValue={banner?.image ?? ''} placeholder="/images/banners/home-02.webp" required />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Mobile image URL" hint="Portrait 450×700. Optional — desktop image is used when empty.">
            <TextInput name="mobileImage" defaultValue={banner?.mobileImage ?? ''} placeholder="/images/banners/home-03.webp" />
          </Field>
        </div>
        <Field label="Location">
          <Select name="location" defaultValue={locationDefault}>
            {BANNER_LOCATIONS.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Position" hint="Lower numbers show first within the location.">
          <TextInput name="position" type="number" defaultValue={banner?.position ?? positionDefault} />
        </Field>
        <Field label="Text colour" hint="Used for headline/subtitle/CTA text.">
          <span className="flex items-center gap-2">
            <input
              type="color"
              name="textColor"
              defaultValue={banner?.textColor ?? '#ffffff'}
              className="h-10 w-14 cursor-pointer rounded-lg border border-gray-300 bg-white p-1"
            />
            <span className="text-xs text-gray-400">{banner?.textColor ?? '#ffffff'}</span>
          </span>
        </Field>
        <Field label="Overlay" hint="Dark overlay (0–90%) behind the text for readability.">
          <TextInput name="overlay" type="number" min={0} max={90} defaultValue={banner?.overlay ?? 20} />
        </Field>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4">
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            name="active"
            defaultChecked={banner?.active ?? true}
            className="h-4 w-4 rounded border-gray-300 accent-brand"
          />
          Active (visible on the storefront)
        </label>
        <SubmitButton>
          {isEdit ? (
            'Save banner'
          ) : (
            <>
              <PlusIcon className="h-4 w-4" /> Create banner
            </>
          )}
        </SubmitButton>
      </div>
    </form>
  );
}
