import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { NextRequest } from 'next/server';

/**
 * Authenticate a server-side API request.
 * Returns the user and profile, or an error response.
 *
 * Usage in a route handler:
 *   const auth = await authenticateApiRequest(req);
 *   if (!auth.ok) return auth.response;
 *   const { user, profile } = auth;
 */
export async function authenticateApiRequest(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return {
        ok: false as const,
        user: null,
        profile: null,
        response: Response.json(
          { error: 'Unauthorized — authentication required' },
          { status: 401 }
        ),
      };
    }

    // Optionally fetch profile for role/unit checks
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    return {
      ok: true as const,
      user,
      profile,
      response: null,
    };
  } catch (err) {
    console.error('[API Auth] Error:', err);
    return {
      ok: false as const,
      user: null,
      profile: null,
      response: Response.json(
        { error: 'Authentication error' },
        { status: 500 }
      ),
    };
  }
}
