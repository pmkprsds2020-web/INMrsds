'use client';

import { createBrowserClient } from '@supabase/ssr';

/**
 * Supabase client for use in Client Components ('use client').
 * Safe to use in the browser — only ever uses the public anon key.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// Shared singleton instance for convenience in client components/hooks.
export const supabase = createClient();
