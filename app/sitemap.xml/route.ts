import { seed, all } from '../../lib/server/db';

/** 공개 페이지와 공개 과정 목록 */
export async function GET(req: Request) {
  const origin = new URL(req.url).origin;
  const today = new Date().toISOString().slice(0, 10);
  let courses: { id: string }[] = [];
  try {
    await seed();
    courses = await all<{ id: string }>('SELECT id FROM courses WHERE published=1 ORDER BY position');
  } catch { /* DB 오류 시 고정 페이지만 */ }
  const pages: [string, string, string][] = [
    ['/', 'daily', '1.0'], ['/courses', 'daily', '0.9'], ['/guide', 'monthly', '0.6'], ['/notices', 'weekly', '0.6'], ['/faq', 'monthly', '0.5'],
    ['/verify', 'yearly', '0.3'], ['/terms', 'yearly', '0.2'], ['/privacy', 'yearly', '0.2'],
    ...courses.map((c) => ['/course/' + encodeURIComponent(c.id), 'weekly', '0.8'] as [string, string, string]),
  ];
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map(([p, f, pr]) => `  <url><loc>${esc(origin + p)}</loc><lastmod>${today}</lastmod><changefreq>${f}</changefreq><priority>${pr}</priority></url>`).join('\n')}\n</urlset>\n`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
}
