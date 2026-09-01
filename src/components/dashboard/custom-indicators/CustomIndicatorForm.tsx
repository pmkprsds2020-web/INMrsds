'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, ArrowLeft, Save, Plus, Trash2 } from 'lucide-react';
import {
  type CustomIndicatorKind, type FormulaType, type TargetOperator, type TargetDirection,
  type MeasurementFrequency, type FieldType, type FieldFormulaRole,
  INDICATOR_KIND_LABEL, DEFAULT_CATEGORIES, FORMULA_TYPE_OPTIONS, FORMULA_MULTIPLIER_OPTIONS,
  TARGET_OPERATOR_OPTIONS, TARGET_DIRECTION_OPTIONS, UNIT_OF_MEASURE_OPTIONS, FREQUENCY_OPTIONS,
  FIELD_TYPE_OPTIONS, ASSIGNABLE_UNIT_IDS,
} from '@/types/customIndicators';
import { createCustomIndicator, getCustomIndicatorCategories, createCustomIndicatorCategory } from '@/lib/customIndicatorData';
import { toastSuccess, toastError } from '@/lib/toast-helpers';

interface DraftField {
  fieldCode: string; fieldLabel: string; fieldType: FieldType; isRequired: boolean;
  roleInFormula: FieldFormulaRole | null; options: string;
}

interface CustomIndicatorFormProps {
  mode: 'create';
  userId: string;
  onDone: (id: string) => void;
  onCancel: () => void;
}

export function CustomIndicatorForm({ userId, onDone, onCancel }: CustomIndicatorFormProps) {
  const [saving, setSaving] = useState(false);

  // Step 1 — Identitas
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [purpose, setPurpose] = useState('');
  const [indicatorType, setIndicatorType] = useState<CustomIndicatorKind>('unit');
  const [category, setCategory] = useState('Lainnya');
  const [customCategory, setCustomCategory] = useState('');
  const [picName, setPicName] = useState('');
  const [isPermanent, setIsPermanent] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [activateNow, setActivateNow] = useState(false);

  // Priority RS fields
  const [priorityNumber, setPriorityNumber] = useState<number | ''>('');
  const [priorityReason, setPriorityReason] = useState('');
  const [priorityBasis, setPriorityBasis] = useState('');
  const [priorityPeriod, setPriorityPeriod] = useState('');

  // Step 2 — Unit
  const [isAllUnits, setIsAllUnits] = useState(false);
  const [selectedUnits, setSelectedUnits] = useState<string[]>([]);

  // Step 3 — Definisi Operasional & Formula & Target
  const [operationalDefinition, setOperationalDefinition] = useState('');
  const [numeratorLabel, setNumeratorLabel] = useState('');
  const [denominatorLabel, setDenominatorLabel] = useState('');
  const [inclusionCriteria, setInclusionCriteria] = useState('');
  const [exclusionCriteria, setExclusionCriteria] = useState('');
  const [sourceOfData, setSourceOfData] = useState('');
  const [collectionMethod, setCollectionMethod] = useState('');
  const [formulaType, setFormulaType] = useState<FormulaType>('percentage');
  const [formulaMultiplier, setFormulaMultiplier] = useState(100);
  const [targetValue, setTargetValue] = useState<number | ''>('');
  const [targetOperator, setTargetOperator] = useState<TargetOperator>('gte');
  const [targetDirection, setTargetDirection] = useState<TargetDirection>('higher_better');
  const [unitOfMeasure, setUnitOfMeasure] = useState('%');
  const [unitOfMeasureCustom, setUnitOfMeasureCustom] = useState('');
  const [frequency, setFrequency] = useState<MeasurementFrequency>('bulanan');
  const [frequencyCustom, setFrequencyCustom] = useState('');
  const [allowMultiplePerPeriod, setAllowMultiplePerPeriod] = useState(false);
  const [allowNumeratorGtDenominator, setAllowNumeratorGtDenominator] = useState(false);

  // Step 4 — Field pengukuran
  const [fields, setFields] = useState<DraftField[]>([
    { fieldCode: 'numerator', fieldLabel: 'Numerator', fieldType: 'number', isRequired: true, roleInFormula: 'numerator', options: '' },
    { fieldCode: 'denominator', fieldLabel: 'Denominator', fieldType: 'number', isRequired: true, roleInFormula: 'denominator', options: '' },
  ]);

  function addField() {
    setFields((f) => [...f, { fieldCode: `field_${f.length + 1}`, fieldLabel: '', fieldType: 'number', isRequired: false, roleInFormula: null, options: '' }]);
  }
  function updateField(i: number, patch: Partial<DraftField>) {
    setFields((f) => f.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  }
  function removeField(i: number) {
    setFields((f) => f.filter((_, idx) => idx !== i));
  }

  const needsMultiplier = formulaType === 'rate';
  const needsNumeratorDenominator = ['percentage', 'rate', 'average', 'ratio'].includes(formulaType);

  async function handleSubmit() {
    if (!name.trim()) { toastError('Nama indikator wajib diisi.'); return; }
    if (!isAllUnits && indicatorType === 'unit' && selectedUnits.length === 0) { toastError('Pilih minimal satu unit, atau centang "Berlaku untuk semua unit".'); return; }
    if (needsNumeratorDenominator && (formulaMultiplier <= 0 && needsMultiplier)) { toastError('Multiplier harus lebih besar dari 0.'); return; }

    setSaving(true);
    try {
      const finalCategory = category === '__custom__' ? (customCategory.trim() || 'Lainnya') : category;
      if (category === '__custom__' && customCategory.trim()) {
        try { await createCustomIndicatorCategory(customCategory.trim(), userId); } catch { /* mungkin sudah ada, abaikan */ }
      }

      const created = await createCustomIndicator({
        identity: {
          name: name.trim(), code: code.trim() || undefined, description: description.trim() || undefined,
          purpose: purpose.trim() || undefined, indicatorType, category: finalCategory,
          status: activateNow ? 'active' : 'draft',
          isAllUnits: indicatorType === 'priority_rs' ? isAllUnits || selectedUnits.length === 0 : isAllUnits,
          picName: picName.trim() || undefined, isPermanent,
          startDate: startDate || undefined, endDate: endDate || undefined,
          priorityNumber: indicatorType === 'priority_rs' && priorityNumber !== '' ? Number(priorityNumber) : undefined,
          priorityReason: indicatorType === 'priority_rs' ? priorityReason.trim() || undefined : undefined,
          priorityBasis: indicatorType === 'priority_rs' ? priorityBasis.trim() || undefined : undefined,
          priorityPeriod: indicatorType === 'priority_rs' ? priorityPeriod.trim() || undefined : undefined,
          createdBy: userId,
        },
        version: {
          operationalDefinition: operationalDefinition.trim() || undefined,
          numeratorLabel: numeratorLabel.trim() || undefined, denominatorLabel: denominatorLabel.trim() || undefined,
          inclusionCriteria: inclusionCriteria.trim() || undefined, exclusionCriteria: exclusionCriteria.trim() || undefined,
          sourceOfData: sourceOfData.trim() || undefined, collectionMethod: collectionMethod.trim() || undefined,
          formulaType, formulaMultiplier,
          targetValue: targetValue === '' ? undefined : Number(targetValue),
          targetOperator, targetDirection,
          unitOfMeasure, unitOfMeasureCustom: unitOfMeasure === 'lainnya' ? unitOfMeasureCustom.trim() || undefined : undefined,
          frequency, frequencyCustom: frequency === 'custom' ? frequencyCustom.trim() || undefined : undefined,
          allowMultiplePerPeriod, allowNumeratorGtDenominator,
        },
        fields: fields.filter((f) => f.fieldLabel.trim()).map((f) => ({
          fieldCode: f.fieldCode, fieldLabel: f.fieldLabel, fieldType: f.fieldType, isRequired: f.isRequired,
          roleInFormula: f.roleInFormula ?? undefined,
          options: f.fieldType === 'select' && f.options.trim() ? f.options.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
        })),
        unitIds: isAllUnits ? [] : selectedUnits,
      });

      toastSuccess(`Indikator ${created.indicator.code} dibuat`, { description: activateNow ? 'Langsung aktif dan siap menerima data.' : 'Tersimpan sebagai draft.' });
      onDone(created.indicator.id);
    } catch (err) {
      toastError('Gagal membuat indikator', { description: err instanceof Error ? err.message : undefined });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-4 space-y-4 max-w-4xl">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button size="icon" variant="ghost" className="size-8" onClick={onCancel}><ArrowLeft className="size-4" /></Button>
          <h2 className="text-lg font-semibold">Buat Indikator Mutu Baru</h2>
        </div>
        <Button size="sm" disabled={saving} onClick={handleSubmit} className="gap-1.5">
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Simpan{activateNow ? ' & Aktifkan' : ''}
        </Button>
      </div>

      <Tabs defaultValue="identitas">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="identitas">1. Identitas</TabsTrigger>
          <TabsTrigger value="unit">2. Penetapan Unit</TabsTrigger>
          <TabsTrigger value="definisi">3. Definisi & Formula</TabsTrigger>
          <TabsTrigger value="field">4. Field Pengukuran</TabsTrigger>
        </TabsList>

        {/* ── Step 1: Identitas ─────────────────────────────────── */}
        <TabsContent value="identitas" className="space-y-4">
          <Card>
            <CardContent className="pt-6 grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Nama Indikator <span className="text-rose-500">*</span></Label>
                <Input placeholder="Contoh: Kepatuhan Pengisian Rekam Medis" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Kode Indikator (opsional, otomatis jika kosong)</Label>
                <Input placeholder="Contoh: IMU-004" value={code} onChange={(e) => setCode(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Jenis Indikator</Label>
                <Select value={indicatorType} onValueChange={(v) => setIndicatorType(v as CustomIndicatorKind)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unit">{INDICATOR_KIND_LABEL.unit}</SelectItem>
                    <SelectItem value="priority_rs">{INDICATOR_KIND_LABEL.priority_rs}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Deskripsi</Label>
                <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Tujuan</Label>
                <Textarea rows={2} value={purpose} onChange={(e) => setPurpose(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Kategori</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DEFAULT_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    <SelectItem value="__custom__">+ Kategori baru…</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {category === '__custom__' && (
                <div className="space-y-1.5">
                  <Label>Nama Kategori Baru</Label>
                  <Input value={customCategory} onChange={(e) => setCustomCategory(e.target.value)} />
                </div>
              )}
              <div className="space-y-1.5">
                <Label>PIC</Label>
                <Input value={picName} onChange={(e) => setPicName(e.target.value)} />
              </div>
              <div className="flex items-center justify-between gap-2 sm:col-span-2 border rounded-lg p-3">
                <div>
                  <p className="text-sm font-medium">Indikator permanen</p>
                  <p className="text-xs text-muted-foreground">Bila dimatikan, tentukan tanggal mulai/selesai.</p>
                </div>
                <Switch checked={isPermanent} onCheckedChange={setIsPermanent} />
              </div>
              {!isPermanent && (
                <>
                  <div className="space-y-1.5"><Label>Tanggal Mulai</Label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
                  <div className="space-y-1.5"><Label>Tanggal Selesai</Label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
                </>
              )}
              <div className="flex items-center justify-between gap-2 sm:col-span-2 border rounded-lg p-3">
                <div>
                  <p className="text-sm font-medium">Simpan & Aktifkan langsung</p>
                  <p className="text-xs text-muted-foreground">Bila tidak dicentang, indikator tersimpan sebagai Draft.</p>
                </div>
                <Switch checked={activateNow} onCheckedChange={setActivateNow} />
              </div>
            </CardContent>
          </Card>

          {indicatorType === 'priority_rs' && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Detail Indikator Prioritas RS</CardTitle></CardHeader>
              <CardContent className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label>Nomor Prioritas</Label><Input type="number" value={priorityNumber} onChange={(e) => setPriorityNumber(e.target.value === '' ? '' : Number(e.target.value))} /></div>
                <div className="space-y-1.5"><Label>Periode Prioritas</Label><Input placeholder="mis. 2026" value={priorityPeriod} onChange={(e) => setPriorityPeriod(e.target.value)} /></div>
                <div className="space-y-1.5 sm:col-span-2"><Label>Alasan Menjadi Prioritas</Label><Textarea rows={2} value={priorityReason} onChange={(e) => setPriorityReason(e.target.value)} /></div>
                <div className="space-y-1.5 sm:col-span-2"><Label>Dasar Penetapan</Label><Textarea rows={2} value={priorityBasis} onChange={(e) => setPriorityBasis(e.target.value)} /></div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Step 2: Unit ──────────────────────────────────────── */}
        <TabsContent value="unit" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Unit Penanggung Jawab</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <label className="flex items-center gap-2 text-sm font-medium">
                <Checkbox checked={isAllUnits} onCheckedChange={(v) => setIsAllUnits(!!v)} />
                Berlaku untuk semua unit
              </label>
              {!isAllUnits && (
                <div className="grid sm:grid-cols-3 gap-2">
                  {ASSIGNABLE_UNIT_IDS.map((u) => (
                    <label key={u} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={selectedUnits.includes(u)}
                        onCheckedChange={() => setSelectedUnits((s) => s.includes(u) ? s.filter((x) => x !== u) : [...s, u])}
                      />
                      {u}
                    </label>
                  ))}
                </div>
              )}
              {indicatorType === 'unit' && selectedUnits.length > 1 && (
                <p className="text-xs text-muted-foreground pt-2 border-t">Indikator ini dipakai {selectedUnits.length} unit sekaligus — pertimbangkan aktifkan perbandingan antarunit di halaman detail bila metodologinya sebanding.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Step 3: Definisi Operasional & Formula & Target ─────── */}
        <TabsContent value="definisi" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Definisi Operasional</CardTitle></CardHeader>
            <CardContent className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5 sm:col-span-2"><Label>Definisi Operasional</Label><Textarea rows={3} value={operationalDefinition} onChange={(e) => setOperationalDefinition(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Label Numerator</Label><Input value={numeratorLabel} onChange={(e) => setNumeratorLabel(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Label Denominator</Label><Input value={denominatorLabel} onChange={(e) => setDenominatorLabel(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Kriteria Inklusi</Label><Textarea rows={2} value={inclusionCriteria} onChange={(e) => setInclusionCriteria(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Kriteria Eksklusi</Label><Textarea rows={2} value={exclusionCriteria} onChange={(e) => setExclusionCriteria(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Sumber Data</Label><Input value={sourceOfData} onChange={(e) => setSourceOfData(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Metode Pengumpulan Data</Label><Input value={collectionMethod} onChange={(e) => setCollectionMethod(e.target.value)} /></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm">Formula / Rumus Indikator</CardTitle></CardHeader>
            <CardContent className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Metode Perhitungan</Label>
                <Select value={formulaType} onValueChange={(v) => setFormulaType(v as FormulaType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{FORMULA_TYPE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{FORMULA_TYPE_OPTIONS.find((o) => o.value === formulaType)?.description}</p>
              </div>
              {needsMultiplier && (
                <div className="space-y-1.5">
                  <Label>Multiplier</Label>
                  <Select value={String(formulaMultiplier)} onValueChange={(v) => setFormulaMultiplier(Number(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{FORMULA_MULTIPLIER_OPTIONS.map((m) => <SelectItem key={m} value={String(m)}>{m.toLocaleString('id-ID')}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1.5">
                <Label>Satuan</Label>
                <Select value={unitOfMeasure} onValueChange={setUnitOfMeasure}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{UNIT_OF_MEASURE_OPTIONS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {unitOfMeasure === 'lainnya' && (
                <div className="space-y-1.5"><Label>Nama Satuan Custom</Label><Input value={unitOfMeasureCustom} onChange={(e) => setUnitOfMeasureCustom(e.target.value)} /></div>
              )}
              <div className="space-y-1.5">
                <Label>Frekuensi Pengukuran</Label>
                <Select value={frequency} onValueChange={(v) => setFrequency(v as MeasurementFrequency)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{FREQUENCY_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {frequency === 'custom' && (
                <div className="space-y-1.5"><Label>Frekuensi Custom</Label><Input value={frequencyCustom} onChange={(e) => setFrequencyCustom(e.target.value)} /></div>
              )}
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <Checkbox checked={allowMultiplePerPeriod} onCheckedChange={(v) => setAllowMultiplePerPeriod(!!v)} />
                Izinkan multiple measurements per periode
              </label>
              {needsNumeratorDenominator && (
                <label className="flex items-center gap-2 text-sm sm:col-span-2">
                  <Checkbox checked={allowNumeratorGtDenominator} onCheckedChange={(v) => setAllowNumeratorGtDenominator(!!v)} />
                  Izinkan numerator lebih besar dari denominator
                </label>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm">Target & Arah Indikator</CardTitle></CardHeader>
            <CardContent className="grid sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Operator Target</Label>
                <Select value={targetOperator} onValueChange={(v) => setTargetOperator(v as TargetOperator)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TARGET_OPERATOR_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Nilai Target</Label>
                <Input type="number" value={targetValue} onChange={(e) => setTargetValue(e.target.value === '' ? '' : Number(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label>Arah Indikator</Label>
                <Select value={targetDirection} onValueChange={(v) => setTargetDirection(v as TargetDirection)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TARGET_DIRECTION_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Step 4: Field Pengukuran ─────────────────────────────── */}
        <TabsContent value="field" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm">Field Form Input Data</CardTitle>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={addField}><Plus className="size-3.5" /> Tambah Field</Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {fields.map((f, i) => (
                <div key={i} className="grid sm:grid-cols-6 gap-2 items-end border-b pb-3 last:border-0">
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-xs">Label Field</Label>
                    <Input value={f.fieldLabel} onChange={(e) => updateField(i, { fieldLabel: e.target.value })} placeholder="mis. Jumlah patuh" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Kode</Label>
                    <Input value={f.fieldCode} onChange={(e) => updateField(i, { fieldCode: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Tipe</Label>
                    <Select value={f.fieldType} onValueChange={(v) => updateField(i, { fieldType: v as FieldType })}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>{FIELD_TYPE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Peran Formula</Label>
                    <Select value={f.roleInFormula ?? '__none__'} onValueChange={(v) => updateField(i, { roleInFormula: v === '__none__' ? null : v as FieldFormulaRole })}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">—</SelectItem>
                        <SelectItem value="numerator">Numerator</SelectItem>
                        <SelectItem value="denominator">Denominator</SelectItem>
                        <SelectItem value="value">Value</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-1">
                    <label className="flex items-center gap-1.5 text-xs"><Checkbox checked={f.isRequired} onCheckedChange={(v) => updateField(i, { isRequired: !!v })} /> Wajib</label>
                    <Button size="icon" variant="ghost" className="size-7 ml-auto" onClick={() => removeField(i)}><Trash2 className="size-3.5 text-rose-500" /></Button>
                  </div>
                  {f.fieldType === 'select' && (
                    <div className="space-y-1 sm:col-span-6">
                      <Label className="text-xs">Pilihan (pisahkan dengan koma)</Label>
                      <Input value={f.options} onChange={(e) => updateField(i, { options: e.target.value })} placeholder="Ya, Tidak, Belum" />
                    </div>
                  )}
                </div>
              ))}
              <p className="text-xs text-muted-foreground pt-2">Field dengan "Peran Formula" = Numerator/Denominator akan otomatis dipakai calculation engine saat data diinput. Field lain tersimpan sebagai data pendukung.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
