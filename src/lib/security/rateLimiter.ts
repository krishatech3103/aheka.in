// In-memory sliding-window rate limiter for admin authentication
// Prevents brute-force attempts while avoiding locking out genuine owners too easily.

interface AttemptRecord {
  count: number;
  firstAttemptAt: number;
  lastAttemptAt: number;
}

const attemptStore = new Map<string, AttemptRecord>();

const MAX_FAILED_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export function getClientIp(request: Request): string {
  const cfIp = request.headers.get('cf-connecting-ip');
  if (cfIp) return cfIp.trim();

  const xff = request.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0];
    if (first) return first.trim();
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp.trim();

  return '127.0.0.1';
}

export function checkAdminRateLimit(ip: string): {
  allowed: boolean;
  remainingAttempts: number;
  retryAfterSeconds?: number;
  error?: string;
} {
  const now = Date.now();
  const record = attemptStore.get(ip);

  if (!record) {
    return { allowed: true, remainingAttempts: MAX_FAILED_ATTEMPTS };
  }

  // If window has passed since first attempt, reset
  if (now - record.firstAttemptAt > WINDOW_MS) {
    attemptStore.delete(ip);
    return { allowed: true, remainingAttempts: MAX_FAILED_ATTEMPTS };
  }

  if (record.count >= MAX_FAILED_ATTEMPTS) {
    const remainingMs = WINDOW_MS - (now - record.firstAttemptAt);
    const retryAfterSeconds = Math.max(1, Math.ceil(remainingMs / 1000));
    return {
      allowed: false,
      remainingAttempts: 0,
      retryAfterSeconds,
      error: `Too many failed login attempts. Please wait ${Math.ceil(retryAfterSeconds / 60)} minutes before trying again.`,
    };
  }

  return {
    allowed: true,
    remainingAttempts: MAX_FAILED_ATTEMPTS - record.count,
  };
}

export function recordFailedLogin(ip: string): {
  count: number;
  isLocked: boolean;
  retryAfterSeconds?: number;
} {
  const now = Date.now();
  const record = attemptStore.get(ip);

  if (!record || now - record.firstAttemptAt > WINDOW_MS) {
    attemptStore.set(ip, {
      count: 1,
      firstAttemptAt: now,
      lastAttemptAt: now,
    });
    return { count: 1, isLocked: false };
  }

  record.count += 1;
  record.lastAttemptAt = now;

  const isLocked = record.count >= MAX_FAILED_ATTEMPTS;
  let retryAfterSeconds: number | undefined;

  if (isLocked) {
    const remainingMs = WINDOW_MS - (now - record.firstAttemptAt);
    retryAfterSeconds = Math.max(1, Math.ceil(remainingMs / 1000));
    console.warn(`[Security] Admin login rate limit exceeded for IP: ${ip.replace(/(\d+)\.(\d+)\..*/, '$1.$2.***')}. Locked for ${retryAfterSeconds}s.`);
  } else {
    console.warn(`[Security] Failed admin login attempt (${record.count}/${MAX_FAILED_ATTEMPTS}) from IP: ${ip.replace(/(\d+)\.(\d+)\..*/, '$1.$2.***')}`);
  }

  return {
    count: record.count,
    isLocked,
    retryAfterSeconds,
  };
}

export function resetFailedLogins(ip: string): void {
  attemptStore.delete(ip);
}

// For unit tests
export function clearRateLimitStore(): void {
  attemptStore.clear();
}

export const adminLoginRateLimiter = {
  check: checkAdminRateLimit,
  recordFailed: recordFailedLogin,
  reset: resetFailedLogins,
  clear: clearRateLimitStore,
};
