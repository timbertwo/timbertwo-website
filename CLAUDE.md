# Timber Two marketing site: standing instructions

This folder is the static public website (Astro, deployed to Netlify). The quoting app lives in the repository root and is a separate deployment; see the root CLAUDE.md for it.

## Read first

- `README.md`: structure and how to edit content.
- `HANDOVER.md`: hosting, domain and go-live steps. Keep it accurate when hosting details change.

## Rules

- The site shows no prices and sells nothing. Enquiries go through the Netlify form only.
- The look is a faithful copy of the former Shopify site. Keep the theme CSS in `public/theme` as-is and fix things in `src/html` instead.
- Page content is plain HTML under `src/html`. Do not move it into Astro components: the theme markup contains braces and inline styles that Astro would mangle.
- URLs stay as they were on Shopify. A page that moves gets a line in `public/_redirects`.
- No third-party scripts or CDNs; everything is served from this site. jQuery and slick are vendored under `public/vendor`.
- Photos are WebP under about 300 KB. Big originals belong in `reference/original-images/` (not committed).
- `scripts/harvest.mjs` and `scripts/port.mjs` were a one-off migration. Do not re-run `port.mjs`: it overwrites hand edits.
- Australian English in copy. The business is in Mudgee, NSW.

## Checks

`npm run build` must pass, and every internal link in `dist/` must resolve (see the link check in the repository's history for a one-liner).
