import type { APIRoute } from 'astro';
import { getClientIp, checkAdminRateLimit, recordFailedLogin, resetFailedLogins } from '../../../lib/security/rateLimiter';

export const POST: APIRoute = async ({ request, cookies, locals }) => {
  const ip = getClientIp(request);

  // 1. Rate limiting check (max 5 failed attempts per 15 minutes)
  const rateLimit = checkAdminRateLimit(ip);
  if (!rateLimit.allowed) {
    return new Response(JSON.stringify({ success: false, error: rateLimit.error }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(rateLimit.retryAfterSeconds || 900),
      },
    });
  }

  try {
    const { password } = await request.json();

    // Default admin password for local dev / staging or from server env
    const expectedPassword = process.env.ADMIN_PASSWORD || 'aheka-admin-2026';

    if (!password || password !== expectedPassword) {
      const record = recordFailedLogin(ip);
      const remainingMsg = record.isLocked
        ? 'Account temporarily locked due to repeated failed attempts. Please wait 15 minutes.'
        : `Invalid admin credentials. (${record.count}/5 attempts used)`;

      return new Response(JSON.stringify({ success: false, error: remainingMsg }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Reset rate limit on successful authentication
    resetFailedLogins(ip);

    const isProd = import.meta.env.PROD || process.env.NODE_ENV === 'production';
    cookies.set('aheka_admin_token', 'admin-session-token-valid', {
      path: '/',
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    const adminEntryPath = locals?.adminEntryPath || process.env.ADMIN_ENTRY_PATH || 'local-admin';

    return new Response(JSON.stringify({ success: true, redirect: `/${adminEntryPath}` }), {
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
