import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone', // requis par 05_Infrastructure/docker/Dockerfile.frontend
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: ['lucide-react', 'recharts'],
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' }, // logos de salles hébergés sur S3/MinIO
    ],
  },
};

export default nextConfig;
