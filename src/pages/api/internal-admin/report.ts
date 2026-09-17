import type { APIRoute } from 'astro';
import { getDataRepository } from '../../../lib/repositories/dataRepository';
import {
  formatWhatsAppReport,
  formatTrialConversionMessage,
  formatRenewalReminderMessage,
  getWhatsAppLink,
} from '../../../lib/business/reportTemplates';
import { getRemainingDays } from '../../../lib/business/slotEnforcement';

export const POST: APIRoute = async ({ request, cookies }) => {
  const adminToken = cookies.get('aheka_admin_token')?.value;
  if (!adminToken) {
    return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await request.json();
    const repo = getDataRepository();

    if (!body.vendor_id) {
      return new Response(JSON.stringify({ success: false, error: 'vendor_id is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const report = await repo.getListingPerformanceReport({
      vendor_id: body.vendor_id,
      listing_id: body.listing_id || undefined,
      range_type: body.range_type || '30d',
      from_date: body.from_date || undefined,
      to_date: body.to_date || undefined,
    });

    const vendor = report.vendor;
    const listing = report.listing;
    const catEn = listing?.category.name_en || 'Multiple Services';
    const catMr = listing?.category.name_mr || 'सर्व सेवा';
    const talEn = listing?.taluka.name_en || 'Local Taluka';
    const talMr = listing?.taluka.name_mr || 'स्थानिक तालुका';

    const rangeLabels: Record<string, { en: string; mr: string }> = {
      '7d': { en: 'last 7 days', mr: '७ दिवस' },
      '30d': { en: 'last 30 days', mr: '३० दिवस' },
      '90d': { en: 'last 90 days', mr: '९० दिवस' },
      'all': { en: 'all time', mr: 'एकूण कालावधी' },
      'trial': { en: 'free trial period', mr: 'मोफत चाचणी कालावधी' },
      'subscription': { en: 'annual subscription period', mr: 'वार्षिक वर्गणी कालावधी' },
      'custom': { en: 'custom date range', mr: 'निवडलेला कालावधी' },
    };

    const rangeLabel = rangeLabels[report.range_type] || { en: report.range_type, mr: report.range_type };

    let validUntil: string | null = null;
    if (listing?.subscription && listing.subscription.status === 'active') {
      validUntil = new Date(listing.subscription.ends_at).toLocaleDateString('en-IN');
    } else if (listing?.current_trial && listing.current_trial.status === 'active') {
      validUntil = new Date(listing.current_trial.ends_at).toLocaleDateString('en-IN');
    }

    // Generate bilingual messages
    const whatsappMr = formatWhatsAppReport({
      vendorName: vendor.provider_name,
      businessName: vendor.business_name,
      categoryNameEn: catEn,
      categoryNameMr: catMr,
      talukaNameEn: talEn,
      talukaNameMr: talMr,
      rangeTitleEn: rangeLabel.en,
      rangeTitleMr: rangeLabel.mr,
      metrics: report.metrics,
      validUntil,
      locale: 'mr',
    });

    const whatsappEn = formatWhatsAppReport({
      vendorName: vendor.provider_name,
      businessName: vendor.business_name,
      categoryNameEn: catEn,
      categoryNameMr: catMr,
      talukaNameEn: talEn,
      talukaNameMr: talMr,
      rangeTitleEn: rangeLabel.en,
      rangeTitleMr: rangeLabel.mr,
      metrics: report.metrics,
      validUntil,
      locale: 'en',
    });

    // Trial conversion message if on trial
    let conversionMessageMr = '';
    let conversionMessageEn = '';
    if (listing?.current_trial) {
      const t = listing.current_trial;
      conversionMessageMr = formatTrialConversionMessage({
        vendorName: vendor.provider_name,
        businessName: vendor.business_name,
        categoryNameEn: catEn,
        categoryNameMr: catMr,
        talukaNameEn: talEn,
        talukaNameMr: talMr,
        trialStartsAt: new Date(t.starts_at).toLocaleDateString('en-IN'),
        trialEndsAt: new Date(t.ends_at).toLocaleDateString('en-IN'),
        metrics: report.metrics,
        locale: 'mr',
      });
      conversionMessageEn = formatTrialConversionMessage({
        vendorName: vendor.provider_name,
        businessName: vendor.business_name,
        categoryNameEn: catEn,
        categoryNameMr: catMr,
        talukaNameEn: talEn,
        talukaNameMr: talMr,
        trialStartsAt: new Date(t.starts_at).toLocaleDateString('en-IN'),
        trialEndsAt: new Date(t.ends_at).toLocaleDateString('en-IN'),
        metrics: report.metrics,
        locale: 'en',
      });
    }

    // Renewal reminder message if on paid subscription
    let renewalMessageMr = '';
    let renewalMessageEn = '';
    if (listing?.subscription && listing.subscription.status === 'active') {
      const days = getRemainingDays(listing.subscription.ends_at);
      renewalMessageMr = formatRenewalReminderMessage({
        vendorName: vendor.provider_name,
        businessName: vendor.business_name,
        categoryNameEn: catEn,
        categoryNameMr: catMr,
        talukaNameEn: talEn,
        talukaNameMr: talMr,
        expiresAt: new Date(listing.subscription.ends_at).toLocaleDateString('en-IN'),
        daysRemaining: days,
        locale: 'mr',
      });
      renewalMessageEn = formatRenewalReminderMessage({
        vendorName: vendor.provider_name,
        businessName: vendor.business_name,
        categoryNameEn: catEn,
        categoryNameMr: catMr,
        talukaNameEn: talEn,
        talukaNameMr: talMr,
        expiresAt: new Date(listing.subscription.ends_at).toLocaleDateString('en-IN'),
        daysRemaining: days,
        locale: 'en',
      });
    }

    const recipientMobile = vendor.whatsapp_number || vendor.mobile;
    const waLinkMr = getWhatsAppLink(recipientMobile, whatsappMr);
    const waLinkEn = getWhatsAppLink(recipientMobile, whatsappEn);

    // Save snapshot if requested
    if (body.save_snapshot) {
      await repo.saveReportSnapshot({
        vendor_id: vendor.id,
        vendor_listing_id: listing?.id,
        from_date: report.from_date,
        to_date: report.to_date,
        report_type: listing ? 'listing' : 'combined_vendor',
        metrics: report.metrics,
        notes: body.snapshot_notes,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        report,
        whatsapp_mr: whatsappMr,
        whatsapp_en: whatsappEn,
        conversion_mr: conversionMessageMr,
        conversion_en: conversionMessageEn,
        renewal_mr: renewalMessageMr,
        renewal_en: renewalMessageEn,
        wa_link_mr: waLinkMr,
        wa_link_en: waLinkEn,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
