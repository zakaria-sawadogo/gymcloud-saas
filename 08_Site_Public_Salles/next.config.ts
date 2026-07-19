import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  // §3.2 — Servi sous /s/ sur le domaine principal (gymcloud.sahelsystem.com/s/xxx),
  // pas en sous-domaine dédié (aurait demandé un DNS + certificat wildcard,
  // plus complexe sur cet hébergement). basePath préfixe automatiquement
  // TOUT — routes ET fichiers statiques (/_next/...) — sans quoi ces
  // derniers seraient demandés à la racine du domaine et intercepiés par
  // l'app principale au lieu de celle-ci (page blanche, JS jamais chargé).
  basePath: '/s',
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' }, // logos/couvertures de salles hébergés sur S3/MinIO
    ],
  },
};

export default nextConfig;
