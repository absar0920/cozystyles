/**
 * /pages/berlin assets (live "Berlin Executive Series" landing page). DB-free and idempotent:
 *
 *   npx tsx scripts/fidelity/berlin.ts
 *
 * Downloads into public/ whatever is missing (src/components/pages/BerlinPage.tsx renders them):
 *  - images/berlin/{n}.{ext}: the 7 product renders the live 3D-viewer thumbnails use (1000px wide).
 *    Live streams 30 MB+ GLB models per product; we show these renders in the same viewer box instead.
 *  - videos/berlin/hero.mp4 and slide-{1,2,3}.mp4: unchanged live files (frames checked: no logo).
 *  - videos/berlin/evolution.mp4: the live 1080p film carries the old brand's leaf watermark bottom-left
 *    and ends on its wordmark card, so it is re-encoded with ffmpeg (required for this one file):
 *    trimmed to 41.8 s (before the end card), `delogo` over the watermark, scaled to 1280 px, no audio.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../..');
const IMG = path.join(ROOT, 'public', 'images', 'berlin');
const VID = path.join(ROOT, 'public', 'videos', 'berlin');

export const RENDERS = [
  'Berlin_Desk_01.png?v=1754301208',
  'Berlin_SideRack_6b254ff0-39f5-45fe-b31a-76832cf1c870.webp?v=1754302381',
  'Berlin_Credenza_6c496bf8-b3b9-44f4-b8f9-eef46659f99b.webp?v=1754302381',
  'Berlin_Side_Table.webp?v=1754302381',
  'Berlin_Center_Table.webp?v=1754302381',
  'Berlin_Sofa_1S_defbaceb-7ccf-41c4-add2-68daeae48d60.webp?v=1754302381',
  'Berlin_Sofa_3S_a31f99d1-9f90-4eb5-9798-200674eeebb0.webp?v=1754302380',
];

const VIDEOS: Record<string, string> = {
  'hero.mp4':
    'https://interwood.pk/cdn/shop/videos/c/vp/4347f4fcec7d407394f4055a73803405/4347f4fcec7d407394f4055a73803405.HD-720p-4.5Mbps-55481978.mp4',
  'slide-1.mp4': 'https://cdn.shopify.com/videos/c/o/v/50f5b74d2e0f4677bbd994288c0fe2a3.mp4',
  'slide-2.mp4': 'https://cdn.shopify.com/videos/c/o/v/a06ebba53633443ab8429a916c41c727.mp4',
  'slide-3.mp4': 'https://cdn.shopify.com/videos/c/o/v/2e2303bce1a045218732b2862bb6af3f.mp4',
};
const EVOLUTION_SRC =
  'https://interwood.pk/cdn/shop/videos/c/vp/62a23d67cef54b579e88cf3933cd6058/62a23d67cef54b579e88cf3933cd6058.HD-1080p-4.8Mbps-56419933.mp4';

async function download(url: string, file: string) {
  if (existsSync(file)) return;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  console.log('downloaded', path.relative(ROOT, file));
}

async function main() {
  mkdirSync(IMG, { recursive: true });
  mkdirSync(VID, { recursive: true });
  for (const [i, f] of RENDERS.entries()) {
    const ext = path.extname(f.split('?')[0]);
    await download(`https://interwood.pk/cdn/shop/files/${f}&width=1000`, path.join(IMG, `${i + 1}${ext}`));
  }
  for (const [name, url] of Object.entries(VIDEOS)) await download(url, path.join(VID, name));

  const evo = path.join(VID, 'evolution.mp4');
  if (!existsSync(evo)) {
    const tmp = path.join(os.tmpdir(), 'berlin-evolution-src.mp4');
    await download(EVOLUTION_SRC, tmp);
    execFileSync('ffmpeg', [
      '-v', 'error', '-y', '-i', tmp, '-t', '41.8', '-an',
      '-vf', 'delogo=x=86:y=930:w=106:h=104,scale=1280:-2',
      '-c:v', 'libx264', '-crf', '27', '-preset', 'slow', '-movflags', '+faststart', '-pix_fmt', 'yuv420p', evo,
    ]);
    rmSync(tmp, { force: true });
    console.log('encoded', path.relative(ROOT, evo));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
