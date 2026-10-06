import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Creates an administrative Supabase client for server-side ingestion and maintenance.
 * Resolves SUPABASE_SECRET_KEY first, with a fallback to legacy SUPABASE_SERVICE_ROLE_KEY.
 * Protected by Next.js 'server-only' compile-time boundary and runtime window check.
 */
export function createAdminClient(): SupabaseClient {
  if (typeof window !== 'undefined') {
    throw new Error('Security violation: createAdminClient cannot be executed in the browser.');
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const adminKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error('Missing SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL for administrative client.');
  }

  if (!adminKey) {
    throw new Error('Missing SUPABASE_SECRET_KEY (or legacy SUPABASE_SERVICE_ROLE_KEY) for administrative client.');
  }

  return createClient(supabaseUrl, adminKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}
