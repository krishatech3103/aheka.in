import type { APIRoute } from 'astro';
import { getDataRepository } from '../../../lib/repositories/dataRepository';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const repo = getDataRepository();

    if (body.vendor_id && body.event_type) {
      await repo.recordAnalyticsEvent({
        vendor_id: body.vendor_id,
        vendor_listing_id: body.vendor_listing_id,
        event_type: body.event_type,
        page_path: body.page_path || '/',
        locale: body.locale || 'mr',
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ ok: false }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
