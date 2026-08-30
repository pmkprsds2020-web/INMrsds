'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChevronLeft, Loader2, ShieldAlert, Upload, Trash2, Save, Plus } from 'lucide-react';
import {
  type Risk, RISK_STATUS_LABEL, RISK_STATUS_COLOR, RISK_LEVEL_LABEL, RISK_LEVEL_COLOR,
  RISK_CATEGORIES, RISK_EVALUATION_LABEL, RISK_MITIGATION_STATUS_LABEL, RISK_MITIGATION_STATUS_COLOR,
  RISK_REVIEW_DECISION_LABEL,
} from '@/types/risk';
import {
  getRiskById, updateRisk,
  getRiskMitigations, createRiskMitigation, updateRiskMitigation,
  getRiskMonitorings, createRiskMonitoring,
  getRiskReviews, createRiskReview,
  getRiskAttachments, uploadRiskAttachment, getRiskAttachmentUrl, deleteRiskAttachment,
  getRiskHistory, getRiskAuditTrail, evaluateRisk, closeRisk,
} from '@/lib/riskData';
import { toastSuccess, toastError } from '@/lib/toast-helpers';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale/id';

interface RiskDetailProps {
  riskId: string;
  userId: string;
  userName: string;
  canReview: boolean;
  onBack: () => void;
  onEdit?: (risk: Risk) => void;
  initialTab?: string;
}

export function RiskDetail({ riskId, userId, userName, canReview, onBack, onEdit, initialTab }: RiskDetailProps) {
  const [risk, setRisk] = useState<Risk | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(initialTab ?? 'info');

  const reload = async () => {
    const data = await getRiskById(riskId);
    setRisk(data);
    setLoading(false);
  };

  useEffect(() => { reload(); }, [riskId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;
  if (!risk) return <div className="p-6 text-sm text-muted-foreground">Risiko tidak ditemukan.</div>;

  const level = risk.assessment?.levelSkor;

  return (
    <div className="p-4 space-y-4 max-w-5xl mx-auto">
      <Button variant="ghost" size="sm" onClick={onBack}><ChevronLeft className="size-4 mr-1" />Kembali ke Risk Register</Button>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <ShieldAlert className="size-5 text-amber-500" />
                <h2 className="text-lg font-semibold font-mono">{risk.riskCode}</h2>
                <Badge variant="outline" style={{ borderColor: RISK_STATUS_COLOR[risk.status], color: RISK_STATUS_COLOR[risk.status] }}>
                  {RISK_STATUS_LABEL[risk.status]}
                </Badge>
                {level && (
                  <Badge style={{ backgroundColor: RISK_LEVEL_COLOR[level], color: 'white', border: 'none' }}>
                    {RISK_LEVEL_LABEL[level]} · Skor {risk.assessment?.skorRisiko}
                  </Badge>
                )}
              </div>
              <p className="text-sm font-medium mt-1">{risk.risiko}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {risk.unitLokasi} · {RISK_CATEGORIES.find((c) => c.id === risk.category)?.label} · Tahun {risk.riskYear}
                {' · '}Risk Owner: {risk.riskOwnerName || '—'}
              </p>
            </div>
            <div className="flex gap-2">
              {onEdit && risk.status !== 'ditutup' && (
                <Button variant="outline" size="sm" onClick={() => onEdit(risk)}>Edit Identifikasi/Analisis</Button>
              )}
              {canReview && risk.status !== 'ditutup' && (
                <Button
                  variant="outline" size="sm"
                  onClick={async () => { await closeRisk(risk.id, userId); toastSuccess('Risiko ditutup'); reload(); }}
                >
                  Tutup Risiko
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="info">Informasi</TabsTrigger>
          <TabsTrigger value="evaluasi">Evaluasi</TabsTrigger>
          <TabsTrigger value="mitigasi">Mitigasi</TabsTrigger>
          <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
          <TabsTrigger value="review">Review & Residual</TabsTrigger>
          <TabsTrigger value="evidence">Evidence</TabsTrigger>
          <TabsTrigger value="riwayat">Riwayat</TabsTrigger>
          <TabsTrigger value="audit">Audit Trail</TabsTrigger>
        </TabsList>

        <TabsContent value="info"><TabInfo risk={risk} /></TabsContent>
        <TabsContent value="evaluasi"><TabEvaluasi risk={risk} userId={userId} canReview={canReview} onChanged={reload} /></TabsContent>
        <TabsContent value="mitigasi"><TabMitigasi riskId={risk.id} userId={userId} canReview={canReview} onChanged={reload} /></TabsContent>
        <TabsContent value="monitoring"><TabMonitoring riskId={risk.id} userId={userId} canReview={canReview} onChanged={reload} /></TabsContent>
        <TabsContent value="review"><TabReview risk={risk} userId={userId} canReview={canReview} onChanged={reload} /></TabsContent>
        <TabsContent value="evidence"><TabEvidence riskId={risk.id} userId={userId} /></TabsContent>
        <TabsContent value="riwayat"><TabRiwayat riskId={risk.id} /></TabsContent>
        <TabsContent value="audit"><TabAudit riskId={risk.id} /></TabsContent>
      </Tabs>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Tab: Informasi (Identifikasi + Analisis, read-only ringkasan)
// ────────────────────────────────────────────────────────────────
function TabInfo({ risk }: { risk: Risk }) {
  const a = risk.assessment;
  return (
    <Card><CardContent className="pt-6 space-y-4 text-sm">
      <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-3">
        <div><dt className="text-xs text-muted-foreground">Tanggal Identifikasi</dt><dd>{format(new Date(risk.identifiedDate), 'd MMMM yyyy', { locale: idLocale })}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Unit/Lokasi</dt><dd>{risk.unitLokasi}</dd></div>
        <div className="sm:col-span-2"><dt className="text-xs text-muted-foreground">Risiko</dt><dd>{risk.risiko}</dd></div>
        <div className="sm:col-span-2"><dt className="text-xs text-muted-foreground">Sebab Insiden/Kejadian</dt><dd>{risk.sebabInsiden}</dd></div>
        <div className="sm:col-span-2"><dt className="text-xs text-muted-foreground">Efek/Dampak</dt><dd>{risk.efekDampak}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Kontrol yang Sudah Tersedia</dt><dd>{risk.kontrolExisting || '—'}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Dokumen/SPO Terkait</dt><dd>{risk.dokumenSpoTerkait || '—'}</dd></div>
      </dl>

      {a ? (
        <div className="rounded-lg border p-4 space-y-2 bg-muted/20">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Analisis Risiko</p>
          <div className="grid sm:grid-cols-4 gap-3 text-center">
            <div><p className="text-[11px] text-muted-foreground">Probabilitas</p><p className="text-lg font-bold">{a.probabilitas}</p></div>
            <div><p className="text-[11px] text-muted-foreground">Dampak</p><p className="text-lg font-bold">{a.dampak}</p></div>
            <div><p className="text-[11px] text-muted-foreground">Controllability</p><p className="text-lg font-bold">{a.controllability}</p></div>
            <div><p className="text-[11px] text-muted-foreground">Skor Risiko</p><p className="text-lg font-bold" style={{ color: RISK_LEVEL_COLOR[a.levelSkor] }}>{a.skorRisiko}</p></div>
          </div>
          <p className="text-xs text-center text-muted-foreground">
            Level Skor: <span className="font-medium" style={{ color: RISK_LEVEL_COLOR[a.levelSkor] }}>{RISK_LEVEL_LABEL[a.levelSkor]}</span>
            {' · '}Posisi Matrix (P×D): {a.matrixScore} — {RISK_LEVEL_LABEL[a.matrixLevel]}
          </p>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground italic">Analisis risiko belum diisi.</p>
      )}
    </CardContent></Card>
  );
}

// ────────────────────────────────────────────────────────────────
// Tab: Evaluasi
// ────────────────────────────────────────────────────────────────
function TabEvaluasi({ risk, userId, canReview, onChanged }: { risk: Risk; userId: string; canReview: boolean; onChanged: () => void }) {
  const [decision, setDecision] = useState(risk.assessment?.evaluationDecision ?? '');
  const [saving, setSaving] = useState(false);

  if (!risk.assessment) return <Card><CardContent className="pt-6 text-sm text-muted-foreground">Lengkapi Analisis Risiko terlebih dahulu sebelum melakukan evaluasi.</CardContent></Card>;

  const save = async () => {
    if (!decision) return;
    setSaving(true);
    try {
      await evaluateRisk(risk.id, decision, userId);
      toastSuccess('Evaluasi risiko tersimpan');
      onChanged();
    } catch (err) {
      toastError('Gagal menyimpan evaluasi', { description: err instanceof Error ? err.message : undefined });
    } finally { setSaving(false); }
  };

  return (
    <Card><CardContent className="pt-6 space-y-4 max-w-md">
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div><p className="text-xs text-muted-foreground">Skor Risiko Awal</p><p className="font-semibold">{risk.assessment.skorRisiko}</p></div>
        <div><p className="text-xs text-muted-foreground">Level Risiko Awal</p><p className="font-semibold">{RISK_LEVEL_LABEL[risk.assessment.levelSkor]}</p></div>
      </div>
      <div className="space-y-1.5">
        <Label>Keputusan Evaluasi</Label>
        <Select value={decision} onValueChange={setDecision} disabled={!canReview}>
          <SelectTrigger><SelectValue placeholder="Pilih keputusan" /></SelectTrigger>
          <SelectContent>{Object.entries(RISK_EVALUATION_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      {canReview && <Button size="sm" onClick={save} disabled={saving || !decision}><Save className="size-4 mr-1.5" />Simpan Evaluasi</Button>}
    </CardContent></Card>
  );
}

// ────────────────────────────────────────────────────────────────
// Tab: Mitigasi
// ────────────────────────────────────────────────────────────────
function TabMitigasi({ riskId, userId, canReview, onChanged }: { riskId: string; userId: string; canReview: boolean; onChanged: () => void }) {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof getRiskMitigations>>>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);

  const reload = () => getRiskMitigations(riskId).then(setRows);
  useEffect(() => { reload(); }, [riskId]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    if (!form.rencanaTindakan) return;
    setSaving(true);
    try {
      await createRiskMitigation({ riskId, ...form }, userId);
      toastSuccess('Rencana mitigasi ditambahkan');
      setForm({}); setShowForm(false);
      reload(); onChanged();
    } catch (err) {
      toastError('Gagal menambah mitigasi', { description: err instanceof Error ? err.message : undefined });
    } finally { setSaving(false); }
  };

  const updateProgress = async (id: string, progressPercent: number, status: string) => {
    await updateRiskMitigation(id, { progressPercent, status: status as any }, userId);
    reload(); onChanged();
  };

  return (
    <div className="space-y-3">
      {canReview && (
        <Button size="sm" variant="outline" onClick={() => setShowForm((s) => !s)}><Plus className="size-4 mr-1.5" />Tambah Rencana Mitigasi</Button>
      )}
      {showForm && (
        <Card><CardContent className="pt-6 space-y-3">
          <div className="space-y-1.5"><Label>Rencana Tindakan *</Label><Textarea rows={2} value={form.rencanaTindakan ?? ''} onChange={(e) => setForm((f: any) => ({ ...f, rencanaTindakan: e.target.value }))} /></div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Strategi Pengelolaan</Label><Input value={form.strategi ?? ''} onChange={(e) => setForm((f: any) => ({ ...f, strategi: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>PIC</Label><Input value={form.picName ?? ''} onChange={(e) => setForm((f: any) => ({ ...f, picName: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Tanggal Mulai</Label><Input type="date" value={form.tanggalMulai ?? ''} onChange={(e) => setForm((f: any) => ({ ...f, tanggalMulai: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Target Penyelesaian</Label><Input type="date" value={form.targetPenyelesaian ?? ''} onChange={(e) => setForm((f: any) => ({ ...f, targetPenyelesaian: e.target.value }))} /></div>
          </div>
          <div className="space-y-1.5"><Label>Indikator Keberhasilan</Label><Input value={form.indikatorKeberhasilan ?? ''} onChange={(e) => setForm((f: any) => ({ ...f, indikatorKeberhasilan: e.target.value }))} /></div>
          <Button size="sm" onClick={submit} disabled={saving || !form.rencanaTindakan}>{saving ? 'Menyimpan…' : 'Simpan Rencana'}</Button>
        </CardContent></Card>
      )}

      {rows.length === 0 && <p className="text-sm text-muted-foreground px-1">Belum ada rencana mitigasi.</p>}
      {rows.map((m) => (
        <Card key={m.id}><CardContent className="pt-4 space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-sm font-medium">{m.rencanaTindakan}</p>
            <Badge variant="outline" style={{ borderColor: RISK_MITIGATION_STATUS_COLOR[m.status], color: RISK_MITIGATION_STATUS_COLOR[m.status] }}>
              {RISK_MITIGATION_STATUS_LABEL[m.status]}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            PIC: {m.picName || '—'} · Target: {m.targetPenyelesaian ? format(new Date(m.targetPenyelesaian), 'd MMM yyyy', { locale: idLocale }) : '—'}
          </p>
          <Progress value={m.progressPercent} className="h-1.5" />
          {canReview && (
            <div className="flex items-center gap-2">
              <Input type="number" min={0} max={100} className="w-20 h-8" defaultValue={m.progressPercent}
                onBlur={(e) => updateProgress(m.id, Number(e.target.value), m.status)} />
              <span className="text-xs text-muted-foreground">% progress</span>
              <Select defaultValue={m.status} onValueChange={(v) => updateProgress(m.id, m.progressPercent, v)}>
                <SelectTrigger className="h-8 w-[170px]"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(RISK_MITIGATION_STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
        </CardContent></Card>
      ))}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Tab: Monitoring
// ────────────────────────────────────────────────────────────────
function TabMonitoring({ riskId, userId, canReview, onChanged }: { riskId: string; userId: string; canReview: boolean; onChanged: () => void }) {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof getRiskMonitorings>>>([]);
  const [aktivitas, setAktivitas] = useState('');
  const [catatan, setCatatan] = useState('');
  const [progress, setProgress] = useState<number | ''>('');
  const [saving, setSaving] = useState(false);

  const reload = () => getRiskMonitorings(riskId).then(setRows);
  useEffect(() => { reload(); }, [riskId]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    if (!aktivitas) return;
    setSaving(true);
    try {
      await createRiskMonitoring({ riskId, aktivitas, catatan, progressPercent: progress === '' ? undefined : Number(progress) }, userId);
      setAktivitas(''); setCatatan(''); setProgress('');
      reload(); onChanged();
    } catch (err) {
      toastError('Gagal mencatat monitoring', { description: err instanceof Error ? err.message : undefined });
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-3">
      {canReview && (
        <Card><CardContent className="pt-6 space-y-3">
          <div className="space-y-1.5"><Label>Aktivitas *</Label><Input value={aktivitas} onChange={(e) => setAktivitas(e.target.value)} placeholder="Aktivitas monitoring yang dilakukan" /></div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Catatan</Label><Input value={catatan} onChange={(e) => setCatatan(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Progress (%)</Label><Input type="number" min={0} max={100} value={progress} onChange={(e) => setProgress(e.target.value === '' ? '' : Number(e.target.value))} /></div>
          </div>
          <Button size="sm" onClick={submit} disabled={saving || !aktivitas}>Catat Aktivitas</Button>
        </CardContent></Card>
      )}
      <div className="space-y-2">
        {rows.length === 0 && <p className="text-sm text-muted-foreground px-1">Belum ada catatan monitoring.</p>}
        {rows.map((m) => (
          <div key={m.id} className="border-l-2 border-amber-400 pl-3 py-1">
            <p className="text-xs text-muted-foreground">{format(new Date(m.tanggal), 'd MMM yyyy', { locale: idLocale })}{m.picName ? ` · ${m.picName}` : ''}</p>
            <p className="text-sm">{m.aktivitas}</p>
            {m.catatan && <p className="text-xs text-muted-foreground">{m.catatan}</p>}
            {m.progressPercent != null && <p className="text-xs font-medium">Progress: {m.progressPercent}%</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Tab: Review & Risiko Residual
// ────────────────────────────────────────────────────────────────
function TabReview({ risk, userId, canReview, onChanged }: { risk: Risk; userId: string; canReview: boolean; onChanged: () => void }) {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof getRiskReviews>>>([]);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);

  const reload = () => getRiskReviews(risk.id).then(setRows);
  useEffect(() => { reload(); }, [risk.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    setSaving(true);
    try {
      await createRiskReview({ riskId: risk.id, ...form }, userId);
      toastSuccess('Review risiko tersimpan');
      setForm({});
      reload(); onChanged();
    } catch (err) {
      toastError('Gagal menyimpan review', { description: err instanceof Error ? err.message : undefined });
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      {risk.assessment && (
        <Card><CardContent className="pt-4 flex items-center gap-4 text-sm">
          <div><p className="text-xs text-muted-foreground">Skor Awal (Inheren)</p><p className="text-xl font-bold">{risk.assessment.skorRisiko}</p></div>
          <span className="text-muted-foreground">→ Mitigasi →</span>
          <div><p className="text-xs text-muted-foreground">Skor Residual Terakhir</p><p className="text-xl font-bold">{rows[0]?.skorResidual ?? '—'}</p></div>
        </CardContent></Card>
      )}

      {canReview && (
        <Card><CardContent className="pt-6 space-y-3">
          <p className="text-sm font-medium">Review Ulang</p>
          <div className="space-y-1.5"><Label>Kondisi Risiko Saat Ini</Label><Textarea rows={2} value={form.kondisiSaatIni ?? ''} onChange={(e) => setForm((f: any) => ({ ...f, kondisiSaatIni: e.target.value }))} /></div>
          <p className="text-xs font-semibold text-muted-foreground pt-1">Nilai Baru (Risiko Residual)</p>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5"><Label>Probabilitas Baru</Label><Input type="number" min={1} max={5} value={form.probabilitasBaru ?? ''} onChange={(e) => setForm((f: any) => ({ ...f, probabilitasBaru: Number(e.target.value) }))} /></div>
            <div className="space-y-1.5"><Label>Dampak Baru</Label><Input type="number" min={1} max={5} value={form.dampakBaru ?? ''} onChange={(e) => setForm((f: any) => ({ ...f, dampakBaru: Number(e.target.value) }))} /></div>
            <div className="space-y-1.5"><Label>Controllability Baru</Label><Input type="number" min={1} max={5} value={form.controllabilityBaru ?? ''} onChange={(e) => setForm((f: any) => ({ ...f, controllabilityBaru: Number(e.target.value) }))} /></div>
          </div>
          <div className="space-y-1.5">
            <Label>Keputusan</Label>
            <Select value={form.keputusan ?? ''} onValueChange={(v) => setForm((f: any) => ({ ...f, keputusan: v }))}>
              <SelectTrigger><SelectValue placeholder="Pilih keputusan" /></SelectTrigger>
              <SelectContent>{Object.entries(RISK_REVIEW_DECISION_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button size="sm" onClick={submit} disabled={saving}>Simpan Review</Button>
        </CardContent></Card>
      )}

      <div className="space-y-2">
        {rows.map((r) => (
          <Card key={r.id}><CardContent className="pt-4 text-sm space-y-1">
            <p className="text-xs text-muted-foreground">{format(new Date(r.reviewDate), 'd MMM yyyy', { locale: idLocale })}</p>
            {r.kondisiSaatIni && <p>{r.kondisiSaatIni}</p>}
            {r.skorResidual != null && (
              <p className="font-medium">Skor Residual: {r.skorResidual} {r.levelResidual ? `(${RISK_LEVEL_LABEL[r.levelResidual]})` : ''}</p>
            )}
            {r.keputusan && <Badge variant="outline">{RISK_REVIEW_DECISION_LABEL[r.keputusan]}</Badge>}
          </CardContent></Card>
        ))}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Tab: Evidence
// ────────────────────────────────────────────────────────────────
function TabEvidence({ riskId, userId }: { riskId: string; userId: string }) {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof getRiskAttachments>>>([]);
  const [uploading, setUploading] = useState(false);

  const reload = () => getRiskAttachments(riskId).then(setRows);
  useEffect(() => { reload(); }, [riskId]); // eslint-disable-line react-hooks/exhaustive-deps

  const onUpload = async (file: File) => {
    setUploading(true);
    try {
      await uploadRiskAttachment(riskId, file, userId);
      toastSuccess('Berkas berhasil diunggah');
      reload();
    } catch (err) {
      toastError('Gagal mengunggah berkas', { description: err instanceof Error ? err.message : undefined });
    } finally { setUploading(false); }
  };

  return (
    <div className="space-y-3">
      <label className="inline-flex items-center gap-2 text-sm border rounded-md px-3 py-2 cursor-pointer hover:bg-muted/40 w-fit">
        <Upload className="size-4" />{uploading ? 'Mengunggah…' : 'Unggah Bukti Pendukung'}
        <input type="file" className="hidden" disabled={uploading} onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])} />
      </label>
      {rows.length === 0 && <p className="text-sm text-muted-foreground">Belum ada berkas.</p>}
      {rows.map((a) => (
        <div key={a.id} className="flex items-center justify-between border rounded-md px-3 py-2 text-sm">
          <button className="text-left hover:underline" onClick={async () => { const url = await getRiskAttachmentUrl(a.storageKey); if (url) window.open(url, '_blank'); }}>
            {a.filename}
          </button>
          <Button variant="ghost" size="sm" onClick={async () => { await deleteRiskAttachment(a.id, a.storageKey); reload(); }}>
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      ))}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Tab: Riwayat (status history — poin 16)
// ────────────────────────────────────────────────────────────────
function TabRiwayat({ riskId }: { riskId: string }) {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof getRiskHistory>>>([]);
  useEffect(() => { getRiskHistory(riskId).then(setRows); }, [riskId]);

  return (
    <div className="space-y-2">
      {rows.length === 0 && <p className="text-sm text-muted-foreground">Belum ada riwayat perubahan status.</p>}
      {rows.map((h) => (
        <div key={h.id} className="border-l-2 border-sky-400 pl-3 py-1 text-sm">
          <p className="text-xs text-muted-foreground">{format(new Date(h.createdAt), 'd MMM yyyy HH:mm', { locale: idLocale })}</p>
          <p>{h.fromStatus ? `${RISK_STATUS_LABEL[h.fromStatus as keyof typeof RISK_STATUS_LABEL] ?? h.fromStatus} → ` : 'Dibuat sebagai '}{RISK_STATUS_LABEL[h.toStatus as keyof typeof RISK_STATUS_LABEL] ?? h.toStatus}</p>
        </div>
      ))}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Tab: Audit Trail
// ────────────────────────────────────────────────────────────────
function TabAudit({ riskId }: { riskId: string }) {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof getRiskAuditTrail>>>([]);
  useEffect(() => { getRiskAuditTrail(riskId).then(setRows); }, [riskId]);

  return (
    <div className="space-y-2">
      {rows.length === 0 && <p className="text-sm text-muted-foreground">Belum ada aktivitas.</p>}
      {rows.map((a) => (
        <div key={a.id} className="flex items-start gap-2 text-sm border-b py-2 last:border-0">
          <Badge variant="outline" className="text-[10px] shrink-0">{a.badge}</Badge>
          <div><p>{a.msg}</p><p className="text-xs text-muted-foreground">{a.ts}</p></div>
        </div>
      ))}
    </div>
  );
}
