'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Microscope, Plus, Pencil, Loader2, ExternalLink } from 'lucide-react';
import { OPPE_FPPE_STATUS_LABEL, type OppeFppe, type OppeFppeStatus, type OppeDoctor } from '@/types/oppe';
import { getOppeFppeList, saveOppeFppe, getAllActiveOppeDoctors, friendlyOppeError, getOppeEvaluations } from '@/lib/oppeData';
import { toastSuccess } from '@/lib/toast-helpers';
import { OppeLoading, OppeEmpty, OppeErrorState, OppePageHeader, OppeFppeStatusBadge, ALL, fmtDate, type OppeMasters } from './OppeShared';
import type { OppeEvaluation } from '@/types/oppe';
import { periodLabel } from '@/types/oppe';

interface Props {
  masters: OppeMasters;
  canManage: boolean;
  actor: { id: string; name: string };
  onOpenEvaluation: (id: string) => void;
}

export function OppeFppePanel({ masters, canManage, actor, onOpenEvaluation }: Props) {
  const [rows, setRows] = useState<OppeFppe[]>([]);
  const [pending, setPending] = useState<OppeEvaluation[]>([]);
  const [status, setStatus] = useState(ALL);
  const [ksmId, setKsmId] = useState(ALL);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Partial<OppeFppe> | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [f, ev] = await Promise.all([
        getOppeFppeList({ status: status === ALL ? undefined : status, ksmId: ksmId === ALL ? undefined : ksmId }),
        getOppeEvaluations({ requiresFppe: true }),
      ]);
      setRows(f);
      const withFppe = new Set((await getOppeFppeList()).map((x) => x.evaluationId));
      setPending(ev.rows.filter((e) => !withFppe.has(e.id)));
    } catch (e) {
      setError(friendlyOppeError(e, 'Data FPPE gagal dimuat.'));
    } finally {
      setLoading(false);
    }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [status, ksmId]);

  return (
    <div className="p-4 space-y-4">
      <OppePageHeader
        icon={Microscope}
        title="FPPE — Focused Professional Practice Evaluation"
        description="Evaluasi terfokus yang dipicu hasil OPPE (indikator kritis / trigger berulang). Keputusan tetap oleh Komite Medik."
        actions={canManage && <Button size="sm" className="gap-1.5" onClick={() => setEditing({ status: 'draft' })}><Plus className="size-4" />FPPE Baru</Button>}
      />

      {pending.length > 0 && (
        <Card className="border-amber-500/40">
          <CardContent className="pt-4 space-y-2">
            <p className="text-sm font-semibold">Rekomendasi FPPE yang belum ditindaklanjuti ({pending.length})</p>
            {pending.map((e) => (
              <div key={e.id} className="flex flex-wrap items-center justify-between gap-2 rounded border p-2">
                <div className="text-xs">
                  <p className="font-medium text-sm">{e.doctorName} · {e.ksmName}</p>
                  <p className="text-muted-foreground">{periodLabel(e)} · skor {e.finalScore ?? '—'} · {e.triggerCount} trigger{e.criticalIndicators ? ` · kritis: ${e.criticalIndicators}` : ''}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" className="gap-1" onClick={() => onOpenEvaluation(e.id)}><ExternalLink className="size-3.5" />Evaluasi</Button>
                  {canManage && (
                    <Button size="sm" className="gap-1" onClick={() => setEditing({
                      evaluationId: e.id, doctorId: e.doctorId, ksmId: e.ksmId, status: 'draft',
                      triggerIndicatorName: e.criticalIndicators ?? null,
                      reason: e.criticalIndicators ? `Indikator kritis terkena trigger pada OPPE ${periodLabel(e)}: ${e.criticalIndicators}` : `${e.triggerCount} indikator terkena trigger pada OPPE ${periodLabel(e)}`,
                    })}><Plus className="size-3.5" />Buat FPPE</Button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-[180px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value={ALL}>Semua status</SelectItem>{(Object.keys(OPPE_FPPE_STATUS_LABEL) as OppeFppeStatus[]).map((s) => <SelectItem key={s} value={s}>{OPPE_FPPE_STATUS_LABEL[s]}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={ksmId} onValueChange={setKsmId}>
              <SelectTrigger className="w-[220px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value={ALL}>Semua KSM</SelectItem>{masters.ksm.map((k) => <SelectItem key={k.id} value={k.id}>{k.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {loading ? <OppeLoading /> : error ? <OppeErrorState message={error} onRetry={load} /> : rows.length === 0 ? <OppeEmpty title="Belum ada FPPE" /> : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>No. FPPE</TableHead><TableHead>Dokter</TableHead><TableHead>KSM</TableHead><TableHead>Indikator pemicu</TableHead><TableHead>Periode</TableHead><TableHead>Evaluator</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Aksi</TableHead></TableRow></TableHeader>
                <TableBody>
                  {rows.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell className="font-mono text-xs">{f.fppeNumber}</TableCell>
                      <TableCell className="font-medium">{f.doctorName}</TableCell>
                      <TableCell className="text-xs">{f.ksmName}</TableCell>
                      <TableCell className="text-xs max-w-[280px]">{f.triggerIndicatorName ?? f.reason}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{fmtDate(f.startDate)} – {fmtDate(f.endDate)}</TableCell>
                      <TableCell className="text-xs">{f.evaluatorName ?? '—'}</TableCell>
                      <TableCell><OppeFppeStatusBadge status={f.status} /></TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {f.evaluationId && <Button size="icon" variant="ghost" className="size-8" title="Buka evaluasi OPPE" onClick={() => onOpenEvaluation(f.evaluationId!)}><ExternalLink className="size-4" /></Button>}
                        {(canManage || f.evaluatorId === actor.id) && <Button size="icon" variant="ghost" className="size-8" onClick={() => setEditing(f)}><Pencil className="size-4" /></Button>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      {editing && <OppeFppeForm masters={masters} initial={editing} actor={actor} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </div>
  );
}

export function OppeFppeForm({ masters, initial, actor, onClose, onSaved }: { masters: OppeMasters; initial: Partial<OppeFppe>; actor: { id: string; name: string }; onClose: () => void; onSaved: (f: OppeFppe) => void }) {
  const [f, setF] = useState<Partial<OppeFppe>>({ evaluatorName: actor.name, evaluatorId: actor.id, ...initial });
  const [doctors, setDoctors] = useState<OppeDoctor[]>([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { getAllActiveOppeDoctors().then(setDoctors).catch(() => setDoctors([])); }, []);
  const set = <K extends keyof OppeFppe>(k: K, v: OppeFppe[K] | null) => setF((p) => ({ ...p, [k]: v }));

  async function submit() {
    setErr(null);
    setSaving(true);
    try {
      const doc = doctors.find((d) => d.id === f.doctorId);
      const saved = await saveOppeFppe({ ...f, ksmId: f.ksmId ?? doc?.ksmId ?? null }, actor);
      toastSuccess(initial.id ? 'FPPE diperbarui' : 'FPPE dibuat');
      onSaved(saved);
    } catch (e) {
      setErr(friendlyOppeError(e, 'FPPE gagal disimpan. Silakan coba kembali.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{f.id ? `FPPE ${f.fppeNumber ?? ''}` : 'FPPE Baru'}</DialogTitle>
          <DialogDescription>Evaluasi terfokus atas area praktik tertentu. Hasil & rekomendasi diputuskan Komite Medik.</DialogDescription>
        </DialogHeader>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1 sm:col-span-2"><Label className="text-xs">Dokter *</Label>
            <Select value={f.doctorId ?? ''} onValueChange={(v) => set('doctorId', v)} disabled={!!initial.evaluationId}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Pilih dokter" /></SelectTrigger>
              <SelectContent>{doctors.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}{d.ksmName ? ` — ${d.ksmName}` : ''}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1 sm:col-span-2"><Label className="text-xs">Indikator pemicu</Label><Input value={f.triggerIndicatorName ?? ''} onChange={(e) => set('triggerIndicatorName', e.target.value)} /></div>
          <div className="space-y-1 sm:col-span-2"><Label className="text-xs">Alasan FPPE *</Label><Textarea rows={2} value={f.reason ?? ''} onChange={(e) => set('reason', e.target.value)} /></div>
          <div className="space-y-1 sm:col-span-2"><Label className="text-xs">Area yang dievaluasi</Label><Input value={f.area ?? ''} onChange={(e) => set('area', e.target.value)} placeholder="mis. tata laksana peri-anestesi" /></div>
          <div className="space-y-1"><Label className="text-xs">Tanggal mulai</Label><Input type="date" value={f.startDate ?? ''} onChange={(e) => set('startDate', e.target.value)} /></div>
          <div className="space-y-1"><Label className="text-xs">Tanggal selesai</Label><Input type="date" value={f.endDate ?? ''} onChange={(e) => set('endDate', e.target.value)} /></div>
          <div className="space-y-1"><Label className="text-xs">Evaluator / pembimbing</Label><Input value={f.evaluatorName ?? ''} onChange={(e) => set('evaluatorName', e.target.value)} /></div>
          <div className="space-y-1"><Label className="text-xs">Status</Label>
            <Select value={f.status ?? 'draft'} onValueChange={(v) => set('status', v as OppeFppeStatus)}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>{(Object.keys(OPPE_FPPE_STATUS_LABEL) as OppeFppeStatus[]).map((s) => <SelectItem key={s} value={s}>{OPPE_FPPE_STATUS_LABEL[s]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1 sm:col-span-2"><Label className="text-xs">Rencana evaluasi</Label><Textarea rows={3} value={f.plan ?? ''} onChange={(e) => set('plan', e.target.value)} placeholder="mis. observasi langsung, review kasus, audit rekam medis, proctoring" /></div>
          <div className="space-y-1 sm:col-span-2"><Label className="text-xs">Hasil</Label><Textarea rows={3} value={f.result ?? ''} onChange={(e) => set('result', e.target.value)} /></div>
          <div className="space-y-1 sm:col-span-2"><Label className="text-xs">Rekomendasi</Label><Textarea rows={2} value={f.recommendation ?? ''} onChange={(e) => set('recommendation', e.target.value)} /></div>
        </div>
        {masters.ksm.length === 0 && <p className="text-xs text-amber-600">Master KSM kosong.</p>}
        {err && <p className="text-sm text-red-500">{err}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Batal</Button>
          <Button onClick={submit} disabled={saving} className="gap-1.5">{saving && <Loader2 className="size-4 animate-spin" />}Simpan</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
