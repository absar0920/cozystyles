/** @type {import('next').NextConfig} */
const nextConfig = {
  images: { unoptimized: true },
  eslint: { ignoreDuringBuilds: true },
  // Native / WASM image libraries stay as plain Node requires (only src/lib/uploads.ts imports them).
  serverExternalPackages: ['sharp', 'heic-decode'],
  experimental: {
    serverActions: { bodySizeLimit: '10mb' },
  },
  async redirects() {
    return [
      { source: '/cart', destination: '/', permanent: false },
      { source: '/checkout', destination: '/', permanent: false },
      { source: '/checkout/:path*', destination: '/', permanent: false },
      // No customer accounts: old /account links (sign-in, orders…) go to the home page.
      { source: '/account', destination: '/', permanent: false },
      { source: '/account/:path*', destination: '/', permanent: false },
    ];
  },
};

export default nextConfig;
