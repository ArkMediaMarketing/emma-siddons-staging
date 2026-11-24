# Emma Siddons website studio

Astro.js admin with a Cloudflare Workers API and persistent Cloudflare D1 content storage. The public website is built from the existing static HTML, CSS and photographs; the source templates remain intact.

## Run locally

From `cms`:

```powershell
npm ci
npm run build
npm run dev
```

Open http://localhost:8787/admin/ . This serves the complete website and admin on the same origin. The old Python server at port 8000 serves static source files only and cannot run the API.

The local server uses Node 24 SQLite and executes the same Worker handlers, with a small local implementation of the asset binding and HTMLRewriter. Its database is `.local/content.sqlite`, excluded from Git. This fallback is provided because the native Windows workerd binary crashes on this machine. On a supported workerd host, `npm run db:local` followed by `npm run dev:worker` uses Cloudflare's native local runtime.

## Content workflow

- Overview links to 16 pages, shared header/footer, and media.
- Select a page and then a section. Text, links, SEO title/description and image alternative text are editable.
- Choose an existing photograph, or upload JPEG, PNG or WebP files up to 1 MB. Uploads are durable in D1. Existing original site images stay at their original quality.
- Save draft persists private changes. Preview opens saved drafts, including shared content. Publish makes the saved page visible on the Worker-hosted website. Each document publishes independently.
- Discard draft restores the last published values (or original content).
- Revision checking prevents silently overwriting another editor's saved work.
- The admin edits existing sections. It does not add/delete pages, change section layouts, manage email delivery or provision additional users.

The build injects display-contents `cms-text` elements into the deployable copy. This permits safe plain-text updates while preserving the original nested emphasis and page layouts. The source templates are never rewritten by this preparation.

## Deployment already provisioned

- Worker: `emma-siddons-admin`
- URL: https://emma-siddons-admin.itswebsitedeveloper-ews.workers.dev
- Database: `emma-siddons-cms`
- Administrator: `itswebsitedeveloper.ews@gmail.com`

### Administrator sign-in (no Zero Trust required)

The studio uses its own email/password login. There is no Cloudflare Access or Zero Trust subscription requirement.

Run `npm run auth:setup` from `cms` to issue a private, single-use setup link for the configured administrator. The account owner opens that link and chooses a password of at least 14 characters. Links expire after 24 hours. Issuing a new unused link invalidates previous unused links. Setup is disabled once an administrator exists.

Passwords are salted and hashed using Web Crypto PBKDF2-SHA256 (100,000 iterations). Sessions are opaque random tokens, stored only as SHA256 hashes in D1, and expire after eight hours. The browser receives a Secure, HttpOnly, SameSite=Strict cookie. Sign out revokes the session. Authentication is rate-limited to ten attempts per IP per 15 minutes. A setup token cannot be reused.

There is no email-password recovery service configured. Account recovery requires a deliberate administrator operation through the Cloudflare account; credentials are not recoverable from their stored hashes. Never commit setup links, passwords, database dumps or session tokens.

Production rejects API requests without a valid session and redirects unauthenticated admin visits to the branded login page. The local-only bypass is constrained to loopback and is never deployed to production. Mutating requests require the same Origin. Uploaded SVG/HTML and unsafe URL protocols are rejected; text is HTML-escaped on publication.

Deploy updates with `npm run build` then `npx wrangler deploy --env ""`.

## Netlify integration

`netlify.toml` builds a small routing-only deployment using `scripts/netlify-bridge.mjs`. The existing legacy redirects are preserved. Public routes are forced proxy rewrites to the Worker, preserving the Netlify URL, including uploaded media. The admin, login and API are proxied on the Netlify origin too. Secure host-only cookies are issued for the Netlify hostname; the browser stays on Netlify. A fixed proxy header is used only for client-facing redirects. CSRF checks allow only the explicitly configured Netlify and Worker origins. No source code, credentials, dependencies or local databases are included in the Netlify deploy directory.

The Worker returns `Cache-Control: no-store` and `Netlify-CDN-Cache-Control: no-store` for rendered HTML. Publishing a page in the admin immediately changes the content served on Netlify, without rebuilding Netlify. Drafts remain private. Source layout or code changes still require a Worker build/deployment; routing changes require a Netlify deploy. Keep the Worker and its D1 database active, since they now supply the live website.

## Verification

```powershell
npm test
npx wrangler deploy --env "" --dry-run
```

Tests require the local server running. They cover draft isolation, private preview, safe HTML output, publishing, optimistic concurrency, same-origin checks, URL validation and production authentication failure, single-use setup, password login, logout and rate limiting. Test content is restored after execution.

## Maintenance

Run `npm run build` after changing source HTML or images. Content field identifiers are derived from page and element order, so inserting/removing source text or links can shift identifiers. Before structural source changes, export/backup D1 and reconcile saved overrides with the generated `worker/catalog.json`. Keep `node_modules`, `.local`, `.wrangler` and `.dev.vars` out of Git and public assets.
