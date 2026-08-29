'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, ShieldCheck, UserCog } from 'lucide-react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  getAllProfiles, updateProfileRole, updateProfileIkpRoles,
  type ProfileRow, type BaseRole, type IkpRoleValue,
} from '@/lib/userAdmin';
import { IKP_ROLE_LABEL } from '@/types/ikp';
import { toastSuccess, toastError } from '@/lib/toast-helpers';

const IKP_ROLE_OPTIONS: IkpRoleValue[] = ['verifikator', 'tim_mutu', 'pimpinan'];

export function IkpUserManagementPanel({ currentUserId }: { currentUserId: string }) {
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = async () => {
    try {
      setProfiles(await getAllProfiles());
    } catch (err) {
      toastError('Gagal memuat daftar pengguna', { description: err instanceof Error ? err.message : undefined });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); }, []);

  const changeRole = async (id: string, role: BaseRole) => {
    if (id === currentUserId && role !== 'admin') {
      toastError('Tidak bisa mencabut role admin dari akun sendiri', { description: 'Minta admin lain untuk melakukan ini.' });
      return;
    }
    setBusyId(id);
    try {
      await updateProfileRole(id, role);
      toastSuccess('Role diperbarui');
      reload();
    } catch (err) {
      toastError('Gagal memperbarui role', { description: err instanceof Error ? err.message : undefined });
    } finally {
      setBusyId(null);
    }
  };

  const toggleIkpRole = async (profile: ProfileRow, role: IkpRoleValue) => {
    const next = profile.ikpRoles.includes(role)
      ? profile.ikpRoles.filter((r) => r !== role)
      : [...profile.ikpRoles, role];
    setBusyId(profile.id);
    try {
      await updateProfileIkpRoles(profile.id, next);
      toastSuccess('Peran IKP diperbarui');
      reload();
    } catch (err) {
      toastError('Gagal memperbarui peran IKP', { description: err instanceof Error ? err.message : undefined });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2 space-y-0">
        <UserCog className="size-4 text-primary" />
        <CardTitle className="text-sm">Manajemen Pengguna & Role</CardTitle>
        <Badge variant="outline" className="text-[10px] ml-auto">Khusus Administrator</Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground -mt-2">
          Role <b>admin</b> memberi akses penuh ke seluruh modul (termasuk semua hak reviewer IKP).
          Peran IKP tambahan (Verifikator/Tim Mutu/Pimpinan) memberi akses reviewer IKP tanpa
          menjadikan pengguna admin penuh — sesuai prinsip <i>least privilege</i>.
        </p>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-2">
            {profiles.map((p) => (
              <div key={p.id} className="rounded-lg border p-3 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-[160px]">
                  <p className="text-sm font-medium">{p.displayName || p.email || p.id}</p>
                  <p className="text-xs text-muted-foreground">{p.email} {p.unitId ? `· ${p.unitId}` : ''}</p>
                </div>

                <div className="flex items-center gap-2">
                  <Select value={p.role} onValueChange={(v) => changeRole(p.id, v as BaseRole)} disabled={busyId === p.id}>
                    <SelectTrigger className="w-[110px] h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">user</SelectItem>
                      <SelectItem value="admin">admin</SelectItem>
                    </SelectContent>
                  </Select>
                  {p.role === 'admin' && <ShieldCheck className="size-4 text-emerald-500" />}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {IKP_ROLE_OPTIONS.map((r) => (
                    <button
                      key={r}
                      type="button"
                      disabled={busyId === p.id || p.role === 'admin'}
                      onClick={() => toggleIkpRole(p, r)}
                      title={p.role === 'admin' ? 'Admin sudah otomatis punya semua akses reviewer IKP' : undefined}
                      className={`text-[10px] rounded-full border px-2.5 py-1 transition-colors disabled:opacity-40 ${
                        p.ikpRoles.includes(r)
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'border-border text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {IKP_ROLE_LABEL[r]}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {profiles.length === 0 && <p className="text-sm text-muted-foreground">Belum ada pengguna terdaftar.</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
