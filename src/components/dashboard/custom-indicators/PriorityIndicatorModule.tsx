'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Loader2, Trophy, CheckCircle2, XCircle } from 'lucide-react';
import {
  type CustomIndicator, type CustomIndicatorBundle, type CustomIndicatorMeasurement,
  STATUS_COLOR, FORMULA_TYPE_OPTIONS, TARGET_OPERATOR_OPTIONS,
} from '@/types/customIndicators';
import {
  getActivePriorityIndicatorsForUnit, getCustomIndicatorBundle, getCustomIndicatorMeasurements,
  subscribeToCustomIndicators, subscribeToCustomIndicatorMeasurements,
} from '@/lib/customIndicatorData';
import { MeasurementForm } from './MeasurementForm';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale/id';

/**
 * Modul "Indikator Mutu Prioritas" — padanan "Indikator Mutu Unit" tapi
 * untuk indikator bertipe Prioritas RS. TERPISAH dari "Master Indikator
 * Mutu" (kelola/CRUD, untuk komite_mutu/admin/manajemen). Modul ini untuk
 * PIC: hanya menampilkan indikator custom bertipe 'priority_rs' yang
 * berstatus AKTIF dan berlaku untuk unit yang sedang aktif (is_all_units,
 * atau ditugaskan khusus ke unit itu sebagai "unit yang berpartisipasi").
 *
 * Otomatis mengikuti status di Master Indikator Mutu: begitu komite_mutu/
 * admin menonaktifkan sebuah indikator prioritas, baris itu tidak lagi
 * dikembalikan oleh getActivePriorityIndicatorsForUnit() sehingga hilang
 * dari daftar di sini pada refresh/subscription berikutnya — tidak perlu
 * langkah manual apa pun.
 *
 * activeTab yang dikenali: 'priority-ind-home' (daftar) atau
 * 'priority-ind-<uuid>' (form input untuk satu indikator).
 */
interface PriorityIndicatorModuleProps {
  activeTab: string;
  userId: string;
  userName: string;
  activeUnit: string;
  onNavigate: (tab: string) => void;
}

export function PriorityIndicatorModule({ activeTab, userId, userName, activeUnit, onNavigate }: PriorityIndicatorModuleProps) {
  const indicatorId = activeTab.startsWith('priority-ind-') && activeTab !== 'priority-ind-home' ? activeTab.slice('priority-ind-'.length) : null;

  if (indicatorId) {
    return <PriorityIndicatorEntryPanel indicatorId={indicatorId} userId={userId} activeUnit={activeUnit} onBack={() => onNavigate('priority-ind-home')} />;
  }
  return <PriorityIndicatorHome activeUnit={activeUnit} onSelect={(id) => onNavigate(`priority-ind-${id}`)} />;
}

function PriorityIndicatorHome({ activeUnit, onSelect }: { activeUnit: string; onSelect: (id: string) => void }) {
  const [rows, setRows] = useState<CustomIndicator[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!activeUnit || activeUnit === 'all') { setRows([]); setLoading(false); return; }
    setLoading(true);
    try { setRows(await getActivePriorityIndicatorsForUnit(activeUnit)); } finally { setLoading(false); }
  }

  useEffect(() => {
    load();
    const unsub = subscribeToCustomIndicators(() => load());
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeUnit]);

  return (
    <div className="p-4 space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Indikator Mutu Prioritas</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Indikator Prioritas RS yang aktif dan berlaku untuk unit <span className="font-medium">{activeUnit || '—'}</span>. Pilih indikator untuk input data.
        </p>
      </div>

      {!activeUnit || activeUnit === 'all' ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Pilih unit kerja terlebih dahulu (lewat pengalih unit di kiri atas) untuk melihat indikator prioritas yang berlaku bagi unit Anda.</CardContent></Card>
      ) : loading ? (
        <div className="flex justify-center py-16"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-16 flex flex-col items-center gap-2 text-center">
            <Trophy className="size-8 text-muted-foreground" />
            <p className="text-sm font-medium">Belum ada Indikator Prioritas RS yang aktif untuk {activeUnit}.</p>
            <p className="text-xs text-muted-foreground max-w-sm">Indikator akan otomatis muncul di sini setelah dibuat dan diaktifkan oleh Komite Mutu/Manajemen lewat menu Master Indikator Mutu.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {rows.slice().sort((a, b) => (a.priorityNumber ?? 999) - (b.priorityNumber ?? 999)).map((r) => (
            <button key={r.id} onClick={() => onSelect(r.id)} className="text-left rounded-lg border p-3 hover:bg-muted/40 transition-colors space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[10px] text-muted-foreground">{r.code}</span>
                {r.priorityNumber != null ? (
                  <Badge variant="outline" style={{ borderColor: STATUS_COLOR[r.status], color: STATUS_COLOR[r.status] }} className="text-[10px]">Prioritas #{r.priorityNumber}</Badge>
                ) : (
                  <Badge variant="outline" style={{ borderColor: STATUS_COLOR[r.status], color: STATUS_COLOR[r.status] }} className="text-[10px]">{r.isAllUnits ? 'Semua Unit' : 'Unit Terpilih'}</Badge>
                )}
              </div>
              <p className="text-sm font-medium">{r.name}</p>
              <p className="text-xs text-muted-foreground">{r.category}{r.picName ? ` · PIC: ${r.picName}` : ''}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PriorityIndicatorEntryPanel({ indicatorId, userId, activeUnit, onBack }: { indicatorId: string; userId: string; activeUnit: string; onBack: () => void }) {
  const [bundle, setBundle] = useState<CustomIndicatorBundle | null>(null);
  const [measurements, setMeasurements] = useState<CustomIndicatorMeasurement[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const b = await getCustomIndicatorBundle(indicatorId);
      setBundle(b);
      if (b) setMeasurements(await getCustomIndicatorMeasurements({ indicatorId, unitId: activeUnit }));
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [indicatorId, activeUnit]);
  useEffect(() => {
    const unsub = subscribeToCustomIndicatorMeasurements(indicatorId, () => {
      getCustomIndicatorMeasurements({ indicatorId, unitId: activeUnit }).then(setMeasurements);
    });
    return unsub;
  }, [indicatorId, activeUnit]);

  const visibleToThisUnit = useMemo(() => {
    if (!bundle) return false;
    return bundle.indicator.isAllUnits || bundle.units.some((u) => u.unitId === activeUnit && u.isActive);
  }, [bundle, activeUnit]);

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;

  if (!bundle || bundle.indicator.status !== 'active' || bundle.indicator.indicatorType !== 'priority_rs' || !visibleToThisUnit) {
    return (
      <div className="p-4 space-y-4 max-w-3xl">
        <Button size="sm" variant="ghost" className="gap-1.5" onClick={onBack}><ArrowLeft className="size-4" /> Kembali</Button>
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
          Indikator prioritas ini sudah tidak aktif atau tidak lagi berlaku untuk unit {activeUnit}. Kembali ke daftar untuk melihat indikator yang masih aktif.
        </CardContent></Card>
      </div>
    );
  }

  const { indicator, currentVersion, fields } = bundle;

  return (
    <div className="p-4 space-y-4 max-w-3xl">
      <div className="flex items-center justify-between gap-2">
        <Button size="sm" variant="ghost" className="gap-1.5" onClick={onBack}><ArrowLeft className="size-4" /> Kembali</Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Trophy className="size-4 text-amber-500" />
              {indicator.name}
              {indicator.priorityNumber != null && <Badge variant="outline" className="text-[10px]">Prioritas #{indicator.priorityNumber}</Badge>}
            </CardTitle>
            <span className="font-mono text-xs text-muted-foreground">{indicator.code}</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          {currentVersion?.operationalDefinition && <p className="text-muted-foreground">{currentVersion.operationalDefinition}</p>}
          {indicator.priorityReason && <p className="text-xs text-muted-foreground"><span className="font-medium">Alasan prioritas:</span> {indicator.priorityReason}</p>}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground pt-1">
            {currentVersion && <span>Formula: {FORMULA_TYPE_OPTIONS.find((o) => o.value === currentVersion.formulaType)?.label}</span>}
            {currentVersion?.targetValue !== null && currentVersion?.targetValue !== undefined && (
              <span>Target: {TARGET_OPERATOR_OPTIONS.find((o) => o.value === currentVersion.targetOperator)?.label} {currentVersion.targetValue} {currentVersion.unitOfMeasure ?? ''}</span>
            )}
            {currentVersion && <span>Frekuensi: {currentVersion.frequency}</span>}
          </div>
        </CardContent>
      </Card>

      {currentVersion && (
        <MeasurementForm indicatorId={indicator.id} version={currentVersion} fields={fields} units={[activeUnit]} defaultUnit={activeUnit} userId={userId} onSaved={load} compact />
      )}

      <Card>
        <CardHeader><CardTitle className="text-sm">Riwayat Input — {activeUnit}</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Tanggal</TableHead><TableHead>Periode</TableHead><TableHead className="text-right">Nilai</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {measurements.slice().reverse().map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="text-xs">{format(new Date(m.measurementDate), 'd MMM yyyy', { locale: idLocale })}</TableCell>
                  <TableCell className="text-xs">{m.period}</TableCell>
                  <TableCell className="text-right text-xs font-medium">{m.value !== null ? m.value.toFixed(2) : '—'}</TableCell>
                  <TableCell>
                    {m.achievementStatus === 'tercapai' && <Badge variant="outline" style={{ borderColor: '#22c55e', color: '#22c55e' }} className="text-[10px] gap-1"><CheckCircle2 className="size-3" /> Tercapai</Badge>}
                    {m.achievementStatus === 'tidak_tercapai' && <Badge variant="outline" style={{ borderColor: '#ef4444', color: '#ef4444' }} className="text-[10px] gap-1"><XCircle className="size-3" /> Tidak Tercapai</Badge>}
                  </TableCell>
                </TableRow>
              ))}
              {measurements.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Belum ada data untuk unit ini.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
