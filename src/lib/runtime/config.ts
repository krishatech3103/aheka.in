export type RuntimeEnv = Record<string, string | undefined>;

/**
 * Reads a value supplied by Cloudflare at runtime, while still supporting Astro
 * local development and direct unit-test invocation.
 */
export function getRuntimeConfig(name: string, env?: RuntimeEnv): string | undefined {
  const value = env?.[name]
    ?? process.env[name]
    ?? (import.meta as any).env?.[name];

  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function isProductionRuntime(env?: RuntimeEnv): boolean {
  return getRuntimeConfig('APP_ENVIRONMENT', env) === 'production'
    || (import.meta as any).env?.PROD === true;
}

export function getRequiredRuntimeConfig(name: string, env?: RuntimeEnv): string {
  const value = getRuntimeConfig(name, env);
  if (!value) {
    throw new Error(`Missing required runtime configuration: ${name}`);
  }
  return value;
}

export function getSiteUrl(requestOrigin: string, env?: RuntimeEnv): string {
  const configured = getRuntimeConfig('SITE_URL', env);

  if (!configured) {
    if (isProductionRuntime(env)) {
      throw new Error('Missing required runtime configuration: SITE_URL');
    }
    return new URL(requestOrigin).origin;
  }

  try {
    return new URL(configured).origin;
  } catch {
    throw new Error('SITE_URL must be an absolute URL.');
  }
}
