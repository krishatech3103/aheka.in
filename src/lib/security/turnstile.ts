import { getRuntimeConfig, isProductionRuntime } from '../runtime/config';

export async function verifyTurnstileToken(token: unknown, request: Request): Promise<{
  success: boolean;
  configurationError?: boolean;
}> {
  const secret = getRuntimeConfig('TURNSTILE_SECRET_KEY');

  if (!secret) {
    return isProductionRuntime()
      ? { success: false, configurationError: true }
      : { success: true };
  }

  if (typeof token !== 'string' || !token.trim()) {
    return { success: false };
  }

  const body = new URLSearchParams({ secret, response: token });
  const remoteIp = request.headers.get('cf-connecting-ip');
  if (remoteIp) body.set('remoteip', remoteIp);

  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const result = await response.json() as { success?: boolean };
    return { success: response.ok && result.success === true };
  } catch {
    return { success: false };
  }
}
