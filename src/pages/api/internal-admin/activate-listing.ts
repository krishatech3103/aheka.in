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
    const body = await request.json();
    const repo = getDataRepository();

    const result = await repo.activateListing({
      listing_id: body.listing_id,
      amount: Number(body.amount) || 999.00,
      payment_method: body.payment_method || 'upi',
      reference_number: body.reference_number || `REF-${Date.now()}`,
      notes: body.notes,
    });

    if (!result.success) {
      return new Response(JSON.stringify(result), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

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
