import { supabase } from '@/lib/supabase/client';

// Manajemen role pengguna (role dasar 'user'/'admin' dan ikp_roles).
// Tidak membuat tabel/skema baru — hanya membaca & memperbarui tabel
// `profiles` yang sudah ada. Keamanan sepenuhnya ditegakkan oleh RLS
// existing di supabase/migration.sql ("profiles_update_own_or_admin"):
// hanya pemilik baris atau user dengan role='admin' yang bisa UPDATE,
// jadi non-admin yang memanggil fungsi di sini akan ditolak oleh Postgres,
// bukan hanya disembunyikan di UI.

export type BaseRole = 'user' | 'admin';
export type IkpRoleValue = 'verifikator' | 'tim_mutu' | 'pimpinan';

export interface ProfileRow {
  id: string;
  email: string | null;
  displayName: string | null;
  unitId: string | null;
  role: BaseRole;
  ikpRoles: IkpRoleValue[];
  createdAt: string;
}

function rowToProfile(row: Record<string, any>): ProfileRow {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    unitId: row.unit_id,
    role: (row.role as BaseRole) ?? 'user',
    ikpRoles: (row.ikp_roles as IkpRoleValue[]) ?? [],
    createdAt: row.created_at,
  };
}

export async function getAllProfiles(): Promise<ProfileRow[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, display_name, unit_id, role, ikp_roles, created_at')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data as any[]).map(rowToProfile);
}

export async function updateProfileRole(id: string, role: BaseRole): Promise<void> {
  const { error } = await supabase.from('profiles').update({ role }).eq('id', id);
  if (error) throw error;
}

export async function updateProfileIkpRoles(id: string, ikpRoles: IkpRoleValue[]): Promise<void> {
  const { error } = await supabase.from('profiles').update({ ikp_roles: ikpRoles }).eq('id', id);
  if (error) throw error;
}
