/** @type {import('next').NextConfig} */
const nextConfig = {
  images: { unoptimized: true },
  eslint: { ignoreDuringBuilds: true },
  experimental: {
    serverActions: { bodySizeLimit: '10mb' },
  },
};

export default nextConfig;
