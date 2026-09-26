import type { MiddlewareHandler } from 'astro';
import { ADMIN_SESSION_COOKIE, getAdminConfigurationError, isValidAdminSession } from './lib/security/adminSession';
import { getRuntimeConfig, isProductionRuntime } from './lib/runtime/config';

function notFound(): Response {
  return new Response('Not Found', {
    status: 404,
    statusText: 'Not Found',
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}

function unauthorizedAdminRequest(isApiRequest: boolean, adminEntryPath: string): Response {
  if (isApiRequest) {
    return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
      status: 401,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'X-Robots-Tag': 'noindex, nofollow',
      },
    });
  }

  return new Response(null, {
    status: 302,
    headers: {
      Location: `/${adminEntryPath}/login`,
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}

export const onRequest: MiddlewareHandler = async (context, next) => {
  const url = new URL(context.request.url);
  const pathname = url.pathname;

  // 1. Obvious & probing public admin or vendor routes MUST return HTTP 404
  // Do not redirect to the secret path or give any hint.
  if (
    pathname === '/admin' ||
    pathname.startsWith('/admin/') ||
    pathname === '/administrator' ||
    pathname.startsWith('/administrator/') ||
    pathname === '/wp-admin' ||
    pathname.startsWith('/wp-admin/') ||
    pathname === '/dashboard' ||
    pathname.startsWith('/dashboard/') ||
    pathname === '/vendor' ||
    pathname.startsWith('/vendor/') ||
    pathname === '/api/vendor' ||
    pathname.startsWith('/api/vendor/') ||
    pathname === '/api/admin' ||
    pathname.startsWith('/api/admin/')
  ) {
    return notFound();
  }

  // 2. Direct external requests to internal-admin handlers without private route rewrite MUST return 404
  if (
    (pathname === '/internal-admin' || pathname.startsWith('/internal-admin/') ||
     pathname === '/api/internal-admin' || pathname.startsWith('/api/internal-admin/')) &&
    !context.locals._isInternalAdminRewrite
  ) {
    return notFound();
  }

  // 3. Resolve configured private ADMIN_ENTRY_PATH (local-only default for developer convenience).
  const rawPath = getRuntimeConfig('ADMIN_ENTRY_PATH') || 'local-admin';
  const adminEntryPath = rawPath.replace(/^\/+|\/+$/g, '').trim();

  // 4. Intercept private admin route
  if (
    pathname === `/${adminEntryPath}` ||
    pathname.startsWith(`/${adminEntryPath}/`)
  ) {
    const subpath = pathname.slice(`/${adminEntryPath}`.length);
    const isApiRequest = subpath.startsWith('/api/');
    const isLoginRequest = subpath === '/login' || subpath === '/api/login';

    if (isProductionRuntime()) {
      const configurationError = getAdminConfigurationError();
      if (configurationError) {
        return new Response(JSON.stringify({ success: false, error: configurationError }), {
          status: 503,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
            'X-Robots-Tag': 'noindex, nofollow',
          },
        });
      }
    }

    const adminSession = context.cookies.get(ADMIN_SESSION_COOKIE)?.value;
    const isAuthenticated = await isValidAdminSession(adminSession);

    if (!isLoginRequest && !isAuthenticated) {
      return unauthorizedAdminRequest(isApiRequest, adminEntryPath);
    }

    if (isLoginRequest && !isApiRequest && isAuthenticated) {
      return new Response(null, {
        status: 302,
        headers: {
          Location: `/${adminEntryPath}`,
          'Cache-Control': 'no-store',
          'X-Robots-Tag': 'noindex, nofollow',
        },
      });
    }

    context.locals.adminEntryPath = adminEntryPath;
    context.locals._isInternalAdminRewrite = true;
    context.locals.isAdminAuthenticated = isAuthenticated;

    // Handle internal API requests
    if (subpath.startsWith('/api/')) {
      const apiSubpath = subpath.slice('/api'.length);
      return context.rewrite(new URL(`/api/internal-admin${apiSubpath}`, context.url));
    }

    // Handle Admin pages
    const targetPage = subpath === '' || subpath === '/' ? '/internal-admin' : `/internal-admin${subpath}`;
    return context.rewrite(new URL(targetPage, context.url));
  }

  return next();
};
