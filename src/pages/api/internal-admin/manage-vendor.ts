import type { APIRoute } from 'astro';
import { z } from 'zod';
import { getDataRepository } from '../../../lib/repositories/dataRepository';
import { hasValidAdminSession } from '../../../lib/security/adminSession';

const optionalText = (maximum: number) => z.string().trim().max(maximum).nullable().optional()
  .transform(value => value || null);

const updateVendorSchema = z.object({
  action: z.literal('update'),
  vendor_id: z.string().trim().min(1).max(100),
  data: z.object({
    provider_name: z.string().trim().min(2).max(150),
    business_name: optionalText(200),
    mobile: z.string().trim().regex(/^(?:\+91[\s-]?)?[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number'),
    whatsapp_number: optionalText(20).refine(value => !value || /^(?:\+91[\s-]?)?[6-9]\d{9}$/.test(value), 'Enter a valid WhatsApp number'),
    experience_years: z.coerce.number().int().min(0).max(60),
    full_address: z.string().trim().min(5).max(500),
    google_maps_url: optionalText(500).refine(value => !value || /^https?:\/\//i.test(value), 'Google Maps link must start with http:// or https://'),
    description_en: optionalText(2000),
    description_mr: optionalText(2000),
  }),
});

const deleteVendorSchema = z.object({
  action: z.literal('delete'),
  vendor_id: z.string().trim().min(1).max(100),
});

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!(await hasValidAdminSession(cookies))) {
    return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const input = await request.json();
    const deletePayload = deleteVendorSchema.safeParse(input);
    if (deletePayload.success) {
      const result = await getDataRepository().deleteVendor(deletePayload.data.vendor_id);
      return new Response(JSON.stringify(result), {
        status: result.success ? 200 : 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const updatePayload = updateVendorSchema.safeParse(input);
    if (!updatePayload.success) {
      return new Response(JSON.stringify({ success: false, error: updatePayload.error.issues[0]?.message || 'Invalid vendor details.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const result = await getDataRepository().updateVendorProfile(updatePayload.data.vendor_id, updatePayload.data.data);
    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 400,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Could not update the vendor.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
