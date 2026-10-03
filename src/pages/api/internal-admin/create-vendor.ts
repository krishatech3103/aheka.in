import type { APIRoute } from 'astro';
import { z } from 'zod';
import { getDataRepository } from '../../../lib/repositories/dataRepository';
import { hasValidAdminSession } from '../../../lib/security/adminSession';

const optionalText = (maximum: number) => z.string().trim().max(maximum).optional().nullable()
  .transform(value => value || undefined);

const manualVendorSchema = z.object({
  provider_name: z.string().trim().min(2, 'Provider name is required').max(150),
  business_name: optionalText(200),
  mobile: z.string().trim().regex(/^(?:\+91[\s-]?)?[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number'),
  whatsapp_number: optionalText(20).refine(
    value => !value || /^(?:\+91[\s-]?)?[6-9]\d{9}$/.test(value),
    'Enter a valid WhatsApp number',
  ),
  district_id: z.string().trim().min(1).max(100),
  taluka_id: z.string().trim().min(1).max(100),
  category_ids: z.array(z.string().trim().min(1).max(100)).min(1, 'Choose at least one category').max(20)
    .transform(ids => [...new Set(ids)]),
  experience_years: z.coerce.number().int().min(0).max(60),
  full_address: z.string().trim().min(5, 'Full address is required').max(500),
  google_maps_url: optionalText(500).refine(
    value => !value || /^https?:\/\//i.test(value),
    'Google Maps link must start with http:// or https://',
  ),
  description_en: optionalText(2000),
  description_mr: optionalText(2000),
  is_verified: z.boolean().optional().default(false),
  admin_notes: optionalText(2000),
});

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!(await hasValidAdminSession(cookies))) {
    return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const parsed = manualVendorSchema.safeParse(await request.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({
        success: false,
        error: parsed.error.issues[0]?.message || 'Invalid vendor details.',
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const result = await getDataRepository().createManualVendor(parsed.data);
    return new Response(JSON.stringify(result), {
      status: result.success ? 201 : 400,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Could not create the vendor.',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
