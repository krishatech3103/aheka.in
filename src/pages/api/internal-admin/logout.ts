import type { APIRoute } from 'astro';
import { ADMIN_SESSION_COOKIE } from '../../../lib/security/adminSession';

export const POST: APIRoute = async ({ cookies }) => {
  cookies.delete(ADMIN_SESSION_COOKIE, { path: '/' });
  // Clear the legacy cookie from previous deployments as well.
  cookies.delete('aheka_admin_token', { path: '/' });
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
