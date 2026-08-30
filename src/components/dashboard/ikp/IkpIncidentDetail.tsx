'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ChevronLeft, Loader2, ShieldAlert, Upload, FileText, Trash2, CheckCircle2, Save,
} from 'lucide-react';
import {
  type IkpIncident, type IkpInvestigation, type IkpAction, type IkpAttachment, type IkpAuditEntry,
  IKP_STATUS_LABEL, IKP_STATUS_COLOR, IKP_STATUS_FLOW, IKP_SEVERITY_GRADES, getSeverityMeta,
  IKP_INVESTIGATION_METHODS, IKP_CONTRIBUTING_FACTORS, IKP_ACTION_STATUS_LABEL, IKP_ACTION_PRIORITY_LABEL,
  IKP_INCIDENT_TYPES, IKP_PATIENT_IMPACTS,
} from '@/types/ikp';
import {
  getIkpIncidentById, updateIkpIncident,
  getIkpInvestigation, upsertIkpInvestigation,
  getIkpActions, createIkpAction, updateIkpAction,
  getIkpAttachments, uploadIkpAttachment, getIkpAttachmentUrl, deleteIkpAttachment,
  getIkpAuditTrail,
} from '@/lib/ikpData';
import { toastSuccess, toastError } from '@/lib/toast-helpers';
import { createRiskFromIkpIncident } from '@/lib/riskData';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale/id';

interface IkpIncidentDetailProps {
  incidentId: string;
  userId: string;
  userName: string;
  canReview: boolean; // verifikator / tim_mutu / pimpinan / admin
  onBack: () => void;
  initialTab?: string;
}

export function IkpIncidentDetail({ incidentId, userId, userName, canReview, onBack, initialTab }: IkpIncidentDetailProps) {
  const [incident, setIncident] = useState<IkpIncident | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(initialTab ?? 'ringkasan');

  const reload = async () => {
    const data = await getIkpIncidentById(incidentId);
    setIncident(data);
    setLoading(false);
  };

  useEffect(() => { reload(); }, [incidentId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;
  if (!incident) return <div className="p-6 text-sm text-muted-foreground">Laporan tidak ditemukan.</div>;

  const severity = getSeverityMeta(incident.severityGrade);

  return (
    <div className="p-4 space-y-4 max-w-5xl mx-auto">
      <Button variant="ghost" size="sm" onClick={onBack}><ChevronLeft className="size-4 mr-1" />Kembali ke Daftar</Button>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <ShieldAlert className="size-5 text-amber-500" />
                <h2 className="text-lg font-semibold font-mono">{incident.reportNumber}</h2>
                <Badge variant="outline" style={{ borderColor: IKP_STATUS_COLOR[incident.status], color: IKP_STATUS_COLOR[incident.status] }}>
                  {IKP_STATUS_LABEL[incident.status]}
                </Badge>
                {severity && (
                  <Badge style={{ backgroundColor: severity.color, color: 'white', border: 'none' }}>{severity.label}</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Tanggal kejadian: {incident.incidentDate ? format(new Date(incident.incidentDate), 'd MMMM yyyy', { locale: idLocale }) : '—'}
                {' · '}Tanggal laporan: {format(new Date(incident.reportDate), 'd MMMM yyyy', { locale: idLocale })}
              </p>
            </div>
            {canReview && (
              <div className="flex items-center gap-2">
                <JadikanRisikoButton incident={incident} userId={userId} />
                <StatusActions incident={incident} userId={userId} onChanged={reload} />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="ringkasan">Ringkasan</TabsTrigger>
          <TabsTrigger value="kronologi">Kronologi</TabsTrigger>
          <TabsTrigger value="klasifikasi">Klasifikasi</TabsTrigger>
          <TabsTrigger value="investigasi">Investigasi</TabsTrigger>
          <TabsTrigger value="analisis">Analisis</TabsTrigger>
          <TabsTrigger value="tindak-lanjut">Tindak Lanjut</TabsTrigger>
          <TabsTrigger value="attachment">Attachment</TabsTrigger>
          <TabsTrigger value="audit">Audit Trail</TabsTrigger>
        </TabsList>

        <TabsContent value="ringkasan"><RingkasanTab incident={incident} /></TabsContent>
        <TabsContent value="kronologi"><KronologiTab incident={incident} /></TabsContent>
        <TabsContent value="klasifikasi"><KlasifikasiTab incident={incident} userId={userId} canReview={canReview} onChanged={reload} /></TabsContent>
        <TabsContent value="investigasi"><InvestigasiTab incidentId={incident.id} userId={userId} userName={userName} canReview={canReview} /></TabsContent>
        <TabsContent value="analisis"><AnalisisTab incidentId={incident.id} /></TabsContent>
        <TabsContent value="tindak-lanjut"><TindakLanjutTab incidentId={incident.id} userId={userId} canReview={canReview} /></TabsContent>
        <TabsContent value="attachment"><AttachmentTab incidentId={incident.id} userId={userId} /></TabsContent>
        <TabsContent value="audit"><AuditTab incidentId={incident.id} /></TabsContent>
      </Tabs>
    </div>
  );
}

/* ── Ringkasan ────────────────────────────────────────────────────────── */
function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 border-b last:border-0 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value || '—'}</span>
    </div>
  );
}

function RingkasanTab({ incident: r }: { incident: IkpIncident }) {
  return (
    <Card><CardContent className="pt-6 space-y-1">
      <InfoRow label="Jenis Laporan" value={r.reportKind === 'kpc' ? 'Kondisi Potensial Cedera (KPC)' : 'Insiden KNC/KTC/KTD/Sentinel'} />
      <InfoRow label="Tempat" value={r.tempat} />
      <InfoRow label="Pelapor" value={r.isAnonymous ? 'Anonim' : r.reporterName} />
      <InfoRow label="Unit Pelapor" value={r.reporterUnit} />
      <InfoRow label="Nama Pasien" value={r.patientName} />
      <InfoRow label="No. RM" value={r.patientMrNumber} />
      <InfoRow label="Lokasi Kejadian" value={r.incidentLocation} />
      <InfoRow label="Unit Penyebab" value={r.causingUnit} />
      <InfoRow label="Ringkasan Insiden" value={r.incidentSummary || r.kpcDescription} />
    </CardContent></Card>
  );
}

function KronologiTab({ incident: r }: { incident: IkpIncident }) {
  return (
    <Card><CardContent className="pt-6 space-y-4">
      <div>
        <Label className="text-xs text-muted-foreground">Kronologis Insiden</Label>
        <p className="text-sm mt-1 whitespace-pre-wrap">{r.chronology || '—'}</p>
      </div>
      <div>
        <Label className="text-xs text-muted-foreground">Tindakan Segera & Hasilnya</Label>
        <p className="text-sm mt-1 whitespace-pre-wrap">{r.immediateAction || '—'}</p>
        <p className="text-sm mt-1 whitespace-pre-wrap text-muted-foreground">{r.immediateActionResult}</p>
      </div>
      {r.recurrenceElsewhere && (
        <div>
          <Label className="text-xs text-muted-foreground">Kejadian Serupa di Unit Lain</Label>
          <p className="text-sm mt-1 whitespace-pre-wrap">{r.recurrenceDetail || '—'}</p>
        </div>
      )}
    </CardContent></Card>
  );
}

function KlasifikasiTab({ incident, userId, canReview, onChanged }: { incident: IkpIncident; userId: string; canReview: boolean; onChanged: () => void }) {
  const [grade, setGrade] = useState(incident.severityGrade ?? undefined);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const meta = IKP_SEVERITY_GRADES.find((g) => g.id === grade);
      await updateIkpIncident(incident.id, {
        severityGrade: grade as any,
        severitySetBy: userId,
        severitySetAt: new Date().toISOString(),
        investigationRequired: meta?.investigationRequired ?? null,
      }, userId);
      toastSuccess('Grading risiko tersimpan');
      onChanged();
    } catch (err) {
      toastError('Gagal menyimpan grading', { description: err instanceof Error ? err.message : undefined });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card><CardContent className="pt-6 space-y-4">
      <InfoRow label="Jenis Insiden" value={incident.incidentType ? IKP_INCIDENT_TYPES.find((t) => t.id === incident.incidentType)?.label : undefined} />
      <InfoRow label="Akibat Terhadap Pasien" value={incident.patientImpact ? IKP_PATIENT_IMPACTS.find((p) => p.id === incident.patientImpact)?.label : undefined} />

      <div className="pt-2">
        <Label className="text-sm font-medium">Grading Risiko Kejadian</Label>
        <p className="text-xs text-muted-foreground mb-2">Diisi oleh atasan pelapor / verifikator. Menentukan kewajiban investigasi.</p>
        {canReview ? (
          <div className="flex items-center gap-2">
            <div className="grid grid-cols-4 gap-2 flex-1">
              {IKP_SEVERITY_GRADES.map((g) => (
                <button
                  key={g.id}
                  onClick={() => setGrade(g.id)}
                  className={`rounded-lg border-2 p-2.5 text-xs font-medium transition-all ${grade === g.id ? 'ring-2 ring-offset-1' : 'opacity-70'}`}
                  style={{ borderColor: g.color, color: g.color, backgroundColor: grade === g.id ? `${g.color}15` : undefined }}
                >
                  {g.label}
                </button>
              ))}
            </div>
            <Button size="sm" onClick={save} disabled={saving || !grade}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            </Button>
          </div>
        ) : (
          <Badge variant="outline">{getSeverityMeta(incident.severityGrade)?.label ?? 'Belum digrading'}</Badge>
        )}
        {getSeverityMeta(grade as any) && (
          <p className="text-xs text-muted-foreground mt-2">{getSeverityMeta(grade as any)?.definition} — {getSeverityMeta(grade as any)?.investigationNote}</p>
        )}
      </div>
    </CardContent></Card>
  );
}

/* ── Investigasi & Analisis (RCA) ─────────────────────────────────────── */
function InvestigasiForm({ incidentId, userId, userName, canReview, onlyAnalysis }: { incidentId: string; userId: string; userName: string; canReview: boolean; onlyAnalysis?: boolean }) {
  const [data, setData] = useState<Partial<IkpInvestigation>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getIkpInvestigation(incidentId).then((inv) => { setData(inv ?? { investigatorName: userName }); setLoading(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incidentId]);

  const set = (k: keyof IkpInvestigation, v: any) => setData((prev) => ({ ...prev, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      await upsertIkpInvestigation(incidentId, data, userId);
      toastSuccess('Data investigasi tersimpan');
    } catch (err) {
      toastError('Gagal menyimpan investigasi', { description: err instanceof Error ? err.message : undefined });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loader2 className="size-5 animate-spin text-muted-foreground" />;

  const toggleFactor = (f: string) => {
    const current = data.contributingFactors ?? [];
    set('contributingFactors', current.includes(f as any) ? current.filter((c) => c !== f) : [...current, f as any]);
  };

  return (
    <div className="space-y-4">
      {!onlyAnalysis && (
        <>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">Investigator</Label>
              <Input disabled={!canReview} value={data.investigatorName ?? ''} onChange={(e) => set('investigatorName', e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Metode Investigasi</Label>
              <Select disabled={!canReview} value={data.method ?? undefined} onValueChange={(v) => set('method', v)}>
                <SelectTrigger><SelectValue placeholder="Pilih metode" /></SelectTrigger>
                <SelectContent>{IKP_INVESTIGATION_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Tanggal Mulai</Label>
              <Input disabled={!canReview} type="date" value={data.startedAt ?? ''} onChange={(e) => set('startedAt', e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Tanggal Selesai</Label>
              <Input disabled={!canReview} type="date" value={data.completedAt ?? ''} onChange={(e) => set('completedAt', e.target.value)} />
            </div>
          </div>
          <div>
            <Label className="text-xs">Kronologi Hasil Investigasi</Label>
            <Textarea disabled={!canReview} rows={4} value={data.findings ?? ''} onChange={(e) => set('findings', e.target.value)} />
          </div>
        </>
      )}
      <div>
        <Label className="text-xs">Faktor Kontributor <span className="text-muted-foreground">(perlu konfirmasi kesesuaian dengan kebijakan RS)</span></Label>
        <div className="flex flex-wrap gap-2 mt-1.5">
          {IKP_CONTRIBUTING_FACTORS.map((f) => (
            <button key={f.id} type="button" disabled={!canReview} onClick={() => toggleFactor(f.id)}
              className={`text-xs rounded-full border px-3 py-1 ${(data.contributingFactors ?? []).includes(f.id) ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground'}`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <Label className="text-xs">Detail Faktor Kontributor</Label>
        <Textarea disabled={!canReview} rows={2} value={data.contributingFactorsDetail ?? ''} onChange={(e) => set('contributingFactorsDetail', e.target.value)} />
      </div>
      <div>
        <Label className="text-xs">Akar Masalah (Root Cause)</Label>
        <Textarea disabled={!canReview} rows={3} value={data.rootCause ?? ''} onChange={(e) => set('rootCause', e.target.value)} />
      </div>
      <div>
        <Label className="text-xs">Rekomendasi</Label>
        <Textarea disabled={!canReview} rows={3} value={data.recommendation ?? ''} onChange={(e) => set('recommendation', e.target.value)} />
      </div>
      {canReview && (
        <Button size="sm" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : <Save className="size-4 mr-1.5" />}
          Simpan
        </Button>
      )}
    </div>
  );
}

function InvestigasiTab({ incidentId, userId, userName, canReview }: { incidentId: string; userId: string; userName: string; canReview: boolean }) {
  return <Card><CardContent className="pt-6"><InvestigasiForm incidentId={incidentId} userId={userId} userName={userName} canReview={canReview} /></CardContent></Card>;
}

function AnalisisTab({ incidentId }: { incidentId: string }) {
  return (
    <Card><CardContent className="pt-6">
      <p className="text-xs text-muted-foreground mb-3">
        Ringkasan akar masalah & faktor kontributor dari tab Investigasi. Isi lengkap dapat diedit di tab Investigasi.
      </p>
      <InvestigasiForm incidentId={incidentId} userId="" userName="" canReview={false} onlyAnalysis />
    </CardContent></Card>
  );
}

/* ── Tindak Lanjut ────────────────────────────────────────────────────── */
function TindakLanjutTab({ incidentId, userId, canReview }: { incidentId: string; userId: string; canReview: boolean }) {
  const [actions, setActions] = useState<IkpAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState<Partial<IkpAction>>({});

  const reload = async () => {
    setActions(await getIkpActions(incidentId));
    setLoading(false);
  };
  useEffect(() => { reload(); }, [incidentId]); // eslint-disable-line react-hooks/exhaustive-deps

  const addAction = async () => {
    if (!draft.action) return;
    await createIkpAction({ ...draft, incidentId }, userId);
    setDraft({});
    setShowForm(false);
    reload();
  };

  const setStatus = async (id: string, status: IkpAction['status']) => {
    await updateIkpAction(id, { status, completedAt: status === 'selesai' ? new Date().toISOString().slice(0, 10) : undefined }, userId);
    reload();
  };

  if (loading) return <Loader2 className="size-5 animate-spin text-muted-foreground" />;

  return (
    <Card><CardContent className="pt-6 space-y-3">
      {actions.length === 0 && <p className="text-sm text-muted-foreground">Belum ada rencana tindak lanjut.</p>}
      {actions.map((a) => {
        const overdue = a.status !== 'selesai' && a.dueDate && new Date(a.dueDate) < new Date();
        return (
          <div key={a.id} className={`rounded-lg border p-3 space-y-1.5 ${overdue ? 'border-red-400/50 bg-red-500/5' : ''}`}>
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium">{a.action}</p>
              <Badge variant="outline" className="text-[10px] shrink-0">{IKP_ACTION_STATUS_LABEL[a.status]}</Badge>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {a.picName && <span>PIC: {a.picName}</span>}
              {a.unit && <span>Unit: {a.unit}</span>}
              {a.priority && <span>Prioritas: {IKP_ACTION_PRIORITY_LABEL[a.priority]}</span>}
              {a.dueDate && <span className={overdue ? 'text-red-500 font-medium' : ''}>Target: {format(new Date(a.dueDate), 'd MMM yyyy', { locale: idLocale })}{overdue ? ' (Terlambat)' : ''}</span>}
            </div>
            {canReview && a.status !== 'selesai' && (
              <div className="flex gap-1.5 pt-1">
                {(['berjalan', 'menunggu_verifikasi', 'selesai'] as const).map((s) => (
                  <Button key={s} variant="outline" size="sm" className="h-6 text-[10px] px-2" onClick={() => setStatus(a.id, s)}>
                    {IKP_ACTION_STATUS_LABEL[s]}
                  </Button>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {canReview && (
        showForm ? (
          <div className="rounded-lg border p-3 space-y-2">
            <Textarea placeholder="Tindakan yang akan dilakukan" rows={2} value={draft.action ?? ''} onChange={(e) => setDraft((d) => ({ ...d, action: e.target.value }))} />
            <div className="grid sm:grid-cols-3 gap-2">
              <Input placeholder="PIC" value={draft.picName ?? ''} onChange={(e) => setDraft((d) => ({ ...d, picName: e.target.value }))} />
              <Input placeholder="Unit" value={draft.unit ?? ''} onChange={(e) => setDraft((d) => ({ ...d, unit: e.target.value }))} />
              <Input type="date" value={draft.dueDate ?? ''} onChange={(e) => setDraft((d) => ({ ...d, dueDate: e.target.value }))} />
            </div>
            <Select value={draft.priority ?? undefined} onValueChange={(v) => setDraft((d) => ({ ...d, priority: v as any }))}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Prioritas" /></SelectTrigger>
              <SelectContent>{Object.entries(IKP_ACTION_PRIORITY_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button size="sm" onClick={addAction}>Simpan</Button>
              <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>Batal</Button>
            </div>
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>+ Tambah Tindak Lanjut</Button>
        )
      )}
    </CardContent></Card>
  );
}

/* ── Attachment ───────────────────────────────────────────────────────── */
function AttachmentTab({ incidentId, userId }: { incidentId: string; userId: string }) {
  const [files, setFiles] = useState<IkpAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const reload = async () => { setFiles(await getIkpAttachments(incidentId)); setLoading(false); };
  useEffect(() => { reload(); }, [incidentId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toastError('Ukuran file maksimal 10MB'); return; }
    setUploading(true);
    try {
      await uploadIkpAttachment(incidentId, file, userId);
      toastSuccess('Berkas berhasil diunggah');
      reload();
    } catch (err) {
      toastError('Gagal mengunggah berkas', { description: err instanceof Error ? err.message : undefined });
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const openFile = async (key: string) => {
    const url = await getIkpAttachmentUrl(key);
    if (url) window.open(url, '_blank');
  };

  const removeFile = async (att: IkpAttachment) => {
    await deleteIkpAttachment(att.id, att.storageKey);
    reload();
  };

  if (loading) return <Loader2 className="size-5 animate-spin text-muted-foreground" />;

  return (
    <Card><CardContent className="pt-6 space-y-3">
      <label className="flex items-center justify-center gap-2 rounded-lg border-2 border-dashed p-4 text-sm text-muted-foreground cursor-pointer hover:bg-muted/40">
        {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
        Unggah bukti pendukung (foto, dokumen, hasil pemeriksaan — maks 10MB)
        <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
      </label>
      {files.length === 0 && <p className="text-sm text-muted-foreground">Belum ada berkas.</p>}
      {files.map((f) => (
        <div key={f.id} className="flex items-center justify-between rounded-lg border p-2.5 text-sm">
          <button className="flex items-center gap-2 text-left hover:underline" onClick={() => openFile(f.storageKey)}>
            <FileText className="size-4 text-muted-foreground" /> {f.filename}
          </button>
          <Button variant="ghost" size="icon" className="size-7" onClick={() => removeFile(f)}><Trash2 className="size-3.5 text-red-500" /></Button>
        </div>
      ))}
    </CardContent></Card>
  );
}

/* ── Audit Trail ──────────────────────────────────────────────────────── */
function AuditTab({ incidentId }: { incidentId: string }) {
  const [logs, setLogs] = useState<IkpAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { getIkpAuditTrail(incidentId).then((l) => { setLogs(l); setLoading(false); }); }, [incidentId]);

  if (loading) return <Loader2 className="size-5 animate-spin text-muted-foreground" />;

  return (
    <Card><CardContent className="pt-6 space-y-2">
      {logs.length === 0 && <p className="text-sm text-muted-foreground">Belum ada aktivitas tercatat.</p>}
      {logs.map((l) => (
        <div key={l.id} className="flex items-start gap-3 text-sm border-b pb-2 last:border-0">
          <CheckCircle2 className="size-4 text-emerald-500 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p>{l.msg}</p>
            <p className="text-xs text-muted-foreground">{l.ts}</p>
          </div>
        </div>
      ))}
    </CardContent></Card>
  );
}

/* ── Aksi perubahan status (verifikator/tim mutu) ───────────────────────── */
/**
 * Tombol "Jadikan Risiko" (poin 22, integrasi Modul Manajemen Risiko).
 * Menyalin data insiden menjadi draft Risk Register — user tetap harus
 * membuka modul Manajemen Risiko untuk melengkapi & memvalidasi analisis
 * sebelum draft ini menjadi entri Risk Register final.
 */
function JadikanRisikoButton({ incident, userId }: { incident: IkpIncident; userId: string }) {
  const [saving, setSaving] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={saving}
      onClick={async () => {
        setSaving(true);
        try {
          const risk = await createRiskFromIkpIncident(incident, userId);
          toastSuccess('Draft risiko dibuat', {
            description: `${risk.riskCode} tersimpan sebagai draft — buka menu Manajemen Risiko > Risk Register untuk validasi & analisis.`,
          });
        } catch (err) {
          toastError('Gagal membuat risiko dari IKP', { description: err instanceof Error ? err.message : undefined });
        } finally {
          setSaving(false);
        }
      }}
    >
      {saving ? 'Memproses…' : 'Jadikan Risiko'}
    </Button>
  );
}

function StatusActions({ incident, userId, onChanged }: { incident: IkpIncident; userId: string; onChanged: () => void }) {
  const currentIdx = IKP_STATUS_FLOW.indexOf(incident.status);
  const nextStatus = IKP_STATUS_FLOW[currentIdx + 1];
  const [busy, setBusy] = useState(false);

  if (!nextStatus) return null;

  const advance = async () => {
    setBusy(true);
    try {
      const patch: Partial<IkpIncident> = { status: nextStatus };
      if (nextStatus === 'diverifikasi') patch.verifiedAt = new Date().toISOString();
      if (nextStatus === 'selesai') patch.closedAt = new Date().toISOString();
      await updateIkpIncident(incident.id, patch, userId);
      toastSuccess(`Status diperbarui ke "${IKP_STATUS_LABEL[nextStatus]}"`);
      onChanged();
    } catch (err) {
      toastError('Gagal memperbarui status', { description: err instanceof Error ? err.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button size="sm" onClick={advance} disabled={busy}>
      {busy ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : null}
      Lanjutkan ke: {IKP_STATUS_LABEL[nextStatus]}
    </Button>
  );
}
