'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ClipboardPlus, Loader2, ArrowLeft, Plus, X, Wand2 } from 'lucide-react';
import { OPPE_PERIOD_LABEL, type OppeDoctor, type OppeIndicator, type OppePeriodType } from '@/types/oppe';
import {
  getAllActiveOppeDoctors, getOppeTemplateIndicators, getOppeIndicators, createOppeEvaluation, validateNewEvaluation, suggestTemplate, friendlyOppeError,
} from '@/lib/oppeData';
import { describeTarget } from '@/lib/oppeScoring';
import { supabase } from '@/lib/supabase/client';
import { toastSuccess } from '@/lib/toast-helpers';
import { OppeLoading, OppePageHeader, YEAR_OPTIONS, CURRENT_YEAR, type OppeMasters } from './OppeShared';

interface Props {
  masters: OppeMasters;
  actor: { id: string; name: string };
  isAdmin: boolean;
  isCommittee: boolean;
  initialDoctorId?: string | null;
  onCreated: (id: string) => void;
  onCancel: () => void;
}

export function OppeEvaluationForm({ masters, actor, isAdmin, isCommittee, initialDoctorId, onCreated, onCancel }: Props) {
  const [doctors, setDoctors] = useState<OppeDoctor[]>([]);
  const [doctorId, setDoctorId] = useState<string>(initialDoctorId ?? '');
  const [doctorSearch, setDoctorSearch] = useState('');
  const [ksmId, setKsmId] = useState<string>('');
  const [unitId, setUnitId] = useState<string>('');
  const [periodType, setPeriodType] = useState<OppePeriodType>(new Date().getMonth() < 6 ? 'semester_1' : 'semester_2');
  const [year, setYear] = useState<number>(CURRENT_YEAR);
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [evaluatorId, setEvaluatorId] = useState(actor.id);
  const [evaluatorName, setEvaluatorName] = useState(actor.name);
  const [evaluators, setEvaluators] = useState<{ id: string; name: string }[]>([{ id: actor.id, name: actor.name }]);
  const [evaluationDate, setEvaluationDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState('');
  const [templateId, setTemplateId] = useState<string>('');
  const [indicators, setIndicators] = useState<OppeIndicator[]>([]);
  const [allIndicators, setAllIndicators] = useState<OppeIndicator[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingTpl, setLoadingTpl] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [docs, inds] = await Promise.all([getAllActiveOppeDoctors(true), getOppeIndicators({ active: true })]);
        setDoctors(docs);
        setAllIndicators(inds);
        // Admin dapat menugaskan evaluator lain (dari profiles dengan oppe_roles evaluator/komite_medik).
        if (isAdmin) {
          const { data } = await supabase.from('profiles').select('id, display_name, email, oppe_roles, role').limit(500);
          const list = (data ?? [])
            .filter((p: any) => p.role === 'admin' || (p.oppe_roles ?? []).some((r: string) => ['evaluator', 'komite_medik'].includes(r)))
            .map((p: any) => ({ id: p.id as string, name: (p.display_name || p.email || p.id) as string }));
          if (list.length) setEvaluators([{ id: actor.id, name: actor.name }, ...list.filter((x) => x.id !== actor.id)]);
        }
      } catch (e) {
        setErr(friendlyOppeError(e, 'Data awal gagal dimuat.'));
      } finally {
        setLoading(false);
      }
    })();
  }, [isAdmin, actor.id, actor.name]);

  const doctor = doctors.find((d) => d.id === doctorId) ?? null;

  // Isi otomatis KSM/unit & template dari dokter: KSM -> Profesi -> Template OPPE
  useEffect(() => {
    if (!doctor) return;
    setKsmId(doctor.ksmId ?? '');
    setUnitId(doctor.unitId ?? '');
    const tpl = suggestTemplate(masters.templates, doctor.ksmId, doctor.profession);
    setTemplateId(tpl?.id ?? '');
  }, [doctor, masters.templates]);

  useEffect(() => {
    if (!templateId) { setIndicators([]); return; }
    setLoadingTpl(true);
    getOppeTemplateIndicators(templateId)
      .then((r) => setIndicators(r.filter((x) => x.isActive && x.indicator.isActive).map((x) => x.indicator)))
      .catch((e) => setErr(friendlyOppeError(e, 'Indikator template gagal dimuat.')))
      .finally(() => setLoadingTpl(false));
  }, [templateId]);

  useEffect(() => {
    // default jatuh tempo: akhir bulan setelah periode berakhir
    if (periodType === 'semester_1') setDueDate(`${year}-07-31`);
    else if (periodType === 'semester_2') setDueDate(`${year + 1}-01-31`);
    else if (periodType === 'tahunan') setDueDate(`${year + 1}-01-31`);
  }, [periodType, year]);

  const filteredDoctors = doctors.filter((d) => !doctorSearch || d.name.toLowerCase().includes(doctorSearch.toLowerCase()));
  const addable = allIndicators.filter((i) => !indicators.some((x) => x.id === i.id) && (!i.ksmId || i.ksmId === ksmId));
  const catName = (id: string) => masters.categories.find((c) => c.id === id);
  const grouped = useMemo(() => masters.categories.map((c) => ({ cat: c, items: indicators.filter((i) => i.categoryId === c.id) })), [masters.categories, indicators]);

  async function submit() {
    setErr(null);
    const input = {
      doctor: doctor ?? undefined, templateId: templateId || null, indicatorIds: indicators.map((i) => i.id), periodType, year,
      periodStart: periodStart || null, periodEnd: periodEnd || null, evaluatorId, evaluatorName, evaluationDate, dueDate: dueDate || null,
      ksmId: ksmId || null, unitId: unitId || null, unitName: masters.units.find((u) => u.id === unitId)?.name ?? doctor?.unitName ?? null,
    };
    const invalid = validateNewEvaluation(input);
    if (invalid) { setErr(invalid); return; }
    setSaving(true);
    try {
      const id = await createOppeEvaluation({ ...input, doctor: doctor! }, actor);
      toastSuccess('Evaluasi OPPE dibuat', { description: 'Silakan isi realisasi indikator.' });
      onCreated(id);
    } catch (e) {
      setErr(friendlyOppeError(e));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <OppeLoading />;

  return (
    <div className="p-4 space-y-4 max-w-5xl mx-auto">
      <OppePageHeader
        icon={ClipboardPlus}
        title="Evaluasi OPPE Baru"
        description="Pilih dokter, periode, dan evaluator. Indikator dimuat otomatis dari template KSM dokter."
        actions={<Button variant="outline" size="sm" className="gap-1.5" onClick={onCancel}><ArrowLeft className="size-4" />Kembali</Button>}
      />

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Identitas</CardTitle></CardHeader>
        <CardContent className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-xs">Dokter <span className="text-red-500">*</span></Label>
            <div className="flex gap-2">
              <Input value={doctorSearch} onChange={(e) => setDoctorSearch(e.target.value)} placeholder="Cari…" className="h-9 w-32" />
              <Select value={doctorId} onValueChange={setDoctorId}>
                <SelectTrigger className="h-9 flex-1"><SelectValue placeholder="Pilih dokter" /></SelectTrigger>
                <SelectContent>{filteredDoctors.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}{d.title ? `, ${d.title}` : ''}{d.ksmName ? ` — ${d.ksmName}` : ''}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {doctors.length === 0 && <p className="text-[11px] text-amber-600">Belum ada dokter aktif. Tambahkan di menu Data Dokter.</p>}
          </div>
          <ReadOnly label="Profesi" value={doctor?.profession} />
          <ReadOnly label="Spesialisasi" value={doctor?.specialty} />
          <div className="space-y-1">
            <Label className="text-xs">KSM <span className="text-red-500">*</span></Label>
            <Select value={ksmId} onValueChange={setKsmId} disabled={!isCommittee && !!doctor?.ksmId}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Pilih KSM" /></SelectTrigger>
              <SelectContent>{masters.ksm.map((k) => <SelectItem key={k.id} value={k.id}>{k.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Unit</Label>
            {masters.units.length > 0 ? (
              <Select value={unitId || '__none'} onValueChange={(v) => setUnitId(v === '__none' ? '' : v)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="__none">—</SelectItem>{masters.units.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
              </Select>
            ) : <Input disabled value={doctor?.unitName ?? ''} className="h-9" />}
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Periode <span className="text-red-500">*</span></Label>
            <Select value={periodType} onValueChange={(v) => setPeriodType(v as OppePeriodType)}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>{(Object.keys(OPPE_PERIOD_LABEL) as OppePeriodType[]).map((p) => <SelectItem key={p} value={p}>{OPPE_PERIOD_LABEL[p]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Tahun <span className="text-red-500">*</span></Label>
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>{YEAR_OPTIONS.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <ReadOnly label="Semester" value={periodType === 'semester_1' ? 'I' : periodType === 'semester_2' ? 'II' : '—'} />
          {periodType === 'custom' && (
            <>
              <div className="space-y-1"><Label className="text-xs">Tanggal mulai *</Label><Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className="h-9" /></div>
              <div className="space-y-1"><Label className="text-xs">Tanggal selesai *</Label><Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className="h-9" /></div>
            </>
          )}
          <div className="space-y-1">
            <Label className="text-xs">Evaluator <span className="text-red-500">*</span></Label>
            <Select value={evaluatorId} onValueChange={(v) => { setEvaluatorId(v); setEvaluatorName(evaluators.find((e) => e.id === v)?.name ?? ''); }}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>{evaluators.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}{e.id === actor.id ? ' (saya)' : ''}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label className="text-xs">Tanggal evaluasi</Label><Input type="date" value={evaluationDate} onChange={(e) => setEvaluationDate(e.target.value)} className="h-9" /></div>
          <div className="space-y-1"><Label className="text-xs">Jatuh tempo</Label><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="h-9" /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2 flex-row flex-wrap items-center justify-between gap-2 space-y-0">
          <CardTitle className="text-sm">Template & Indikator</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={templateId || '__none'} onValueChange={(v) => setTemplateId(v === '__none' ? '' : v)}>
              <SelectTrigger className="h-9 w-[280px]"><SelectValue placeholder="Pilih template" /></SelectTrigger>
              <SelectContent><SelectItem value="__none">— Tanpa template —</SelectItem>{masters.templates.filter((t) => t.isActive).map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
            </Select>
            {doctor && (
              <Button size="sm" variant="ghost" className="gap-1 text-xs" onClick={() => setTemplateId(suggestTemplate(masters.templates, ksmId || doctor.ksmId, doctor.profession)?.id ?? '')}>
                <Wand2 className="size-3.5" />Sarankan
              </Button>
            )}
            <Button size="sm" variant="outline" className="gap-1" onClick={() => setShowAdd((s) => !s)}><Plus className="size-3.5" />Tambah indikator</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {showAdd && (
            <div className="border rounded-md p-2 max-h-60 overflow-y-auto space-y-1">
              {addable.length === 0 && <p className="text-xs text-muted-foreground p-2">Tidak ada indikator lain untuk KSM ini.</p>}
              {addable.map((i) => (
                <label key={i.id} className="flex items-start gap-2 p-1.5 rounded hover:bg-muted/40 cursor-pointer">
                  <Checkbox checked={false} onCheckedChange={() => setIndicators((s) => [...s, i])} className="mt-0.5" />
                  <span className="text-xs"><span className="font-mono text-muted-foreground">{i.code}</span> {i.name}</span>
                </label>
              ))}
            </div>
          )}
          {loadingTpl ? <OppeLoading /> : indicators.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Pilih dokter/template untuk memuat indikator.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>No</TableHead><TableHead>Parameter</TableHead><TableHead>Target</TableHead><TableHead>Trigger</TableHead><TableHead>Sumber Data</TableHead><TableHead /></TableRow></TableHeader>
                <TableBody>
                  {grouped.map(({ cat, items }) => items.length === 0 ? null : (
                    <Fragment key={cat.id}>
                      <TableRow className="bg-muted/40 hover:bg-muted/40"><TableCell className="font-semibold text-xs">{cat.code}</TableCell><TableCell colSpan={5} className="font-semibold text-xs uppercase">{cat.name} (Bobot {cat.weight}%)</TableCell></TableRow>
                      {items.map((i, idx) => (
                        <TableRow key={i.id}>
                          <TableCell className="text-xs">{idx + 1}</TableCell>
                          <TableCell className="text-sm">{i.name}{i.isCritical && <Badge variant="destructive" className="ml-1 text-[9px]">KRITIS</Badge>}</TableCell>
                          <TableCell className="text-xs whitespace-nowrap">{i.targetText || describeTarget(i, i.unitLabel)}</TableCell>
                          <TableCell className="text-xs">{i.triggerText}</TableCell>
                          <TableCell className="text-xs">{i.sourceData}</TableCell>
                          <TableCell><Button size="icon" variant="ghost" className="size-7" onClick={() => setIndicators((s) => s.filter((x) => x.id !== i.id))}><X className="size-3.5" /></Button></TableCell>
                        </TableRow>
                      ))}
                    </Fragment>
                  ))}
                  {indicators.filter((i) => !catName(i.categoryId)).length > 0 && <TableRow><TableCell colSpan={6} className="text-xs text-amber-600">Beberapa indikator memiliki kategori nonaktif.</TableCell></TableRow>}
                </TableBody>
              </Table>
              <p className="text-xs text-muted-foreground pt-2">{indicators.length} indikator akan dievaluasi.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {err && <p className="text-sm text-red-500">{err}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>Batal</Button>
        <Button onClick={submit} disabled={saving} className="gap-1.5">{saving && <Loader2 className="size-4 animate-spin" />}Buat Evaluasi</Button>
      </div>
    </div>
  );
}

function ReadOnly({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input disabled value={value ?? '—'} className="h-9" />
    </div>
  );
}
