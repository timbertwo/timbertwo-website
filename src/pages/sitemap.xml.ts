// Lists every page in src/pages, so new pages appear in the sitemap without
// any extra step. Utility pages are left out.
const SITE = 'https://timbertwo.com';
const SKIP = new Set(['/404', '/thank-you']);

export function GET() {
  const files = Object.keys(import.meta.glob('./**/*.astro'));
  const routes = files
    .map((f) => f.replace(/^\.\//, '/').replace(/\.astro$/, '').replace(/\/index$/, '') || '/')
    .filter((r) => !SKIP.has(r))
    .sort();

  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    routes.map((r) => `  <url><loc>${SITE}${r === '/' ? '/' : r}</loc></url>`).join('\n') +
    `\n</urlset>\n`;

  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
