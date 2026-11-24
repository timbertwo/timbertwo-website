// One-off harvest of the live Shopify site (timbertwo.com), run before the
// store is cancelled. Saves each page's rendered HTML under
// reference/original-site/ and every theme stylesheet, script, font and image
// under public/, then writes reference/original-site/asset-map.json mapping
// each original URL to its local path.
//
// Usage, from the site/ folder:  node scripts/harvest.mjs
// Re-running skips files that already exist.

import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ORIGIN, URL_RE, classify, safeName as safeNameOf } from './harvest-lib.mjs';

const SITE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAW_DIR = path.join(SITE_DIR, 'reference', 'original-site');
const PUBLIC_DIR = path.join(SITE_DIR, 'public');
const UA = 'Mozilla/5.0 (compatible; timbertwo-site-harvest)';
const CONCURRENCY = 6;

// Photos are fetched as WebP (the CDN converts on request and the files are
// about a tenth of the size). The favicon and logo stay PNG.
const PLAIN_IMAGE = /\/(Logo-Icon-900|image_2_11)\./;
const WEBP_ACCEPT = { accept: 'image/webp,image/*,*/*' };

// Images the pages do not reference directly but the site needs.
const EXTRA_IMAGES = [
  { kind: 'image', key: `${ORIGIN}/cdn/shop/files/1ecf0fd10682b4b1e4ce42cdfa81f1ba.jpg?width=1200`, fetchUrl: `${ORIGIN}/cdn/shop/files/1ecf0fd10682b4b1e4ce42cdfa81f1ba.jpg?width=1200`, local: '/images/share-image.jpg', plain: true },
];

const PAGES = [
  '/',
  '/pages/about-us',
  '/pages/service',
  '/pages/service/bathrooms',
  '/pages/service/kitchen',
  '/pages/service/FURNITURE',
  '/pages/contact',
  '/pages/faqs',
  '/pages/reviews',
  '/pages/vanity-spec-sheet',
  '/pages/sustainability',
  '/pages/privacy-policy',
  '/pages/terms-conditions',
  '/blogs/news',
  '/blogs/news/horem-ipsum-dolor-sit-amet-consectetur-adipiscing-elit-nunc-vulputate-libero-et-velit-interdum-ac-aliquet-odio-mattis-2',
  '/blogs/news/horem-ipsum-dolor-sit-amet-consectetur-adipiscing-elit-nunc-vulputate-libero-et-velit-interdum-ac-aliquet-odio-mattis-3',
  '/blogs/news/gorem-ipsum-dolor-sit',
  '/404-probe-this-page-does-not-exist',
];
const EXTRAS = ['/products.json?limit=250', '/collections.json'];

function slugOf(p) {
  if (p === '/') return 'home';
  if (p.startsWith('/blogs/news/')) return 'blog_' + p.slice(-24).replace(/[^a-zA-Z0-9]+/g, '_');
  return p.replace(/^\//, '').replace(/[^a-zA-Z0-9]+/g, '_').slice(0, 80);
}

async function fetchBytes(url, extraHeaders = {}, tries = 3) {
  for (let i = 1; i <= tries; i++) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': UA, ...extraHeaders }, redirect: 'follow' });
      const buf = Buffer.from(await res.arrayBuffer());
      return { status: res.status, buf, type: res.headers.get('content-type') || '' };
    } catch (e) {
      if (i === tries) throw e;
      await new Promise((r) => setTimeout(r, 600 * i));
    }
  }
}

async function exists(file) {
  try {
    const s = await stat(file);
    return s.size > 0;
  } catch {
    return false;
  }
}

// Every original URL that resolves to the same local file is remembered, so
// the port can rewrite all of them.
function discover(text, assets) {
  for (const raw of text.match(URL_RE) || []) {
    const c = classify(raw);
    if (!c) continue;
    let entry = assets.get(c.local);
    if (!entry) {
      entry = { ...c, keys: new Set(), actual: c.local };
      assets.set(c.local, entry);
    }
    entry.keys.add(c.key);
  }
}

function webpName(local) {
  return local.replace(/\.(png|jpe?g)$/i, '.webp');
}

async function main() {
  await mkdir(RAW_DIR, { recursive: true });
  const manifest = [];
  const assets = new Map(); // local path -> classification

  // 1. Pages
  for (const p of PAGES) {
    const { status, buf } = await fetchBytes(ORIGIN + p);
    const html = buf.toString('utf8');
    const file = path.join(RAW_DIR, slugOf(p) + '.html');
    await writeFile(file, html);
    manifest.push({ path: p, status, bytes: buf.length, file: path.basename(file) });
    console.log(`page ${status} ${String(buf.length).padStart(7)}  ${p}`);
    discover(html, assets);
  }
  for (const p of EXTRAS) {
    const { status, buf } = await fetchBytes(ORIGIN + p);
    const file = path.join(RAW_DIR, p.replace(/^\//, '').split('?')[0]);
    await writeFile(file, buf);
    manifest.push({ path: p, status, bytes: buf.length, file: path.basename(file) });
    console.log(`extra ${status} ${String(buf.length).padStart(6)}  ${p}`);
  }

  for (const extra of EXTRA_IMAGES) {
    assets.set(extra.local, { ...extra, keys: new Set([extra.key]), actual: extra.local });
  }

  // 2. Assets, with a second pass over stylesheets for anything they reference
  const downloaded = [];
  const failed = [];
  async function download(c) {
    const wantWebp = c.kind === 'image' && !c.plain && !PLAIN_IMAGE.test(c.local);
    const candidates = wantWebp ? [webpName(c.local), c.local] : [c.local];
    for (const local of candidates) {
      if (await exists(path.join(PUBLIC_DIR, local))) {
        c.actual = local;
        downloaded.push({ ...c, bytes: 0, skipped: true });
        if (c.kind === 'theme' && local.endsWith('.css')) {
          discover(await readFile(path.join(PUBLIC_DIR, local), 'utf8'), assets);
        }
        return;
      }
    }
    const { status, buf, type } = await fetchBytes(c.fetchUrl, wantWebp ? WEBP_ACCEPT : {});
    if (status !== 200 || buf.length === 0) {
      failed.push({ ...c, status });
      return;
    }
    c.actual = wantWebp && type.includes('image/webp') ? webpName(c.local) : c.local;
    const file = path.join(PUBLIC_DIR, c.actual);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, buf);
    downloaded.push({ ...c, bytes: buf.length, type });
    if (c.kind === 'theme' && c.local.endsWith('.css')) discover(buf.toString('utf8'), assets);
  }

  let round = 0;
  const done = new Set();
  while (true) {
    const pending = [...assets.values()].filter((c) => !done.has(c.local));
    if (pending.length === 0) break;
    round += 1;
    console.log(`\nasset round ${round}: ${pending.length} files`);
    let i = 0;
    await Promise.all(
      Array.from({ length: CONCURRENCY }, async () => {
        while (i < pending.length) {
          const c = pending[i++];
          done.add(c.local);
          try {
            await download(c);
          } catch (e) {
            failed.push({ ...c, error: String(e) });
          }
        }
      }),
    );
  }

  // 3. Full-size copies of every photo, in the original format, for the
  // owner's records. Not committed (see .gitignore): about 150 MB.
  const originals = new Map();
  for (const e of assets.values()) {
    if (e.kind !== 'image') continue;
    const u = new URL(e.fetchUrl);
    originals.set(`${u.origin}${u.pathname}`, safeNameOf(decodeURIComponent(path.basename(u.pathname))));
  }
  const ORIG_DIR = path.join(SITE_DIR, 'reference', 'original-images');
  await mkdir(ORIG_DIR, { recursive: true });
  let origCount = 0;
  let origBytes = 0;
  for (const [base, name] of originals) {
    const file = path.join(ORIG_DIR, name);
    if (await exists(file)) continue;
    try {
      const { status, buf } = await fetchBytes(`${base}?width=3000`);
      if (status === 200 && buf.length) {
        await writeFile(file, buf);
        origCount += 1;
        origBytes += buf.length;
      } else failed.push({ fetchUrl: base, status });
    } catch (e) {
      failed.push({ fetchUrl: base, error: String(e) });
    }
  }
  console.log(`\noriginals: ${origCount} new files, ${(origBytes / 1e6).toFixed(1)} MB, in reference/original-images/`);

  // 4. Map and report
  const map = {};
  for (const e of assets.values()) for (const k of e.keys) map[k] = e.actual;
  await writeFile(path.join(RAW_DIR, 'asset-map.json'), JSON.stringify(map, null, 2));
  await writeFile(path.join(RAW_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));

  const byKind = {};
  for (const d of downloaded) {
    byKind[d.kind] ??= { files: 0, bytes: 0 };
    byKind[d.kind].files += 1;
    byKind[d.kind].bytes += d.bytes;
  }
  console.log('\nsummary');
  for (const [k, v] of Object.entries(byKind)) {
    console.log(`  ${k.padEnd(6)} ${String(v.files).padStart(4)} files  ${(v.bytes / 1e6).toFixed(1)} MB`);
  }
  if (failed.length) {
    console.log(`\nfailed (${failed.length}):`);
    for (const f of failed) console.log(`  ${f.status || f.error}  ${f.fetchUrl}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
