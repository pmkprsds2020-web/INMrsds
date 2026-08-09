import 'server-only';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * Admin Supabase client using the SERVICE ROLE key.
 *
 * ⚠️ SERVER-ONLY. This bypasses Row Level Security entirely. Never import
 * this file from a Client Component, never send this key to the browser.
 * The `server-only` import above will throw a build error if anyone
 * accidentally imports this from client code.
 *
 * Only use this for privileged operations that can't be expressed as an RLS
 * policy — e.g. deleting a user's auth account from an API route after
 * you've already verified their identity server-side.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
