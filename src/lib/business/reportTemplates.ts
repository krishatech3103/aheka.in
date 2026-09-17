import type { PerformanceMetrics } from '../types/database';

/**
 * Report Formatting Utilities for Aheka WhatsApp & Administrative Messages
 * 
 * Rules:
 * - Bilingual: Natural Marathi (primary) & English (secondary).
 * - Factual, neutral terminology: "contact actions" / "संपर्क कृती", never unverified claims of "customers received".
 * - Clear dates and totals.
 */

export interface ReportTemplateData {
  vendorName: string;
  businessName?: string | null;
  categoryNameEn: string;
  categoryNameMr: string;
  talukaNameEn: string;
  talukaNameMr: string;
  rangeTitleEn: string;
  rangeTitleMr: string;
  metrics: PerformanceMetrics;
  validUntil?: string | null;
  locale?: 'mr' | 'en';
}

export function formatWhatsAppReport(data: ReportTemplateData): string {
  const isMr = data.locale !== 'en';
  const name = data.businessName ? `${data.vendorName} (${data.businessName})` : data.vendorName;
  const cat = isMr ? data.categoryNameMr : data.categoryNameEn;
  const tal = isMr ? data.talukaNameMr : data.talukaNameEn;
  const range = isMr ? data.rangeTitleMr : data.rangeTitleEn;
  const valid = data.validUntil ? (isMr ? `वैधता: ${data.validUntil}` : `Valid until: ${data.validUntil}`) : '';

  if (isMr) {
    return `नमस्कार ${name},

येथे मागील ${range} मधील तुमची Aheka लिस्टिंग कामगिरी माहिती आहे:

👁️ प्रोफाईल पाहिली: ${data.metrics.profile_views}
📞 थेट कॉल क्लिक्स: ${data.metrics.call_clicks}
💬 व्हॉट्सॲप चौकशी: ${data.metrics.whatsapp_clicks}
📍 नकाशा दिशा: ${data.metrics.directions_clicks}
🔗 शेअर: ${data.metrics.share_clicks}

✨ एकूण ग्राहक संपर्क कृती: ${data.metrics.total_contact_actions}

📋 सेवा लिस्टिंग:
${cat} — ${tal}
${valid ? `\n📅 ${valid}` : ''}

टीप: Aheka बटण संवाद व प्रोफाईल हालचाली मोजते; प्रत्यक्षात झालेल्या कॉल्स किंवा कामांची खात्री आम्ही देत नाही.

—
Aheka — आहे का?
https://aheka.in`;
  }

  return `Hello ${name},

Here is your Aheka listing performance for the ${range}:

👁️ Profile Views: ${data.metrics.profile_views}
📞 Call Clicks: ${data.metrics.call_clicks}
💬 WhatsApp Clicks: ${data.metrics.whatsapp_clicks}
📍 Directions Clicks: ${data.metrics.directions_clicks}
🔗 Shares: ${data.metrics.share_clicks}

✨ Total Contact Actions: ${data.metrics.total_contact_actions}

📋 Listing:
${cat} — ${tal}
${valid ? `\n📅 ${valid}` : ''}

Note: Aheka reports button interactions and profile activity; actual completed calls or jobs cannot be guaranteed.

—
Aheka — आहे का?
https://aheka.in`;
}

export function formatTrialConversionMessage(params: {
  vendorName: string;
  businessName?: string | null;
  categoryNameEn: string;
  categoryNameMr: string;
  talukaNameEn: string;
  talukaNameMr: string;
  trialStartsAt: string;
  trialEndsAt: string;
  metrics: PerformanceMetrics;
  annualFee?: number;
  locale?: 'mr' | 'en';
}): string {
  const isMr = params.locale !== 'en';
  const name = params.businessName ? `${params.vendorName} (${params.businessName})` : params.vendorName;
  const cat = isMr ? params.categoryNameMr : params.categoryNameEn;
  const tal = isMr ? params.talukaNameMr : params.talukaNameEn;
  const fee = params.annualFee || 999;

  if (isMr) {
    return `नमस्कार ${name},

तुमची Aheka 30-दिवसीय मोफत चाचणी पूर्ण होत आहे. चाचणी कालावधीतील कामगिरी:

कालावधी: ${params.trialStartsAt} ते ${params.trialEndsAt}
• प्रोफाईल व्ह्यूज: ${params.metrics.profile_views}
• कॉल क्लिक्स: ${params.metrics.call_clicks}
• व्हॉट्सॲप चौकशी: ${params.metrics.whatsapp_clicks}
• दुकानाचे लोकेशन: ${params.metrics.directions_clicks}
• एकूण संपर्क कृती: ${params.metrics.total_contact_actions}

सेवा लिस्टिंग: ${cat} — ${tal}

आपली लिस्टिंग अविरत चालू ठेवण्यासाठी वार्षिक वर्गणी ₹${fee}/वर्ष भरून सक्रिय करा. Aheka वरील 10 सेवा प्रदात्यांच्या स्लॉटमध्ये आपले स्थान कायम ठेवा.

संपर्क: Aheka Support`;
  }

  return `Hello ${name},

Your 30-day Aheka free trial is nearing completion. Here is your trial summary:

Trial Period: ${params.trialStartsAt} to ${params.trialEndsAt}
• Profile Views: ${params.metrics.profile_views}
• Call Clicks: ${params.metrics.call_clicks}
• WhatsApp Clicks: ${params.metrics.whatsapp_clicks}
• Directions: ${params.metrics.directions_clicks}
• Total Contact Actions: ${params.metrics.total_contact_actions}

Listing: ${cat} — ${tal}

To continue your active listing without interruption, you can convert to the annual subscription at ₹${fee}/year and retain your position within the 10-provider taluka limit.

Contact: Aheka Support`;
}

export function formatRenewalReminderMessage(params: {
  vendorName: string;
  businessName?: string | null;
  categoryNameEn: string;
  categoryNameMr: string;
  talukaNameEn: string;
  talukaNameMr: string;
  expiresAt: string;
  daysRemaining: number;
  annualFee?: number;
  locale?: 'mr' | 'en';
}): string {
  const isMr = params.locale !== 'en';
  const name = params.businessName ? `${params.vendorName} (${params.businessName})` : params.vendorName;
  const cat = isMr ? params.categoryNameMr : params.categoryNameEn;
  const tal = isMr ? params.talukaNameMr : params.talukaNameEn;
  const fee = params.annualFee || 999;

  if (isMr) {
    return `नमस्कार ${name},

तुमची Aheka वरील ${cat} (${tal}) लिस्टिंग वर्गणी ${params.expiresAt} रोजी (${params.daysRemaining} दिवसांत) संपत आहे.

तालुक्यातील 10 सक्रिय सेवा प्रदात्यांच्या मर्यादित यादीत आपले स्थान कायम ठेवण्यासाठी ₹${fee}/वर्ष नूतनीकरण करा.

नूतनीकरणासाठी संपर्क: Aheka Team`;
  }

  return `Hello ${name},

Your Aheka listing for ${cat} (${tal}) is expiring on ${params.expiresAt} (${params.daysRemaining} days remaining).

To retain your spot within the 10 active provider slots in ${tal}, please renew your annual subscription for ₹${fee}/year.

Contact: Aheka Team`;
}

export function getWhatsAppLink(rawPhone: string, text: string): string {
  const digits = rawPhone.replace(/[^\d]/g, '');
  const encoded = encodeURIComponent(text);
  return `https://wa.me/${digits}?text=${encoded}`;
}
