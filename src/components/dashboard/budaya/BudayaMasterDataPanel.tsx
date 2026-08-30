'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Loader2, Plus } from 'lucide-react';
import { getBudayaUnits, createBudayaUnit, updateBudayaUnit, getBudayaDimensions } from '@/lib/budayaData';
import { BUDAYA_ROLE_LABEL, type BudayaUnit, type BudayaDimension } from '@/types/budaya';

function UnitsMaster({ isAdmin }: { isAdmin: boolean }) {
  const [units, setUnits] = useState<BudayaUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);

  const reload = () => { setLoading(true); getBudayaUnits(false).then((u) => { setUnits(u); setLoading(false); }); };
  useEffect(reload, []);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    const code = newName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
    await createBudayaUnit({ code, name: newName.trim(), sortOrder: units.length + 1 });
    setNewName(''); setSaving(false); reload();
  };

  const handleToggle = async (u: BudayaUnit) => {
    await updateBudayaUnit(u.id, { isActive: !u.isActive });
    reload();
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Master Unit Kerja</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Daftar unit untuk pilihan Bagian A kuesioner. Menambah/menonaktifkan unit di sini tidak mengubah data survei yang sudah berjalan.
        </p>
        {loading ? (
          <div className="flex items-center py-6 text-muted-foreground"><Loader2 className="size-4 animate-spin mr-2" /> Memuat…</div>
        ) : (
          <div className="space-y-1">
            {units.map((u) => (
              <div key={u.id} className="flex items-center justify-between text-sm border-b py-1.5 last:border-0">
                <span className={u.isActive ? '' : 'text-muted-foreground line-through'}>{u.name}</span>
                {isAdmin && <Switch checked={u.isActive} onCheckedChange={() => handleToggle(u)} />}
              </div>
            ))}
          </div>
        )}
        {isAdmin && (
          <div className="flex gap-2 pt-2">
            <Input placeholder="Nama unit baru…" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <Button size="sm" onClick={handleAdd} disabled={saving}><Plus className="size-4 mr-1" /> Tambah</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DimensionsReference() {
  const [dims, setDims] = useState<BudayaDimension[]>([]);
  useEffect(() => { getBudayaDimensions().then(setDims); }, []);
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Referensi 12 Dimensi</CardTitle></CardHeader>
      <CardContent className="space-y-2 text-sm">
        {dims.map((d) => (
          <div key={d.id} className="border-b pb-2 last:border-0">
            <p className="font-medium">{d.code} — {d.name}</p>
            <p className="text-xs text-muted-foreground">{d.description}</p>
          </div>
        ))}
        <p className="text-xs text-muted-foreground pt-1">Struktur dimensi baku (AHRQ HSOPSC 1.0) — perubahan struktural butuh migrasi instrument_version baru, bukan diedit di sini (poin BP).</p>
      </CardContent>
    </Card>
  );
}

function RolesReference() {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Peran Modul (budaya_roles)</CardTitle></CardHeader>
      <CardContent className="space-y-2 text-sm">
        {Object.entries(BUDAYA_ROLE_LABEL).map(([k, v]) => (
          <div key={k} className="flex items-center justify-between">
            <span>{v}</span><Badge variant="outline">{k}</Badge>
          </div>
        ))}
        <p className="text-xs text-muted-foreground pt-1">Penetapan peran per pengguna dilakukan lewat panel Manajemen Pengguna Admin (reuse pola IKP/Risk — belum ditambahkan khusus di sini pada fase ini).</p>
      </CardContent>
    </Card>
  );
}

export function BudayaMasterDataPanel({ isAdmin, currentUserId }: { isAdmin: boolean; currentUserId: string }) {
  void currentUserId;
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Master Data</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <UnitsMaster isAdmin={isAdmin} />
        <div className="space-y-4">
          <DimensionsReference />
          <RolesReference />
        </div>
      </div>
    </div>
  );
}
