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
    const { action, id, data } = body;
    const repo = getDataRepository();

    if (action === 'create') {
      const created = await repo.addCategory({
        name_en: data.name_en,
        name_mr: data.name_mr,
        slug: data.slug,
        description_en: data.description_en || '',
        description_mr: data.description_mr || '',
        icon_key: data.icon_key || 'tool',
        is_visible: data.is_visible !== undefined ? data.is_visible : true,
        is_featured: data.is_featured !== undefined ? data.is_featured : false,
        aliases: Array.isArray(data.aliases) ? data.aliases : (data.aliases ? data.aliases.split(',').map((s: string) => s.trim()) : []),
        sort_order: Number(data.sort_order) || 0,
      });
      return new Response(JSON.stringify({ success: true, category: created }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (action === 'update') {
      if (!id) throw new Error('Category ID is required for update');
      const updates: any = {};
      if (data.name_en !== undefined) updates.name_en = data.name_en;
      if (data.name_mr !== undefined) updates.name_mr = data.name_mr;
      if (data.slug !== undefined) updates.slug = data.slug;
      if (data.description_en !== undefined) updates.description_en = data.description_en;
      if (data.description_mr !== undefined) updates.description_mr = data.description_mr;
      if (data.icon_key !== undefined) updates.icon_key = data.icon_key;
      if (data.is_visible !== undefined) updates.is_visible = Boolean(data.is_visible);
      if (data.is_featured !== undefined) updates.is_featured = Boolean(data.is_featured);
      if (data.sort_order !== undefined) updates.sort_order = Number(data.sort_order);
      if (data.aliases !== undefined) {
        updates.aliases = Array.isArray(data.aliases)
          ? data.aliases
          : data.aliases.split(',').map((s: string) => s.trim()).filter(Boolean);
      }

      const result = await repo.updateCategory(id, updates);
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: false, error: 'Invalid action' }), {
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
