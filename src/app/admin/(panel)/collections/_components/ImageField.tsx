'use client';

import { ImageUpload } from '@/components/admin/ImageUpload';

/** Collection image: upload or paste a URL, with a live preview. */
export function ImageField({ initial = '' }: { initial?: string }) {
  return (
    <ImageUpload
      name="image"
      folder="collections"
      initial={initial}
      placeholder="/images/collections/living-room.jpg or https://…"
      hint="Upload a JPG, PNG or WebP (square works best, up to 15 MB), or paste an image URL. Leave blank for no image."
    />
  );
}
