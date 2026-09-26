import type { APIRoute } from 'astro';
import { getSiteUrl } from '../lib/runtime/config';

export const GET: APIRoute = async ({ url }) => {
  const siteUrl = getSiteUrl(url.origin);
  const robots = `User-agent: *
Allow: /
Disallow: /admin
Disallow: /admin/
Disallow: /vendor
Disallow: /vendor/
Disallow: /api/

Sitemap: ${siteUrl}/sitemap.xml
`;

  return new Response(robots, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain',
      'Cache-Control': 'public, max-age=86400',
    },
  });
};
