import type { APIRoute } from 'astro';
import { getDataRepository } from '../lib/repositories/dataRepository';
import { LOCALES, type Locale } from '../lib/i18n';
import type { District, Taluka, Category } from '../lib/types/database';

export const GET: APIRoute = async () => {
  const repo = getDataRepository();
  const districts: District[] = await repo.getDistricts();
  const talukas: Taluka[] = await repo.getTalukas();
  const categories: Category[] = await repo.getCategories();
  const allVendors = await repo.getAdminVendors();

  const siteUrl = 'https://aheka.in';
  const urls: { loc: string; lastmod: string; changefreq: string; priority: string }[] = [];

  const today = new Date().toISOString().split('T')[0];

  // 1. Homepages
  LOCALES.forEach((locale: Locale) => {
    urls.push({
      loc: `${siteUrl}/${locale}`,
      lastmod: today,
      changefreq: 'daily',
      priority: '1.0',
    });
  });

  // 2. Static / Trust Pages
  ['about', 'privacy', 'terms', 'provider-terms', 'join', 'services'].forEach((path: string) => {
    LOCALES.forEach((locale: Locale) => {
      urls.push({
        loc: `${siteUrl}/${locale}/${path}`,
        lastmod: today,
        changefreq: 'monthly',
        priority: '0.5',
      });
    });
  });

  // 3. District & Taluka Pages
  districts.forEach((d: District) => {
    LOCALES.forEach((locale: Locale) => {
      urls.push({
        loc: `${siteUrl}/${locale}/${d.slug}`,
        lastmod: today,
        changefreq: 'weekly',
        priority: '0.8',
      });
    });

    const districtTalukas = talukas.filter((t: Taluka) => t.district_id === d.id);
    districtTalukas.forEach((t: Taluka) => {
      LOCALES.forEach((locale: Locale) => {
        urls.push({
          loc: `${siteUrl}/${locale}/${d.slug}/${t.slug}`,
          lastmod: today,
          changefreq: 'weekly',
          priority: '0.8',
        });
      });

      // 4. Category Pages (Directory)
      categories.forEach((c: Category) => {
        LOCALES.forEach((locale: Locale) => {
          urls.push({
            loc: `${siteUrl}/${locale}/${d.slug}/${t.slug}/${c.slug}`,
            lastmod: today,
            changefreq: 'daily',
            priority: '0.9',
          });
        });
      });
    });
  });

  // 5. Active Provider Profiles
  allVendors
    .filter((v: any) => v.is_publicly_visible && !v.is_suspended && v.approval_status === 'approved')
    .forEach((v: any) => {
      LOCALES.forEach((locale: Locale) => {
        urls.push({
          loc: `${siteUrl}/${locale}/provider/${v.slug}`,
          lastmod: today,
          changefreq: 'weekly',
          priority: '0.7',
        });
      });
    });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    u => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`
  )
  .join('\n')}
</urlset>`;

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
