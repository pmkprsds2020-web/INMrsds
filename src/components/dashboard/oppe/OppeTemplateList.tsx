'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Pencil, Copy, Loader2, ArrowUp, ArrowDown, X, Eye } from 'lucide-react';
import type { OppeIndicator, OppeTemplate } from '@/types/oppe';
import { getOppeTemplates, getOppeTemplateIndicators, getOppeIndicators, saveOppeTemplate, friendlyOppeError } from '@/lib/oppeData';
import { describeTarget } from '@/lib/oppeScoring';
import { toastSuccess } from '@/lib/toast-helpers';
import { OppeLoading, OppeEmpty, OppeErrorState, type OppeMasters } from './OppeShared';

export function OppeTemplateList({ masters, canManage, actor, onChanged }: { masters: OppeMasters; canManage: boolean; actor: { id: string; name: string }; onChanged: () => void }) {
  const [rows, setRows] = useState<OppeTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ template: Partial<OppeTemplate>; copyFrom?: string } | null>(null);
  const [viewing, setViewing] = useState<OppeTemplate | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try { setRows(await getOppeTemplates()); } catch (e) { setError(friendlyOppeError(e, 'Template gagal dimuat.')); } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);
  const ksmName = (id: string | null) => masters.ksm.find((k) => k.id === id)?.name ?? 'Umum';

  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground max-w-2xl">
            Alur: <b>KSM → Profesi → Template OPPE</b>. Saat membuat evaluasi, sistem otomatis memuat indikator A (Perilaku), B (Pengembangan),
            dan C (Kinerja Klinis) dari template KSM dokter. Admin/Komite tetap bisa menambah, menghapus, atau mengurutkan indikator.
          </p>
          {canManage && <Button size="sm" className="gap-1.5" onClick={() => setEditing({ template: { isActive: true } })}><Plus className="size-4" />Template Baru</Button>}
        </div>
        {loading ? <OppeLoading /> : error ? <OppeErrorState message={error} onRetry={load} /> : rows.length === 0 ? <OppeEmpty title="Belum ada template" /> : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow><TableHead>Kode</TableHead><TableHead>Template</TableHead><TableHead>KSM</TableHead><TableHead>Profesi</TableHead><TableHead className="text-right">Indikator</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Aksi</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-mono text-xs">{t.code}</TableCell>
                    <TableCell className="font-medium text-sm">{t.name}<p className="text-[11px] text-muted-foreground font-normal line-clamp-1">{t.description}</p></TableCell>
                    <TableCell className="text-xs">{ksmName(t.ksmId)}</TableCell>
                    <TableCell className="text-xs">{t.profession ?? '—'}</TableCell>
                    <TableCell className="text-right">{t.indicatorCount ?? '—'}</TableCell>
                    <TableCell><Badge variant={t.isActive ? 'secondary' : 'outline'} className="text-[10px]">{t.isActive ? 'Aktif' : 'Nonaktif'}</Badge></TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <Button size="icon" variant="ghost" className="size-8" title="Lihat" onClick={() => setViewing(t)}><Eye className="size-4" /></Button>
                      {canManage && <Button size="icon" variant="ghost" className="size-8" title="Edit" onClick={() => setEditing({ template: t })}><Pencil className="size-4" /></Button>}
                      {canManage && <Button size="icon" variant="ghost" className="size-8" title="Duplikat" onClick={() => setEditing({ template: { ...t, id: undefined, code: `${t.code}-COPY`, name: `${t.name} (salinan)` }, copyFrom: t.id })}><Copy className="size-4" /></Button>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
      {editing && <OppeTemplateForm masters={masters} initial={editing.template} copyFrom={editing.copyFrom} actor={actor} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); onChanged(); }} />}
      {viewing && <TemplatePreview template={viewing} onClose={() => setViewing(null)} />}
    </Card>
  );
}

function TemplatePreview({ template, onClose }: { template: OppeTemplate; onClose: () => void }) {
  const [rows, setRows] = useState<OppeIndicator[] | null>(null);
  useEffect(() => { getOppeTemplateIndicators(template.id).then((r) => setRows(r.map((x) => x.indicator))).catch(() => setRows([])); }, [template.id]);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{template.name}</DialogTitle><DialogDescription>{template.description}</DialogDescription></DialogHeader>
        {!rows ? <OppeLoading /> : (
          <Table>
            <TableHeader><TableRow><TableHead>No</TableHead><TableHead>Parameter</TableHead><TableHead>Target</TableHead><TableHead>Trigger</TableHead><TableHead>Sumber Data</TableHead></TableRow></TableHeader>
            <TableBody>
              {rows.map((r, i) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs">{r.categoryCode}{i + 1}</TableCell>
                  <TableCell className="text-sm">{r.name}{r.isCritical && <Badge variant="destructive" className="ml-1 text-[9px]">KRITIS</Badge>}</TableCell>
                  <TableCell className="text-xs">{r.targetText || describeTarget(r, r.unitLabel)}</TableCell>
                  <TableCell className="text-xs">{r.triggerText}</TableCell>
                  <TableCell className="text-xs">{r.sourceData}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
}

function OppeTemplateForm({ masters, initial, copyFrom, actor, onClose, onSaved }: { masters: OppeMasters; initial: Partial<OppeTemplate>; copyFrom?: string; actor: { id: string; name: string }; onClose: () => void; onSaved: () => void }) {
  const [t, setT] = useState<Partial<OppeTemplate>>(initial);
  const [all, setAll] = useState<OppeIndicator[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [showAllKsm, setShowAllKsm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [inds, current] = await Promise.all([
          getOppeIndicators({ active: true }),
          initial.id || copyFrom ? getOppeTemplateIndicators((initial.id ?? copyFrom)!) : Promise.resolve([]),
        ]);
        setAll(inds);
        setSelected(current.sort((a, b) => a.sequence - b.sequence).map((c) => c.indicatorId));
      } finally {
        setLoading(false);
      }
    })();
  }, [initial.id, copyFrom]);

  const byId = useMemo(() => new Map(all.map((i) => [i.id, i])), [all]);
  const candidates = all.filter((i) => showAllKsm || !i.ksmId || i.ksmId === t.ksmId);
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const move = (idx: number, d: -1 | 1) => setSelected((s) => {
    const n = [...s];
    const j = idx + d;
    if (j < 0 || j >= n.length) return s;
    [n[idx], n[j]] = [n[j], n[idx]];
    return n;
  });
  const catOrder = (id: string) => masters.categories.find((c) => c.id === byId.get(id)?.categoryId)?.sortOrder ?? 99;

  async function submit() {
    setErr(null);
    if (!t.code?.trim() || !t.name?.trim()) { setErr('Kode dan nama template wajib diisi.'); return; }
    if (selected.length === 0) { setErr('Pilih minimal satu indikator.'); return; }
    setSaving(true);
    try {
      // urutkan stabil per kategori (A, B, C) dengan mempertahankan urutan pilihan di dalam kategori
      const ordered = [...selected].map((id, i) => ({ id, i })).sort((a, b) => catOrder(a.id) - catOrder(b.id) || a.i - b.i).map((x) => x.id);
      await saveOppeTemplate({ ...t, code: t.code!, name: t.name! }, ordered, actor);
      toastSuccess('Template disimpan');
      onSaved();
    } catch (e) {
      setErr(friendlyOppeError(e, 'Template gagal disimpan.'));
    } finally {
      setSaving(false);
    }
  }

  const professions = masters.options.filter((o) => o.kind === 'profession' && o.isActive);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t.id ? 'Edit Template OPPE' : 'Template OPPE Baru'}</DialogTitle>
          <DialogDescription>Template menentukan indikator yang otomatis dimuat saat membuat evaluasi.</DialogDescription>
        </DialogHeader>
        <div className="grid sm:grid-cols-4 gap-3">
          <div className="space-y-1"><Label className="text-xs">Kode *</Label><Input value={t.code ?? ''} onChange={(e) => setT({ ...t, code: e.target.value })} /></div>
          <div className="space-y-1 sm:col-span-3"><Label className="text-xs">Nama template *</Label><Input value={t.name ?? ''} onChange={(e) => setT({ ...t, name: e.target.value })} /></div>
          <div className="space-y-1 sm:col-span-2"><Label className="text-xs">KSM</Label>
            <Select value={t.ksmId ?? '__none'} onValueChange={(v) => setT({ ...t, ksmId: v === '__none' ? null : v })}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="__none">Umum</SelectItem>{masters.ksm.map((k) => <SelectItem key={k.id} value={k.id}>{k.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label className="text-xs">Profesi</Label>
            <Select value={t.profession ?? '__none'} onValueChange={(v) => setT({ ...t, profession: v === '__none' ? null : v })}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="__none">Semua</SelectItem>{professions.map((p) => <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label className="text-xs">Aktif</Label><div className="h-9 flex items-center"><Switch checked={t.isActive ?? true} onCheckedChange={(v) => setT({ ...t, isActive: v })} /></div></div>
          <div className="space-y-1 sm:col-span-4"><Label className="text-xs">Deskripsi</Label><Textarea rows={2} value={t.description ?? ''} onChange={(e) => setT({ ...t, description: e.target.value })} /></div>
        </div>

        {loading ? <OppeLoading /> : (
          <div className="grid md:grid-cols-2 gap-3">
            <div className="border rounded-md p-2 space-y-1 max-h-[380px] overflow-y-auto">
              <div className="flex items-center justify-between px-1 pb-1">
                <p className="text-xs font-semibold">Pilih indikator</p>
                <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><Switch checked={showAllKsm} onCheckedChange={setShowAllKsm} />semua KSM</label>
              </div>
              {candidates.map((i) => (
                <label key={i.id} className="flex items-start gap-2 rounded p-1.5 hover:bg-muted/40 cursor-pointer">
                  <Checkbox checked={selected.includes(i.id)} onCheckedChange={() => toggle(i.id)} className="mt-0.5" />
                  <span className="text-xs"><span className="font-mono text-muted-foreground">{i.code}</span> {i.name}</span>
                </label>
              ))}
            </div>
            <div className="border rounded-md p-2 space-y-1 max-h-[380px] overflow-y-auto">
              <p className="text-xs font-semibold px-1 pb-1">Urutan indikator terpilih ({selected.length})</p>
              {selected.map((id, idx) => {
                const i = byId.get(id);
                return (
                  <div key={id} className="flex items-center gap-1 rounded border p-1.5">
                    <span className="text-[10px] text-muted-foreground w-5">{idx + 1}</span>
                    <span className="text-xs flex-1 min-w-0 truncate"><span className="font-mono text-muted-foreground">{i?.code}</span> {i?.name ?? id}</span>
                    <Button size="icon" variant="ghost" className="size-6" onClick={() => move(idx, -1)}><ArrowUp className="size-3" /></Button>
                    <Button size="icon" variant="ghost" className="size-6" onClick={() => move(idx, 1)}><ArrowDown className="size-3" /></Button>
                    <Button size="icon" variant="ghost" className="size-6" onClick={() => toggle(id)}><X className="size-3" /></Button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {err && <p className="text-sm text-red-500">{err}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Batal</Button>
          <Button onClick={submit} disabled={saving} className="gap-1.5">{saving && <Loader2 className="size-4 animate-spin" />}Simpan Template</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
