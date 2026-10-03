import type { APIRoute } from 'astro';
import { z } from 'zod';
import { getDataRepository } from '../../../lib/repositories/dataRepository';
import { normalizeIndianMobile, isValidIndianMobile } from '../../../lib/business/slotEnforcement';
import { verifyTurnstileToken } from '../../../lib/security/turnstile';

const applicationSchema = z.object({
  provider_name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  business_name: z.string().max(150).optional().nullable(),
  mobile: z.string().refine(isValidIndianMobile, {
    message: 'Invalid 10-digit Indian mobile number (must start with 6, 7, 8, or 9)',
  }),
  whatsapp_number: z.string().refine(v => !v || isValidIndianMobile(v), {
    message: 'Invalid WhatsApp number',
  }).optional().nullable(),
  district_id: z.string().min(1, 'Invalid district selected'),
  taluka_id: z.string().min(1, 'Invalid taluka selected'),
  category_ids: z.array(z.string().min(1)).min(1, 'Select at least one service category'),
  experience_years: z.coerce.number().min(0).max(60),
  full_address: z.string().min(5, 'Full address is required').max(300),
  service_areas_text: z.string().min(2, 'Service areas are required').max(500),
  google_maps_url: z.string().url().optional().nullable().or(z.literal('')),
  consent_agreed: z.literal(true, {
    errorMap: () => ({ message: 'You must agree to the terms and accuracy declaration' }),
  }),
  // Honeypot field for anti-bot
  website_honeypot: z.string().optional().nullable(),
  turnstile_token: z.string().optional().nullable(),
  locale: z.enum(['en', 'mr']).optional(),
});

export const POST: APIRoute = async ({ request }) => {
  let locale: 'en' | 'mr' = 'en';
  try {
    const body = await request.json();
    locale = body?.locale === 'mr' ? 'mr' : 'en';

    // Honeypot check: If bot filled the hidden honeypot, fake success silently
    if (body.website_honeypot && body.website_honeypot.trim() !== '') {
      return new Response(JSON.stringify({ success: true, id: 'app-bot-ignored' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const parseResult = applicationSchema.safeParse(body);
    if (!parseResult.success) {
      return new Response(
        JSON.stringify({
          success: false,
          error: locale === 'mr'
            ? 'कृपया सर्व आवश्यक माहिती योग्य प्रकारे भरा.'
            : 'Please complete all required fields correctly.',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const data = parseResult.data;
    const turnstile = await verifyTurnstileToken(data.turnstile_token, request);
    if (!turnstile.success) {
      return new Response(JSON.stringify({
        success: false,
        error: turnstile.configurationError
          ? (locale === 'mr' ? 'स्पॅम संरक्षणाची मांडणी केलेली नाही.' : 'Spam protection is not configured.')
          : (locale === 'mr' ? 'तुमची पडताळणी करता आली नाही. कृपया पुन्हा प्रयत्न करा.' : 'Unable to verify that you are human. Please try again.'),
      }), {
        status: turnstile.configurationError ? 503 : 400,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      });
    }

    const repo = getDataRepository();

    const result = await repo.submitVendorApplication({
      provider_name: data.provider_name,
      business_name: data.business_name || undefined,
      mobile: normalizeIndianMobile(data.mobile),
      whatsapp_number: data.whatsapp_number ? normalizeIndianMobile(data.whatsapp_number) : undefined,
      district_id: data.district_id,
      taluka_id: data.taluka_id,
      category_ids: data.category_ids,
      experience_years: data.experience_years,
      full_address: data.full_address,
      service_areas_text: data.service_areas_text,
      google_maps_url: data.google_maps_url || undefined,
      consent_agreed: data.consent_agreed,
      turnstile_verified: true,
    });

    return new Response(JSON.stringify({ success: true, id: result.id }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: locale === 'mr'
          ? 'काहीतरी चूक झाली. कृपया पुन्हा प्रयत्न करा.'
          : 'Something went wrong. Please try again.',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
