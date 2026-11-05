/** 검색엔진 수집 규칙: 공개 페이지만 허용 */
export async function GET(req: Request) {
  const origin = new URL(req.url).origin;
  const body = ['User-agent: *', 'Allow: /', 'Disallow: /admin', 'Disallow: /learn', 'Disallow: /lesson', 'Disallow: /reset', 'Disallow: /api/', '', `Sitemap: ${origin}/sitemap.xml`, ''].join('\n');
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
}
