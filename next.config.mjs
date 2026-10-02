const isProd = process.env.NODE_ENV === 'production';

// Plain JS (not .ts) so the production image can start without TypeScript installed.
// Monaco's loader fetches the editor from cdn.jsdelivr.net; if that host is blocked the IDE falls back to a plain editor.
const csp = [
  "default-src 'self'",
  "img-src 'self' data: blob:",
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://cdn.jsdelivr.net",
  "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
  "font-src 'self' data: https://cdn.jsdelivr.net",
  "worker-src 'self' blob:",
  "connect-src 'self' https://cdn.jsdelivr.net",
  "frame-ancestors 'self'", // PDFs and text files preview in same-origin iframes
].join('; ');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['manifold-3d', '@libsql/client', 'libsql', 'unpdf'],
  // make sure serverless bundles (Vercel) ship manifold's WebAssembly next to its JS
  outputFileTracingIncludes: { '/api/**/*': ['./node_modules/manifold-3d/*.wasm'] },
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

// GitHub Pages build (npm run build:pages): static pages only, built from a copy without app/api and middleware;
// the API runs in a service worker instead (browser-server/).
const staticExport = process.env.STATIC_EXPORT === '1';
const pagesConfig = {
  reactStrictMode: true,
  output: 'export',
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || undefined,
  trailingSlash: true,
  images: { unoptimized: true },
  eslint: { ignoreDuringBuilds: true },
};

export default staticExport ? pagesConfig : nextConfig;
