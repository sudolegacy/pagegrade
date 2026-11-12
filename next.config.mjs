const isDev = process.env.NODE_ENV !== 'production';
const https = (process.env.APP_URL || '').startsWith('https://');

// Next.js hydration relies on inline scripts, so script-src needs 'unsafe-inline'
// (no third-party scripts are loaded). Everything else is locked to our origin.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${isDev ? ' ws:' : ''}`,
  "frame-ancestors 'none'",
  "form-action 'self' https://checkout.stripe.com https://billing.stripe.com",
  "base-uri 'self'",
  "object-src 'none'",
  ...(https ? ['upgrade-insecure-requests'] : []),
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  ...(https ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' }] : []),
];

/** @type {import('next').NextConfig} */
const config = {
  poweredByHeader: false,
  // Public values baked in at build time (Railway exposes service variables to the build).
  env: {
    NEXT_PUBLIC_APP_URL: (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, ''),
    NEXT_PUBLIC_SUPPORT_EMAIL: process.env.SUPPORT_EMAIL || 'pagegrade1@gmail.com',
    NEXT_PUBLIC_COMPANY_NUMBER: process.env.COMPANY_NUMBER || '',
    NEXT_PUBLIC_COMPANY_ADDRESS: process.env.COMPANY_ADDRESS || '',
  },
  reactStrictMode: true,
  serverExternalPackages: ['better-sqlite3', 'playwright-core', 'sharp', 'lighthouse', 'chrome-launcher', 'nodemailer'],
  // Permanent redirects for retired article URLs, so old links and bookmarks never 404.
  async redirects() {
    return [
      { source: '/blog/landing-page-checklist', destination: '/blog/ai-visibility-audit', permanent: true },
      { source: '/blog/landing-page-headline', destination: '/blog/ai-search-visibility-uk', permanent: true },
      { source: '/blog/call-to-action-best-practices', destination: '/blog/ai-search-visibility-uk', permanent: true },
      { source: '/blog/category', destination: '/blog', permanent: true },
    ];
  },
  async headers() {
    // /embed/* is the lead widget, which agencies' websites show in an iframe: it sends its own
    // CSP (frame-ancestors limited to the agency's sites), so it must not get X-Frame-Options: DENY.
    return [{ source: '/((?!embed/).*)', headers: securityHeaders }];
  },
};

export default config;
