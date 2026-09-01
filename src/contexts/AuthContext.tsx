'use client';

import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';

/**
 * App-facing user shape. Mirrors the subset of the old `firebase/auth` User
 * object that the rest of the app reads (user.uid, user.email,
 * user.displayName, user.emailVerified, user.metadata.*), so components
 * built against Firebase's shape keep working unchanged.
 */
export interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  emailVerified: boolean;
  metadata: {
    creationTime: string | undefined;
    lastSignInTime: string | undefined;
  };
}

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  unitId: string | null;
  /** role dasar dari tabel profiles ('user' | 'admin'). */
  role: string | null;
  /** peran tambahan khusus modul IKP ('verifikator' | 'tim_mutu' | 'pimpinan'). */
  ikpRoles: string[];
  /** peran tambahan khusus modul Manajemen Risiko ('manajemen' | 'pj_mutu' | 'risk_owner' | 'staff_unit' | 'direktur'). */
  riskRoles: string[];
  /** peran tambahan khusus modul Survey Budaya Keselamatan Pasien ('komite_mutu' | 'manajemen' | 'kepala_unit' | 'staff'). */
  budayaRoles: string[];
  /** peran tambahan khusus modul Usulan Indikator Mutu Unit ('kepala_unit' | 'komite_mutu' | 'manajemen'). */
  uimuRoles: string[];
  /** peran tambahan khusus modul Master Indikator Mutu Custom ('komite_mutu' | 'manajemen'). */
  customIndicatorRoles: string[];
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, displayName: string, unitId: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  confirmReset: (code: string, newPassword: string) => Promise<void>;
  verifyResetCode: () => Promise<string>;
  loginWithGoogle: () => Promise<void>;
  setUnitId: (unitId: string) => Promise<void>;
  sendVerification: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const useAuth = () => useContext(AuthContext);

const PROFILES_TABLE = 'profiles';

/** Maps a Supabase auth error to a Firebase-style `code` so existing UI
 *  error-handling (which switches on `error.code === 'auth/...'`) keeps
 *  working without rewriting every page. */
function toFirebaseLikeError(err: unknown): Error & { code: string } {
  const message = err instanceof Error ? err.message : String(err);
  const lower = message.toLowerCase();
  let code = 'auth/unknown-error';

  if (lower.includes('invalid login credentials') || lower.includes('invalid credentials')) {
    code = 'auth/invalid-credential';
  } else if (lower.includes('user not found')) {
    code = 'auth/user-not-found';
  } else if (lower.includes('already registered') || lower.includes('already been registered') || lower.includes('user already exists')) {
    code = 'auth/email-already-in-use';
  } else if (lower.includes('password') && lower.includes('at least')) {
    code = 'auth/weak-password';
  } else if (lower.includes('password') && lower.includes('weak')) {
    code = 'auth/weak-password';
  } else if (lower.includes('invalid email') || lower.includes('unable to validate email')) {
    code = 'auth/invalid-email';
  } else if (lower.includes('rate limit') || lower.includes('too many requests')) {
    code = 'auth/too-many-requests';
  } else if (lower.includes('expired')) {
    code = 'auth/expired-action-code';
  } else if (lower.includes('token') && (lower.includes('invalid') || lower.includes('not found'))) {
    code = 'auth/invalid-action-code';
  } else if (lower.includes('disabled') || lower.includes('banned')) {
    code = 'auth/user-disabled';
  }

  const wrapped = new Error(message) as Error & { code: string };
  wrapped.code = code;
  return wrapped;
}

function toAppUser(user: SupabaseUser | null | undefined): AppUser | null {
  if (!user) return null;
  return {
    uid: user.id,
    email: user.email ?? null,
    displayName: (user.user_metadata?.display_name as string) ?? null,
    emailVerified: !!user.email_confirmed_at,
    metadata: {
      creationTime: user.created_at,
      lastSignInTime: user.last_sign_in_at,
    },
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [unitId, setUnitIdState] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [ikpRoles, setIkpRoles] = useState<string[]>([]);
  const [riskRoles, setRiskRoles] = useState<string[]>([]);
  const [budayaRoles, setBudayaRoles] = useState<string[]>([]);
  const [uimuRoles, setUimuRoles] = useState<string[]>([]);
  const [customIndicatorRoles, setCustomIndicatorRoles] = useState<string[]>([]);
  const recoveryEmailRef = useRef<string | null>(null);

  const fetchUnitId = async (uid: string) => {
    try {
      // ikp_roles/risk_roles/budaya_roles/uimu_roles/custom_indicator_roles hanya
      // ada setelah migrasi modul masing-masing dijalankan. Coba sertakan
      // semuanya; kalau kolom belum ada, turun bertahap supaya unit_id/role
      // (fitur existing) tetap jalan meski salah satu atau lebih migrasi
      // modul belum diterapkan.
      let { data, error } = await supabase
        .from(PROFILES_TABLE)
        .select('unit_id, role, ikp_roles, risk_roles, budaya_roles, uimu_roles, custom_indicator_roles')
        .eq('id', uid)
        .maybeSingle();

      if (error) {
        const fallbackUimu = await supabase
          .from(PROFILES_TABLE)
          .select('unit_id, role, ikp_roles, risk_roles, budaya_roles, uimu_roles')
          .eq('id', uid)
          .maybeSingle();
        data = fallbackUimu.data as typeof data;
        error = fallbackUimu.error;
      }

      if (error) {
        const fallbackIkpRiskBudaya = await supabase
          .from(PROFILES_TABLE)
          .select('unit_id, role, ikp_roles, risk_roles, budaya_roles')
          .eq('id', uid)
          .maybeSingle();
        data = fallbackIkpRiskBudaya.data as typeof data;
        error = fallbackIkpRiskBudaya.error;
      }

      if (error) {
        const fallbackIkpRisk = await supabase
          .from(PROFILES_TABLE)
          .select('unit_id, role, ikp_roles, risk_roles')
          .eq('id', uid)
          .maybeSingle();
        data = fallbackIkpRisk.data as typeof data;
        error = fallbackIkpRisk.error;
      }

      if (error) {
        const fallbackIkp = await supabase
          .from(PROFILES_TABLE)
          .select('unit_id, role, ikp_roles')
          .eq('id', uid)
          .maybeSingle();
        data = fallbackIkp.data as typeof data;
        error = fallbackIkp.error;
      }

      if (error) {
        const fallback = await supabase
          .from(PROFILES_TABLE)
          .select('unit_id, role')
          .eq('id', uid)
          .maybeSingle();
        data = fallback.data as typeof data;
        error = fallback.error;
      }

      if (!error && data) {
        setUnitIdState((data.unit_id as string) || null);
        setRole((data.role as string) ?? 'user');
        setIkpRoles((data as { ikp_roles?: string[] }).ikp_roles ?? []);
        setRiskRoles((data as { risk_roles?: string[] }).risk_roles ?? []);
        setBudayaRoles((data as { budaya_roles?: string[] }).budaya_roles ?? []);
        setUimuRoles((data as { uimu_roles?: string[] }).uimu_roles ?? []);
        setCustomIndicatorRoles((data as { custom_indicator_roles?: string[] }).custom_indicator_roles ?? []);
      }
    } catch (err) {
      console.error('Error fetching user profile:', err);
    }
  };

  useEffect(() => {
    // Restore any existing session on first load.
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(toAppUser(session?.user));
      if (session?.user) fetchUnitId(session.user.id);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        // Remember the email associated with the recovery link; used by
        // verifyResetCode() on the reset-password page.
        recoveryEmailRef.current = session?.user?.email ?? null;
      }

      setUser(toAppUser(session?.user));
      if (session?.user) {
        await fetchUnitId(session.user.id);
      } else {
        setUnitIdState(null);
        setRole(null);
        setIkpRoles([]);
      }
      setLoading(false);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw toFirebaseLikeError(error);
  };

  const signup = async (email: string, password: string, displayName: string, selectedUnitId: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName,
          unit_id: selectedUnitId,
        },
      },
    });
    if (error) throw toFirebaseLikeError(error);

    // A DB trigger (handle_new_user) creates the `profiles` row from the
    // signup metadata above. If the session came back immediately (email
    // confirmation disabled), reflect the unit right away.
    if (data.session) {
      setUnitIdState(selectedUnitId);
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUnitIdState(null);
    setRole(null);
    setIkpRoles([]);
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/?page=reset` : undefined,
    });
    if (error) throw toFirebaseLikeError(error);
  };

  // Supabase's recovery flow authenticates the browser via the emailed link
  // itself (no separate oobCode to redeem) — by the time this resolves, the
  // PASSWORD_RECOVERY event above should already have fired. `_code` is
  // accepted for signature compatibility with the old Firebase-based pages.
  const confirmReset = async (_code: string, newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw toFirebaseLikeError(error);
  };

  const verifyResetCode = async (): Promise<string> => {
    const { data: { session } } = await supabase.auth.getSession();
    const email = session?.user?.email ?? recoveryEmailRef.current;
    if (!session || !email) {
      throw toFirebaseLikeError(new Error('invalid or expired reset link'));
    }
    return email;
  };

  const loginWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
      },
    });
    if (error) throw toFirebaseLikeError(error);
    // Supabase OAuth redirects the whole page; profile creation for new
    // Google users is handled by the same handle_new_user DB trigger.
  };

  const setUnitId = async (id: string) => {
    setUnitIdState(id);
    if (user?.uid) {
      try {
        const { error } = await supabase
          .from(PROFILES_TABLE)
          .update({ unit_id: id })
          .eq('id', user.uid);
        if (error) throw error;
      } catch (err) {
        console.error('Failed to persist unit change:', err);
      }
    }
  };

  const sendVerification = async () => {
    if (!user?.email) {
      throw new Error('Tidak ada pengguna yang login');
    }
    const { error } = await supabase.auth.resend({ type: 'signup', email: user.email });
    if (error) throw toFirebaseLikeError(error);
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      unitId,
      role,
      ikpRoles,
      riskRoles,
      budayaRoles,
      uimuRoles,
      customIndicatorRoles,
      login,
      signup,
      logout,
      resetPassword,
      confirmReset,
      verifyResetCode,
      loginWithGoogle,
      setUnitId,
      sendVerification,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
