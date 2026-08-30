'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { createBudayaSurvey } from '@/lib/budayaData';
import type { BudayaSurveyPeriod } from '@/types/budaya';

export function BudayaSurveyForm({ userId, onDone, onCancel }: { userId: string; survey?: undefined; onDone: (id: string) => void; onCancel: () => void }) {
  const currentYear = new Date().getFullYear();
  const [name, setName] = useState('');
  const [year, setYear] = useState(currentYear);
  const [period, setPeriod] = useState<BudayaSurveyPeriod>('semester_1');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [target, setTarget] = useState(100);
  const [minThreshold, setMinThreshold] = useState(10);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    if (!name.trim()) return setError('Nama survei wajib diisi.');
    if (!startDate || !endDate) return setError('Tanggal mulai dan selesai wajib diisi.');
    if (endDate < startDate) return setError('Tanggal selesai tidak boleh sebelum tanggal mulai.');

    setSaving(true);
    try {
      const created = await createBudayaSurvey({
        name: name.trim(),
        year,
        period,
        startDate,
        endDate,
        targetRespondents: target,
        minRespondentThreshold: minThreshold,
        status: 'draft',
        anonymityMode: 'anonymous',
        createdBy: userId,
      });
      onDone(created.id);
    } catch (e: any) {
      setError(e?.message ?? 'Gagal membuat survei.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-4">
      <h2 className="text-xl font-semibold">Buat Survey Baru</h2>
      <Card>
        <CardHeader><CardTitle className="text-base">Detail Survey</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nama Survey</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Survey Budaya Keselamatan Pasien Semester I 2027" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Tahun</Label>
              <Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label>Periode</Label>
              <Select value={period} onValueChange={(v) => setPeriod(v as BudayaSurveyPeriod)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="semester_1">Semester I</SelectItem>
                  <SelectItem value="semester_2">Semester II</SelectItem>
                  <SelectItem value="tahunan">Tahunan</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Tanggal Mulai</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Tanggal Selesai</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Target Responden</Label>
              <Input type="number" min={1} value={target} onChange={(e) => setTarget(Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label>Ambang Minimum Anonimitas</Label>
              <Input type="number" min={1} value={minThreshold} onChange={(e) => setMinThreshold(Number(e.target.value))} />
              <p className="text-xs text-muted-foreground">Unit dengan responden di bawah angka ini tidak ditampilkan per-unit (poin AC).</p>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Unit yang diikutkan diatur setelah survei dibuat (bisa semua unit atau sebagian, lewat halaman detail survei). Survei dibuat berstatus <strong>Draft</strong> — ubah ke Aktif untuk mulai distribusi (link/QR/token).
          </p>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={onCancel} disabled={saving}>Batal</Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving && <Loader2 className="size-4 mr-1 animate-spin" />} Simpan Survey
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
