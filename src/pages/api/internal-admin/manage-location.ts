import type { APIRoute } from 'astro';
import { getDataRepository } from '../../../lib/repositories/dataRepository';

export const POST: APIRoute = async ({ request, cookies }) => {
  const adminToken = cookies.get('aheka_admin_token')?.value;
  if (!adminToken) {
    return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await request.json();
    const { type, action, id, data } = body;
    const repo = getDataRepository();

    if (type === 'district') {
      if (action === 'create') {
        const created = await repo.addDistrict({
          name_en: data.name_en,
          name_mr: data.name_mr,
          slug: data.slug,
          is_active: data.is_active !== undefined ? Boolean(data.is_active) : true,
          is_featured: data.is_featured !== undefined ? Boolean(data.is_featured) : false,
          sort_order: Number(data.sort_order) || 0,
        });
        return new Response(JSON.stringify({ success: true, district: created }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (action === 'update') {
        if (!id) throw new Error('District ID required for update');
        const updates: any = {};
        if (data.name_en !== undefined) updates.name_en = data.name_en;
        if (data.name_mr !== undefined) updates.name_mr = data.name_mr;
        if (data.slug !== undefined) updates.slug = data.slug;
        if (data.is_active !== undefined) updates.is_active = Boolean(data.is_active);
        if (data.is_featured !== undefined) updates.is_featured = Boolean(data.is_featured);
        if (data.sort_order !== undefined) updates.sort_order = Number(data.sort_order);

        const result = await repo.updateDistrict(id, updates);
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    if (type === 'taluka') {
      if (action === 'create') {
        const created = await repo.addTaluka({
          district_id: data.district_id,
          name_en: data.name_en,
          name_mr: data.name_mr,
          slug: data.slug,
          is_active: data.is_active !== undefined ? Boolean(data.is_active) : true,
          is_featured: data.is_featured !== undefined ? Boolean(data.is_featured) : false,
          sort_order: Number(data.sort_order) || 0,
        });
        return new Response(JSON.stringify({ success: true, taluka: created }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (action === 'update') {
        if (!id) throw new Error('Taluka ID required for update');
        const updates: any = {};
        if (data.district_id !== undefined) updates.district_id = data.district_id;
        if (data.name_en !== undefined) updates.name_en = data.name_en;
        if (data.name_mr !== undefined) updates.name_mr = data.name_mr;
        if (data.slug !== undefined) updates.slug = data.slug;
        if (data.is_active !== undefined) updates.is_active = Boolean(data.is_active);
        if (data.is_featured !== undefined) updates.is_featured = Boolean(data.is_featured);
        if (data.sort_order !== undefined) updates.sort_order = Number(data.sort_order);

        const result = await repo.updateTaluka(id, updates);
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response(JSON.stringify({ success: false, error: 'Invalid type or action' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
