# Timber Two marketing site

The public website for Timber Two Joinery (timbertwo.com), rebuilt as a static site from the former Shopify store so it can be hosted for free on Netlify. The shop, cart, customer accounts and search are gone. Enquiry forms post to Netlify Forms, which emails the submissions to the business.

`HANDOVER.md` is the step-by-step guide for putting it live under Jake's accounts and switching the domain over.

## Run it locally

Needs Node.js 20 or later.

```bash
npm install
npm run dev
```

Then open http://localhost:4321. `npm run build` writes the finished site to `dist/`, and `npm run preview` serves that folder the way Netlify will.

## How the site is put together

The look is the Shopify "Dawn" theme as the agency Insil customised it, kept byte-for-byte where it matters:

| Folder | Contents |
|---|---|
| `src/layouts/Base.astro` | The page shell: head, header, footer, scripts. The only place that decides what wraps a page. |
| `src/html/header.html`, `footer.html`, `theme-style.html` | The theme's header, footer and font/colour variables, as plain HTML. Edit these to change the menu or footer details. |
| `src/html/pages/**` | Each page's content, as plain HTML. This is where the words live. |
| `src/html/enquiry-form.html` | The enquiry form used on the contact page and the three service pages. |
| `src/pages/**` | One tiny Astro file per page. It picks the content file and sets the title and description. The file path is the URL. |
| `public/theme` | The theme's stylesheets and scripts, unchanged apart from local image paths. |
| `public/images`, `public/fonts`, `public/videos`, `public/vendor` | Photos (WebP, resized at harvest time), fonts, the About page video, jQuery and slick for the testimonials carousel. |
| `public/_redirects` | Netlify redirects for the old shop, blog and capitalised URLs. |
| `reference/original-site` | The Shopify pages as they were rendered on the day of the move, for reference. |
| `scripts/` | The one-off `harvest.mjs` (pull pages and assets from Shopify) and `port.mjs` (turn them into this site). Documentation of the move; re-running `port.mjs` overwrites hand edits. |

URLs are the same as on Shopify (`/pages/about-us`, `/blogs/news/...`) so existing links and search results keep working. Blog posts that had placeholder URLs got real ones, with redirects from the old ones.

## Editing content

- **Words on a page**: edit the matching file under `src/html/pages/`. Keep the surrounding tags; the classes are what the theme styles.
- **Title or description**: edit the page's file under `src/pages/`.
- **Menu or footer**: `src/html/header.html` and `src/html/footer.html`. The desktop menu and the mobile drawer are separate lists, so change both.
- **A new page**: copy one of the `src/pages/pages/*.astro` files and its content file, then add a menu link. It appears in `sitemap.xml` automatically.
- **Photos**: drop the file in `public/images/` and reference it as `/images/name.webp`. Keep photos under about 300 KB.
- **Enquiry form fields**: `src/html/enquiry-form.html`. Netlify picks up field changes on the next deploy.

Commit and push to `main`; Netlify rebuilds in about a minute.

## What is not here on purpose

- No shop, prices, cart or checkout. The quoting app in the repository root will take over quoting; link it from the menu when it is live.
- No analytics or tracking scripts. Add them to `Base.astro` if wanted.
- The "Vanity Spec Sheet" page still links to the Claude artifact form that preceded the quoting app.
