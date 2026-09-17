# Aheka (आहे का?) — Architecture Documentation

**Aheka** (Marathi: **आहे का?**) is a production-grade hyperlocal service-provider discovery platform for small cities and talukas across Maharashtra, India.
Primary domain: `https://aheka.in`

---

## 1. High-Level Architectural Overview

Aheka is architected for maximum speed, bulletproof reliability, and zero initial hosting costs using a bootstrap-first stack:
- **Client Runtime & Frontend**: Astro 4.x / 5.x with Server-Side Rendering (SSR) deployed to **Cloudflare Workers**.
- **Interactive Islands**: React islands via `@astrojs/react` for complex interactive widgets (admin tables, location picker, modals, analytics charts). Core directory & profile content is rendered directly as server-side HTML in `.astro` components for optimal SEO and instant initial load on budget Android devices.
- **Database, Auth & Storage**: **Supabase** (PostgreSQL 15+, Supabase Auth for Super Admin email/password, Supabase Storage for provider profile images).
- **Styling**: Tailwind CSS with tailored typography (Noto Sans Devanagari + Inter) and an authentic Maharashtra-local color palette (warm saffron/amber `#E65100`/`#F57C00`, charcoal `#1F2937`, off-white canvas `#FBFBFA`).
- **PWA**: Mobile-first Progressive Web App with service worker, web app manifest, and offline shell.

```
                  +----------------------------------------------+
                  |           User / Crawler Request             |
                  |                https://aheka.in              |
                  +----------------------------------------------+
                                         |
                                         v
                  +----------------------------------------------+
                  |         Cloudflare Edge Network              |
                  |  - HTTPS termination                         |
                  |  - Apex canonical redirect (www -> apex)     |
                  |  - Cloudflare Turnstile bot protection       |
                  |  - Cloudflare Worker (Astro SSR Runtime)     |
                  +----------------------------------------------+
                                         |
                                         v
                  +----------------------------------------------+
                  |         Astro SSR & Middleware               |
                  |  - src/middleware.ts                         |
                  |    * Intercept probed paths (/admin*, etc) -> 404 |
                  |    * Block direct /internal-admin* -> 404   |
                  |    * Rewrite /{ADMIN_ENTRY_PATH} -> /internal-admin |
                  |    * In-memory sliding-window Rate Limiter   |
                  |    * X-Robots-Tag: noindex, nofollow         |
                  |  - Public Routes: /{locale}/...              |
                  |  - Private Admin Routes (rewritten)          |
                  |  - Server Endpoints: /api/...                |
                  +----------------------------------------------+
                                         |
                                         v
                  +----------------------------------------------+
                  |              Data Repository                 |
                  |  - SupabaseDataRepository                    |
                  |    * Dynamic Supabase queries (RLS protected)|
                  |    * Fallback to resilient in-memory state   |
                  |    * Zero-crash on empty tables              |
                  +----------------------------------------------+
                                         |
                      +-------------------+-------------------+
                      |                                       |
                      v                                       v
       +-----------------------------+         +-----------------------------+
       |  Public Supabase Client     |         |  Server-Side Admin Client   |
       |  (Scoped by RLS Policies)   |         |  (Service Role Secret)      |
       +-----------------------------+         +-----------------------------+
                      \                                       /
                       \                                     /
                        v                                   v
                  +----------------------------------------------+
                  |          Supabase PostgreSQL DB              |
                  |  - Core Tables: districts, talukas,          |
                  |    categories, category_aliases, vendors,    |
                  |    vendor_listings, listing_trials, payments |
                  |  - is_featured & sort_order indexes          |
                  |  - Atomic Slot-Locking Functions             |
                  |  - Deterministic Daily Rotation Engine       |
                  |  - Full Row Level Security (RLS)             |
                  +----------------------------------------------+
```

---

## 2. Core Business Rules & Domain Logic

### 2.1 The Commercial Unit & 30-Day Free Trial
$$\text{1 Listing} = \text{1 Vendor} + \text{1 Category} + \text{1 Taluka}$$
- **30-Day Free Trial**: Offered per listing commercial unit. Starts ONLY when admin explicitly triggers "Start 30-Day Trial".
- **Anti-Abuse Rule**: Strictly **one free trial per listing**. Subsequent trial starts require explicit Admin Override with a logged justification.
- **Annual Subscription**: **₹999 / listing / year** (configurable in `site_settings`).
- **Trial-to-Paid Conversion**: If payment is recorded while trial is running, the paid period begins at trial expiry, preserving all remaining free days. If paid post-expiry, slot availability is re-verified.
- Manual payment methods: UPI, Cash, Bank Transfer, Other. No third-party payment gateway in V1.

### 2.2 Provider Limit (Max 10 per Taluka + Category)
- Hard limit of **10 active providers** per Taluka + Category combination.
- **Both active trials and active paid listings count toward this limit**.
- Overbooking prevention is guaranteed at the database layer via atomic transaction logic and `SELECT ... FOR UPDATE` row-level locks.
- **Non-Duplication**: A listing that converts to paid while still on free trial represents **exactly 1 slot**, never 2.
- When 10 slots are occupied, subsequent approved listings enter the **Waiting List** ordered chronologically (`created_at ASC`).

### 2.3 Fair Daily Provider Rotation Algorithm
To ensure no provider permanently monopolizes top visibility, Aheka implements deterministic daily rotation:
- Timezone: `Asia/Kolkata` (midnight IST boundary).
- For $N$ active providers ($1 \le N \le 10$):
  1. Providers are sorted by stable activation key (`first_activated_at ASC, id ASC`).
  2. Calendar day number is calculated in IST: $\text{dayNumber} = \lfloor \frac{\text{epochMs}_{\text{IST}}}{86400000} \rfloor$.
  3. Offset is calculated: $\text{offset} = \text{dayNumber} \pmod N$.
  4. The array is sliced: $\text{Rotated} = \text{Providers}[\text{offset}:N] \mathbin{\Vert} \text{Providers}[0:\text{offset}]$.
- Over $N$ consecutive days, each active provider holds position #1 exactly once.
- **Equal Treatment**: Trial providers participate identically to paid providers; zero sponsored placement, zero ranking penalty.
- All visitors and crawlers receive the exact same sequence on any given calendar day.

### 2.4 Authoritative Unified Listing Eligibility Matrix
A listing is publicly discoverable and included in sitemaps/rotation if and only if:
1. `vendor.approval_status = 'approved'` AND `vendor.is_suspended = false` AND `vendor.is_publicly_visible = true`
2. `vendor_listing.approval_status = 'approved'` AND `vendor_listing.is_visible = true`
3. `category.is_visible = true`
4. `taluka.is_active = true` AND `district.is_active = true`
5. **EITHER**:
   - **Condition A (Free Trial)**: An active trial exists where $\text{starts\_at} \le \text{NOW}() < \text{ends\_at}$ in IST and `status IN ('active', 'converted')`.
   - **OR Condition B (Paid Subscription)**: An active paid subscription exists where $\text{starts\_at} \le \text{NOW}() < \text{ends\_at}$ in IST and `status = 'active'`.

### 2.5 Dynamic Directory & Zero Hardcoded Production Data
- **No Hardcoded Data**: Production code contains zero hardcoded districts, talukas, categories, aliases, or provider details.
- **Featured Sorting**: Homepage and Footer "Popular Services" and "Key Talukas" load active entities ordered by `is_featured DESC, sort_order ASC`.
- **Search Island**: Category search queries match dynamically against `name_en`, `name_mr`, and database-stored `category_aliases` (e.g. wireman, electrician).
- **Empty Database Resilience**: If Supabase has zero records in any table, the application renders friendly, localized empty states without throwing 500 errors or crashing.

### 2.6 Single Profile Image Policy
- Exactly **one optional profile image** per vendor (personal photo, shop exterior/interior, or logo).
- There are no multi-image galleries.
- When absent, the UI renders an accessible, high-contrast monogram placeholder that adapts seamlessly to both Light and Dark modes.

---

## 3. Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| Runtime / Edge | Cloudflare Workers | Serverless edge execution for SSR routes and static assets |
| Framework | Astro (`@astrojs/cloudflare`) | Fast SSR by default, zero client JS for static content |
| UI Islands | React 18/19 (`@astrojs/react`) | Interactive components (filters, dialogs, charts, forms) |
| Styling | Tailwind CSS | Utility-first responsive design, mobile-first breakpoints |
| Database | Supabase PostgreSQL 15+ | Relational data, RLS, transactional slot locks, stored procedures |
| Authentication | Supabase Auth + Session Cookies | Super Admin email/password with secure session cookies |
| Storage | Supabase Storage | Bucket: `vendor-profile-images` (public-read) |
| Schema Validation | Zod | Server-side request validation and type inference |
| Anti-Spam | Cloudflare Turnstile | Server-verified bot protection on `/join` and admin login |

---

## 4. Security & Privacy Architecture

### 4.1 Private Admin Entry & Probing Defense
- **Private Entry Path**: Admin entry is exposed exclusively through a server-side environment variable `ADMIN_ENTRY_PATH` (e.g. `/manage-aheka-x7k92p` in production, `/local-admin` in dev).
- **Probing Interception**: Obvious admin and legacy paths (`/admin`, `/admin/*`, `/administrator*`, `/wp-admin*`, `/dashboard*`, `/vendor*`) are intercepted by `src/middleware.ts` and return standard **404 Not Found** with `X-Robots-Tag: noindex, nofollow`. The private path is never revealed or redirected to.
- **Direct Route Protection**: The underlying implementation path (`/internal-admin/*`) returns 404 if accessed directly.
- **Defense in Depth**: The private URL is merely an obscurity layer. Any privileged operation requires valid Supabase Super Admin authentication and session role verification.

### 4.2 Rate Limiting
- An in-memory sliding-window rate limiter (`src/lib/security/rateLimiter.ts`) tracks failed login attempts by client IP.
- Threshold: 5 failed attempts per 15 minutes.
- When triggered, returns HTTP 429 with `Retry-After` headers and time remaining.

### 4.3 Crawler & SEO Protection
- All admin and probed endpoints send `X-Robots-Tag: noindex, nofollow, noarchive`.
- Admin pages are strictly excluded from `sitemap.xml`.
- The secret production path is **never** added to `robots.txt`.

### 4.4 Credential & Secret Isolation
- `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY` are safe for public/client-side queries scoped by Supabase RLS.
- `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_PASSWORD`, `ADMIN_ENTRY_PATH`, and `JWT_SECRET` are strictly kept server-side in Cloudflare secrets and never leaked to the browser.
