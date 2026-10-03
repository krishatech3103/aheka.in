import type { APIRoute } from 'astro';
import { getClientIp, checkAdminRateLimit, recordFailedLogin, resetFailedLogins } from '../../../lib/security/rateLimiter';
import {
  ADMIN_SESSION_COOKIE,
  createAdminSession,
  isSecureCookieRuntime,
  secureValueMatches,
} from '../../../lib/security/adminSession';
import { getRuntimeConfig } from '../../../lib/runtime/config';

export const POST: APIRoute = async ({ request, locals }) => {
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

    const expectedPassword = getRuntimeConfig('ADMIN_PASSWORD');
    const sessionSecret = getRuntimeConfig('ADMIN_SESSION_SECRET');

    if (!expectedPassword || !sessionSecret) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Admin authentication is not configured.',
      }), {
        status: 503,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      });
    }

    if (!password || typeof password !== 'string' || !(await secureValueMatches(password, expectedPassword))) {
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

    const session = await createAdminSession();
    // This endpoint is reached through a middleware rewrite. Set the header on
    // the returned response itself so the browser reliably receives the session
    // cookie after that rewrite.
    const sessionCookie = [
      `${ADMIN_SESSION_COOKIE}=${session.token}`,
      'Path=/',
      `Max-Age=${session.maxAge}`,
      'HttpOnly',
      ...(isSecureCookieRuntime() ? ['Secure'] : []),
      'SameSite=Strict',
    ].join('; ');

    const adminEntryPath = locals?.adminEntryPath || getRuntimeConfig('ADMIN_ENTRY_PATH') || 'local-admin';

    return new Response(JSON.stringify({ success: true, redirect: `/${adminEntryPath}` }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'Set-Cookie': sessionCookie,
      },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
