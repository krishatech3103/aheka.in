# Aheka (आहे का?) — Project Status

**Last Updated**: V1 Update Complete (2026-09-07)  
**Primary Domain**: https://aheka.in  
**Tech Stack**: Astro 4.x / 5.x (SSR) + React Islands + TypeScript + Tailwind CSS + Cloudflare Workers + Supabase (PostgreSQL + RLS + Storage)

---

## 📊 High-Level Delivery Summary

| Module | Status | Highlights & Verification |
|---|---|---|
| **Phase 1: Core Hyperlocal Platform** | ✅ Complete | Multilingual routing (`/mr`, `/en`), deterministic daily rotation, single-image policy, `/join` flow, SEO schemas, PWA |
| **Phase 2: 30-Day Free Trial & ₹999/yr** | ✅ Complete | 1 listing = 1 vendor + 1 category + 1 taluka, 10-slot scarcity cap, anti-abuse rule with admin override, early conversion preservation |
| **Phase 3: Light + Dark + System Theme** | ✅ Complete | Complete theme support across Public, Admin, and PWA with zero-flash inline blocking script and semantic tokens |
| **V1 Update: Vendor Portal Removal** | ✅ Complete | Removed vendor login and authenticated vendor portal; Super Admin manages all listings, trials, and reports |
| **V1 Update: Private Admin Entry** | ✅ Complete | Obscured admin entry via `ADMIN_ENTRY_PATH` env var; `/admin*`, `/wp-admin*`, `/dashboard*` probe defense returns 404; sliding-window rate limiting; crawler exclusion |
| **V1 Update: Zero Hardcoded Directory Data** | ✅ Complete | Completely removed all hardcoded districts, talukas, categories, aliases, and provider details; 100% dynamic Supabase-driven with polite empty states |

---

## 🔒 Security & Admin Entry Architecture Verification

- [x] **No Public Admin Links**: Header, footer, menus, mobile navigation, and CTA sections contain zero references to admin login.
- [x] **Private Entry Path (`ADMIN_ENTRY_PATH`)**: Route rewritten in `src/middleware.ts` from `/{ADMIN_ENTRY_PATH}` to internal admin pages.
- [x] **Probing Interception (HTTP 404)**: Direct requests to `/admin`, `/admin/*`, `/administrator*`, `/wp-admin*`, `/dashboard*`, `/vendor*` return standard 404 with `X-Robots-Tag: noindex, nofollow`. The secret path is never revealed or redirected to.
- [x] **Direct Route Protection**: Direct access to `/internal-admin/*` returns HTTP 404.
- [x] **Authentication Strictly Required**: Reaching the private path only shows the login screen. Valid Super Admin credentials and server-side role check (`is_admin: true`) are required.
- [x] **Sliding-Window Rate Limiting**: In-memory sliding-window limiter blocks IP after 5 failed password attempts within 15 minutes with HTTP 429 Too Many Requests.
- [x] **SEO Isolation**: All admin and probed pages return `X-Robots-Tag: noindex, nofollow, noarchive`. Excluded from `sitemap.xml`. Never added to `robots.txt`.
- [x] **Secret Isolation**: `ADMIN_ENTRY_PATH`, `ADMIN_PASSWORD`, `SUPABASE_SERVICE_ROLE_KEY`, and `JWT_SECRET` are strictly server-side and never exposed to the client.

---

## 📋 Hardcoded Production Data Audit

A comprehensive repository audit was conducted across components, pages, React islands, translation dictionaries, constants, and utilities to eliminate all hardcoded production directory data.

### Audit Findings & Removals

1. **Category Search Aliases (`src/components/SearchIsland.tsx`)**:
   - *Removed*: Hardcoded `SERVICE_ALIASES` dictionary (`{ electrician: ['wireman', 'light'], ... }`).
   - *Replaced with*: Dynamic queries against database-stored `category.aliases` from the `category_aliases` table and `aliases` array.

2. **Homepage Default Fallback Entities (`src/pages/[locale]/index.astro`)**:
   - *Removed*: Hardcoded `{ slug: 'ahilyanagar' }` and `{ slug: 'sangamner' }` fallback slugs in category link generators.
   - *Replaced with*: Fully dynamic entity resolution from Supabase with polite empty states if no districts or categories exist yet.

3. **Provider Profile Fallback Links (`src/pages/[locale]/provider/[slug].astro`)**:
   - *Removed*: Hardcoded `'ahilyanagar'` fallback in breadcrumb links and back button.
   - *Replaced with*: Dynamic listing-associated district slug lookup with localized fallback route.

4. **Public Footer Navigation (`src/components/Footer.astro`)**:
   - *Removed*: Hardcoded `Admin Login` button and static link mappings.
   - *Replaced with*: Dynamic queries for featured categories and featured talukas (`is_featured DESC, sort_order ASC`) with zero admin references.

5. **Database Seed Data Isolation (`supabase/migrations/005_seed_dev_data.sql`)**:
   - *Removed*: Automatic insertion of demo vendors, listings, and fixtures into production migrations.
   - *Replaced with*: Converted migration `005` into a safe no-op. Seed fixtures moved to standalone `supabase/seed/seed_dev_data.sql` runnable explicitly via `npm run db:seed` for development only.

6. **Provider Monogram Placeholders (`src/components/ProviderCard.astro`, `src/pages/[locale]/provider/[slug].astro`)**:
   - *Audited*: Confirmed zero fake stock profile photos exist.
   - *Enhanced*: Single provider image policy strictly enforced; missing images generate an initials monogram avatar supporting both Light and Dark themes (`dark:bg-brand-950/60 dark:text-brand-300`).

7. **Zero-Crash Empty Database Behavior**:
   - *Audited*: `MockDataRepository` and `SupabaseDataRepository` tested for empty tables (0 districts, 0 talukas, 0 categories, 0 vendors).
   - *Enhanced*: All public and admin pages render polite, accessible empty states instead of crashing or throwing 500 errors.

8. **Admin Panel Management Capabilities**:
   - *Added*: Full CRUD management for Categories (`/categories`), Locations (`/locations`), and Payments (`/payments`), allowing Super Admins to manage all directory data directly through the UI.

---

## 🧪 Verification & Test Results

```bash
# 1. Run Automated Test Suite (72 tests across 9 test suites)
npm test
# Result: 9 passed, 72 passed, 0 failed (100%)

# 2. Astro Typecheck & Diagnostics
npx astro check
# Result: 0 errors, 0 warnings across 59 files

# 3. Production SSR Cloudflare Build
npm run build
# Result: Successfully built Cloudflare SSR worker in 5.6s
```
