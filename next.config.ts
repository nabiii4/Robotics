import type { NextConfig } from 'next';

const isProd = process.env.NODE_ENV === 'production';

// Monaco's loader fetches the editor from cdn.jsdelivr.net (documented exception, see docs/DECISIONS.md).
const csp = [
  "default-src 'self'",
  "img-src 'self' data: blob:",
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://cdn.jsdelivr.net",
  "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
  "font-src 'self' data: https://cdn.jsdelivr.net",
  "worker-src 'self' blob:",
  "connect-src 'self' https://cdn.jsdelivr.net",
  "frame-ancestors 'none'",
].join('; ');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['manifold-3d', '@libsql/client', 'libsql', 'unpdf'],
  eslint: { ignoreDuringBuilds: true },
  async headers() {
    const h = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'serial=(self), microphone=(self), camera=()' },
    ];
    if (isProd) h.push({ key: 'Content-Security-Policy', value: csp });
    return [{ source: '/:path*', headers: h }];
  },
};

export default nextConfig;
