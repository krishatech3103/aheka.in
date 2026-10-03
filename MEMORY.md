# Aheka Project Memory

This file is a concise handover for an AI or developer joining the project.
Read it before changing code, data, secrets, deployment, or public content.

## Product and status

- **Aheka (आहे का?)** is a bilingual hyperlocal directory for Maharashtra.
- Visitors choose a district and taluka, search service categories, and contact listed providers directly.
- The current Cloudflare domain is `https://aheka.krishatech.in`. The intended future primary domain is `https://aheka.in`.
- English and the light theme are the default first-time experience. User choices are persisted per device.
- The current Supabase project is being treated as production. Do not use mock data when production configuration is available.
- Do **not** push to Git or deploy to Cloudflare unless the user explicitly asks in the current task.

## Stack

- Astro 4 SSR with the Cloudflare adapter.
- React islands for interactive UI, Tailwind CSS for styling, TypeScript throughout.
- Cloudflare Workers hosts the app; `wrangler.jsonc` is the Worker configuration.
- Supabase PostgreSQL, Row Level Security, RPC functions, and Storage provide backend services.
- Vitest covers business and repository behavior.

## Important directories

| Path | Purpose |
| --- | --- |
| `src/pages/[locale]/` | Public English (`en`) and Marathi (`mr`) pages. |
| `src/pages/[locale]/[district]/[taluka]/[category].astro` | Public provider-directory category page. |
| `src/pages/[locale]/provider/[slug].astro` | Public provider profile page. |
| `src/pages/internal-admin/` | Protected admin UI. |
| `src/pages/api/internal-admin/` | Protected admin APIs. |
| `src/components/` | Shared Astro/React UI. |
| `src/lib/repositories/dataRepository.ts` | Main data access layer: Supabase in configured environments; mock data only in non-production fallback. |
| `src/lib/supabase/client.ts` | Public and service-role Supabase client creation. |
| `src/lib/location/` | Saved location preference and nearest-taluka helper logic. |
| `supabase/migrations/` | Ordered, versioned database schema/data migrations. Never rename an already-applied migration. |
| `scripts/` | Local development helpers. |
| `wrangler.jsonc` | Cloudflare Worker name, non-secret production vars, assets, compatibility flags. |

## Local development

### Requirements

- Node.js **20 or newer** is required. `.nvmrc` specifies Node 20.
- Use the project command, not a direct `astro dev` command:

```bash
npm run dev
```

`scripts/dev.cjs` starts Astro and automatically adds the Node 20 WebSocket compatibility flag. On this managed Linux workstation it also uses `/etc/ssl/certs/ca-certificates.crt` when available, allowing Node to trust the Supabase HTTPS certificate chain.

### Local environment

Create `.env` from `.env.example` and keep it untracked:

```bash
cp .env.example .env
```

At minimum for a production-data local test, configure:

```env
APP_ENVIRONMENT=production
SITE_URL=http://localhost:4321
PUBLIC_SUPABASE_URL=...
PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

Other server-only values required for the complete admin/join flow are `ADMIN_ENTRY_PATH`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`, and `TURNSTILE_SECRET_KEY`.

Never put secrets in `wrangler.jsonc`, source code, Git, screenshots, chat, or browser code. `.env` and `.dev.vars` are ignored by Git.

### Useful commands

```bash
npm run dev       # local Astro server
npm run check     # Astro/TypeScript validation
npm test          # Vitest suite
npm run build     # production Worker build
```

If `npm run dev` shows a database error, first ensure the command output contains `node scripts/dev.cjs` (not `astro dev`), then restart it. Production mode intentionally refuses to show mock data after a Supabase failure.

## Location, language, and home page rules

- `src/lib/location/preference.ts` stores the saved selection in browser local storage under `aheka_location_v1` and emits `aheka:location-changed`.
- `LocationModal.astro` provides manual district → taluka selection plus nearest-taluka recommendation from browser geolocation. Location is used in-browser only.
- `SearchIsland.tsx` reads the saved preference and routes searches to that taluka.
- The home-page Popular Services grid is **hidden until a valid location is saved**. After saving, card labels and links use only the saved taluka. Do not reintroduce a server-side fallback such as `talukas[0]`; it caused Tasgaon users to see Atpadi.
- `src/lib/i18n/index.ts` holds English/Marathi UI dictionaries. Do not mix languages within one selected locale.

## Public directory and provider rules

- Public directory route: `/{locale}/{district}/{taluka}/{category}`.
- Public provider route: `/{locale}/provider/{vendorSlug}`.
- Breadcrumbs remain in a single horizontal, scrollable row on narrow screens; do not allow separator characters to wrap independently.
- Public category pages do **not** show internal provider-rotation language or automatic "verified providers" marketing copy. Custom admin-created directory introductions may be shown when configured.
- Provider visibility/rotation happens on the server through the Supabase data repository and SQL function. Do not expose the service-role key to the browser.

## Supabase data model and security

Key tables include:

- Geography: `districts`, `talukas`
- Directory: `categories`, `category_aliases`, `vendors`, `vendor_listings`, `vendor_service_areas`, `directory_page_settings`
- Commercial lifecycle: `listing_trials`, `subscriptions`, `payments`
- Admin and analytics: `vendor_applications`, `vendor_application_items`, `analytics_events`, `vendor_report_snapshots`

The public anon key is RLS-restricted. Server-side public directory pages and admin operations may need `SUPABASE_SERVICE_ROLE_KEY`; that key must stay server-only. In `APP_ENVIRONMENT=production`, repository failures deliberately throw instead of falling back to mock records.

### Migration state

Migrations `001` through `013` have been applied to the linked production Supabase project.

- `011_sangli_taluka_location_centres.sql`: Sangli taluka geographic centres.
- `012_tasgaon_test_categories_and_vendors.sql`: 10 public Tasgaon test categories/vendors, clearly labelled `TEST DATA` with non-real phone numbers. Remove them from Admin → Vendors before public launch.
- `013_merge_duplicate_tasgaon_taluka.sql`: canonicalizes active `tasgaon`, moves the 10 test listings there, and marks legacy mixed-case `Tasgaon` inactive. Do not recreate a duplicate Tasgaon record with different casing.

Apply new migrations only through the Supabase CLI after review:

```bash
npx supabase@latest db push --dry-run
npx supabase@latest db push
```

Never edit an applied migration to change remote history; create the next numbered migration instead.

## Cloudflare deployment

1. Validate locally: `npm run check`, `npm test`, and `npm run build` as appropriate.
2. Review `git status` so unrelated user changes are preserved.
3. Configure private Worker secrets with Wrangler or the Cloudflare dashboard:

```bash
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put ADMIN_PASSWORD
npx wrangler secret put ADMIN_SESSION_SECRET
npx wrangler secret put ADMIN_ENTRY_PATH
npx wrangler secret put TURNSTILE_SECRET_KEY
```

4. Keep public/non-secret Worker settings in `wrangler.jsonc`: `SITE_URL`, `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`, `PUBLIC_TURNSTILE_SITE_KEY`, `APP_ENVIRONMENT`, and `SEO_MIN_ACTIVE_PROVIDERS`.
5. Deploy only with explicit user authorization:

```bash
npm run build
npx wrangler deploy
```

When moving from `aheka.krishatech.in` to `aheka.in`, update `SITE_URL`, add/configure the custom domain in Cloudflare, redeploy, then verify canonical tags, sitemap, robots, and Turnstile allowed domains.

## Operational safety

- Preserve a dirty worktree; do not reset, overwrite, or remove unrelated files.
- Use `apply_patch` for source edits.
- Admin vendor/category deletion is intentionally destructive; confirm exact targets and dependencies before changing it.
- Keep one manual weekly Supabase backup in cloud storage if that remains the owner’s backup policy. A database backup does not automatically include Supabase Storage images; download those separately when image uploads are enabled.
- Current public test vendor records are temporary and must be deleted before launch.

## Related documentation

- `README.md`: developer overview.
- `ARCHITECTURE.md`: broader technical design.
- `DEPLOYMENT.md`: Cloudflare/Supabase deployment and secret setup details.
- `PROJECT_STATUS.md`: project status and prior implementation notes.
