# Putting the site live, and handing it over

This is the order of work for moving timbertwo.com off Shopify onto Netlify, all under Jake's own accounts, and what to leave him with. Written November 2026; Netlify's plans and screens change, so check anything that looks different.

## What the move changes

- The website is now a set of plain files (this repository, built with `npm run build`). Netlify hosts them for free.
- The shop, cart, customer login and search are gone. There are no prices anywhere on the site.
- Every enquiry form (contact page and the three service pages) posts to Netlify Forms, which emails the enquiry to the business and keeps a copy in the Netlify dashboard. Later, the quoting app (its own private repository, `Timber-Two-Quoting-app`) takes over quoting.
- Shopify gets cancelled. The domain stays at GoDaddy. The email (info@timbertwo.com) runs on Microsoft 365 and is not touched.

## 1. Accounts, all in Jake's name

1. **GitHub** (free): Jake's account owns two repositories, `timbertwo-website` (this site, public) and `Timber-Two-Quoting-app` (the quoting app, private). The website repository is public on purpose: Netlify's free plan builds a private repository's commits from only one GitHub account, which would stop anyone but Jake from updating the site. Whoever maintains the site is added as a collaborator on `timbertwo-website` (repository Settings, Collaborators).
2. **Netlify** (free): sign up at netlify.com with Jake's email, choosing "Sign up with GitHub" so Netlify can read the repository.

## 2. Deploy the site to Netlify

1. In Netlify: Add new site, Import an existing project, GitHub, pick the repository.
2. Build settings:
   - Base directory: leave blank
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Branch: `main`
   `netlify.toml` repeats these and pins Node 22.
3. **Before the first deploy**, open the site's Forms tab and turn on "Enable form detection". Without it the enquiry form does nothing. If the site was already deployed, turn it on and trigger a new deploy.
4. Deploy. Netlify gives the site a random name like `brave-curie-12345.netlify.app`. Rename it under Site configuration, Site details, Change site name, to `timbertwo`.
5. Check every page on the `.netlify.app` address with Jake. Send a test enquiry.

Notes on Netlify's layout as of November 2026 (the "Manage" screen):

- Build settings live under Manage, Build and deploy, Build settings. The base directory must be blank. (The site was first imported from inside the quoting app's repository with a base directory of `site`; the free plan's one-contributor rule on private repositories then blocked every build, which is why the site has its own public repository.)
- There is no Trigger deploy button. A push to `main` starts a build. A commit that changes no files shows as "Didn't build".
- Manage, "Who can see it" starts as "Private, only you". Set it to public before the domain is connected; while private, every page answers 401 to visitors.
- The Forms screen under Manage only offers to have Netlify's AI agent add a form. The classic switch for forms already in the pages is at `app.netlify.com/projects/<project>/configuration/forms` (or type "form detection" in the Find a setting box). Enable it, then deploy once more so the form is registered.
- Switch off "Show the Powered by Netlify badge" on the Manage screen.
- Each production deploy spends 15 of the plan's 300 monthly credits, so settle settings first and build once.

## 3. Enquiry emails

1. Forms, Submission notifications, Add notification, Email notification. Recipient: info@timbertwo.com. Form: `enquiry`.
2. Add a second notification to Jake's personal email if he wants a backup copy.
3. Submissions also sit under Forms, `enquiry`, with a spam folder. The form has a hidden honeypot field and Netlify runs its own spam filter.
4. Limits: on Netlify's current credit-based plans, form submissions are free and unlimited. Older "legacy" plans allowed 100 a month.

## 4. Point the domain at Netlify (GoDaddy stays the registrar)

1. In Netlify: Domain management, Add a domain, `timbertwo.com`. Netlify adds `www.timbertwo.com` as well. Make `timbertwo.com` the primary domain so the web addresses stay exactly as they were.
2. In GoDaddy (Jake's login, My Products, timbertwo.com, DNS): change only these two records.

   | Type | Name | Change from | Change to |
   |---|---|---|---|
   | A | `@` | `23.227.38.65` (Shopify) | `75.2.60.5` (Netlify) |
   | CNAME | `www` | Shopify's address | `timbertwo.netlify.app` (the site's Netlify address) |

   Do not touch any other record. The MX record, the TXT record starting `v=spf1`, and anything mentioning `outlook`, `microsoft`, `autodiscover` or `dkim` run the email. Leaving old Shopify verification TXT records in place is harmless.
3. Back in Netlify, wait for the domain to show as verified and for the HTTPS certificate to be issued (minutes, sometimes a few hours). Then turn on Force HTTPS under Domain management, HTTPS.
4. Test https://timbertwo.com, https://www.timbertwo.com, a blog post, and the enquiry form.

Netlify's own advice with an outside DNS provider is to make `www` the primary domain, because an apex A record cannot use their full network. Keeping the apex as primary matches the old addresses; it is a fair trade for a site this size.

## 5. Cancel Shopify

Only once the domain is live on Netlify and checked:

1. Shopify admin, Settings, Plan, Deactivate store. Shopify offers a pause plan; it is not needed.
2. Cancel the Judge.me reviews app if it bills separately.
3. The photos and the About page video are already copied into this repository, so nothing on the new site depends on Shopify's servers.
4. Keep paying GoDaddy for the domain and Microsoft for the email. Those are the only ongoing costs.

## 6. Free plan limits, as of November 2026

Netlify's free plan is credit-based: 300 credits a month. Bandwidth costs 20 credits per GB (about 15 GB a month), each production deploy 15 credits (about 20 a month), and web requests 2 credits per 10,000. A quiet trade website fits, but the About page video (the largest file on the site) is loaded on desktop screens only for that reason. If the site ever outgrows the plan, Cloudflare Pages hosts static sites with no bandwidth cap and this site would move unchanged apart from the form handling.

## 7. Things for Jake to look at

- The kitchen service page repeats the bathrooms text word for word. It did on Shopify too.
- The privacy policy and terms are Shopify's templates and talk about purchases and payments.
- The enquiry form's service choices are now Furniture, Bathrooms, Kitchens and Other. On Shopify the labels and values were mismatched.
- The two home page cards that pointed at the shop now read "Custom Vanities" and "Custom Furniture" with Enquire Now buttons.
- The "Designed by Insil" credit stays in the footer.
- The old "Vanity Spec Sheet" page still links to the Claude artifact form that came before the quoting app.
- Body text uses the browser's default sans-serif font. The theme asks for "Gilroy-Regular", which was never loaded on the old site either.

When the quoting app is live, link it from the header menu (both the desktop list and the mobile drawer in `src/html/header.html`) and from the two home page cards.

## 8. What Jake keeps

- Logins: GitHub, Netlify, GoDaddy, Microsoft 365. Nothing else.
- Two repositories under his GitHub account: `timbertwo-website` (this site) and `Timber-Two-Quoting-app` (the quoting app).
- `reference/original-images/` on the computer that did the move holds full-size copies of every photo and the original 97 MB video, for his records. It is not in the repository.
