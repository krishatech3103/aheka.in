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

    const result = await repo.startTrial({
      listing_id: body.listing_id,
      start_date: body.start_date,
      is_override: Boolean(body.is_override),
      override_reason: body.override_reason,
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
