import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export function getPublicSupabaseClient(env?: Record<string, any>): SupabaseClient | null {
  const url = env?.PUBLIC_SUPABASE_URL || import.meta.env.PUBLIC_SUPABASE_URL;
  const key = env?.PUBLIC_SUPABASE_ANON_KEY || import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key || url.includes('xyzcompany') || url.includes('your-project')) {
    return null;
  }

  return createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}

export function getAdminSupabaseClient(env?: Record<string, any>): SupabaseClient | null {
  const url = env?.PUBLIC_SUPABASE_URL || env?.SUPABASE_URL || import.meta.env.PUBLIC_SUPABASE_URL;
  const serviceKey = env?.SUPABASE_SERVICE_ROLE_KEY || import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey || serviceKey.startsWith('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...')) {
    return null;
  }

  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
