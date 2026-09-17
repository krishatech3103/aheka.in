import type { APIRoute } from 'astro';
import { getDataRepository } from '../../../lib/repositories/dataRepository';
import { normalizeIndianMobile, isValidIndianMobile } from '../../../lib/business/slotEnforcement';

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const { mobile } = await request.json();

    if (!mobile || !isValidIndianMobile(mobile)) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid Indian mobile number' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const normalized = normalizeIndianMobile(mobile);
    const repo = getDataRepository();
    const vendors = await repo.getAdminVendors();

    const vendor = vendors.find(v => v.mobile === normalized);
    if (!vendor) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'No registered provider found with this mobile number. Please apply first via Join page.',
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Set vendor session cookie
    cookies.set('aheka_vendor_id', vendor.id, {
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    return new Response(JSON.stringify({ success: true, vendor_id: vendor.id }), {
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
