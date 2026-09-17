# Aheka (आहे का?) — Administrator Guide

This guide provides operational and security instructions for Aheka super administrators managing service providers, categories, locations, 30-day free trials, 10-slot limits, ₹999/year conversions, and performance reports across Maharashtra.

---

## 1. Private Admin Entry & Security Architecture

### Private Admin Entry (`ADMIN_ENTRY_PATH`)
Aheka does **NOT** expose a predictable public admin route such as `/admin` or `/admin/login`. Any request to `/admin`, `/admin/*`, `/wp-admin`, `/administrator`, or `/dashboard` immediately returns a standard **HTTP 404 Not Found**.

Instead, the entry URL is configured via the server-side environment variable `ADMIN_ENTRY_PATH`:
- **Local Development**: Configured in `.env` as `ADMIN_ENTRY_PATH=local-admin`. Accessible at:
  ```
  http://localhost:4321/local-admin
  ```
- **Production (`aheka.in`)**: Configured securely in Cloudflare environment variables as an unguessable string (e.g. `ADMIN_ENTRY_PATH=manage-aheka-x7k92p`). Accessible at:
  ```
  https://aheka.in/manage-aheka-x7k92p
  ```

> [!IMPORTANT]
> **Secret Path is NOT Authentication**: Knowing the private URL grants zero administrative access or data. It merely exposes the secure login form. Valid Super Admin credentials and an authenticated server-side session are strictly required before any admin screen or API endpoint will respond.

### How to Change the Private Path Safely
To change your private entry URL without downtime or code redeployment:
1. Open the **Cloudflare Dashboard** → **Workers & Pages** → `aheka` → **Settings** → **Variables and Secrets**.
2. Update the `ADMIN_ENTRY_PATH` environment variable to a new secret value (or run `npx wrangler secret put ADMIN_ENTRY_PATH`).
3. The worker instantly updates its rewrite rules. Bookmark your new private URL. The previous URL will immediately return 404.
4. **NEVER** commit the production `ADMIN_ENTRY_PATH` to Git or public repositories.

### Rate Limiting & Brute-Force Protection
Admin login endpoints are protected by an in-memory sliding-window rate limiter:
- Maximum **5 failed password attempts per 15-minute window** per client IP.
- When the threshold is exceeded, the server responds with **HTTP 429 Too Many Requests** and displays a countdown timer.
- Successful login immediately clears failed attempts for that IP.
- All failed authentication attempts are logged server-side safely without recording plaintext passwords.

### SEO & Crawler Protection
- All admin pages return `X-Robots-Tag: noindex, nofollow, noarchive`.
- Admin pages are strictly excluded from `sitemap.xml` and the internal link graph.
- The secret production path is **NEVER** listed in `robots.txt` (since `robots.txt` is publicly readable).

---

## 2. Directory & Location Management

All production directory entities are managed dynamically by the Super Admin from the private panel.

### 2.1 Managing Districts & Talukas (`/{ADMIN_ENTRY_PATH}/locations`)
- **Districts**: Add/edit district records with `name_en`, `name_mr`, `slug`, `sort_order`, `is_active`, and `is_featured`.
- **Talukas**: Add/edit talukas assigned to an active district with `name_en`, `name_mr`, `slug`, `sort_order`, `is_active`, and `is_featured`.
- **Key / Featured Talukas**: Toggle `is_featured` to promote key talukas to the public Homepage and Footer "Key Talukas" sections.

### 2.2 Managing Categories & Aliases (`/{ADMIN_ENTRY_PATH}/categories`)
- **Category Fields**: `name_en`, `name_mr`, `slug`, `icon`, `sort_order`, `is_visible`, `is_featured`.
- **Search Aliases**: Manage comma-separated aliases (e.g. `wireman, light fitting, fuse, electrician`) so Marathi and English search queries match accurately.
- **Popular Services**: Toggle `is_featured` to display the category in the public Homepage and Footer "Popular Services" lists.

---

## 3. The Commercial Unit & Lifecycle

In Aheka, every commercial listing is defined as:
$$\text{1 Commercial Unit} = \text{1 Vendor} + \text{1 Category} + \text{1 Taluka}$$

If a vendor offers multiple services (e.g. Electrician in Sangamner AND Plumber in Sangamner), each service is an **independent listing** with its own trial and subscription lifecycle.

---

## 4. Starting a 30-Day Free Trial

### When Does a Trial Start?
A free trial **never** starts automatically when a vendor submits an application or when an admin creates a vendor.

A free trial starts **only when an administrator intentionally clicks "Start 30-Day Trial"** in `/{ADMIN_ENTRY_PATH}/vendors`.

### Pre-conditions for Trial Activation:
1. Vendor must be **approved** and not suspended.
2. The listing must be in **approved** status.
3. The taluka + category must have an **available slot** ($< 10$ active listings).

### How to Start a Trial:
1. Navigate to **Admin Panel → Vendors & Slots** (`/{ADMIN_ENTRY_PATH}/vendors`).
2. Locate the provider and listing.
3. Click **"Start 30-Day Trial"**.
4. (Optional) Select a specific start date, or leave empty to begin immediately.
5. Click **"Start 30-Day Trial"**.
6. The listing immediately becomes publicly visible and participates equally in fair daily rotation.

---

## 5. Anti-Abuse Rule: One Free Trial Per Listing

### Business Rule:
Each listing receives **one free 30-day trial only**. A provider cannot let a trial expire and repeatedly restart free trials to avoid paying.

### Admin Override:
If an exceptional scenario warrants an additional trial (e.g., medical emergency, shop relocation during initial trial):
1. The admin dialog will display: `⚠️ Trial Already Used`.
2. Check the box **"Grant Admin Override"**.
3. Enter a mandatory **Justification / Reason** (e.g., "Shop relocation verified via physical visit").
4. The override and reason are permanently recorded in `listing_trials` for auditing.

---

## 6. Converting a Trial to Paid (₹999/year)

When a trial provider is ready to become an annual paying subscriber:

### Case A: Payment Collected While Trial is Still Active (Early Conversion)
- Aheka **preserves all remaining free trial days**.
- Example: Trial runs September 1 to September 30. Provider pays on September 25.
- The annual paid period will begin on **October 1** and run until **September 30 of the following year**.
- The provider does NOT lose the 5 remaining free days.

### Case B: Payment Collected After Trial Has Expired
- Because the trial expired, the listing lost its slot.
- When recording payment, the system **re-checks the 10-slot limit**.
- If a slot is available ($< 10$), the listing activates immediately.
- If all 10 slots are now occupied, the listing is placed on the **Waiting List** with status `Payment pending activation — slot currently unavailable`.

### Recording Payment in Admin Panel:
1. Click **"Convert to Paid (₹999)"** on the listing (or navigate to `/{ADMIN_ENTRY_PATH}/payments`).
2. Verify the start date preview shown in the dialog.
3. Enter Amount (₹999 default), Payment Method (UPI/Cash/Bank Transfer), and Reference Number.
4. Click **"Confirm & Activate Annual"**.

---

## 7. Slot Counting & The 10-Provider Scarcity Cap

Each Taluka + Category has a strict maximum of **10 active providers**:
$$\text{Active Slots} = \text{Active Trial Listings} + \text{Active Paid Listings} \le 10$$

### Non-Duplication Rule:
When an active trial converts to paid, it continues to represent **exactly 1 slot** (never 2). The 11th applicant is automatically placed on the waitlist.

---

## 8. Single Profile Image Policy
- Each provider profile has strictly **one optional image** (personal photo, shop exterior/interior, or logo).
- There is no image gallery or multiple vendor photos.
- If no image is provided, the application automatically displays a clean, responsive monogram avatar using the provider's initials that adapts perfectly across both Light and Dark themes.

---

## 9. Vendor Performance Reports & WhatsApp Messages

Administrators can generate verifiable performance reports to share with providers for renewals and conversions.

### Metrics Tracked:
- **Profile Views**: Times the provider profile was loaded.
- **Call Clicks**: Clicks on the direct call button (`tel:`).
- **WhatsApp Clicks**: Clicks on the WhatsApp inquiry button.
- **Directions Clicks**: Clicks to open Google Maps directions.
- **Share Clicks**: Shares via Web Share API or link copy.

### Total Contact Actions Formula:
$$\text{Total Contact Actions} = \text{Call Clicks} + \text{WhatsApp Clicks} + \text{Directions Clicks}$$
*Profile views and share clicks are strictly excluded from contact totals.*

### Generating & Sending Reports:
1. Click **"📊 Performance"** on any listing in `/{ADMIN_ENTRY_PATH}/vendors` (or **"Full Report 📈"** for a combined vendor summary).
2. Select a date range: `Last 7 Days`, `Last 30 Days`, `Last 90 Days`, `Current Trial`, `Subscription`, or `All Time`.
3. View the metric cards and Total Contact Actions.
4. Click **"📋 Copy (मराठी)"** or **"📋 Copy (English)"** to copy a pre-formatted, polite message to your clipboard.
5. Click **"Open WhatsApp ↗"** to open WhatsApp Web/Desktop with the message pre-filled for the vendor's registered number.

### Important Communication Standard:
Always use factual language such as **"contact actions"** (संपर्क कृती) rather than "customers received" or "guaranteed leads", because Aheka cannot confirm whether a phone call resulted in a completed commercial job.

---

## 10. Renewal & Expiry Follow-Up Timeline

### Trials Expiring Soon:
- **7 Days Before Expiry**: Send trial midpoint performance report and mention the ₹999/yr annual continuation option.
- **3 Days Before Expiry**: Send urgent trial conversion reminder.
- **Day of Expiry**: If unpaid, the listing automatically disappears from public directory and search. Vendor record remains in DB.

### Annual Subscriptions Expiring Soon:
- **30 Days Before Renewal**: Review annual performance metrics and send annual summary.
- **15 Days Before Renewal**: Follow up for UPI/Cash renewal payment.
- **7 Days Before Renewal**: Final renewal notice to preserve position within the 10-slot taluka limit.
