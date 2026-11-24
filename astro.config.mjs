import { defineConfig } from 'astro/config';

// Static output only. URLs keep the exact paths the Shopify site used
// (no trailing slash, e.g. /pages/about-us) so existing links and search
// results keep working after the move to Netlify.
export default defineConfig({
  site: 'https://timbertwo.com',
  output: 'static',
  trailingSlash: 'never',
  build: {
    format: 'file',
  },
});
