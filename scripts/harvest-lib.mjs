// Shared helpers for the one-off harvest and port scripts.
// Recognises the Shopify CDN URLs the live site uses and maps each one to a
// local path under public/.

import path from 'node:path';

export const ORIGIN = 'https://timbertwo.com';

// Largest image width worth keeping. The Shopify CDN resizes on request;
// anything wider than this is fetched at this width instead.
export const MAX_WIDTH = 2000;

// Matches every absolute, protocol-relative or /cdn/-relative URL that points
// at the Shopify CDN for this store.
export const URL_RE =
  /(?:https?:)?\/\/(?:timbertwo\.com|cdn\.shopify\.com)\/[^\s"'<>(),]+|(?<=["'(\s=])\/cdn\/[^\s"'<>(),]+/g;

export function safeName(s) {
  return s.replace(/[^a-zA-Z0-9._-]+/g, '-');
}

// Turns a raw match (possibly HTML-escaped, protocol-relative or /cdn/-relative)
// into an absolute URL string.
export function absolutise(raw) {
  let u = raw.replace(/&amp;/g, '&');
  if (u.startsWith('//')) u = 'https:' + u;
  else if (u.startsWith('/')) u = ORIGIN + u;
  return u;
}

// Classifies a CDN URL. Returns null for anything that is not a theme file,
// font or store image (for example Shopify's own platform scripts).
export function classify(raw) {
  const u = absolutise(raw);
  let parsed;
  try {
    parsed = new URL(u);
  } catch {
    return null;
  }
  let p;
  try {
    p = decodeURIComponent(parsed.pathname);
  } catch {
    p = parsed.pathname;
  }
  let m;

  if ((m = p.match(/\/t\/\d+\/assets\/([^/]+)$/))) {
    return { kind: 'theme', key: u, fetchUrl: u, local: `/theme/${safeName(m[1])}` };
  }

  if ((m = p.match(/\/cdn\/fonts\/[^/]+\/([^/]+)$/))) {
    return { kind: 'font', key: u, fetchUrl: u, local: `/fonts/${safeName(m[1])}` };
  }

  if ((m = p.match(/\/videos\/c\/o\/v\/([^/]+)$/))) {
    const fetchUrl = `${parsed.origin}${parsed.pathname}`;
    return { kind: 'video', key: u, fetchUrl, local: `/videos/${safeName(m[1])}` };
  }

  if (
    (m = p.match(
      /\/(?:cdn\/shop\/(?:files|products|articles)|s\/files\/\d+\/\d+\/\d+\/\d+\/(?:files|products|articles))\/([^/]+)$/,
    ))
  ) {
    const sp = parsed.searchParams;
    let width = sp.get('width') ? Number(sp.get('width')) : null;
    const height = sp.get('height') ? Number(sp.get('height')) : null;
    const crop = sp.get('crop');
    if (width && width > MAX_WIDTH) width = MAX_WIDTH;
    const ext = path.extname(m[1]).toLowerCase();
    const stem = safeName(path.basename(m[1], path.extname(m[1])));
    const suffix =
      (width ? `.w${width}` : '') + (height ? `.h${height}` : '') + (crop ? `.c${safeName(crop)}` : '');
    const q = new URLSearchParams();
    if (width) q.set('width', String(width));
    if (height) q.set('height', String(height));
    if (crop) q.set('crop', crop);
    const fetchUrl = `${parsed.origin}${parsed.pathname}${q.size ? '?' + q.toString() : ''}`;
    return { kind: 'image', key: u, fetchUrl, local: `/images/${stem}${suffix}${ext}` };
  }

  return null;
}
