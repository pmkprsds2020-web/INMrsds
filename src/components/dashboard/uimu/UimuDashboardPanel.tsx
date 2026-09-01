'use client';

import { useEffect, useMemo, useState } from 'react';
import { Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement,
  Tooltip as ChartTooltip, Legend as ChartLegend,
} from 'chart.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  ClipboardList, FileClock, ShieldCheck, CheckCircle2, XCircle, Loader2, Trophy,
} from 'lucide-react';
import {
  UIMU_STATUS_LABEL, UIMU_STATUS_COLOR, PRIORITY_CATEGORY_LABEL, PRIORITY_CATEGORY_COLOR,
  INDICATOR_CATEGORY_OPTIONS, QUALITY_DIMENSION_OPTIONS,
} from '@/types/uimu';
import type { UimuProposal, UimuUnit } from '@/types/uimu';
import { getUimuProposals, getUimuUnits, computeUimuDashboardStats, subscribeToUimuProposals } from '@/lib/uimuData';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, ChartTooltip, ChartLegend);

const CURRENT_YEAR = new Date().getFullYear();

function KpiCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: number | string; color: string }) {
  return (
    <Card>
      <CardContent className="pt-6 flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-lg" style={{ backgroundColor: `${color}20`, color }}>
          <Icon className="size-5" />
        </span>
        <div>
          <p className="text-2xl font-bold leading-none">{value}</p>
          <p className="text-xs text-muted-foreground mt-1">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function UimuDashboardPanel({ onSelect }: { onSelect: (id: string) => void }) {
  const [year, setYear] = useState<number>(CURRENT_YEAR);
  const [rows, setRows] = useState<UimuProposal[]>([]);
  const [units, setUnits] = useState<UimuUnit[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [proposals, unitList] = await Promise.all([
        getUimuProposals({ periodYear: year }),
        getUimuUnits(true),
      ]);
      setRows(proposals);
      setUnits(unitList);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const unsub = subscribeToUimuProposals(() => load());
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

  const stats = useMemo(() => computeUimuDashboardStats(rows, units), [rows, units]);

  const statusData = {
    labels: Object.keys(stats.byStatus).map((k) => UIMU_STATUS_LABEL[k as keyof typeof UIMU_STATUS_LABEL] ?? k),
    datasets: [{ data: Object.values(stats.byStatus), backgroundColor: Object.keys(stats.byStatus).map((k) => UIMU_STATUS_COLOR[k as keyof typeof UIMU_STATUS_COLOR] ?? '#94a3b8') }],
  };

  const unitData = {
    labels: stats.byUnit.map((u) => u.unitName),
    datasets: [{ label: 'Jumlah Usulan', data: stats.byUnit.map((u) => u.total), backgroundColor: '#a78bfa' }],
  };

  const categoryData = {
    labels: Object.keys(stats.byIndicatorCategory).map((k) => INDICATOR_CATEGORY_OPTIONS.find((o) => o.value === k)?.label ?? k),
    datasets: [{ data: Object.values(stats.byIndicatorCategory), backgroundColor: ['#38bdf8', '#facc15', '#f87171', '#94a3b8'] }],
  };

  const dimensionData = {
    labels: Object.keys(stats.byQualityDimension).map((k) => QUALITY_DIMENSION_OPTIONS.find((o) => o.value === k)?.label ?? k),
    datasets: [{ label: 'Jumlah', data: Object.values(stats.byQualityDimension), backgroundColor: '#4f8ef7' }],
  };

  const yearOptions = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - 2 + i);

  return (
    <div className="p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Dashboard Usulan Indikator Mutu Unit</h2>
        <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
          <SelectTrigger className="w-[120px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            {yearOptions.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <KpiCard icon={ClipboardList} label="Total Usulan" value={stats.total} color="#4f8ef7" />
            <KpiCard icon={FileClock} label="Draft" value={stats.byStatus.draft ?? 0} color="#94a3b8" />
            <KpiCard icon={ShieldCheck} label="Dalam Review/Telaah" value={(stats.byStatus.review_unit ?? 0) + (stats.byStatus.telaah_mutu ?? 0)} color="#f59e0b" />
            <KpiCard icon={XCircle} label="Revisi/Dikembalikan" value={(stats.byStatus.revisi ?? 0) + (stats.byStatus.dikembalikan ?? 0)} color="#f87171" />
            <KpiCard icon={CheckCircle2} label="Ditetapkan/Aktif" value={(stats.byStatus.ditetapkan ?? 0) + (stats.byStatus.aktif ?? 0)} color="#22c55e" />
            <KpiCard icon={Trophy} label="Prioritas" value={stats.priorityCount.prioritas} color="#ef4444" />
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">Status Usulan Indikator Mutu Unit</CardTitle></CardHeader>
              <CardContent><div className="h-64 flex items-center justify-center"><Doughnut data={statusData} options={{ maintainAspectRatio: false, responsive: true }} /></div></CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Jumlah Usulan per Unit</CardTitle></CardHeader>
              <CardContent><div className="h-64"><Bar data={unitData} options={{ maintainAspectRatio: false, responsive: true, indexAxis: 'y' as const }} /></div></CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Distribusi Berdasarkan Jenis Indikator</CardTitle></CardHeader>
              <CardContent><div className="h-64 flex items-center justify-center"><Doughnut data={categoryData} options={{ maintainAspectRatio: false, responsive: true }} /></div></CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Distribusi Berdasarkan Dimensi Mutu</CardTitle></CardHeader>
              <CardContent><div className="h-64"><Bar data={dimensionData} options={{ maintainAspectRatio: false, responsive: true }} /></div></CardContent>
            </Card>
          </div>

          {/* Status Usulan Indikator Mutu Seluruh Unit (poin 27) */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Status Usulan Indikator Mutu Seluruh Unit</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Unit</TableHead>
                    <TableHead className="text-right">Jumlah Usulan</TableHead>
                    <TableHead className="text-right">Disetujui</TableHead>
                    <TableHead className="text-right">Revisi</TableHead>
                    <TableHead className="text-right">Ditolak</TableHead>
                    <TableHead className="text-right">Ditetapkan</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.byUnit.map((u) => (
                    <TableRow key={u.unitId} className="cursor-pointer hover:bg-muted/40">
                      <TableCell className="font-medium">{u.unitName}</TableCell>
                      <TableCell className="text-right">{u.total}</TableCell>
                      <TableCell className="text-right">{u.disetujui}</TableCell>
                      <TableCell className="text-right">{u.revisi}</TableCell>
                      <TableCell className="text-right">{u.ditolak}</TableCell>
                      <TableCell className="text-right">{u.ditetapkan}</TableCell>
                    </TableRow>
                  ))}
                  {stats.byUnit.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Belum ada usulan pada tahun {year}</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Indikator prioritas — poin 10 */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Indikator Prioritas</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {rows
                .filter((r) => (r.totalScore ?? 0) > 0)
                .sort((a, b) => (b.totalScore ?? 0) - (a.totalScore ?? 0))
                .slice(0, 8)
                .map((r) => (
                  <button
                    key={r.id}
                    onClick={() => onSelect(r.id)}
                    className="w-full flex items-center justify-between gap-2 rounded-lg border p-2.5 text-left hover:bg-muted/40"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{r.indicatorName || '(Belum diberi nama)'}</p>
                      <p className="text-xs text-muted-foreground truncate">{r.proposalNumber} · {r.unitNameSnapshot}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" style={{ borderColor: PRIORITY_CATEGORY_COLOR.prioritas, color: PRIORITY_CATEGORY_COLOR.prioritas }} className="text-[10px]">
                        Skor {r.totalScore}
                      </Badge>
                    </div>
                  </button>
                ))}
              {rows.filter((r) => (r.totalScore ?? 0) > 0).length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-4">Belum ada usulan dengan skor prioritas terisi.</p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
