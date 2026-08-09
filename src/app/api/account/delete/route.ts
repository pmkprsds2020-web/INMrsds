import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Deletes the currently-authenticated user's account.
 *
 * Supabase's client SDK has no "delete my own account" call — deleting an
 * auth user requires the service-role key, which must never touch the
 * browser. So the flow is:
 *   1. Read the caller's session from cookies (createClient — anon key,
 *      RLS-scoped) to find out WHO is asking.
 *   2. Re-verify the supplied password against that same email via
 *      signInWithPassword, so a stolen/left-open session alone isn't
 *      enough to delete the account.
 *   3. Only then use the admin client (service role) to actually delete.
 */
export async function POST(req: NextRequest) {
  const { password } = await req.json().catch(() => ({ password: undefined }));

  if (!password || typeof password !== 'string') {
    return NextResponse.json({ error: 'Password wajib diisi.' }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: sessionError,
  } = await supabase.auth.getUser();

  if (sessionError || !user || !user.email) {
    return NextResponse.json({ error: 'Sesi tidak valid. Silakan login kembali.' }, { status: 401 });
  }

  // Re-verify the password before doing anything irreversible.
  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password,
  });
  if (reauthError) {
    return NextResponse.json({ error: 'Password salah.' }, { status: 401 });
  }

  const admin = createAdminClient();
  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  // The `profiles` row is cleaned up automatically by the
  // ON DELETE CASCADE foreign key to auth.users (see the SQL migration).
  return NextResponse.json({ success: true });
}
