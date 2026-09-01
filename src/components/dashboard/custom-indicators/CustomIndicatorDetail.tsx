'use client';

import { useEffect, useMemo, useState } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip as ChartTooltip, Legend as ChartLegend,
} from 'chart.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  ArrowLeft, Loader2, Power, PowerOff, Copy, GitBranch, Save, CheckCircle2, XCircle,
} from 'lucide-react';
import {
  type CustomIndicatorBundle, type CustomIndicatorMeasurement, type FormulaType, type TargetOperator, type TargetDirection, type MeasurementFrequency,
  STATUS_LABEL, STATUS_COLOR, INDICATOR_KIND_LABEL, FORMULA_TYPE_OPTIONS, TARGET_OPERATOR_OPTIONS,
  FREQUENCY_OPTIONS, DEACTIVATION_REASON_OPTIONS, ASSIGNABLE_UNIT_IDS,
} from '@/types/customIndicators';
import {
  getCustomIndicatorBundle, getCustomIndicatorMeasurements,
  activateCustomIndicator, deactivateCustomIndicator, cloneCustomIndicator, createNewCustomIndicatorVersion,
  subscribeToCustomIndicatorMeasurements,
} from '@/lib/customIndicatorData';
import { MeasurementForm } from './MeasurementForm';
import { toastSuccess, toastError } from '@/lib/toast-helpers';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale/id';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, ChartTooltip, ChartLegend);

interface CustomIndicatorDetailProps {
  indicatorId: string;
  userId: string;
  userName: string;
  activeUnit: string;
  isManager: boolean;
  onBack: () => void;
}

function StatusBadge({ status }: { status: CustomIndicatorBundle['indicator']['status'] }) {
  return <Badge variant="outline" style={{ borderColor: STATUS_COLOR[status], color: STATUS_COLOR[status] }}>{STATUS_LABEL[status]}</Badge>;
}

export function CustomIndicatorDetail({ indicatorId, userId, userName, activeUnit, isManager, onBack }: CustomIndicatorDetailProps) {
  const [bundle, setBundle] = useState<CustomIndicatorBundle | null>(null);
  const [measurements, setMeasurements] = useState<CustomIndicatorMeasurement[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<string>('');

  async function load() {
    setLoading(true);
    try {
      const b = await getCustomIndicatorBundle(indicatorId);
      setBundle(b);
      if (b) {
        const units = b.indicator.isAllUnits ? ASSIGNABLE_UNIT_IDS : b.units.map((u) => u.unitId);
        const defaultUnit = units.includes(activeUnit as any) ? activeUnit : units[0];
        setSelectedUnit((prev) => prev || defaultUnit || '');
        const ms = await getCustomIndicatorMeasurements({ indicatorId });
        setMeasurements(ms);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [indicatorId]);
  useEffect(() => {
    const unsub = subscribeToCustomIndicatorMeasurements(indicatorId, () => {
      getCustomIndicatorMeasurements({ indicatorId }).then(setMeasurements);
    });
    return unsub;
  }, [indicatorId]);

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;
  if (!bundle) return <div className="p-4 text-sm text-muted-foreground">Indikator tidak ditemukan.</div>;

  const { indicator, currentVersion, fields, units, allVersions } = bundle;
  const assignedUnits = indicator.isAllUnits ? ASSIGNABLE_UNIT_IDS : units.map((u) => u.unitId);

  async function withBusy(fn: () => Promise<void>) {
    setBusy(true);
    try { await fn(); await load(); } catch (err) { toastError('Gagal memproses aksi', { description: err instanceof Error ? err.message : undefined }); } finally { setBusy(false); }
  }

  return (
    <div className="p-4 space-y-4 max-w-5xl">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Button size="icon" variant="ghost" className="size-8" onClick={onBack}><ArrowLeft className="size-4" /></Button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-semibold truncate">{indicator.name}</h2>
              <StatusBadge status={indicator.status} />
              <Badge variant="outline" className="text-[10px]">{INDICATOR_KIND_LABEL[indicator.indicatorType]}</Badge>
            </div>
            <p className="text-xs text-muted-foreground font-mono">{indicator.code} · v{currentVersion?.versionNumber ?? '-'} · {indicator.category}</p>
          </div>
        </div>
        {isManager && (
          <div className="flex flex-wrap gap-2 shrink-0">
            {indicator.status !== 'active' && (
              <Button size="sm" className="gap-1.5" disabled={busy} onClick={() => withBusy(async () => { await activateCustomIndicator(indicator.id, userId); toastSuccess('Indikator diaktifkan'); })}>
                <Power className="size-3.5" /> Aktifkan
              </Button>
            )}
            {indicator.status === 'active' && (
              <DeactivateButton indicatorId={indicator.id} userId={userId} busy={busy} onDone={load} />
            )}
            <Button size="sm" variant="outline" className="gap-1.5" disabled={busy} onClick={() => withBusy(async () => {
              const cloned = await cloneCustomIndicator(indicator.id, userId);
              toastSuccess(`Disalin sebagai ${cloned.indicator.code} (draft)`);
            })}><Copy className="size-3.5" /> Duplikasi</Button>
          </div>
        )}
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="data">Input Data</TabsTrigger>
          <TabsTrigger value="trend">Trend</TabsTrigger>
          <TabsTrigger value="analisis">Analisis Unit</TabsTrigger>
          <TabsTrigger value="versi">Versi</TabsTrigger>
        </TabsList>

        {/* ── Overview ────────────────────────────────────────── */}
        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Identitas & Definisi Operasional</CardTitle></CardHeader>
            <CardContent className="space-y-1">
              <Row label="Deskripsi" value={indicator.description} />
              <Row label="Tujuan" value={indicator.purpose} />
              <Row label="PIC" value={indicator.picName} />
              <Row label="Unit" value={indicator.isAllUnits ? 'Semua Unit' : assignedUnits.join(', ')} />
              <Row label="Definisi Operasional" value={currentVersion?.operationalDefinition} />
              <Row label="Numerator" value={currentVersion?.numeratorLabel} />
              <Row label="Denominator" value={currentVersion?.denominatorLabel} />
              <Row label="Kriteria Inklusi" value={currentVersion?.inclusionCriteria} />
              <Row label="Kriteria Eksklusi" value={currentVersion?.exclusionCriteria} />
              <Row label="Sumber Data" value={currentVersion?.sourceOfData} />
              <Row label="Formula" value={currentVersion ? FORMULA_TYPE_OPTIONS.find((o) => o.value === currentVersion.formulaType)?.label : null} />
              <Row label="Target" value={currentVersion?.targetValue !== null && currentVersion?.targetValue !== undefined ? `${TARGET_OPERATOR_OPTIONS.find((o) => o.value === currentVersion.targetOperator)?.label ?? ''} ${currentVersion.targetValue} ${currentVersion.unitOfMeasure ?? ''}` : null} />
              <Row label="Frekuensi" value={currentVersion ? FREQUENCY_OPTIONS.find((o) => o.value === currentVersion.frequency)?.label : null} />
              {indicator.indicatorType === 'priority_rs' && (
                <>
                  <Separator className="my-2" />
                  <Row label="Nomor Prioritas" value={indicator.priorityNumber} />
                  <Row label="Alasan Prioritas" value={indicator.priorityReason} />
                  <Row label="Dasar Penetapan" value={indicator.priorityBasis} />
                </>
              )}
              {indicator.status === 'inactive' && (
                <>
                  <Separator className="my-2" />
                  <Row label="Dinonaktifkan" value={indicator.deactivatedAt ? format(new Date(indicator.deactivatedAt), 'd MMM yyyy', { locale: idLocale }) : null} />
                  <Row label="Alasan" value={DEACTIVATION_REASON_OPTIONS.find((o) => o.value === indicator.deactivationReason)?.label} />
                  <Row label="Catatan" value={indicator.deactivationNote} />
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Input Data ──────────────────────────────────────── */}
        <TabsContent value="data" className="space-y-4">
          {indicator.status !== 'active' ? (
            <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Indikator berstatus {STATUS_LABEL[indicator.status]} — tidak dapat menerima data baru.</CardContent></Card>
          ) : currentVersion ? (
            <MeasurementForm indicatorId={indicator.id} version={currentVersion} fields={fields} units={assignedUnits} defaultUnit={selectedUnit} userId={userId} onSaved={load} />
          ) : null}

          <Card>
            <CardHeader><CardTitle className="text-sm">Riwayat Pengukuran</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Tanggal</TableHead><TableHead>Unit</TableHead><TableHead>Periode</TableHead><TableHead className="text-right">Numerator</TableHead><TableHead className="text-right">Denominator</TableHead><TableHead className="text-right">Nilai</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {measurements.slice().reverse().map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="text-xs">{format(new Date(m.measurementDate), 'd MMM yyyy', { locale: idLocale })}</TableCell>
                      <TableCell className="text-xs">{m.unitId}</TableCell>
                      <TableCell className="text-xs">{m.period}</TableCell>
                      <TableCell className="text-right text-xs">{m.numerator ?? '—'}</TableCell>
                      <TableCell className="text-right text-xs">{m.denominator ?? '—'}</TableCell>
                      <TableCell className="text-right text-xs font-medium">{m.value !== null ? m.value.toFixed(2) : '—'}</TableCell>
                      <TableCell>
                        {m.achievementStatus === 'tercapai' && <Badge variant="outline" style={{ borderColor: '#22c55e', color: '#22c55e' }} className="text-[10px] gap-1"><CheckCircle2 className="size-3" /> Tercapai</Badge>}
                        {m.achievementStatus === 'tidak_tercapai' && <Badge variant="outline" style={{ borderColor: '#ef4444', color: '#ef4444' }} className="text-[10px] gap-1"><XCircle className="size-3" /> Tidak Tercapai</Badge>}
                      </TableCell>
                    </TableRow>
                  ))}
                  {measurements.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Belum ada data.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Trend ───────────────────────────────────────────── */}
        <TabsContent value="trend">
          <TrendChart measurements={measurements} target={currentVersion?.targetValue ?? null} units={assignedUnits} />
        </TabsContent>

        {/* ── Analisis Unit ─────────────────────────────────────── */}
        <TabsContent value="analisis">
          <UnitAnalysis measurements={measurements} units={assignedUnits} isComparable={indicator.isComparableAcrossUnits} target={currentVersion?.targetValue ?? null} operator={currentVersion?.targetOperator ?? null} />
        </TabsContent>

        {/* ── Versi ─────────────────────────────────────────────── */}
        <TabsContent value="versi" className="space-y-4">
          {isManager && currentVersion && (
            <NewVersionForm indicatorId={indicator.id} current={currentVersion} userId={userId} onDone={load} />
          )}
          <Card>
            <CardHeader><CardTitle className="text-sm">Riwayat Versi ({allVersions.length})</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {allVersions.slice().reverse().map((v) => (
                <div key={v.id} className="border rounded-lg p-3 text-sm space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium flex items-center gap-1.5"><GitBranch className="size-3.5" /> Versi {v.versionNumber}</span>
                    <span className="text-xs text-muted-foreground">{v.effectiveFrom} {v.effectiveTo ? `s/d ${v.effectiveTo}` : '(berlaku saat ini)'}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Target: {v.targetValue ?? '—'} {v.unitOfMeasure ?? ''} · Formula: {FORMULA_TYPE_OPTIONS.find((o) => o.value === v.formulaType)?.label}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className="grid grid-cols-3 gap-2 py-1.5 text-sm border-b last:border-0">
      <span className="text-muted-foreground col-span-1">{label}</span>
      <span className="col-span-2">{value}</span>
    </div>
  );
}

function DeactivateButton({ indicatorId, userId, busy, onDone }: { indicatorId: string; userId: string; busy: boolean; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  if (!open) return <Button size="sm" variant="outline" className="gap-1.5" disabled={busy} onClick={() => setOpen(true)}><PowerOff className="size-3.5" /> Nonaktifkan</Button>;

  return (
    <Card className="w-full">
      <CardContent className="pt-4 space-y-2">
        <p className="text-sm font-medium">Nonaktifkan indikator ini?</p>
        <p className="text-xs text-muted-foreground">Indikator ini akan dinonaktifkan dan tidak dapat menerima data baru. Seluruh data historis tetap tersimpan.</p>
        <Select value={reason} onValueChange={setReason}>
          <SelectTrigger className="h-9"><SelectValue placeholder="Pilih alasan" /></SelectTrigger>
          <SelectContent>{DEACTIVATION_REASON_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
        </Select>
        <Textarea placeholder="Catatan alasan (opsional)" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setOpen(false)}>Batal</Button>
          <Button size="sm" variant="destructive" disabled={!reason || saving} onClick={async () => {
            setSaving(true);
            try {
              await deactivateCustomIndicator({ id: indicatorId, reason: reason as any, note, actorId: userId });
              toastSuccess('Indikator dinonaktifkan');
              setOpen(false);
              onDone();
            } catch (err) {
              toastError('Gagal menonaktifkan', { description: err instanceof Error ? err.message : undefined });
            } finally { setSaving(false); }
          }}>{saving ? <Loader2 className="size-4 animate-spin" /> : 'Nonaktifkan'}</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function TrendChart({ measurements, target, units }: { measurements: CustomIndicatorMeasurement[]; target: number | null; units: string[] }) {
  const [unit, setUnit] = useState(units[0] ?? '');
  const rows = measurements.filter((m) => m.unitId === unit).sort((a, b) => a.period.localeCompare(b.period));

  const data = {
    labels: rows.map((r) => r.period),
    datasets: [
      { label: 'Capaian', data: rows.map((r) => r.value), borderColor: '#4f8ef7', backgroundColor: '#4f8ef7', tension: 0.3 },
      ...(target !== null ? [{ label: 'Target', data: rows.map(() => target), borderColor: '#ef4444', borderDash: [6, 4], pointRadius: 0 }] : []),
    ],
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm">Trend Capaian</CardTitle>
        <Select value={unit} onValueChange={setUnit}>
          <SelectTrigger className="w-[160px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>{units.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? <p className="text-sm text-muted-foreground text-center py-10">Belum ada data untuk unit ini.</p> : (
          <div className="h-72"><Line data={data} options={{ maintainAspectRatio: false, responsive: true }} /></div>
        )}
      </CardContent>
    </Card>
  );
}

function UnitAnalysis({ measurements, units, isComparable, target, operator }: { measurements: CustomIndicatorMeasurement[]; units: string[]; isComparable: boolean; target: number | null; operator: TargetOperator | null }) {
  const rows = units.map((u) => {
    const ms = measurements.filter((m) => m.unitId === u);
    const latest = ms.slice().sort((a, b) => b.measurementDate.localeCompare(a.measurementDate))[0];
    return { unit: u, count: ms.length, latestValue: latest?.value ?? null, status: latest?.achievementStatus ?? null };
  });

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Analisis per Unit {isComparable ? '' : '(perbandingan antarunit dinonaktifkan untuk indikator ini)'}</CardTitle></CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader><TableRow><TableHead>Unit</TableHead><TableHead className="text-right">Jumlah Data</TableHead><TableHead className="text-right">Nilai Terakhir</TableHead><TableHead className="text-right">Target</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.unit}>
                <TableCell>{r.unit}</TableCell>
                <TableCell className="text-right">{r.count}</TableCell>
                <TableCell className="text-right">{r.latestValue !== null ? r.latestValue.toFixed(2) : '—'}</TableCell>
                <TableCell className="text-right">{target ?? '—'}</TableCell>
                <TableCell>
                  {r.status === 'tercapai' && <Badge variant="outline" style={{ borderColor: '#22c55e', color: '#22c55e' }} className="text-[10px]">Tercapai</Badge>}
                  {r.status === 'tidak_tercapai' && <Badge variant="outline" style={{ borderColor: '#ef4444', color: '#ef4444' }} className="text-[10px]">Tidak Tercapai</Badge>}
                  {!r.status && <span className="text-xs text-muted-foreground">—</span>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function NewVersionForm({ indicatorId, current, userId, onDone }: { indicatorId: string; current: NonNullable<CustomIndicatorBundle['currentVersion']>; userId: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [targetValue, setTargetValue] = useState<number | ''>(current.targetValue ?? '');
  const [operationalDefinition, setOperationalDefinition] = useState(current.operationalDefinition ?? '');
  const [saving, setSaving] = useState(false);

  if (!open) return <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setOpen(true)}><GitBranch className="size-3.5" /> Buat Versi Baru</Button>;

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Buat Versi Baru</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">Versi lama tetap tersimpan dan tetap dipakai untuk data historis. Perubahan di bawah hanya berlaku untuk data baru mulai hari ini.</p>
        <div className="space-y-1.5"><Label>Target Baru</Label><Input type="number" value={targetValue} onChange={(e) => setTargetValue(e.target.value === '' ? '' : Number(e.target.value))} /></div>
        <div className="space-y-1.5"><Label>Definisi Operasional</Label><Textarea rows={3} value={operationalDefinition} onChange={(e) => setOperationalDefinition(e.target.value)} /></div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setOpen(false)}>Batal</Button>
          <Button size="sm" disabled={saving} onClick={async () => {
            setSaving(true);
            try {
              await createNewCustomIndicatorVersion({
                indicatorId,
                version: { ...current, targetValue: targetValue === '' ? undefined : Number(targetValue), operationalDefinition },
                fields: [],
                actorId: userId,
              });
              toastSuccess('Versi baru dibuat');
              setOpen(false);
              onDone();
            } catch (err) {
              toastError('Gagal membuat versi baru', { description: err instanceof Error ? err.message : undefined });
            } finally { setSaving(false); }
          }}>{saving ? <Loader2 className="size-4 animate-spin" /> : 'Simpan Versi Baru'}</Button>
        </div>
      </CardContent>
    </Card>
  );
}
