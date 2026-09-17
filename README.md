# Aheka (आहे का?) — Hyperlocal Service Discovery Platform

> **"Electrician आहे का?" "Plumber आहे का?"**
> **Aheka (https://aheka.in)** answers that question for Maharashtra's small cities and talukas by connecting citizens directly with verified local service professionals.

---

## 🌟 Core Product Principles

1. **Direct Contact, Zero Commission**:
   - Customers call and WhatsApp providers directly.
   - Aheka does not middle-man payments, take cuts, or arbitrate service orders.
2. **30-Day Free Trial & Flat Annual Subscription**:
   - **30 days free trial** per Vendor + Category + Taluka listing upon admin activation.
   - Seamless conversion to **₹999/year** flat annual subscription preserving remaining trial days.
   - Strict anti-abuse: **One free trial per listing** with auditable admin override logging.
3. **Unified 10-Slot Scarcity Limit**:
   - Strictly capped at **10 active providers** (active trial + active paid) per `(taluka_id, category_id)`.
   - The 11th applicant enters a transparent waitlist.
   - Converted trials within the trial window count as **exactly 1 slot** (never 2).
4. **Deterministic Daily Rotation**:
   - Mathematically fair visibility: every eligible provider (trial and paid equally) gets the coveted **#1 rank exactly once every N days**.
   - Rotates strictly at midnight Indian Standard Time (IST, UTC+5:30).
   - Zero paid auctioning, zero pay-to-win boosts.
5. **Vendor Performance Reports & Bilingual WhatsApp**:
   - Dynamic tracking: Profile Views, Call Clicks, WhatsApp Clicks, Directions Clicks, Share Clicks.
   - **Total Contact Actions** = `Call Clicks + WhatsApp Clicks + Directions Clicks` (excluding views and shares).
   - 1-click bilingual Marathi and English WhatsApp performance summaries and renewal notices.
6. **Hyperlocal SEO Architecture**:
   - SEO-first URL paths: `/[locale]/[district]/[taluka]/[category]`
   - Full bilingual support (Marathi default: `/mr`, English: `/en`).
   - Dynamic auto-noindexing (`noindex, follow`) on thin directory pages (< 3 providers) to prevent Google index dilution.
   - Comprehensive Schema.org structured data (`LocalBusiness`, `BreadcrumbList`, `Organization`).

---

## 🏗️ Architecture & Technology Stack

- **Framework**: Astro 4.x (SSR Mode)
- **Language**: TypeScript (Strict Mode)
- **Styling**: Tailwind CSS + Custom Design System
- **Database**: PostgreSQL via Supabase (Row-Level Security enabled)
- **Edge Deployment**: Cloudflare Pages / Workers via `@astrojs/cloudflare`
- **Testing**: Vitest (Unit, Integration, and Rotation Engine suites)
- **Type Checking**: Astro Check (`@astrojs/check`)

---

## 🚀 Quick Start

### 1. Prerequisites
- Node.js 20+
- npm or pnpm

### 2. Installation
```bash
git clone https://github.com/your-org/aheka.in.git
cd aheka.in
npm install
```

### 3. Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Populate your environment credentials:
```env
PUBLIC_SUPABASE_URL=https://your-project.supabase.co
PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SITE_URL=https://aheka.in
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ADMIN_SESSION_SECRET=your-random-32-char-secret
ADMIN_ENTRY_PATH=local-admin
ADMIN_PASSWORD=your-super-admin-password
```

*(Note: If Supabase credentials are not provided, Aheka automatically falls back to the in-memory mock repository for local development and testing).*

### 4. Running the Dev Server
```bash
npm run dev
```
- Public portal: `http://localhost:4321/mr`
- Internal Admin entry (dev): `http://localhost:4321/local-admin`

### 5. Running Tests
```bash
npm test
```
Runs 72 unit, integration, and security tests covering:
- Deterministic daily rotation engine & IST calendar math
- 10-slot limit concurrency, trials, and waitlisting logic
- Private admin entry rewriting, 404 enforcement on probing paths, and rate limiting
- Category and location management APIs
- Phone number normalization & slugification

### 6. Running Type Checks
```bash
npm run check
```

### 7. Production Build
```bash
npm run build
```

---

## 🗄️ Database Setup (Supabase)

To initialize your production Supabase database, execute the migration files in `supabase/migrations/`:
- Zero hardcoded production records: all districts, talukas, categories, aliases, and providers are managed via Supabase and the Super Admin panel.
- Development/test fixtures are maintained separately in `supabase/seed/seed_dev_data.sql` and never automatically seeded in production builds.
- To seed a local test database:
```bash
supabase db execute --file supabase/seed/seed_dev_data.sql
```

---

## 🔒 Private Admin Architecture & Security

The Admin Panel is **strictly internal** and hidden from the public website:
1. **Zero Public UI**: Every public link or button to the admin area has been removed from headers, footers, menus, and pages.
2. **Configurable Secret Entry Path**: Access is routed via the server-side environment variable `ADMIN_ENTRY_PATH`.
   - Local development: `ADMIN_ENTRY_PATH=local-admin` → `http://localhost:4321/local-admin`
   - Production: Set an unguessable path in Cloudflare (e.g. `ADMIN_ENTRY_PATH=manage-aheka-x7k92p`).
   - **Never commit the production path to GitHub.** `.env.example` contains only a placeholder.
3. **Defense in Depth (Secret Path != Authentication)**:
   - Knowing the private URL gives **no access** to data.
   - Visitors must authenticate via Super Admin password / Supabase credentials.
   - Server validates role before displaying admin contents.
4. **404 Probing Defense**:
   - Requests to `/admin`, `/admin/*`, `/administrator*`, `/wp-admin*`, `/dashboard*`, `/vendor*` return HTTP `404 Not Found` with `X-Robots-Tag: noindex, nofollow`.
   - The server never redirects or hints at the secret endpoint.
5. **SEO Protection**:
   - All internal admin pages enforce `noindex, nofollow`.
   - Admin paths never appear in `sitemap.xml` or `robots.txt`.
6. **Rate Limiting**:
   - Sliding-window rate limiter blocks brute-force login attempts (max 5 failed attempts per 15-minute window; returns HTTP 429).
7. **Safe Credentials**:
   - The Supabase Service-Role key is strictly kept server-side in Cloudflare secrets and is never transmitted to browser bundles.

---

## 🗺️ Public Routes
- `/{locale}` — Homepage (Marathi default: `/mr`, English: `/en`)
- `/{locale}/{district}/{taluka}` — Taluka Hub
- `/{locale}/{district}/{taluka}/{category}` — Hyperlocal Category Directory (10-slot limit & fair rotation)
- `/{locale}/provider/{vendorSlug}` — Single-image verified provider mini-website
- `/{locale}/services` — Service directory
- `/{locale}/join` — Provider onboarding application
- `/sitemap.xml` — Dynamic XML Sitemap
- `/robots.txt` — Crawler Directives

---

## ⚖️ License
Proprietary — All Rights Reserved. Aheka Platform 2026.
