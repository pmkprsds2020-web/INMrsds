'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ChevronLeft, ChevronRight, Save, Send, Loader2, ShieldAlert, AlertTriangle } from 'lucide-react';
import {
  type IkpIncident, type IkpReportKind,
  IKP_AGE_GROUPS, IKP_GENDERS, IKP_PAYER_TYPES, IKP_INCIDENT_TYPES,
  IKP_REPORTER_CATEGORIES, IKP_INCIDENT_SUBJECTS, IKP_PATIENT_SERVICE_TYPES,
  IKP_SERVICE_UNITS, IKP_PATIENT_IMPACTS, IKP_ACTION_TAKEN_BY,
} from '@/types/ikp';
import { createIkpIncident, updateIkpIncident, submitIkpIncident } from '@/lib/ikpData';
import { toastSuccess, toastError } from '@/lib/toast-helpers';

interface IkpReportFormProps {
  userId: string;
  userName: string;
  activeUnit: string;
  /** Draft yang sedang diedit (opsional — kosong berarti laporan baru). */
  draft?: IkpIncident | null;
  onDone: (incidentId: string) => void;
  onCancel?: () => void;
}

type FormState = Partial<IkpIncident>;

const emptyState = (kind: IkpReportKind): FormState => ({
  reportKind: kind,
  isAnonymous: false,
});

export function IkpReportForm({ userId, userName, activeUnit, draft, onDone, onCancel }: IkpReportFormProps) {
  const [kind, setKind] = useState<IkpReportKind>(draft?.reportKind ?? 'insiden');
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(draft ?? emptyState('insiden'));
  const [saving, setSaving] = useState(false);
  const [incidentId, setIncidentId] = useState<string | undefined>(draft?.id);

  useEffect(() => {
    if (draft) {
      setForm(draft);
      setKind(draft.reportKind);
      setIncidentId(draft.id);
    }
  }, [draft]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const steps = kind === 'insiden'
    ? ['Jenis Laporan', 'Identitas Laporan', 'Data Pasien', 'Rincian Kejadian', 'Dampak & Tindakan', 'Review']
    : ['Jenis Laporan', 'Identitas Laporan', 'Kondisi Potensial Cedera', 'Tindakan', 'Review'];

  const progressPct = Math.round(((step + 1) / steps.length) * 100);

  async function persist(nextStatus?: 'draft' | 'dilaporkan') {
    setSaving(true);
    try {
      const payload: FormState = { ...form, reportKind: kind };
      let id = incidentId;
      if (!id) {
        const created = await createIkpIncident({
          ...payload,
          reportKind: kind,
          createdBy: userId,
          reporterId: payload.reporterId ?? userId,
          reporterName: payload.reporterName ?? userName,
          reporterUnit: payload.reporterUnit ?? activeUnit,
          status: 'draft',
        } as any);
        id = created.id;
        setIncidentId(id);
      } else {
        await updateIkpIncident(id, payload, userId);
      }
      if (nextStatus === 'dilaporkan' && id) {
        await submitIkpIncident(id, userId);
        toastSuccess('Laporan berhasil dikirim', { description: 'Laporan telah diteruskan ke Tim Keselamatan Pasien untuk verifikasi.' });
        onDone(id);
      } else {
        toastSuccess('Draft tersimpan');
      }
      return id;
    } catch (err) {
      console.error(err);
      toastError('Gagal menyimpan laporan', { description: err instanceof Error ? err.message : undefined });
      return undefined;
    } finally {
      setSaving(false);
    }
  }

  const next = async () => {
    if (step < steps.length - 1) {
      await persist('draft');
      setStep((s) => s + 1);
    }
  };
  const back = () => setStep((s) => Math.max(0, s - 1));

  const submitFinal = async () => {
    const id = await persist('dilaporkan');
    if (id) onDone(id);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <ShieldAlert className="size-5 text-amber-500" />
            Pelaporan Insiden Keselamatan Pasien
          </h2>
          <p className="text-xs text-muted-foreground">
            {steps[step]} — Langkah {step + 1} dari {steps.length}
          </p>
        </div>
        <Badge variant="outline" className="text-[10px]">RAHASIA</Badge>
      </div>

      <Progress value={progressPct} className="h-1.5" />

      <Card>
        <CardContent className="pt-6 space-y-5">
          {step === 0 && (
            <StepJenisLaporan kind={kind} onChange={(k) => { setKind(k); setForm(emptyState(k)); }} />
          )}
          {step === 1 && (
            <StepIdentitasLaporan form={form} set={set} defaultUnit={activeUnit} defaultName={userName} />
          )}
          {kind === 'insiden' && step === 2 && <StepDataPasien form={form} set={set} />}
          {kind === 'insiden' && step === 3 && <StepRincianKejadian form={form} set={set} />}
          {kind === 'insiden' && step === 4 && <StepDampakTindakan form={form} set={set} />}
          {kind === 'kpc' && step === 2 && <StepKpcKondisi form={form} set={set} />}
          {kind === 'kpc' && step === 3 && <StepDampakTindakan form={form} set={set} kpc />}
          {step === steps.length - 1 && <StepReview form={form} kind={kind} />}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={step === 0 ? onCancel : back} disabled={saving}>
          <ChevronLeft className="size-4 mr-1" /> {step === 0 ? 'Batal' : 'Kembali'}
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => persist('draft')} disabled={saving}>
            {saving ? <Loader2 className="size-4 mr-1 animate-spin" /> : <Save className="size-4 mr-1" />}
            Simpan Draft
          </Button>
          {step < steps.length - 1 ? (
            <Button onClick={next} disabled={saving}>
              Lanjut <ChevronRight className="size-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={submitFinal} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
              {saving ? <Loader2 className="size-4 mr-1 animate-spin" /> : <Send className="size-4 mr-1" />}
              Kirim Laporan
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────── */

function Field({ label, required, children, hint }: { label: string; required?: boolean; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-foreground/80">
        {label} {required && <span className="text-red-500">*</span>}
      </Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function StepJenisLaporan({ kind, onChange }: { kind: IkpReportKind; onChange: (k: IkpReportKind) => void }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Pilih jenis formulir sesuai kejadian yang ingin dilaporkan. Laporan bersifat rahasia dan wajib
        disampaikan maksimal 2×24 jam sejak kejadian/ditemukan.
      </p>
      <RadioGroup value={kind} onValueChange={(v) => onChange(v as IkpReportKind)} className="gap-3">
        <label className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer ${kind === 'insiden' ? 'border-primary bg-primary/5' : 'border-border'}`}>
          <RadioGroupItem value="insiden" className="mt-1" />
          <div>
            <p className="text-sm font-medium">Laporan Insiden (KNC / KTC / KTD / Sentinel)</p>
            <p className="text-xs text-muted-foreground">Kejadian yang sudah menyangkut / berpotensi menyangkut pasien tertentu.</p>
          </div>
        </label>
        <label className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer ${kind === 'kpc' ? 'border-primary bg-primary/5' : 'border-border'}`}>
          <RadioGroupItem value="kpc" className="mt-1" />
          <div>
            <p className="text-sm font-medium">Laporan Kondisi Potensial Cedera (KPC)</p>
            <p className="text-xs text-muted-foreground">Kondisi/bahaya yang berpotensi menimbulkan cedera, belum menyangkut pasien tertentu.</p>
          </div>
        </label>
      </RadioGroup>
    </div>
  );
}

function StepIdentitasLaporan({ form, set, defaultUnit, defaultName }: { form: FormState; set: any; defaultUnit: string; defaultName: string }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <Field label="Tempat (Poli / Unit pembuat laporan)" required>
        <Input value={form.tempat ?? defaultUnit ?? ''} onChange={(e) => set('tempat', e.target.value)} placeholder="mis. Poli Anak" />
      </Field>
      <Field label="Nama Pelapor">
        <Input value={form.reporterName ?? defaultName} onChange={(e) => set('reporterName', e.target.value)} disabled={!!form.isAnonymous} />
      </Field>
      <Field label="Unit / Bagian Pelapor">
        <Input value={form.reporterUnit ?? defaultUnit ?? ''} onChange={(e) => set('reporterUnit', e.target.value)} />
      </Field>
      <Field label="Profesi">
        <Input value={form.reporterProfession ?? ''} onChange={(e) => set('reporterProfession', e.target.value)} placeholder="mis. Perawat, Dokter, Bidan" />
      </Field>
      <Field label="Kontak Pelapor (opsional)">
        <Input value={form.reporterContact ?? ''} onChange={(e) => set('reporterContact', e.target.value)} placeholder="No. HP / ekstensi" />
      </Field>
      <div className="flex items-center justify-between rounded-lg border p-3 sm:col-span-2">
        <div>
          <p className="text-sm font-medium">Laporkan secara anonim</p>
          <p className="text-xs text-muted-foreground">Nama pelapor tidak akan ditampilkan pada laporan.</p>
        </div>
        <Switch checked={!!form.isAnonymous} onCheckedChange={(v) => set('isAnonymous', v)} />
      </div>
    </div>
  );
}

function StepDataPasien({ form, set }: { form: FormState; set: any }) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Isi data pasien seperlunya (prinsip minimal necessary data). Data ini hanya dapat diakses oleh
        pihak yang berwenang.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Nama Pasien">
          <Input value={form.patientName ?? ''} onChange={(e) => set('patientName', e.target.value)} />
        </Field>
        <Field label="No. Rekam Medis">
          <Input value={form.patientMrNumber ?? ''} onChange={(e) => set('patientMrNumber', e.target.value)} />
        </Field>
        <Field label="Ruangan">
          <Input value={form.patientRoom ?? ''} onChange={(e) => set('patientRoom', e.target.value)} />
        </Field>
        <Field label="Kelompok Umur" required>
          <Select value={form.patientAgeGroup ?? undefined} onValueChange={(v) => set('patientAgeGroup', v)}>
            <SelectTrigger><SelectValue placeholder="Pilih kelompok umur" /></SelectTrigger>
            <SelectContent>
              {IKP_AGE_GROUPS.map((g) => <SelectItem key={g.id} value={g.id}>{g.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Jenis Kelamin" required>
          <RadioGroup value={form.patientGender ?? undefined} onValueChange={(v) => set('patientGender', v)} className="flex gap-4 pt-1.5">
            {IKP_GENDERS.map((g) => (
              <label key={g.id} className="flex items-center gap-1.5 text-sm">
                <RadioGroupItem value={g.id} /> {g.label}
              </label>
            ))}
          </RadioGroup>
        </Field>
        <Field label="Penanggung Biaya Pasien">
          <Select value={form.payerType ?? undefined} onValueChange={(v) => set('payerType', v)}>
            <SelectTrigger><SelectValue placeholder="Pilih penanggung biaya" /></SelectTrigger>
            <SelectContent>
              {IKP_PAYER_TYPES.map((p) => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Tanggal Masuk RS">
          <Input type="date" value={form.admissionDate ?? ''} onChange={(e) => set('admissionDate', e.target.value)} />
        </Field>
        <Field label="Jam Masuk RS">
          <Input type="time" value={form.admissionTime ?? ''} onChange={(e) => set('admissionTime', e.target.value)} />
        </Field>
      </div>
    </div>
  );
}

function StepRincianKejadian({ form, set }: { form: FormState; set: any }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Tanggal Insiden" required>
          <Input type="date" value={form.incidentDate ?? ''} onChange={(e) => set('incidentDate', e.target.value)} />
        </Field>
        <Field label="Jam Insiden" required>
          <Input type="time" value={form.incidentTime ?? ''} onChange={(e) => set('incidentTime', e.target.value)} />
        </Field>
      </div>
      <Field label="Insiden (ringkasan singkat)" required>
        <Textarea rows={2} value={form.incidentSummary ?? ''} onChange={(e) => set('incidentSummary', e.target.value)} />
      </Field>
      <Field label="Kronologis Insiden" required hint="Uraikan kondisi sebelum, saat, dan setelah kejadian secara berurutan.">
        <Textarea rows={5} value={form.chronology ?? ''} onChange={(e) => set('chronology', e.target.value)} />
      </Field>

      <Field label="Jenis Insiden" required>
        <div className="grid gap-2">
          {IKP_INCIDENT_TYPES.map((t) => (
            <label key={t.id} className={`flex items-start gap-2.5 rounded-lg border p-2.5 cursor-pointer ${form.incidentType === t.id ? 'border-primary bg-primary/5' : 'border-border'}`}>
              <input type="radio" className="mt-1" checked={form.incidentType === t.id} onChange={() => set('incidentType', t.id)} />
              <div>
                <p className="text-sm font-medium">{t.label}</p>
                <p className="text-xs text-muted-foreground">{t.description}</p>
              </div>
            </label>
          ))}
        </div>
        {form.incidentType === 'ktd_sentinel' && (
          <label className="flex items-center gap-2 mt-2 text-xs">
            <input type="checkbox" checked={!!form.isSentinel} onChange={(e) => set('isSentinel', e.target.checked)} />
            Tandai sebagai <b>Kejadian Sentinel</b> (dampak sangat serius / kematian tidak wajar)
          </label>
        )}
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Orang Pertama yang Melaporkan Insiden" required>
          <Select value={form.reportedByCategory ?? undefined} onValueChange={(v) => set('reportedByCategory', v)}>
            <SelectTrigger><SelectValue placeholder="Pilih kategori" /></SelectTrigger>
            <SelectContent>
              {IKP_REPORTER_CATEGORIES.map((c) => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        {form.reportedByCategory === 'lain_lain' && (
          <Field label="Sebutkan">
            <Input value={form.reportedByDetail ?? ''} onChange={(e) => set('reportedByDetail', e.target.value)} />
          </Field>
        )}
        <Field label="Insiden Terjadi Pada" required hint="Bila bukan pasien, laporan diarahkan ke unit K3 — perlu konfirmasi alur.">
          <Select value={form.incidentSubject ?? undefined} onValueChange={(v) => set('incidentSubject', v)}>
            <SelectTrigger><SelectValue placeholder="Pilih" /></SelectTrigger>
            <SelectContent>
              {IKP_INCIDENT_SUBJECTS.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Insiden Menyangkut Pasien">
          <Select value={form.patientServiceType ?? undefined} onValueChange={(v) => set('patientServiceType', v)}>
            <SelectTrigger><SelectValue placeholder="Pilih" /></SelectTrigger>
            <SelectContent>
              {IKP_PATIENT_SERVICE_TYPES.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Lokasi Kejadian" required hint="Tempat pasien berada saat insiden terjadi.">
          <Input value={form.incidentLocation ?? ''} onChange={(e) => set('incidentLocation', e.target.value)} />
        </Field>
        <Field label="Unit Pelayanan Pasien (sesuai kasus penyakit)">
          <Select value={form.patientServiceUnit ?? undefined} onValueChange={(v) => set('patientServiceUnit', v)}>
            <SelectTrigger><SelectValue placeholder="Pilih unit" /></SelectTrigger>
            <SelectContent>
              {IKP_SERVICE_UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        {form.patientServiceUnit === 'Lainnya' && (
          <Field label="Sebutkan Unit">
            <Input value={form.patientServiceUnitOther ?? ''} onChange={(e) => set('patientServiceUnitOther', e.target.value)} />
          </Field>
        )}
        <Field label="Unit Kerja Penyebab Insiden" required>
          <Input value={form.causingUnit ?? ''} onChange={(e) => set('causingUnit', e.target.value)} />
        </Field>
      </div>
    </div>
  );
}

function StepKpcKondisi({ form, set }: { form: FormState; set: any }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Tanggal Ditemukan" required>
          <Input type="date" value={form.incidentDate ?? ''} onChange={(e) => set('incidentDate', e.target.value)} />
        </Field>
        <Field label="Jam Ditemukan" required>
          <Input type="time" value={form.incidentTime ?? ''} onChange={(e) => set('incidentTime', e.target.value)} />
        </Field>
      </div>
      <Field label="Deskripsi KPC (Kondisi Potensial Cedera)" required>
        <Textarea rows={4} value={form.kpcDescription ?? ''} onChange={(e) => set('kpcDescription', e.target.value)} />
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Orang Pertama yang Melaporkan" required>
          <Select value={form.reportedByCategory ?? undefined} onValueChange={(v) => set('reportedByCategory', v)}>
            <SelectTrigger><SelectValue placeholder="Pilih kategori" /></SelectTrigger>
            <SelectContent>
              {IKP_REPORTER_CATEGORIES.map((c) => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Lokasi Ditemukan KPC" required>
          <Input value={form.kpcLocation ?? ''} onChange={(e) => set('kpcLocation', e.target.value)} />
        </Field>
        <Field label="Unit / Bagian Terkait KPC" required>
          <Input value={form.kpcRelatedUnit ?? ''} onChange={(e) => set('kpcRelatedUnit', e.target.value)} />
        </Field>
      </div>
    </div>
  );
}

function StepDampakTindakan({ form, set, kpc }: { form: FormState; set: any; kpc?: boolean }) {
  return (
    <div className="space-y-4">
      {!kpc && (
        <Field label="Akibat Insiden Terhadap Pasien" required>
          <div className="grid sm:grid-cols-2 gap-2">
            {IKP_PATIENT_IMPACTS.map((imp) => (
              <label key={imp.id} className={`flex items-center gap-2 rounded-lg border p-2.5 cursor-pointer text-sm ${form.patientImpact === imp.id ? 'border-primary bg-primary/5' : 'border-border'}`}>
                <input type="radio" checked={form.patientImpact === imp.id} onChange={() => set('patientImpact', imp.id)} />
                {imp.label}
              </label>
            ))}
          </div>
        </Field>
      )}
      <Field label={kpc ? 'Tindakan yang Dilakukan Selama Ini, dan Hasilnya' : 'Tindakan Segera yang Dilakukan, dan Hasilnya'} required>
        <Textarea rows={4} value={form.immediateAction ?? ''} onChange={(e) => set('immediateAction', e.target.value)} />
      </Field>
      <Field label="Hasil Tindakan">
        <Textarea rows={2} value={form.immediateActionResult ?? ''} onChange={(e) => set('immediateActionResult', e.target.value)} />
      </Field>
      <Field label="Tindakan Dilakukan Oleh" required>
        <div className="grid sm:grid-cols-2 gap-2">
          {IKP_ACTION_TAKEN_BY.map((a) => (
            <label key={a.id} className={`flex items-center gap-2 rounded-lg border p-2.5 cursor-pointer text-sm ${form.actionTakenBy === a.id ? 'border-primary bg-primary/5' : 'border-border'}`}>
              <input type="radio" checked={form.actionTakenBy === a.id} onChange={() => set('actionTakenBy', a.id)} />
              {a.label}
            </label>
          ))}
        </div>
        {(form.actionTakenBy === 'tim' || form.actionTakenBy === 'petugas_lain') && (
          <Input className="mt-2" placeholder="Sebutkan" value={form.actionTakenByDetail ?? ''} onChange={(e) => set('actionTakenByDetail', e.target.value)} />
        )}
      </Field>
      <div className="rounded-lg border p-3 space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm">Apakah kejadian yang sama pernah terjadi di unit kerja lain?</Label>
          <Switch checked={!!form.recurrenceElsewhere} onCheckedChange={(v) => set('recurrenceElsewhere', v)} />
        </div>
        {form.recurrenceElsewhere && (
          <Textarea rows={3} placeholder="Kapan? Dan langkah/tindakan apa yang diambil pada unit kerja tersebut untuk mencegah terulangnya kejadian yang sama?" value={form.recurrenceDetail ?? ''} onChange={(e) => set('recurrenceDetail', e.target.value)} />
        )}
      </div>
    </div>
  );
}

function StepReview({ form, kind }: { form: FormState; kind: IkpReportKind }) {
  const rows: [string, string | null | undefined][] = kind === 'insiden'
    ? [
        ['Tempat', form.tempat], ['Pelapor', form.isAnonymous ? 'Anonim' : form.reporterName],
        ['Tanggal Insiden', form.incidentDate], ['Jenis Insiden', form.incidentType],
        ['Lokasi Kejadian', form.incidentLocation], ['Unit Penyebab', form.causingUnit],
        ['Akibat Terhadap Pasien', form.patientImpact],
      ]
    : [
        ['Tempat', form.tempat], ['Pelapor', form.isAnonymous ? 'Anonim' : form.reporterName],
        ['Tanggal Ditemukan', form.incidentDate], ['Lokasi KPC', form.kpcLocation],
        ['Unit Terkait', form.kpcRelatedUnit],
      ];
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
        <AlertTriangle className="size-4 shrink-0" />
        Periksa kembali data sebelum mengirim. Setelah dikirim, laporan akan diteruskan ke Tim Keselamatan Pasien untuk verifikasi dan tidak dapat diedit bebas oleh pelapor.
      </div>
      <div className="rounded-lg border divide-y">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between px-3 py-2 text-sm">
            <span className="text-muted-foreground">{label}</span>
            <span className="font-medium text-right max-w-[60%] truncate">{value || '—'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
