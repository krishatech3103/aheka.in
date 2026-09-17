import type { APIRoute } from 'astro';
import { getDataRepository } from '../../../lib/repositories/dataRepository';

export const POST: APIRoute = async ({ request, cookies }) => {
  const vendorId = cookies.get('aheka_vendor_id')?.value;
  if (!vendorId) {
    return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const updates = await request.json();
    const repo = getDataRepository();

    const allowedUpdates = {
      business_name: updates.business_name,
      whatsapp_number: updates.whatsapp_number,
      full_address: updates.full_address,
      experience_years: updates.experience_years ? Number(updates.experience_years) : undefined,
      google_maps_url: updates.google_maps_url,
      description_mr: updates.description_mr,
      description_en: updates.description_en,
      profile_image_url: updates.profile_image_url,
    };

    const result = await repo.updateVendorProfile(vendorId, allowedUpdates);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
