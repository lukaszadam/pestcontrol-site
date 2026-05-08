import { cityPages } from '../data/cityPages.js';

const siteUrl = 'https://pestcontrolcyp.com';
const lastmod = '2026-05-07';

const blogSlugs = [
  'pest-control-chemicals-pet-safety',
];

const urls = [
  { loc: '/', priority: '1.0' },
  { loc: '/blog/', priority: '0.7' },
  ...blogSlugs.map((slug) => ({ loc: `/blog/${slug}/`, priority: '0.6' })),
  ...cityPages.map((page) => ({ loc: `/${page.slug}/`, priority: '0.8' })),
];

export function GET() {
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (url) => `  <url>
    <loc>${siteUrl}${url.loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>${url.priority}</priority>
  </url>`
  )
  .join('\n')}
</urlset>`;

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
    },
  });
}
