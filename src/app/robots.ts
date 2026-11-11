import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/app', '/admin', '/api/', '/r/', '/demo/', '/login', '/signup', '/forgot-password', '/reset-password', '/verify-email', '/grade/', '/print/'] }],
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url,
  };
}
