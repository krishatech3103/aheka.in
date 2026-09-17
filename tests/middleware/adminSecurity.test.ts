import { describe, it, expect } from 'vitest';
import { onRequest } from '../../src/middleware';

describe('Admin Security Middleware & Route Protection', () => {
  const createMockContext = (urlStr: string, isRewrite = false) => {
    const url = new URL(urlStr);
    const rewrittenUrls: URL[] = [];

    return {
      context: {
        request: new Request(urlStr),
        url,
        locals: {
          _isInternalAdminRewrite: isRewrite,
        } as any,
        rewrite: (targetUrl: URL) => {
          rewrittenUrls.push(targetUrl);
          return new Response(`Rewritten to ${targetUrl.pathname}`, { status: 200 });
        },
      },
      rewrittenUrls,
    };
  };

  const nextStub = async () => new Response('Next Called', { status: 200 });

  it('returns 404 with noindex, nofollow for /admin', async () => {
    const { context } = createMockContext('https://aheka.in/admin');
    const res = await (onRequest as any)(context, nextStub);
    expect(res.status).toBe(404);
    expect(res.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
  });

  it('returns 404 with noindex, nofollow for /admin/login', async () => {
    const { context } = createMockContext('https://aheka.in/admin/login');
    const res = await (onRequest as any)(context, nextStub);
    expect(res.status).toBe(404);
    expect(res.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
  });

  it('returns 404 for probing CMS routes like /wp-admin and /administrator', async () => {
    const wp = createMockContext('https://aheka.in/wp-admin');
    const wpRes = await (onRequest as any)(wp.context, nextStub);
    expect(wpRes.status).toBe(404);

    const admin = createMockContext('https://aheka.in/administrator/login');
    const adminRes = await (onRequest as any)(admin.context, nextStub);
    expect(adminRes.status).toBe(404);
  });

  it('returns 404 for /dashboard and /vendor routes', async () => {
    const dash = createMockContext('https://aheka.in/dashboard');
    const dashRes = await (onRequest as any)(dash.context, nextStub);
    expect(dashRes.status).toBe(404);

    const vendor = createMockContext('https://aheka.in/vendor/login');
    const vendorRes = await (onRequest as any)(vendor.context, nextStub);
    expect(vendorRes.status).toBe(404);
  });

  it('blocks direct external access to /internal-admin and /api/internal-admin with 404', async () => {
    const internal = createMockContext('https://aheka.in/internal-admin');
    const internalRes = await (onRequest as any)(internal.context, nextStub);
    expect(internalRes.status).toBe(404);

    const internalApi = createMockContext('https://aheka.in/api/internal-admin/login');
    const internalApiRes = await (onRequest as any)(internalApi.context, nextStub);
    expect(internalApiRes.status).toBe(404);
  });

  it('rewrites configured private ADMIN_ENTRY_PATH to internal admin handlers without redirection', async () => {
    process.env.ADMIN_ENTRY_PATH = 'manage-aheka-x7k92p';

    const { context, rewrittenUrls } = createMockContext('https://aheka.in/manage-aheka-x7k92p');
    const res = await (onRequest as any)(context, nextStub);

    expect(res.status).toBe(200);
    expect(rewrittenUrls[0]?.pathname).toBe('/internal-admin');
    expect(context.locals.adminEntryPath).toBe('manage-aheka-x7k92p');
    expect(context.locals._isInternalAdminRewrite).toBe(true);

    // Subpath rewrite
    const sub = createMockContext('https://aheka.in/manage-aheka-x7k92p/vendors');
    const subRes = await (onRequest as any)(sub.context, nextStub);
    expect(subRes.status).toBe(200);
    expect(sub.rewrittenUrls[0]?.pathname).toBe('/internal-admin/vendors');

    // API rewrite
    const api = createMockContext('https://aheka.in/manage-aheka-x7k92p/api/login');
    const apiRes = await (onRequest as any)(api.context, nextStub);
    expect(apiRes.status).toBe(200);
    expect(api.rewrittenUrls[0]?.pathname).toBe('/api/internal-admin/login');
  });

  it('passes normal public requests through to next handler', async () => {
    const { context } = createMockContext('https://aheka.in/mr');
    const res = await (onRequest as any)(context, nextStub);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toBe('Next Called');
  });
});
