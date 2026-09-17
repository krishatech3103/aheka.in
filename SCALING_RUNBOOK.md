# Aheka (आहे का?) — Scaling & Operational Capacity Runbook

This document defines capacity thresholds, cost milestones, and operational scaling steps from initial bootstrap launch to 1,000+ active paid listings.

---

## 1. Bootstrap Phase: 0 to 100 Paying Vendors

### Target Infrastructure:
- **Cloudflare Workers**: Free Plan (100,000 requests/day, 10ms CPU time/request).
- **Supabase**: Free Tier (500MB database, 1GB file storage, 2GB egress, 50,000 monthly active users).
- **GitHub**: Free private repository + Free Actions (2,000 minutes/month).
- **Cost Target**: **₹0/month** infrastructure bill (excluding domain registration ~₹800/year).

### Operational Safeguards During Bootstrap:
1. **Edge SSR Efficiency**:
   - Static marketing & legal pages (`/about`, `/privacy`, `/terms`, `/provider-terms`) are prerendered at build time where possible.
   - Dynamic directory and provider pages render server-side in under 10ms CPU time using optimized indexed PostgreSQL queries.
2. **Database Connection Management**:
   - In Cloudflare Workers, use Supabase connection pooling (port 6543 / Supavisor) or Supabase HTTP API to avoid connection exhaustion.
3. **Storage Discipline**:
   - Single image per vendor policy strictly caps media storage.
   - Upload compression limits raw images to ~200-400KB WebP.
   - 100 vendors = ~30MB storage (well below the 1GB free tier limit).
4. **Manual Backup Routine**:
   - Free tier automated backups may have limited retention. Run weekly manual SQL exports via `pg_dump` or Supabase dashboard (see `BACKUP_RUNBOOK.md`).

---

## 2. Growth Milestone: 100 to 500 Paying Vendors (~₹1,00,000 to ₹5,00,000 Annual Revenue)

### Upgrade Trigger:
- When active listings reach ~100 (~₹1,00,000 ARR), upgrade to paid tiers for production guarantees.

### Recommended Infrastructure Upgrades:
1. **Supabase Pro Tier ($25/month ~₹2,100/month)**:
   - 8GB database storage included.
   - 100GB file storage included.
   - 250GB bandwidth included.
   - Daily automated backups with 7-day point-in-time recovery (PITR).
   - No project pausing after inactivity.
   - Compute auto-scaling (Micro to Small/Medium).
2. **Cloudflare Workers Paid ($5/month ~₹420/month)**:
   - 10 million requests/month included ($0.50 per additional million).
   - Up to 50ms CPU time per request.
   - Enhanced analytics and rate limiting rules.

### Performance Optimizations:
- Enable Cloudflare Cache Rules on public directory pages (`/{locale}/:district/:taluka/:category`) with short edge cache TTLs (e.g. 5–15 minutes) and `stale-while-revalidate`.
- Cache invalidation occurs automatically at midnight IST to respect the daily provider rotation boundary.

---

## 3. Scale Phase: 500 to 5,000+ Paying Vendors

1. **Database Partitioning & Index Tuning**:
   - Query patterns are hyper-localized by `(taluka_id, category_id)`.
   - Index maintenance: ensure compound index `idx_vendor_listings_taluka_cat_status` remains in RAM buffer pool.
   - Archive old `analytics_events` (> 180 days) to cold storage or aggregated monthly rollup tables.
2. **Read Replicas**:
   - Deploy Supabase Read Replicas if public traffic reaches millions of monthly page views.
   - Direct public directory read queries to replicas; route admin mutations to primary.
3. **Multi-Region Considerations**:
   - Because Aheka serves Maharashtra (`Asia/Kolkata`), keep database compute located in India (e.g. Supabase Mumbai region `ap-south-1`) to minimize database round-trip latency to Cloudflare edge nodes.
