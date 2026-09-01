'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Plus, Database } from 'lucide-react';
import type { UimuProposal, UimuUnit } from '@/types/uimu';
import { getUimuMasterIndikator, getUimuUnits, createUimuUnit, updateUimuUnit, setUimuUnitActive } from '@/lib/uimuData';
import { toastSuccess, toastError } from '@/lib/toast-helpers';

interface UimuMasterPanelProps {
  isAdmin: boolean;
  currentUserId: string;
  onSelectProposal: (id: string) => void;
}

export function UimuMasterPanel({ isAdmin, currentUserId, onSelectProposal }: UimuMasterPanelProps) {
  const [indicators, setIndicators] = useState<UimuProposal[]>([]);
  const [units, setUnits] = useState<UimuUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [ind, unitList] = await Promise.all([getUimuMasterIndikator(), getUimuUnits(true)]);
      setIndicators(ind);
      setUnits(unitList);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleAddUnit() {
    if (!newCode.trim() || !newName.trim()) {
      toastError('Kode dan nama unit wajib diisi');
      return;
    }
    setSaving(true);
    try {
      await createUimuUnit({ code: newCode.trim().toUpperCase(), name: newName.trim(), category: newCategory.trim() || null, createdBy: currentUserId } as any);
      toastSuccess('Unit ditambahkan');
      setNewCode(''); setNewName(''); setNewCategory('');
      await load();
    } catch (err) {
      toastError('Gagal menambah unit', { description: err instanceof Error ? err.message : undefined });
    } finally {
      setSaving(false);
    }
  }

  async function toggleUnit(u: UimuUnit) {
    try {
      await setUimuUnitActive(u.id, !u.isActive);
      await load();
    } catch (err) {
      toastError('Gagal mengubah status unit');
    }
  }

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-lg font-semibold flex items-center gap-2"><Database className="size-4" /> Master Indikator & Master Unit</h2>

      <Tabs defaultValue="indikator">
        <TabsList>
          <TabsTrigger value="indikator">Master Indikator</TabsTrigger>
          <TabsTrigger value="unit">Master Unit</TabsTrigger>
        </TabsList>

        <TabsContent value="indikator">
          <Card>
            <CardHeader><CardTitle className="text-sm">Indikator yang Sudah Ditetapkan/Aktif</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>No. Usulan</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Nama Indikator</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Frekuensi</TableHead>
                    <TableHead>PIC</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {indicators.map((r) => (
                    <TableRow key={r.id} className="cursor-pointer hover:bg-muted/40" onClick={() => onSelectProposal(r.id)}>
                      <TableCell className="font-mono text-xs">{r.proposalNumber}</TableCell>
                      <TableCell>{r.unitNameSnapshot ?? '—'}</TableCell>
                      <TableCell className="max-w-[220px] truncate">{r.indicatorName}</TableCell>
                      <TableCell>{r.targetValue ?? '—'} {r.targetUnit ?? ''}</TableCell>
                      <TableCell>{r.collectionFrequency ?? '—'}</TableCell>
                      <TableCell>{r.picName ?? '—'}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px]">{r.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                  {indicators.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-10">Belum ada indikator yang ditetapkan.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="unit" className="space-y-3">
          {isAdmin && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Tambah Unit Baru</CardTitle></CardHeader>
              <CardContent className="flex flex-wrap items-end gap-2">
                <div className="space-y-1"><label className="text-xs text-muted-foreground">Kode</label><Input className="w-28" value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="mis. HD" /></div>
                <div className="space-y-1"><label className="text-xs text-muted-foreground">Nama Unit</label><Input className="w-56" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="mis. Hemodialisa" /></div>
                <div className="space-y-1"><label className="text-xs text-muted-foreground">Kategori (opsional)</label><Input className="w-44" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="mis. Penunjang" /></div>
                <Button size="sm" disabled={saving} onClick={handleAddUnit} className="gap-1.5"><Plus className="size-4" /> Tambah</Button>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Kode</TableHead><TableHead>Nama Unit</TableHead><TableHead>Kategori</TableHead><TableHead>Aktif</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {units.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-mono text-xs">{u.code}</TableCell>
                      <TableCell>{u.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{u.category ?? '—'}</TableCell>
                      <TableCell>
                        {isAdmin ? <Switch checked={u.isActive} onCheckedChange={() => toggleUnit(u)} /> : <Badge variant={u.isActive ? 'default' : 'outline'} className="text-[10px]">{u.isActive ? 'Aktif' : 'Nonaktif'}</Badge>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
