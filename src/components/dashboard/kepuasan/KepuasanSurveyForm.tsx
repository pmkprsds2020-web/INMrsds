'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { createKepuasanSurvey } from '@/lib/kepuasanData';
import { getCustomIndicators } from '@/lib/customIndicatorData';
import type { KepuasanSurveyMode, KepuasanTargetOperator } from '@/types/kepuasan';
import type { CustomIndicator } from '@/types/customIndicators';
import { UNIT_MAP } from '@/types';

const UNIT_OPTIONS = Object.keys(UNIT_MAP).filter((k) => k !== 'all');

export function KepuasanSurveyForm({ userId, onDone, onCancel }: { userId: string; onDone: (id: string) => void; onCancel: () => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [unitId, setUnitId] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [targetRespondents, setTargetRespondents] = useState<string>('');
  const [surveyMode, setSurveyMode] = useState<KepuasanSurveyMode>('online');
  const [targetValue, setTargetValue] = useState(76.61);
  const [targetOperator, setTargetOperator] = useState<KepuasanTargetOperator>('gt');
  const [linkedIndicatorId, setLinkedIndicatorId] = useState<string>('none');
  const [indicators, setIndicators] = useState<CustomIndicator[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getCustomIndicators({ category: 'Kepuasan' }).then(setIndicators).catch(() => setIndicators([]));
  }, []);

  const handleSubmit = async () => {
    setError(null);
    if (!name.trim()) return setError('Nama survei wajib diisi.');
    if (!startDate || !endDate) return setError('Periode (tanggal mulai & selesai) wajib diisi.');
    if (endDate < startDate) return setError('Tanggal selesai tidak boleh sebelum tanggal mulai.');

    setSaving(true);
    try {
      const created = await createKepuasanSurvey({
        name: name.trim(),
        description: description.trim() || null,
        unitId,
        startDate,
        endDate,
        targetRespondents: targetRespondents.trim() ? Number(targetRespondents) : null,
        surveyMode,
        status: 'draft',
        targetValue,
        targetOperator,
        linkedIndicatorId: linkedIndicatorId === 'none' ? null : linkedIndicatorId,
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
      <h2 className="text-xl font-semibold">Buat Survey Kepuasan Pasien</h2>
      <Card>
        <CardHeader><CardTitle className="text-base">Identitas Survey</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nama Survey</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Survey Kepuasan Pasien Rawat Jalan September 2026" />
          </div>
          <div className="space-y-1.5">
            <Label>Deskripsi</Label>
            <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Survei ini bertujuan untuk mengetahui tingkat kepuasan pasien terhadap pelayanan yang diberikan." />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Unit/Ruangan</Label>
              <Select value={unitId} onValueChange={setUnitId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Unit</SelectItem>
                  {UNIT_OPTIONS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">&quot;Semua Unit&quot;: pasien memilih unitnya sendiri saat mengisi.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Mode</Label>
              <Select value={surveyMode} onValueChange={(v) => setSurveyMode(v as KepuasanSurveyMode)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="online">Survey Online</SelectItem>
                  <SelectItem value="kiosk">Kiosk</SelectItem>
                  <SelectItem value="both">Online + Kiosk</SelectItem>
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

          <div className="space-y-1.5">
            <Label>Target Jumlah Responden (opsional)</Label>
            <Input type="number" min={1} value={targetRespondents} onChange={(e) => setTargetRespondents(e.target.value)} placeholder="Kosongkan bila tidak dibatasi" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Target &amp; Klasifikasi Mutu</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Operator Target</Label>
              <Select value={targetOperator} onValueChange={(v) => setTargetOperator(v as KepuasanTargetOperator)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="gt">Lebih dari (&gt;)</SelectItem>
                  <SelectItem value="gte">Lebih dari sama dengan (&ge;)</SelectItem>
                  <SelectItem value="lt">Kurang dari (&lt;)</SelectItem>
                  <SelectItem value="lte">Kurang dari sama dengan (&le;)</SelectItem>
                  <SelectItem value="eq">Sama dengan (=)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Nilai Target IKM</Label>
              <Input type="number" step="0.01" value={targetValue} onChange={(e) => setTargetValue(Number(e.target.value))} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Default &gt;76,61 mengikuti Permenpan RB 14/2017 (mutu B/Baik). Klasifikasi A-D (25-100) memakai batas standar yang sama — dapat disesuaikan kemudian lewat pengaturan lanjutan bila diperlukan.
          </p>

          <div className="space-y-1.5">
            <Label>Tautkan ke Indikator Mutu (opsional)</Label>
            <Select value={linkedIndicatorId} onValueChange={setLinkedIndicatorId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Tidak ditautkan</SelectItem>
                {indicators.map((i) => <SelectItem key={i.id} value={i.id}>{i.name} ({i.code})</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Bila ditautkan, hasil IKM periode ini otomatis terkirim sebagai data pengukuran indikator tersebut (Master Indikator Mutu Custom) setiap kali Dashboard/Monev dibuka. Indikator &quot;Kepuasan Pasien&quot; sudah tersedia secara default setelah migrasi SQL dijalankan.
            </p>
          </div>

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
