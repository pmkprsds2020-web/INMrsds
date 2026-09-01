'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Save, Send, ArrowLeft } from 'lucide-react';
import {
  type UimuProposal, type UimuUnit,
  INDICATOR_CATEGORY_OPTIONS, QUALITY_DIMENSION_OPTIONS, ASPECT_AREA_OPTIONS,
  REASON_CHECKLIST_OPTIONS, INDICATOR_KIND_OPTIONS, TARGET_OPERATOR_OPTIONS, TARGET_SOURCE_OPTIONS,
  PRIORITY_SCORE_CRITERIA, computeUimuPriority, PRIORITY_CATEGORY_LABEL, PRIORITY_CATEGORY_COLOR,
} from '@/types/uimu';
import {
  createUimuProposal, updateUimuProposal, getUimuProposalById, getUimuUnits, submitUimuProposal, resubmitUimuProposal,
} from '@/lib/uimuData';
import { toastSuccess, toastError } from '@/lib/toast-helpers';

const CURRENT_YEAR = new Date().getFullYear();

interface UimuFormProps {
  userId: string;
  userName: string;
  activeUnit: string;
  proposalId?: string;      // ada -> mode edit draft/dikembalikan/revisi
  onDone: (id: string) => void;
  onCancel: () => void;
}

function emptyDraft(): Partial<UimuProposal> {
  return {
    periodYear: CURRENT_YEAR,
    reasonChecklist: [],
  };
}

export function UimuForm({ userId, userName, activeUnit, proposalId, onDone, onCancel }: UimuFormProps) {
  const [units, setUnits] = useState<UimuUnit[]>([]);
  const [form, setForm] = useState<Partial<UimuProposal>>(emptyDraft());
  const [loading, setLoading] = useState(!!proposalId);
  const [saving, setSaving] = useState(false);
  const [id, setId] = useState<string | undefined>(proposalId);

  useEffect(() => {
    (async () => {
      const unitList = await getUimuUnits();
      setUnits(unitList);
      if (proposalId) {
        const existing = await getUimuProposalById(proposalId);
        if (existing) setForm(existing);
        setLoading(false);
      }
    })();
  }, [proposalId]);

  function set<K extends keyof UimuProposal>(key: K, value: UimuProposal[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toggleReason(code: string) {
    setForm((f) => {
      const cur = f.reasonChecklist ?? [];
      const next = cur.includes(code) ? cur.filter((c) => c !== code) : [...cur, code];
      return { ...f, reasonChecklist: next };
    });
  }

  const totalScorePreview = useMemo(() => {
    return PRIORITY_SCORE_CRITERIA.reduce((sum, c) => sum + (Number((form as any)[c.key]) || 0), 0);
  }, [form]);

  async function handleSaveDraft(showToast = true) {
    setSaving(true);
    try {
      const unit = units.find((u) => u.id === form.unitId);
      const payload: Partial<UimuProposal> & { createdBy: string; periodYear: number } = {
        ...form,
        createdBy: userId,
        periodYear: form.periodYear ?? CURRENT_YEAR,
        proposerId: form.proposerId ?? userId,
        proposerName: form.proposerName ?? userName,
        proposerUnitIdHint: form.proposerUnitIdHint ?? activeUnit,
        unitNameSnapshot: unit?.name ?? form.unitNameSnapshot ?? null,
        eligibilityRecommendation: computeEligibilityRecommendation(form),
      } as any;

      if (id) {
        const updated = await updateUimuProposal(id, payload, userId);
        setForm(updated);
        if (showToast) toastSuccess('Draft tersimpan');
        return updated.id;
      } else {
        const created = await createUimuProposal(payload);
        setId(created.id);
        setForm(created);
        if (showToast) toastSuccess('Draft usulan dibuat', { description: created.proposalNumber });
        return created.id;
      }
    } catch (err) {
      toastError('Gagal menyimpan usulan', { description: err instanceof Error ? err.message : undefined });
      throw err;
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit() {
    if (!form.indicatorName || !form.unitId || !form.indicatorCategory) {
      toastError('Mohon lengkapi data wajib sebelum mengirim usulan.', { description: 'Unit, nama indikator, dan jenis indikator wajib diisi.' });
      return;
    }
    setSaving(true);
    try {
      const savedId = await handleSaveDraft(false);
      if (!savedId) return;
      const current = await getUimuProposalById(savedId);
      if (current && ['dikembalikan', 'revisi'].includes(current.status)) {
        await resubmitUimuProposal(savedId, userId, userName);
      } else {
        await submitUimuProposal(savedId, userId, userName);
      }
      toastSuccess('Usulan berhasil dikirim', { description: 'Usulan diteruskan ke Kepala Unit/PJ Mutu untuk direview.' });
      onDone(savedId);
    } catch (err) {
      toastError('Gagal mengirim usulan', { description: err instanceof Error ? err.message : undefined });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;
  }

  const priorityCat = computeUimuPriority(totalScorePreview);

  return (
    <div className="p-4 space-y-4 max-w-4xl">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button size="icon" variant="ghost" className="size-8" onClick={onCancel}><ArrowLeft className="size-4" /></Button>
          <div>
            <h2 className="text-lg font-semibold">{id ? 'Edit Usulan Indikator Mutu Unit' : 'Buat Usulan Indikator Mutu Unit'}</h2>
            {form.proposalNumber && <p className="text-xs text-muted-foreground font-mono">{form.proposalNumber}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" disabled={saving} onClick={() => handleSaveDraft()} className="gap-1.5">
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Simpan Draft
          </Button>
          <Button size="sm" disabled={saving} onClick={handleSubmit} className="gap-1.5">
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Kirim Usulan
          </Button>
        </div>
      </div>

      <Tabs defaultValue="identitas">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="identitas">Identitas & Indikator</TabsTrigger>
          <TabsTrigger value="alasan">Alasan & Kelayakan</TabsTrigger>
          <TabsTrigger value="definisi">Definisi Operasional</TabsTrigger>
          <TabsTrigger value="target">Target</TabsTrigger>
          <TabsTrigger value="skor">Skor Prioritas</TabsTrigger>
        </TabsList>

        {/* ── Identitas & Indikator ─────────────────────────────── */}
        <TabsContent value="identitas" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Identitas Pengusul</CardTitle></CardHeader>
            <CardContent className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tahun/Periode Mutu</Label>
                <Input type="number" value={form.periodYear ?? CURRENT_YEAR} onChange={(e) => set('periodYear', Number(e.target.value) as any)} />
              </div>
              <div className="space-y-1.5">
                <Label>Unit/Bagian <span className="text-rose-500">*</span></Label>
                <Select value={form.unitId ?? ''} onValueChange={(v) => set('unitId', v as any)}>
                  <SelectTrigger><SelectValue placeholder="Pilih unit" /></SelectTrigger>
                  <SelectContent>
                    {units.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Subunit/Ruangan</Label>
                <Input value={form.subunit ?? ''} onChange={(e) => set('subunit', e.target.value as any)} />
              </div>
              <div className="space-y-1.5">
                <Label>Nama Pengusul</Label>
                <Input value={form.proposerName ?? userName} onChange={(e) => set('proposerName', e.target.value as any)} />
              </div>
              <div className="space-y-1.5">
                <Label>Jabatan</Label>
                <Input value={form.proposerPosition ?? ''} onChange={(e) => set('proposerPosition', e.target.value as any)} />
              </div>
              <div className="space-y-1.5">
                <Label>Email/Username</Label>
                <Input value={form.proposerEmail ?? ''} onChange={(e) => set('proposerEmail', e.target.value as any)} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm">Data Indikator yang Diusulkan</CardTitle></CardHeader>
            <CardContent className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Nama Indikator Mutu <span className="text-rose-500">*</span></Label>
                <Input placeholder="Contoh: Kepatuhan Identifikasi Pasien" value={form.indicatorName ?? ''} onChange={(e) => set('indicatorName', e.target.value as any)} />
              </div>
              <div className="space-y-1.5">
                <Label>Jenis Indikator <span className="text-rose-500">*</span></Label>
                <Select value={form.indicatorCategory ?? ''} onValueChange={(v) => set('indicatorCategory', v as any)}>
                  <SelectTrigger><SelectValue placeholder="Pilih jenis" /></SelectTrigger>
                  <SelectContent>{INDICATOR_CATEGORY_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Dimensi Mutu</Label>
                <Select value={form.qualityDimension ?? ''} onValueChange={(v) => set('qualityDimension', v as any)}>
                  <SelectTrigger><SelectValue placeholder="Pilih dimensi" /></SelectTrigger>
                  <SelectContent>{QUALITY_DIMENSION_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {form.qualityDimension === 'lainnya' && (
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Dimensi mutu lainnya</Label>
                  <Input value={form.qualityDimensionOther ?? ''} onChange={(e) => set('qualityDimensionOther', e.target.value as any)} />
                </div>
              )}
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Area/Aspek Mutu</Label>
                <Select value={form.aspectArea ?? ''} onValueChange={(v) => set('aspectArea', v as any)}>
                  <SelectTrigger><SelectValue placeholder="Pilih aspek (ruang lingkup 21 aspek SPO)" /></SelectTrigger>
                  <SelectContent>{ASPECT_AREA_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {form.aspectArea === 'lainnya' && (
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Aspek lainnya</Label>
                  <Input value={form.aspectAreaOther ?? ''} onChange={(e) => set('aspectAreaOther', e.target.value as any)} />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Alasan & Kelayakan ─────────────────────────────────── */}
        <TabsContent value="alasan" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Alasan/Dasar Pemilihan Indikator</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid sm:grid-cols-2 gap-2">
                {REASON_CHECKLIST_OPTIONS.map((o) => (
                  <label key={o.value} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={(form.reasonChecklist ?? []).includes(o.value)} onCheckedChange={() => toggleReason(o.value)} />
                    {o.label}
                  </label>
                ))}
              </div>
              {(form.reasonChecklist ?? []).includes('lainnya') && (
                <div className="space-y-1.5">
                  <Label>Alasan lainnya</Label>
                  <Input value={form.reasonOther ?? ''} onChange={(e) => set('reasonOther', e.target.value as any)} />
                </div>
              )}
              <div className="space-y-1.5">
                <Label>Uraian masalah/gap yang mendasari indikator</Label>
                <Textarea rows={3} value={form.gapDescription ?? ''} onChange={(e) => set('gapDescription', e.target.value as any)} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm">Validasi Kelayakan Indikator</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <YesNoRow label="Apakah indikator sejalan dengan visi dan misi rumah sakit?" value={form.eligibilityVisiMisi} onChange={(v) => set('eligibilityVisiMisi', v as any)} />
              <YesNoRow label="Apakah terdapat bukti adanya gap dalam pelaksanaan?" value={form.eligibilityEvidenceGap} onChange={(v) => set('eligibilityEvidenceGap', v as any)} />
              <YesNoRow label="Apakah masalah tersebut penting?" value={form.eligibilityImportant} onChange={(v) => set('eligibilityImportant', v as any)} />
              <YesNoRow label="Apakah indikator dapat dikendalikan oleh petugas/unit?" value={form.eligibilityControllable} onChange={(v) => set('eligibilityControllable', v as any)} />
              <div className="flex items-center justify-between gap-2 text-sm">
                <span>Apakah indikator sudah digunakan/tervalidasi?</span>
                <Select value={form.eligibilityValidated ?? ''} onValueChange={(v) => set('eligibilityValidated', v as any)}>
                  <SelectTrigger className="w-[140px] h-8"><SelectValue placeholder="Pilih" /></SelectTrigger>
                  <SelectContent><SelectItem value="ya">Ya</SelectItem><SelectItem value="tidak">Tidak</SelectItem><SelectItem value="belum">Belum</SelectItem></SelectContent>
                </Select>
              </div>
              <YesNoRow label="Apakah indikator ini aplikasi dari prinsip-prinsip mutu?" value={form.eligibilityQualityPrinciple === 'ya' ? true : form.eligibilityQualityPrinciple === 'tidak' ? false : null} onChange={(v) => set('eligibilityQualityPrinciple', (v === true ? 'ya' : v === false ? 'tidak' : null) as any)} />
              <YesNoRow label="Apakah indikator berhubungan dengan keselamatan pasien?" value={form.eligibilityPatientSafety} onChange={(v) => set('eligibilityPatientSafety', v as any)} />
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Rekomendasi kelayakan (otomatis)</span>
                <EligibilityBadge form={form} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Definisi Operasional ─────────────────────────────────── */}
        <TabsContent value="definisi" className="space-y-4">
          <Card>
            <CardContent className="pt-6 grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Definisi Operasional</Label>
                <Textarea rows={3} value={form.operationalDefinition ?? ''} onChange={(e) => set('operationalDefinition', e.target.value as any)} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Tujuan Indikator</Label>
                <Textarea rows={2} value={form.indicatorGoal ?? ''} onChange={(e) => set('indicatorGoal', e.target.value as any)} />
              </div>
              <div className="space-y-1.5">
                <Label>Jenis (Struktur/Proses/Outcome)</Label>
                <Select value={form.indicatorKind ?? ''} onValueChange={(v) => set('indicatorKind', v as any)}>
                  <SelectTrigger><SelectValue placeholder="Pilih" /></SelectTrigger>
                  <SelectContent>{INDICATOR_KIND_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Satuan</Label>
                <Input value={form.unitOfMeasure ?? ''} onChange={(e) => set('unitOfMeasure', e.target.value as any)} />
              </div>
              <div className="space-y-1.5">
                <Label>Numerator</Label>
                <Textarea rows={2} value={form.numerator ?? ''} onChange={(e) => set('numerator', e.target.value as any)} />
              </div>
              <div className="space-y-1.5">
                <Label>Denominator</Label>
                <Textarea rows={2} value={form.denominator ?? ''} onChange={(e) => set('denominator', e.target.value as any)} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Formula</Label>
                <Input placeholder="Capaian = Numerator / Denominator × 100%" value={form.formula ?? ''} onChange={(e) => set('formula', e.target.value as any)} />
              </div>
              <div className="space-y-1.5">
                <Label>Kriteria Inklusi</Label>
                <Textarea rows={2} value={form.inclusionCriteria ?? ''} onChange={(e) => set('inclusionCriteria', e.target.value as any)} />
              </div>
              <div className="space-y-1.5">
                <Label>Kriteria Eksklusi</Label>
                <Textarea rows={2} value={form.exclusionCriteria ?? ''} onChange={(e) => set('exclusionCriteria', e.target.value as any)} />
              </div>
              <div className="space-y-1.5">
                <Label>Populasi</Label>
                <Input value={form.population ?? ''} onChange={(e) => set('population', e.target.value as any)} />
              </div>
              <div className="space-y-1.5">
                <Label>Sumber Data</Label>
                <Input value={form.dataSource ?? ''} onChange={(e) => set('dataSource', e.target.value as any)} />
              </div>
              <div className="space-y-1.5">
                <Label>Metode Pengumpulan Data</Label>
                <Input value={form.collectionMethod ?? ''} onChange={(e) => set('collectionMethod', e.target.value as any)} />
              </div>
              <div className="space-y-1.5">
                <Label>Instrumen Pengumpulan Data</Label>
                <Input value={form.collectionInstrument ?? ''} onChange={(e) => set('collectionInstrument', e.target.value as any)} />
              </div>
              <div className="space-y-1.5">
                <Label>PIC Pengumpulan Data</Label>
                <Input value={form.picName ?? ''} onChange={(e) => set('picName', e.target.value as any)} />
              </div>
              <div className="space-y-1.5">
                <Label>Frekuensi Pengumpulan Data</Label>
                <Input value={form.collectionFrequency ?? ''} onChange={(e) => set('collectionFrequency', e.target.value as any)} />
              </div>
              <div className="space-y-1.5">
                <Label>Periode Analisis</Label>
                <Input value={form.analysisPeriod ?? ''} onChange={(e) => set('analysisPeriod', e.target.value as any)} />
              </div>
              <div className="space-y-1.5">
                <Label>Periode Pelaporan</Label>
                <Input value={form.reportingPeriod ?? ''} onChange={(e) => set('reportingPeriod', e.target.value as any)} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Keterangan</Label>
                <Textarea rows={2} value={form.notes ?? ''} onChange={(e) => set('notes', e.target.value as any)} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Target ─────────────────────────────────────────────── */}
        <TabsContent value="target" className="space-y-4">
          <Card>
            <CardContent className="pt-6 grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Target</Label>
                <Input placeholder="Contoh: 95" value={form.targetValue ?? ''} onChange={(e) => set('targetValue', e.target.value as any)} />
              </div>
              <div className="space-y-1.5">
                <Label>Satuan Target</Label>
                <Input placeholder="%" value={form.targetUnit ?? ''} onChange={(e) => set('targetUnit', e.target.value as any)} />
              </div>
              <div className="space-y-1.5">
                <Label>Operator Target</Label>
                <Select value={form.targetOperator ?? ''} onValueChange={(v) => set('targetOperator', v as any)}>
                  <SelectTrigger><SelectValue placeholder="Pilih" /></SelectTrigger>
                  <SelectContent>{TARGET_OPERATOR_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {form.targetOperator === 'range' && (
                <>
                  <div className="space-y-1.5">
                    <Label>Nilai Minimum</Label>
                    <Input type="number" value={form.targetMin ?? ''} onChange={(e) => set('targetMin', Number(e.target.value) as any)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Nilai Maksimum</Label>
                    <Input type="number" value={form.targetMax ?? ''} onChange={(e) => set('targetMax', Number(e.target.value) as any)} />
                  </div>
                </>
              )}
              <div className="space-y-1.5">
                <Label>Standar Nasional</Label>
                <Input value={form.nationalStandard ?? ''} onChange={(e) => set('nationalStandard', e.target.value as any)} />
              </div>
              <div className="space-y-1.5">
                <Label>Standar Rumah Sakit</Label>
                <Input value={form.hospitalStandard ?? ''} onChange={(e) => set('hospitalStandard', e.target.value as any)} />
              </div>
              <div className="space-y-1.5">
                <Label>Standar Unit</Label>
                <Input value={form.unitStandard ?? ''} onChange={(e) => set('unitStandard', e.target.value as any)} />
              </div>
              <div className="space-y-1.5">
                <Label>Sumber Target</Label>
                <Select value={form.targetSource ?? ''} onValueChange={(v) => set('targetSource', v as any)}>
                  <SelectTrigger><SelectValue placeholder="Pilih" /></SelectTrigger>
                  <SelectContent>{TARGET_SOURCE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Sumber Referensi Target</Label>
                <Input value={form.targetReference ?? ''} onChange={(e) => set('targetReference', e.target.value as any)} />
              </div>
              <div className="space-y-1.5">
                <Label>Tahun Penetapan Target</Label>
                <Input type="number" value={form.targetYear ?? ''} onChange={(e) => set('targetYear', Number(e.target.value) as any)} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Skor Prioritas ─────────────────────────────────────── */}
        <TabsContent value="skor" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Sistem Skoring Prioritas (1–5 per kriteria)</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {PRIORITY_SCORE_CRITERIA.map((c) => (
                <div key={c.key} className="flex items-center justify-between gap-2">
                  <span className="text-sm">{c.label}</span>
                  <Select value={String((form as any)[c.key] ?? '')} onValueChange={(v) => set(c.key as any, Number(v) as any)}>
                    <SelectTrigger className="w-[80px] h-8"><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>{[1, 2, 3, 4, 5].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              ))}
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Total Skor: {totalScorePreview}</span>
                <Badge variant="outline" style={{ borderColor: PRIORITY_CATEGORY_COLOR[priorityCat], color: PRIORITY_CATEGORY_COLOR[priorityCat] }}>
                  {PRIORITY_CATEGORY_LABEL[priorityCat]}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function YesNoRow({ label, value, onChange }: { label: string; value: boolean | null | undefined; onChange: (v: boolean | null) => void }) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span>{label}</span>
      <Select value={value === true ? 'ya' : value === false ? 'tidak' : ''} onValueChange={(v) => onChange(v === 'ya' ? true : v === 'tidak' ? false : null)}>
        <SelectTrigger className="w-[100px] h-8"><SelectValue placeholder="Pilih" /></SelectTrigger>
        <SelectContent><SelectItem value="ya">Ya</SelectItem><SelectItem value="tidak">Tidak</SelectItem></SelectContent>
      </Select>
    </div>
  );
}

/** Rekomendasi kelayakan otomatis, mengikuti diagram alur SPO (Gambar A.1). */
function computeEligibilityRecommendation(f: Partial<UimuProposal>): 'layak' | 'tidak_layak' | 'perlu_kajian' | null {
  const answered = [f.eligibilityVisiMisi, f.eligibilityEvidenceGap, f.eligibilityImportant, f.eligibilityControllable, f.eligibilityPatientSafety];
  if (answered.every((a) => a === null || a === undefined)) return null;
  if (f.eligibilityVisiMisi === false || f.eligibilityControllable === false) return 'tidak_layak';
  if (f.eligibilityVisiMisi === true && (f.eligibilityEvidenceGap === true || f.eligibilityImportant === true) && f.eligibilityControllable === true) {
    return 'layak';
  }
  return 'perlu_kajian';
}

function EligibilityBadge({ form }: { form: Partial<UimuProposal> }) {
  const rec = computeEligibilityRecommendation(form);
  if (!rec) return <span className="text-xs text-muted-foreground">Belum cukup data</span>;
  const meta = { layak: { label: 'Layak', color: '#22c55e' }, tidak_layak: { label: 'Tidak Layak', color: '#ef4444' }, perlu_kajian: { label: 'Perlu Kajian Lanjut', color: '#f59e0b' } }[rec];
  return <Badge variant="outline" style={{ borderColor: meta.color, color: meta.color }}>{meta.label}</Badge>;
}
