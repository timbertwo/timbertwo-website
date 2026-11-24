// One-off port of the harvested Shopify pages into this Astro site.
//
// Reads reference/original-site/*.html (written by harvest.mjs), pulls out the
// shared header, footer and theme style block plus each page's main content,
// rewrites every Shopify CDN URL to the local copy under public/, removes the
// shop, cart, account and search pieces, and writes:
//
//   src/html/header.html, footer.html, theme-style.html
//   src/html/pages/<page>.html      the page's main content, verbatim otherwise
//   src/pages/**/*.astro            thin wrappers that pick a layout and meta
//
// Usage, from the site/ folder:  node scripts/port.mjs
//
// It was run once and the generated files were then edited by hand. Running it
// again overwrites those edits, so treat it as documentation of how the port
// was done rather than a build step.

import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { URL_RE, MAX_WIDTH, classify } from './harvest-lib.mjs';

const SITE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAW_DIR = path.join(SITE_DIR, 'reference', 'original-site');
const HTML_DIR = path.join(SITE_DIR, 'src', 'html');
const PAGES_DIR = path.join(SITE_DIR, 'src', 'pages');

// Clean blog URLs in place of the lorem-ipsum handles the Shopify site had.
export const BLOG_SLUGS = {
  'horem-ipsum-dolor-sit-amet-consectetur-adipiscing-elit-nunc-vulputate-libero-et-velit-interdum-ac-aliquet-odio-mattis-2':
    'the-comeback-of-custom-furniture-and-woodworking',
  'horem-ipsum-dolor-sit-amet-consectetur-adipiscing-elit-nunc-vulputate-libero-et-velit-interdum-ac-aliquet-odio-mattis-3':
    'the-scarcity-of-timber-products-in-australia',
  'gorem-ipsum-dolor-sit': 'modern-vanity-styles-vs-traditional-vanity-styles',
};

// raw file, route, output names, body class, whether it carries the enquiry form
const PAGES = [
  { raw: 'home.html', route: '/', astro: 'index.astro', html: 'home.html', body: 'index gradient' },
  { raw: 'pages_about_us.html', route: '/pages/about-us', astro: 'pages/about-us.astro', html: 'pages/about-us.html', body: 'about-us page gradient' },
  { raw: 'pages_service.html', route: '/pages/service', astro: 'pages/service.astro', html: 'pages/service.html', body: 'service page gradient' },
  { raw: 'pages_service_bathrooms.html', route: '/pages/service/bathrooms', astro: 'pages/service/bathrooms.astro', html: 'pages/service/bathrooms.html', body: 'service gradient', form: true },
  { raw: 'pages_service_kitchen.html', route: '/pages/service/kitchen', astro: 'pages/service/kitchen.astro', html: 'pages/service/kitchen.html', body: 'service gradient', form: true },
  { raw: 'pages_service_FURNITURE.html', route: '/pages/service/furniture', astro: 'pages/service/furniture.astro', html: 'pages/service/furniture.html', body: 'service gradient', form: true },
  { raw: 'pages_contact.html', route: '/pages/contact', astro: 'pages/contact.astro', html: 'pages/contact.html', body: 'contact page gradient', form: true },
  { raw: 'pages_faqs.html', route: '/pages/faqs', astro: 'pages/faqs.astro', html: 'pages/faqs.html', body: 'faqs page gradient' },
  { raw: 'pages_reviews.html', route: '/pages/reviews', astro: 'pages/reviews.astro', html: 'pages/reviews.html', body: 'reviews page gradient' },
  { raw: 'pages_vanity_spec_sheet.html', route: '/pages/vanity-spec-sheet', astro: 'pages/vanity-spec-sheet.astro', html: 'pages/vanity-spec-sheet.html', body: 'vanity-spec-sheet page gradient' },
  { raw: 'pages_sustainability.html', route: '/pages/sustainability', astro: 'pages/sustainability.astro', html: 'pages/sustainability.html', body: 'sustainability page gradient' },
  { raw: 'pages_privacy_policy.html', route: '/pages/privacy-policy', astro: 'pages/privacy-policy.astro', html: 'pages/privacy-policy.html', body: 'privacy-policy page gradient' },
  { raw: 'pages_terms_conditions.html', route: '/pages/terms-conditions', astro: 'pages/terms-conditions.astro', html: 'pages/terms-conditions.html', body: 'terms-conditions page gradient' },
  { raw: 'blogs_news.html', route: '/blogs/news', astro: 'blogs/news.astro', html: 'blogs/news.html', body: 'blog gradient' },
  { raw: 'blog_ac_aliquet_odio_mattis_2.html', route: '/blogs/news/the-comeback-of-custom-furniture-and-woodworking', astro: 'blogs/news/the-comeback-of-custom-furniture-and-woodworking.astro', html: 'blogs/the-comeback-of-custom-furniture-and-woodworking.html', body: 'article gradient' },
  { raw: 'blog_ac_aliquet_odio_mattis_3.html', route: '/blogs/news/the-scarcity-of-timber-products-in-australia', astro: 'blogs/news/the-scarcity-of-timber-products-in-australia.astro', html: 'blogs/the-scarcity-of-timber-products-in-australia.html', body: 'article gradient' },
  { raw: 'blog_ws_gorem_ipsum_dolor_sit.html', route: '/blogs/news/modern-vanity-styles-vs-traditional-vanity-styles', astro: 'blogs/news/modern-vanity-styles-vs-traditional-vanity-styles.astro', html: 'blogs/modern-vanity-styles-vs-traditional-vanity-styles.html', body: 'article gradient' },
  { raw: '404_probe_this_page_does_not_exist.html', route: '/404', astro: '404.astro', html: '404.html', body: '404 gradient' },
];

const warnings = [];
function expect(html, re, replacement, label) {
  const before = html;
  html = html.replace(re, replacement);
  if (html === before) warnings.push(`no match for ${label}`);
  return html;
}

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&ndash;/g, '–');
}

// Original URL -> local path, as the harvest actually saved it (photos became
// WebP). Falls back to the naming rule for anything the harvest did not see.
let assetMap = {};

function rewriteUrls(html) {
  return html.replace(URL_RE, (raw) => {
    const c = classify(raw);
    if (!c) return raw;
    return assetMap[c.key] ?? c.local;
  });
}

// Drops srcset candidates wider than MAX_WIDTH (they all map to the same local
// file) and duplicate URLs, keeping the first of each.
function cleanSrcset(html) {
  return html.replace(/srcset="([^"]*)"/g, (_, list) => {
    const seen = new Set();
    const kept = [];
    for (const cand of list.split(',')) {
      const [url, descriptor = ''] = cand.trim().split(/\s+/);
      if (!url) continue;
      const w = /^(\d+)w$/.exec(descriptor);
      if (w && Number(w[1]) > MAX_WIDTH) continue;
      if (seen.has(url)) continue;
      seen.add(url);
      kept.push(descriptor ? `${url} ${descriptor}` : url);
    }
    return `srcset="${kept.join(', ')}"`;
  });
}

// Shopify printed one attribute per line inside many tags. Collapsing that
// whitespace changes nothing in the browser and lets the patterns below (and
// the active-menu marking in the layout) match on one line.
function tidyTags(html) {
  return html.replace(/<([a-zA-Z][^>]*)>/g, (tag) => tag.replace(/\s+/g, ' ').replace(/\s+>$/, '>'));
}

function commonFixes(html) {
  html = html.replace(/\s*<source src="movie\.ogg" type="video\/ogg">/g, '');
  for (const [oldSlug, newSlug] of Object.entries(BLOG_SLUGS)) {
    html = html.split(`/blogs/news/${oldSlug}`).join(`/blogs/news/${newSlug}`);
  }
  html = html.split('/pages/service/FURNITURE').join('/pages/service/furniture');
  html = html.replace(/href="https:\/\/timber-two-joiner\.myshopify\.com\/collections\/all"/g, 'href="/pages/contact"');
  // Links written with the store's myshopify address, sometimes with a doubled slash
  html = html.replace(/https:\/\/timber-two-joiner\.myshopify\.com\/+/g, '/');
  return cleanSrcset(rewriteUrls(html));
}

const SHOP_LINK_RE = /href="((?:\/collections|\/products|\/cart|\/search|\/account)(?:[/?"#]|$)[^"]*|[^"]*(?:myshopify|customer_authentication|shop\.app)[^"]*)"/g;

function extractMain(html) {
  const m = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/);
  if (!m) throw new Error('no <main>');
  return m[1].trim();
}

function extractTitle(html) {
  const m = html.match(/<title>([\s\S]*?)<\/title>/);
  return decodeEntities((m ? m[1] : '').replace(/\s+/g, ' ').trim());
}

function extractDescription(html) {
  const m = html.match(/<meta name="description" content="([^"]*)"/);
  return decodeEntities(m ? m[1] : '');
}

async function write(file, text) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, text);
}

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else out.push(full);
  }
  return out;
}

function astroWrapper(page) {
  const depth = page.astro.split('/').length - 1;
  const up = '../'.repeat(depth + 1);
  const needsForm = page.form;
  const lines = [
    '---',
    `import Base from '${up}layouts/Base.astro';`,
    `import raw from '${up}html/pages/${page.html}?raw';`,
  ];
  if (needsForm) lines.push(`import form from '${up}html/enquiry-form.html?raw';`);
  lines.push('');
  lines.push(`const path = '${page.route === '/404' ? '/404' : page.route}';`);
  lines.push(`const title = ${JSON.stringify(page.title)};`);
  lines.push(`const description = ${JSON.stringify(page.description)};`);
  if (needsForm) {
    lines.push(`const content = raw.replace('<!-- ENQUIRY_FORM -->', form.split('{PAGE}').join(path));`);
  } else {
    lines.push('const content = raw;');
  }
  lines.push('---');
  lines.push(`<Base title={title} description={description} path={path} bodyClass=${JSON.stringify(page.body)}>`);
  lines.push('  <Fragment set:html={content} />');
  lines.push('</Base>');
  return lines.join('\n') + '\n';
}

async function main() {
  assetMap = JSON.parse(await readFile(path.join(RAW_DIR, 'asset-map.json'), 'utf8'));
  const home = await readFile(path.join(RAW_DIR, 'home.html'), 'utf8');

  // 1. Theme style block: @font-face rules and the :root variables.
  const styleMatch = home.match(/<style data-shopify>\s*@font-face[\s\S]*?<\/style>/);
  if (!styleMatch) throw new Error('theme style block not found');
  await write(path.join(HTML_DIR, 'theme-style.html'), commonFixes(styleMatch[0]) + '\n');

  // 2. Header section.
  let header = home.match(/<div id="shopify-section-sections--\d+__header"[\s\S]*?<!-- END sections: header-group -->/)?.[0];
  if (!header) throw new Error('header not found');
  header = tidyTags(header);
  header = header.replace(/<script\b[\s\S]*?<\/script>/g, '');
  header = header.replace(/<noscript><link[^>]*(component-search|component-cart-notification|component-cart-items)[^>]*><\/noscript>\s*/g, '');
  header = header.replace(/<link[^>]*(component-search|component-cart-notification|component-cart-items|component-price|component-cart-drawer|component-cart\.css|component-totals|component-discounts)[^>]*>\s*/g, '');
  header = expect(header, /<li>\s*<a id="HeaderDrawer-shop"[\s\S]*?<\/li>/, '', 'drawer shop item');
  header = expect(header, /<li>\s*<a id="HeaderMenu-shop"[\s\S]*?<\/li>/, '', 'menu shop item');
  header = expect(header, /<a href="https:\/\/timbertwo\.com\/customer_authentication\/redirect[^"]*"[^>]*>[\s\S]*?<\/a>/g, '', 'account links');
  header = expect(header, /<a href="\/cart"[^>]*id="cart-icon-bubble">[\s\S]*?<\/a>/, '', 'cart icon');
  header = header.replace(/\s*aria-current="page"/g, '');
  header = header.replace(/\s*menu-drawer__menu-item--active/g, '');
  header = expect(header, /<span class="header__active-menu-item">Home<\/span>/, '<span>Home</span>', 'home active span');
  await write(path.join(HTML_DIR, 'header.html'), commonFixes(header) + '\n');

  // 3. Footer section.
  let footer = home.match(/<!-- BEGIN sections: footer-group -->[\s\S]*?<!-- END sections: footer-group -->/)?.[0];
  if (!footer) throw new Error('footer not found');
  footer = tidyTags(footer);
  footer = footer.replace(/<link[^>]*(component-list-payment|component-newsletter)[^>]*>\s*/g, '');
  footer = expect(footer, /<li class="menu-link">\s*<a href="\/collections\/all">Shop<\/a>\s*<\/li>\s*/, '', 'footer shop link');
  footer = expect(footer, /© 2024 Timber Two/, '© {YEAR} Timber Two', 'copyright year');
  await write(path.join(HTML_DIR, 'footer.html'), commonFixes(footer) + '\n');

  // 4. Pages.
  for (const page of PAGES) {
    const raw = await readFile(path.join(RAW_DIR, page.raw), 'utf8');
    let main = extractMain(raw);
    page.title = extractTitle(raw);
    page.description = extractDescription(raw);

    if (page.form) {
      main = expect(main, /<form method="post" action="\/contact#ContactForm"[\s\S]*?<\/form>/, '<!-- ENQUIRY_FORM -->', `${page.route} enquiry form`);
    }
    if (page.route === '/') {
      main = expect(main, /(<h3 class="inline-richtext">)\s*Customise Your Vanity\s*(<\/h3>)/, '$1Custom Vanities$2', 'home card 1 heading');
      main = expect(main, /<p>Build and price your perfect bathroom vanity today\.<\/p>/, '<p>Design your perfect bathroom vanity with us.</p>', 'home card 1 text');
      main = expect(main, /<a href="\/products\/custom-vanity">\s*Shop Now\s*<\/a>/, '<a href="/pages/service/bathrooms"> Enquire Now </a>', 'home card 1 link');
      main = expect(main, /(<h3 class="inline-richtext">)\s*Shop Timber Two\s*(<\/h3>)/, '$1Custom Furniture$2', 'home card 2 heading');
      main = expect(main, /<p>Ready made finds, bathroom vanities and more\.<\/p>/, '<p>Dining tables, bed heads, desks and more, made to order.</p>', 'home card 2 text');
      main = expect(main, /<a href="\/collections">\s*Shop Now\s*<\/a>/, '<a href="/pages/service/furniture"> Enquire Now </a>', 'home card 2 link');
    }
    if (page.route === '/404') {
      main = expect(main, /<a href="\/collections\/all" class="button">\s*Continue shopping\s*<\/a>/, '<a href="/" class="button">Back to home</a>', '404 link');
    }
    main = commonFixes(main);

    const leftovers = [...main.matchAll(SHOP_LINK_RE)].map((m) => m[1]);
    if (leftovers.length) warnings.push(`${page.route}: shop links left: ${leftovers.join(' ')}`);
    const cdn = main.match(/(?:cdn\.shopify\.com|timbertwo\.com\/cdn)[^"' )]*/g);
    if (cdn) warnings.push(`${page.route}: CDN URLs left: ${[...new Set(cdn)].slice(0, 5).join(' ')}`);

    await write(path.join(HTML_DIR, 'pages', page.html), main + '\n');
    await write(path.join(PAGES_DIR, page.astro), astroWrapper(page));
    console.log(`${page.route.padEnd(66)} ${String(main.length).padStart(6)} bytes  "${page.title}"`);
  }

  // 5. Keep only the theme files the site references (the harvest also pulls
  // cart, search and product files), rewrite CDN image URLs inside the
  // stylesheets, and drop the source map comments.
  const themeDir = path.join(SITE_DIR, 'public', 'theme');
  const referenced = new Set(['sections-scripts.js']);
  const sources = [...(await walk(HTML_DIR)), path.join(SITE_DIR, 'src', 'layouts', 'Base.astro')];
  for (const file of sources) {
    const text = await readFile(file, 'utf8');
    for (const m of text.matchAll(/\/theme\/([A-Za-z0-9._-]+)/g)) referenced.add(m[1]);
  }
  let pruned = 0;
  for (const name of await readdir(themeDir)) {
    const file = path.join(themeDir, name);
    if (!referenced.has(name)) {
      await rm(file);
      pruned += 1;
      continue;
    }
    const text = await readFile(file, 'utf8');
    const out = rewriteUrls(text)
      .replace(/\/\*# sourceMappingURL=[^*]*\*\//g, '')
      .replace(/\/\/# sourceMappingURL=\S*/g, '');
    if (out !== text) await writeFile(file, out);
  }
  console.log(`theme: kept ${referenced.size} referenced files, removed ${pruned}`);

  if (warnings.length) {
    console.log('\nwarnings:');
    for (const w of warnings) console.log('  ' + w);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
