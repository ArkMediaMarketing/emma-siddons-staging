# Emma Siddons website studio

Astro public website and admin, with HTML/CSS templates, TypeScript interactions, a TypeScript Cloudflare Workers API and persistent Cloudflare D1 content storage. All 10 public pages compile from `src/pages/**/*.astro` through `src/layouts/SiteLayout.astro`. Original CSS and photographs live in `public/` and keep their existing URLs.

## Run locally

From `cms`:

```powershell
npm ci
npm run build
npm run dev
```

Open http://localhost:8787/admin/ . This serves the complete website and admin on the same origin. From the repository root, run `npm ci`, `npm --prefix cms ci`, then `npm run dev` to build Astro and serve the website at http://localhost:8000/ with the admin at `/admin/`. Rebuild after editing Astro templates or CSS. Do not use a Python static server; public source is now Astro, not root HTML files.

The local server uses Node 24 SQLite and executes the same Worker handlers, with a small local implementation of the asset binding and HTMLRewriter. Its database is `.local/content.sqlite`, excluded from Git. This fallback is provided because the native Windows workerd binary crashes on this machine. On a supported workerd host, `npm run db:local` followed by `npm run dev:worker` uses Cloudflare's native local runtime.

## Content workflow

- Overview links to 10 pages, shared header/footer, and media.
- Select a page and then a section. Text, links, SEO title/description and image alternative text are editable.
- Choose an existing photograph, or upload JPEG, PNG or WebP files up to 1 MB. Uploads are durable in D1. Existing original site images stay at their original quality.
- Save draft persists private changes. Preview opens saved drafts, including shared content. Publish makes the saved page visible on the Worker-hosted website. Each document publishes independently.
- Discard draft restores the last published values (or original content).
- Revision checking prevents silently overwriting another editor's saved work.
- The admin edits existing sections. It does not add/delete pages, change section layouts, manage email delivery or provision users through the browser. Account invitations are issued through the authenticated Cloudflare CLI.

The build injects display-contents `cms-text` elements into the deployable copy. This permits safe plain-text updates while preserving the original nested emphasis and page layouts. The source templates are never rewritten by this preparation.

## Deployment in Ben's Cloudflare account

- Account: Hello@inf-tec.com's Account; account ID `1db9e5cc88c4798f56a21f0bad526c3d`, confirmed by Ben on 24 November 2026.
- Worker: `emma-siddons-admin`
- Website: https://emma-siddons-admin.tight-darkness-d12f.workers.dev/
- Proposed future homepage: https://emma-siddons-admin.tight-darkness-d12f.workers.dev/home-new/
- Admin: https://emma-siddons-admin.tight-darkness-d12f.workers.dev/admin/
- Database: `emma-siddons-cms`, ID `66e8853a-ee80-4442-97ab-eacd5d2ebfd8`.
- Administrator: `ben@webdesignessex.io`. Ben's existing supplied website password remains valid on the migrated site; passwords are never committed.

The existing homepage remains at `/`. Work on `/home-new/` must not replace it until Ben requests the final switch.

The 24 November migration copied the three saved CMS documents, including separate drafts/published values and revisions. The source reported no uploaded media. Repository image assets deploy with the Worker. Historical audit records and other administrators' password hashes were not available through the source CMS API; source sessions, setup tokens and unknown accounts were not copied. Ben's administrator account was recreated with the existing password and a fresh salt. The former hosting remains a rollback source until deliberately retired.

Each developer uses their own Cloudflare login and account membership. Run `npx wrangler login`, then deploy from the repository root using `npm run deploy`. The tracked configuration pins Ben's account and database, so deployments cannot silently target a developer's own account. Do not share Ben's Cloudflare password. For team permissions, give deployment access to the Emma Worker and the required database access; avoid unrelated account administration.

### Administrator sign-in (no Zero Trust required)

The studio uses its own email/password login. There is no Cloudflare Access or Zero Trust subscription requirement.

Run `npm run auth:setup` from `cms` to issue a private, single-use setup link for the configured administrator. The account owner opens that link and chooses a password of at least 14 characters. Links expire after 24 hours. Issuing a new unused link invalidates previous unused links. Setup is disabled for an email once that administrator exists. To invite an additional administrator, run `npm run auth:setup -- ben@webdesignessex.io` from `cms` and privately share the one-use link. Each administrator has separate credentials and sessions; all administrators have the same CMS permissions.

Passwords are salted and hashed using Web Crypto PBKDF2-SHA256 (100,000 iterations). Sessions are opaque random tokens, stored only as SHA256 hashes in D1, and expire after eight hours. The browser receives a Secure, HttpOnly, SameSite=Strict cookie. Sign out revokes the session. Authentication is rate-limited to ten attempts per IP per 15 minutes. A setup token cannot be reused.

There is no email-password recovery service configured. Account recovery requires a deliberate administrator operation through the Cloudflare account; credentials are not recoverable from their stored hashes. Never commit setup links, passwords, database dumps or session tokens.

Production rejects API requests without a valid session and redirects unauthenticated admin visits to the branded login page. The local-only bypass is constrained to loopback and is never deployed to production. Mutating requests require the same Origin. Uploaded SVG/HTML and unsafe URL protocols are rejected; text is HTML-escaped on publication.

Deploy updates with `npm run build` then `npx wrangler deploy --env ""`.

## Former Netlify address

Netlify is no longer the website's hosting entry point. The retained `netlify.toml` exists only to redirect old Netlify links to the new Cloudflare URL, preserving their paths. It must not proxy to the former developer-account Worker. The website, CMS and D1 content database run in Ben's Cloudflare account; no Netlify build is needed to publish changes there.

To publish source changes, run `npm run deploy` from the repository root. CMS publishing updates the Cloudflare website immediately without a source rebuild. Drafts remain private and documents publish independently. Keep the Worker and its D1 database active.

## Verification

```powershell
npm test
npx wrangler deploy --env "" --dry-run
```

Tests require the local server running. They cover draft isolation, private preview, safe HTML output, publishing, optimistic concurrency, same-origin checks, URL validation and production authentication failure, single-use setup, password login, logout and rate limiting. Test content is restored after execution.

## Maintenance

Run `npm run build` after changing Astro templates, CSS, TypeScript or images. Content field identifiers are derived from page and element order, so inserting/removing source text or links can shift identifiers. Before structural source changes, export/backup D1 and reconcile saved overrides with the generated `worker/catalog.json`. Keep `node_modules`, `.local`, `.wrangler` and `.dev.vars` out of Git and public assets.

## Astro migration verification

From the repository root, `npm run check` checks application TypeScript, `npm test` runs the API/auth/media tests (local server on 8787), and `npm run test:migration` checks the built DOMs, original assets, and CMS field identities against the pre-migration contract. Intentional future edits require reviewing and updating that snapshot. No browser JavaScript framework is shipped. Public-page TypeScript handles mobile-menu dismissal; FAQ details, navigation and page content remain native HTML/CSS. Admin interactions and Cloudflare request handlers use TypeScript. Node.js remains a build/test dependency required by Astro, not a public hosting server.

Multi-user accounts are stored in `administrator_accounts`. Applying `worker/schema.sql` copies the legacy owner account without changing its password hash. The legacy table is retained for rollback; sessions are checked against the active account table.

## Visual content editing

Headings and paragraphs are edited as complete blocks using the bundled Tiptap editor (bold, italic, underline, links, line breaks and undo/redo). Images, button/link text, destinations and SEO remain separate fields. Labels describe their purpose rather than duplicating content. Original text IDs remain in the schema for saved-content compatibility; grouped fields use nullable overrides and reconstruct untouched content from the original fragments. No database rewrite is required. Both API saves and rendering sanitize rich HTML to permitted inline formatting, stripping scripts, event handlers, styles and unsafe URLs. Existing layouts and public assets remain unchanged.

The blog archive and five post pages have been retired. `/blog`, `/blog/*`, `/post` and `/post/*` return HTTP 410, including old HTML variants. They are absent from the Astro routes and CMS catalog. Historical D1 records are retained for recovery and are not served by the website.

Related adjacent body paragraphs now share one Content editor. Forced single line breaks are normalized to spaces in the editing view; Enter creates real paragraphs. Nullable paragraph-group overrides preserve existing fragment and rich-text values until edited. Publishing replaces the paragraph run with sanitized paragraph HTML, keeping source paragraph classes and preventing duplicate old paragraphs.

## Repeating content

Eight repeater groups cover homepage/V2 service steps, Home New benefits/journey/areas/FAQs, V2 FAQs, and the How I can help you process. Entries can be added (up to 30), removed, expanded, and moved up/down. Their title, description/answer, optional links/images and original step icons stay together. Numbered templates generate their numbers from array order; manual number fields are hidden. Existing flat field IDs remain compatible and seed the repeater until it is edited. Changes stay private until published. Source SVG templates and sanitized nested field values are used for rendering; administrators cannot supply arbitrary markup or scripts.
