import { getRequiredRuntimeConfig, getRuntimeConfig, isProductionRuntime, type RuntimeEnv } from '../runtime/config';

export const ADMIN_SESSION_COOKIE = 'aheka_admin_session';
const SESSION_TTL_SECONDS = 60 * 60 * 8;

type AdminSessionPayload = {
  version: 1;
  issuedAt: number;
  expiresAt: number;
  nonce: string;
};

function encodeBase64Url(value: Uint8Array | string): string {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  let binary = '';
  bytes.forEach(byte => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function decodeBase64Url(value: string): Uint8Array | null {
  try {
    const base64 = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
    const binary = atob(base64);
    return Uint8Array.from(binary, char => char.charCodeAt(0));
  } catch {
    return null;
  }
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

async function importSigningKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

async function sign(value: string, secret: string): Promise<string> {
  const key = await importSigningKey(secret);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return encodeBase64Url(new Uint8Array(signature));
}

export async function secureValueMatches(actual: string, expected: string): Promise<boolean> {
  const [actualHash, expectedHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', new TextEncoder().encode(actual)),
    crypto.subtle.digest('SHA-256', new TextEncoder().encode(expected)),
  ]);

  const actualBytes = new Uint8Array(actualHash);
  const expectedBytes = new Uint8Array(expectedHash);
  let mismatch = 0;
  for (let index = 0; index < actualBytes.length; index += 1) {
    mismatch |= actualBytes[index] ^ expectedBytes[index];
  }
  return mismatch === 0;
}

export async function createAdminSession(env?: RuntimeEnv): Promise<{ token: string; maxAge: number }> {
  const secret = getRequiredRuntimeConfig('ADMIN_SESSION_SECRET', env);
  const now = Math.floor(Date.now() / 1000);
  const nonce = encodeBase64Url(crypto.getRandomValues(new Uint8Array(18)));
  const payload: AdminSessionPayload = {
    version: 1,
    issuedAt: now,
    expiresAt: now + SESSION_TTL_SECONDS,
    nonce,
  };
  const encodedPayload = encodeBase64Url(JSON.stringify(payload));
  const signature = await sign(encodedPayload, secret);

  return { token: `${encodedPayload}.${signature}`, maxAge: SESSION_TTL_SECONDS };
}

export async function isValidAdminSession(token?: string, env?: RuntimeEnv): Promise<boolean> {
  if (!token) return false;

  const [encodedPayload, encodedSignature, ...rest] = token.split('.');
  if (!encodedPayload || !encodedSignature || rest.length > 0) return false;

  const payloadBytes = decodeBase64Url(encodedPayload);
  const signature = decodeBase64Url(encodedSignature);
  if (!payloadBytes || !signature) return false;

  let payload: AdminSessionPayload;
  try {
    payload = JSON.parse(new TextDecoder().decode(payloadBytes));
  } catch {
    return false;
  }

  if (
    payload.version !== 1
    || !Number.isInteger(payload.issuedAt)
    || !Number.isInteger(payload.expiresAt)
    || typeof payload.nonce !== 'string'
    || payload.expiresAt <= Math.floor(Date.now() / 1000)
    || payload.expiresAt - payload.issuedAt > SESSION_TTL_SECONDS
  ) {
    return false;
  }

  const secret = getRuntimeConfig('ADMIN_SESSION_SECRET', env);
  if (!secret) return false;

  try {
    const key = await importSigningKey(secret);
    return crypto.subtle.verify(
      'HMAC',
      key,
      toArrayBuffer(signature),
      toArrayBuffer(new TextEncoder().encode(encodedPayload)),
    );
  } catch {
    return false;
  }
}

export async function hasValidAdminSession(cookies: { get(name: string): { value?: string } | undefined }): Promise<boolean> {
  return isValidAdminSession(cookies.get(ADMIN_SESSION_COOKIE)?.value);
}

export function getAdminConfigurationError(env?: RuntimeEnv): string | null {
  const missing = ['ADMIN_PASSWORD', 'ADMIN_SESSION_SECRET', 'ADMIN_ENTRY_PATH']
    .filter(name => !getRuntimeConfig(name, env));

  if (!missing.length) return null;
  return `Missing required production configuration: ${missing.join(', ')}`;
}

export function isSecureCookieRuntime(env?: RuntimeEnv): boolean {
  return isProductionRuntime(env);
}
