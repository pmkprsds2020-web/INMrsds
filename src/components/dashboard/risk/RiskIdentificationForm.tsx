'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ChevronLeft, ChevronRight, Save, ShieldAlert } from 'lucide-react';
import {
  type Risk, type RiskAssessment,
  RISK_CATEGORIES, RISK_UNITS, RISK_YEARS,
  RISK_PROBABILITAS_SCALE, RISK_DAMPAK_SCALE, RISK_CONTROLLABILITY_SCALE,
  RISK_LEVEL_LABEL, RISK_LEVEL_COLOR,
  skorLevelFromScore, matrixLevelFromScore,
} from '@/types/risk';
import { createRisk, updateRisk, upsertRiskAssessment, getRiskAssessment } from '@/lib/riskData';
import { toastSuccess, toastError } from '@/lib/toast-helpers';

interface RiskIdentificationFormProps {
  userId: string;
  userName: string;
  activeUnit: string;
  draft?: Risk | null;
  onDone: (riskId: string) => void;
  onCancel?: () => void;
}

type FormState = Partial<Risk>;

const emptyState = (): FormState => ({
  riskYear: new Date().getFullYear(),
  identifiedDate: new Date().toISOString().slice(0, 10),
});

const STEPS = ['Informasi Risiko', 'Identifikasi', 'Analisis Risiko', 'Review'];

export function RiskIdentificationForm({ userId, userName, activeUnit, draft, onDone, onCancel }: RiskIdentificationFormProps) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(draft ?? emptyState());
  const [riskId, setRiskId] = useState<string | undefined>(draft?.id);
  const [saving, setSaving] = useState(false);

  const [probabilitas, setProbabilitas] = useState<number | undefined>(draft?.assessment?.probabilitas);
  const [dampak, setDampak] = useState<number | undefined>(draft?.assessment?.dampak);
  const [controllability, setControllability] = useState<number | undefined>(draft?.assessment?.controllability);

  useEffect(() => {
    if (draft) {
      setForm(draft);
      setRiskId(draft.id);
      if (draft.id) {
        getRiskAssessment(draft.id).then((a) => {
          if (a) { setProbabilitas(a.probabilitas); setDampak(a.dampak); setControllability(a.controllability); }
        });
      }
    }
  }, [draft]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((prev) => ({ ...prev, [key]: value }));

  // Skor & level dihitung LOKAL hanya untuk preview real-time di form —
  // nilai yang disimpan tetap dihitung ulang oleh generated column di database
  // (poin 11, 41 — sumber kebenaran ada di DB, bukan di client).
  const previewSkor = probabilitas && dampak && controllability ? dampak * probabilitas * controllability : null;
  const previewLevel = previewSkor != null ? skorLevelFromScore(previewSkor) : null;
  const previewMatrixScore = probabilitas && dampak ? dampak * probabilitas : null;
  const previewMatrixLevel = previewMatrixScore != null ? matrixLevelFromScore(previewMatrixScore) : null;

  async function persistIdentification(): Promise<string | undefined> {
    setSaving(true);
    try {
      if (!form.unitLokasi || !form.category || !form.risiko || !form.sebabInsiden || !form.efekDampak) {
        toastError('Lengkapi field wajib', { description: 'Unit, Kategori, Risiko, Sebab, dan Efek/Dampak wajib diisi.' });
        return undefined;
      }
      let id = riskId;
      if (!id) {
        const created = await createRisk({
          ...form,
          riskYear: form.riskYear ?? new Date().getFullYear(),
          unitLokasi: form.unitLokasi!,
          category: form.category as any,
          risiko: form.risiko!,
          sebabInsiden: form.sebabInsiden!,
          efekDampak: form.efekDampak!,
          status: 'identifikasi',
          createdBy: userId,
        } as any);
        id = created.id;
        setRiskId(id);
      } else {
        await updateRisk(id, { ...form, status: form.status === 'draft' ? 'identifikasi' : form.status }, userId);
      }
      return id;
    } catch (err) {
      console.error(err);
      toastError('Gagal menyimpan identifikasi risiko', { description: err instanceof Error ? err.message : undefined });
      return undefined;
    } finally {
      setSaving(false);
    }
  }

  async function persistAssessment(id: string) {
    if (!probabilitas || !dampak || !controllability) return;
    await upsertRiskAssessment(id, { probabilitas, dampak, controllability }, userId);
  }

  const next = async () => {
    // Langkah 0 (Informasi Risiko) hanya berisi Unit/Kategori/Subkategori —
    // field Risiko/Sebab/Efek baru diisi di Langkah 1, jadi di sini TIDAK
    // divalidasi/disimpan sebagai identifikasi lengkap (hanya validasi lokal
    // untuk field yang memang ada pada langkah ini).
    if (step === 0) {
      if (!form.unitLokasi || !form.category) {
        toastError('Lengkapi field wajib', { description: 'Unit/Lokasi dan Kategori Risiko wajib diisi.' });
        return;
      }
      setStep((s) => s + 1);
      return;
    }
    if (step === 1) {
      const id = await persistIdentification();
      if (!id) return;
      setStep((s) => s + 1);
      return;
    }
    if (step === 2) {
      if (!probabilitas || !dampak || !controllability) {
        toastError('Lengkapi analisis risiko', { description: 'Probabilitas, Dampak, dan Controllability wajib diisi.' });
        return;
      }
      const id = riskId ?? (await persistIdentification());
      if (!id) return;
      setSaving(true);
      try {
        await persistAssessment(id);
        setStep((s) => s + 1);
      } catch (err) {
        toastError('Gagal menyimpan analisis risiko', { description: err instanceof Error ? err.message : undefined });
      } finally {
        setSaving(false);
      }
      return;
    }
  };
  const back = () => setStep((s) => Math.max(0, s - 1));

  const finish = async () => {
    if (!riskId) return;
    toastSuccess('Risiko berhasil disimpan', { description: `${form.risiko} telah tercatat pada Risk Register tahun ${form.riskYear}.` });
    onDone(riskId);
  };

  const progressPct = Math.round(((step + 1) / STEPS.length) * 100);

  return (
    <div className="max-w-3xl mx-auto space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <ShieldAlert className="size-5 text-amber-500" />
            {draft ? 'Edit Risiko' : 'Identifikasi Risiko Baru'}
          </h2>
          <p className="text-xs text-muted-foreground">{STEPS[step]} — Langkah {step + 1} dari {STEPS.length}</p>
        </div>
        {form.riskYear && <Badge variant="outline" className="text-[10px]">Tahun {form.riskYear}</Badge>}
      </div>

      <Progress value={progressPct} className="h-1.5" />

      <Card>
        <CardContent className="pt-6 space-y-5">
          {step === 0 && (
            <div className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Tahun Risk Register</Label>
                  <Select value={String(form.riskYear ?? new Date().getFullYear())} onValueChange={(v) => set('riskYear', Number(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{RISK_YEARS.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Tanggal Identifikasi</Label>
                  <Input type="date" value={form.identifiedDate ?? ''} onChange={(e) => set('identifiedDate', e.target.value)} />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Unit/Lokasi *</Label>
                  <Select value={form.unitLokasi ?? ''} onValueChange={(v) => set('unitLokasi', v)}>
                    <SelectTrigger><SelectValue placeholder={activeUnit || 'Pilih unit'} /></SelectTrigger>
                    <SelectContent>{RISK_UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Kategori Risiko *</Label>
                  <Select value={form.category ?? ''} onValueChange={(v) => set('category', v as any)}>
                    <SelectTrigger><SelectValue placeholder="Pilih kategori" /></SelectTrigger>
                    <SelectContent>{RISK_CATEGORIES.map((c) => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Subkategori Risiko</Label>
                <Input value={form.subcategory ?? ''} onChange={(e) => set('subcategory', e.target.value)} placeholder="Opsional" />
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Risiko *</Label>
                <Textarea rows={2} value={form.risiko ?? ''} onChange={(e) => set('risiko', e.target.value)} placeholder="Uraikan risiko yang teridentifikasi" />
              </div>
              <div className="space-y-1.5">
                <Label>Sebab Insiden/Kejadian *</Label>
                <Textarea rows={2} value={form.sebabInsiden ?? ''} onChange={(e) => set('sebabInsiden', e.target.value)} placeholder="Mengapa hal tersebut dapat terjadi" />
              </div>
              <div className="space-y-1.5">
                <Label>Efek/Dampak *</Label>
                <Textarea rows={2} value={form.efekDampak ?? ''} onChange={(e) => set('efekDampak', e.target.value)} />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Proses yang Terdampak</Label>
                  <Input value={form.prosesTerdampak ?? ''} onChange={(e) => set('prosesTerdampak', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Dokumen/SPO Terkait</Label>
                  <Input value={form.dokumenSpoTerkait ?? ''} onChange={(e) => set('dokumenSpoTerkait', e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Kontrol yang Sudah Tersedia</Label>
                <Textarea rows={2} value={form.kontrolExisting ?? ''} onChange={(e) => set('kontrolExisting', e.target.value)} />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Risk Owner / PIC</Label>
                  <Input value={form.riskOwnerName ?? ''} onChange={(e) => set('riskOwnerName', e.target.value)} placeholder="Nama penanggung jawab" />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div className="space-y-2">
                <Label>Probabilitas *</Label>
                <RadioGroup value={probabilitas ? String(probabilitas) : ''} onValueChange={(v) => setProbabilitas(Number(v))} className="space-y-2">
                  {RISK_PROBABILITAS_SCALE.map((p) => (
                    <label key={p.value} className="flex items-start gap-3 rounded-lg border p-2.5 cursor-pointer hover:bg-muted/40">
                      <RadioGroupItem value={String(p.value)} className="mt-0.5" />
                      <span className="text-sm">
                        <span className="font-medium">{p.value} — {p.label}</span>
                        <span className="block text-xs text-muted-foreground">{p.description} ({p.percentage})</span>
                      </span>
                    </label>
                  ))}
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label>Dampak *</Label>
                <RadioGroup value={dampak ? String(dampak) : ''} onValueChange={(v) => setDampak(Number(v))} className="space-y-2">
                  {RISK_DAMPAK_SCALE.map((d) => (
                    <label key={d.value} className="flex items-start gap-3 rounded-lg border p-2.5 cursor-pointer hover:bg-muted/40">
                      <RadioGroupItem value={String(d.value)} className="mt-0.5" />
                      <span className="text-sm">
                        <span className="font-medium">{d.value} — {d.label}</span>
                        <ul className="mt-1 list-disc list-inside text-xs text-muted-foreground space-y-0.5">
                          {d.description.map((line, i) => <li key={i}>{line}</li>)}
                        </ul>
                      </span>
                    </label>
                  ))}
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label>Controllability *</Label>
                <RadioGroup value={controllability ? String(controllability) : ''} onValueChange={(v) => setControllability(Number(v))} className="space-y-2">
                  {RISK_CONTROLLABILITY_SCALE.map((c) => (
                    <label key={c.value} className="flex items-start gap-3 rounded-lg border p-2.5 cursor-pointer hover:bg-muted/40">
                      <RadioGroupItem value={String(c.value)} className="mt-0.5" />
                      <span className="text-sm">
                        <span className="font-medium">{c.value} — {c.label}</span>
                        <span className="block text-xs text-muted-foreground">{c.definition} · Kemungkinan deteksi: {c.detection}</span>
                      </span>
                    </label>
                  ))}
                </RadioGroup>
              </div>

              {previewSkor != null && previewLevel && (
                <Card className="bg-muted/30">
                  <CardContent className="pt-4 flex flex-wrap items-center gap-6">
                    <div>
                      <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Skor Risiko (Dampak × Probabilitas × Controllability)</p>
                      <p className="text-2xl font-bold" style={{ color: RISK_LEVEL_COLOR[previewLevel] }}>
                        {dampak} × {probabilitas} × {controllability} = {previewSkor}
                      </p>
                      <Badge variant="outline" style={{ borderColor: RISK_LEVEL_COLOR[previewLevel], color: RISK_LEVEL_COLOR[previewLevel] }} className="mt-1">
                        {RISK_LEVEL_LABEL[previewLevel]}
                      </Badge>
                    </div>
                    {previewMatrixScore != null && previewMatrixLevel && (
                      <div>
                        <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Posisi Risk Matrix (Dampak × Probabilitas)</p>
                        <p className="text-lg font-semibold">{previewMatrixScore} — {RISK_LEVEL_LABEL[previewMatrixLevel]}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
              <p className="text-[11px] text-muted-foreground">
                Skor dihitung otomatis dan tidak dapat diinput manual. Nilai final disimpan setelah Anda melanjutkan ke langkah berikutnya.
              </p>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3 text-sm">
              <h3 className="font-medium">Ringkasan</h3>
              <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
                <div><dt className="text-muted-foreground">Unit/Lokasi</dt><dd className="font-medium">{form.unitLokasi}</dd></div>
                <div><dt className="text-muted-foreground">Kategori</dt><dd className="font-medium">{RISK_CATEGORIES.find((c) => c.id === form.category)?.label}</dd></div>
                <div className="sm:col-span-2"><dt className="text-muted-foreground">Risiko</dt><dd className="font-medium">{form.risiko}</dd></div>
                <div className="sm:col-span-2"><dt className="text-muted-foreground">Sebab Insiden/Kejadian</dt><dd className="font-medium">{form.sebabInsiden}</dd></div>
                <div className="sm:col-span-2"><dt className="text-muted-foreground">Efek/Dampak</dt><dd className="font-medium">{form.efekDampak}</dd></div>
                <div><dt className="text-muted-foreground">Risk Owner/PIC</dt><dd className="font-medium">{form.riskOwnerName || '—'}</dd></div>
                {previewSkor != null && previewLevel && (
                  <div><dt className="text-muted-foreground">Skor Risiko</dt><dd className="font-medium" style={{ color: RISK_LEVEL_COLOR[previewLevel] }}>{previewSkor} ({RISK_LEVEL_LABEL[previewLevel]})</dd></div>
                )}
              </dl>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={step === 0 ? onCancel : back} disabled={saving}>
          <ChevronLeft className="size-4 mr-1" />{step === 0 ? 'Batal' : 'Kembali'}
        </Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={next} disabled={saving}>
            {saving ? 'Menyimpan…' : 'Lanjut'}<ChevronRight className="size-4 ml-1" />
          </Button>
        ) : (
          <Button onClick={finish} disabled={saving}><Save className="size-4 mr-1.5" />Simpan Risiko</Button>
        )}
      </div>
    </div>
  );
}
