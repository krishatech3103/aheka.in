import type { MiddlewareHandler } from 'astro';

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
    pathname === '/api/admin' ||
    pathname.startsWith('/api/admin/')
  ) {
    return new Response('Not Found', {
      status: 404,
      statusText: 'Not Found',
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Robots-Tag': 'noindex, nofollow',
      },
    });
  }

  // 2. Direct external requests to internal-admin handlers without private route rewrite MUST return 404
  if (
    (pathname === '/internal-admin' || pathname.startsWith('/internal-admin/') ||
     pathname === '/api/internal-admin' || pathname.startsWith('/api/internal-admin/')) &&
    !context.locals._isInternalAdminRewrite
  ) {
    return new Response('Not Found', {
      status: 404,
      statusText: 'Not Found',
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Robots-Tag': 'noindex, nofollow',
      },
    });
  }

  // 3. Resolve configured private ADMIN_ENTRY_PATH (default to 'local-admin' in dev)
  const rawPath = process.env.ADMIN_ENTRY_PATH || (import.meta as any).env?.ADMIN_ENTRY_PATH || 'local-admin';
  const adminEntryPath = rawPath.replace(/^\/+|\/+$/g, '').trim();

  // 4. Intercept private admin route
  if (
    pathname === `/${adminEntryPath}` ||
    pathname.startsWith(`/${adminEntryPath}/`)
  ) {
    const subpath = pathname.slice(`/${adminEntryPath}`.length);
    context.locals.adminEntryPath = adminEntryPath;
    context.locals._isInternalAdminRewrite = true;

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
