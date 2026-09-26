import type { APIRoute } from 'astro';
import { getDataRepository } from '../../../lib/repositories/dataRepository';
import { hasValidAdminSession } from '../../../lib/security/adminSession';

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!(await hasValidAdminSession(cookies))) {
    return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { vendor_id, updates } = await request.json();
    const repo = getDataRepository();

    const result = await repo.updateVendorProfile(vendor_id, updates);
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
