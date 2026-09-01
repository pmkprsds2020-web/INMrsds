'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Loader2, Save } from 'lucide-react';
import type { CustomIndicatorBundle } from '@/types/customIndicators';
import { recordCustomIndicatorMeasurement } from '@/lib/customIndicatorData';
import { toastSuccess, toastError } from '@/lib/toast-helpers';

/**
 * Form input data pengukuran, generic untuk field apa pun yang dikonfigurasi
 * pada versi indikator (bagian 18 dokumen acuan). Dipakai dari dua tempat:
 * CustomIndicatorDetail (tab "Input Data", tampilan lengkap untuk komite
 * mutu/admin) dan UnitIndicatorModule (tampilan ringkas untuk PIC per unit)
 * — supaya logikanya tidak terduplikasi.
 */
export function MeasurementForm({ indicatorId, version, fields, units, defaultUnit, userId, onSaved, compact }: {
  indicatorId: string; version: NonNullable<CustomIndicatorBundle['currentVersion']>; fields: CustomIndicatorBundle['fields'];
  units: string[]; defaultUnit: string; userId: string; onSaved: () => void;
  /** true untuk sembunyikan judul kartu — dipakai saat form sudah punya konteks header sendiri (mis. UnitIndicatorModule). */
  compact?: boolean;
}) {
  const [unitId, setUnitId] = useState(defaultUnit || units[0] || '');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [values, setValues] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const numeratorField = fields.find((f) => f.roleInFormula === 'numerator');
  const denominatorField = fields.find((f) => f.roleInFormula === 'denominator');
  const extraFields = fields.filter((f) => f.roleInFormula !== 'numerator' && f.roleInFormula !== 'denominator');

  async function handleSubmit() {
    if (!unitId) { toastError('Pilih unit terlebih dahulu.'); return; }
    setSaving(true);
    try {
      const numerator = numeratorField ? (values[numeratorField.fieldCode] ? Number(values[numeratorField.fieldCode]) : null) : null;
      const denominator = denominatorField ? (values[denominatorField.fieldCode] ? Number(values[denominatorField.fieldCode]) : null) : null;
      const measurementData: Record<string, unknown> = {};
      for (const f of extraFields) if (values[f.fieldCode] !== undefined) measurementData[f.fieldCode] = values[f.fieldCode];

      await recordCustomIndicatorMeasurement({ indicatorId, version, unitId, measurementDate: date, numerator, denominator, measurementData, notes: notes || undefined, actorId: userId });
      toastSuccess('Data pengukuran tersimpan');
      setValues({}); setNotes('');
      onSaved();
    } catch (err) {
      toastError('Gagal menyimpan data', { description: err instanceof Error ? err.message : undefined });
    } finally { setSaving(false); }
  }

  const body = (
    <>
      <CardContent className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Unit</Label>
          {units.length <= 1 ? (
            <div className="flex h-9 items-center rounded-md border bg-muted/30 px-3 text-sm">{units[0] ?? '—'}</div>
          ) : (
            <Select value={unitId} onValueChange={setUnitId}>
              <SelectTrigger><SelectValue placeholder="Pilih unit" /></SelectTrigger>
              <SelectContent>{units.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
            </Select>
          )}
        </div>
        <div className="space-y-1.5"><Label>Tanggal</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        {fields.map((f) => (
          <div key={f.id} className="space-y-1.5">
            <Label>{f.fieldLabel}{f.isRequired && <span className="text-rose-500"> *</span>}</Label>
            {f.fieldType === 'boolean' ? (
              <label className="flex items-center gap-2 text-sm h-9"><Checkbox checked={values[f.fieldCode] === 'true'} onCheckedChange={(v) => setValues((s) => ({ ...s, [f.fieldCode]: v ? 'true' : 'false' }))} /> Ya</label>
            ) : f.fieldType === 'select' ? (
              <Select value={values[f.fieldCode] ?? ''} onValueChange={(v) => setValues((s) => ({ ...s, [f.fieldCode]: v }))}>
                <SelectTrigger><SelectValue placeholder="Pilih" /></SelectTrigger>
                <SelectContent>{(f.options ?? []).map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
              </Select>
            ) : (
              <Input
                type={f.fieldType === 'number' || f.fieldType === 'decimal' ? 'number' : f.fieldType === 'date' ? 'date' : 'text'}
                step={f.fieldType === 'decimal' ? '0.01' : undefined}
                value={values[f.fieldCode] ?? ''}
                onChange={(e) => setValues((s) => ({ ...s, [f.fieldCode]: e.target.value }))}
              />
            )}
          </div>
        ))}
        <div className="space-y-1.5 sm:col-span-2"><Label>Catatan</Label><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
      </CardContent>
      <CardContent className="pt-0">
        <Button size="sm" disabled={saving} onClick={handleSubmit} className="gap-1.5">{saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Simpan Data</Button>
      </CardContent>
    </>
  );

  if (compact) return <Card>{body}</Card>;

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Input Data Pengukuran</CardTitle></CardHeader>
      {body}
    </Card>
  );
}
