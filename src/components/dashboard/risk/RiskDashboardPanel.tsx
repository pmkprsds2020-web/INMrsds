'use client';

import { useEffect, useMemo, useState } from 'react';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement, LineElement,
  ArcElement, Tooltip as ChartTooltip, Legend as ChartLegend,
} from 'chart.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ShieldAlert, AlertTriangle, TrendingUp, CheckCircle2, Clock, CalendarClock, Loader2,
} from 'lucide-react';
import {
  type RiskFilters, RISK_LEVEL_LABEL, RISK_LEVEL_COLOR, RISK_CATEGORIES, RISK_YEARS,
} from '@/types/risk';
import { subscribeToRisks, getAllRiskMitigations, computeRiskDashboardStats } from '@/lib/riskData';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, ChartTooltip, ChartLegend);

function KpiCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: number | string; color: string }) {
  return (
    <Card>
      <CardContent className="pt-6 flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-lg shrink-0" style={{ backgroundColor: `${color}20`, color }}>
          <Icon className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="text-2xl font-bold leading-none">{value}</p>
          <p className="text-xs text-muted-foreground mt-1 truncate">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function RiskDashboardPanel() {
  const [filters, setFilters] = useState<RiskFilters>({});
  const [rows, setRows] = useState<any[]>([]);
  const [mitigations, setMitigations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const unsub = subscribeToRisks(filters, (data) => { setRows(data); setLoading(false); }, () => setLoading(false));
    getAllRiskMitigations().then(setMitigations);
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(filters)]);

  const stats = useMemo(() => computeRiskDashboardStats(rows, mitigations), [rows, mitigations]);

  const trendYearData = {
    labels: Object.keys(stats.byYear).sort(),
    datasets: [{ label: 'Jumlah Risiko', data: Object.keys(stats.byYear).sort().map((y) => stats.byYear[y]), backgroundColor: '#4f8ef7' }],
  };

  const trendMonthData = {
    labels: stats.byMonth.map((m) => m.month),
    datasets: [{ label: 'Risiko Teridentifikasi', data: stats.byMonth.map((m) => m.count), borderColor: '#f59e0b', backgroundColor: '#f59e0b', tension: 0.3 }],
  };

  const levelData = {
    labels: Object.keys(stats.byLevel).map((k) => RISK_LEVEL_LABEL[k as keyof typeof RISK_LEVEL_LABEL] ?? k),
    datasets: [{ data: Object.values(stats.byLevel), backgroundColor: Object.keys(stats.byLevel).map((k) => RISK_LEVEL_COLOR[k as keyof typeof RISK_LEVEL_COLOR] ?? '#94a3b8') }],
  };

  const unitData = {
    labels: Object.keys(stats.byUnit),
    datasets: [{ label: 'Risiko per Unit', data: Object.values(stats.byUnit), backgroundColor: '#a78bfa' }],
  };

  const categoryData = {
    labels: Object.keys(stats.byCategory).map((k) => RISK_CATEGORIES.find((c) => c.id === k)?.label ?? k),
    datasets: [{ label: 'Risiko per Kategori', data: Object.values(stats.byCategory), backgroundColor: '#38bdf8' }],
  };

  const mitigationStatusData = {
    labels: Object.keys(stats.byMitigationStatus),
    datasets: [{ data: Object.values(stats.byMitigationStatus), backgroundColor: ['#94a3b8', '#38bdf8', '#c084fc', '#22c55e', '#ef4444'] }],
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Dashboard Manajemen Risiko</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={filters.year ? String(filters.year) : 'all'} onValueChange={(v) => setFilters((f) => ({ ...f, year: v === 'all' ? undefined : Number(v) }))}>
            <SelectTrigger className="w-[130px] h-9"><SelectValue placeholder="Tahun" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Semua Tahun</SelectItem>{RISK_YEARS.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={filters.status ?? 'all'} onValueChange={(v) => setFilters((f) => ({ ...f, status: v === 'all' ? undefined : (v as any) }))}>
            <SelectTrigger className="w-[150px] h-9"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Semua Status</SelectItem></SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <KpiCard icon={ShieldAlert} label="Total Risiko" value={stats.total} color="#4f8ef7" />
            <KpiCard icon={TrendingUp} label="Risiko Aktif" value={stats.aktif} color="#a78bfa" />
            <KpiCard icon={AlertTriangle} label="Risiko Sangat Tinggi" value={stats.sangatTinggi} color="#ef4444" />
            <KpiCard icon={AlertTriangle} label="Risiko Tinggi" value={stats.tinggi} color="#fb923c" />
            <KpiCard icon={Clock} label="Belum Ditindaklanjuti" value={stats.belumDitindaklanjuti} color="#f59e0b" />
            <KpiCard icon={AlertTriangle} label="Risiko Sedang" value={stats.sedang} color="#facc15" />
            <KpiCard icon={CheckCircle2} label="Risiko Rendah" value={stats.rendah} color="#4ade80" />
            <KpiCard icon={CheckCircle2} label="Risiko Selesai" value={stats.selesai} color="#22c55e" />
            <KpiCard icon={CalendarClock} label="Melebihi Deadline" value={stats.melebihiDeadline} color="#ef4444" />
          </div>

          {stats.sangatTinggi > 0 && (
            <Card className="border-red-400/50 bg-red-500/5">
              <CardContent className="pt-4 flex items-center gap-3">
                <AlertTriangle className="size-5 text-red-500 shrink-0" />
                <p className="text-sm"><span className="font-semibold">PERHATIAN:</span> Terdapat {stats.sangatTinggi} risiko sangat tinggi yang memerlukan prioritas pengelolaan.</p>
              </CardContent>
            </Card>
          )}

          <div className="grid lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">Distribusi Risiko berdasarkan Level</CardTitle></CardHeader>
              <CardContent><div className="h-64 flex items-center justify-center"><Doughnut data={levelData} options={{ maintainAspectRatio: false, responsive: true }} /></div></CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Distribusi Risiko berdasarkan Unit</CardTitle></CardHeader>
              <CardContent><div className="h-64"><Bar data={unitData} options={{ maintainAspectRatio: false, responsive: true, indexAxis: 'y' as const }} /></div></CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Distribusi Risiko berdasarkan Kategori</CardTitle></CardHeader>
              <CardContent><div className="h-64"><Bar data={categoryData} options={{ maintainAspectRatio: false, responsive: true, indexAxis: 'y' as const }} /></div></CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Trend Risiko per Tahun</CardTitle></CardHeader>
              <CardContent><div className="h-64"><Bar data={trendYearData} options={{ maintainAspectRatio: false, responsive: true }} /></div></CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Trend Risiko per Bulan</CardTitle></CardHeader>
              <CardContent><div className="h-64"><Line data={trendMonthData} options={{ maintainAspectRatio: false, responsive: true }} /></div></CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Status Pengelolaan Risiko (Mitigasi)</CardTitle></CardHeader>
              <CardContent><div className="h-64 flex items-center justify-center"><Doughnut data={mitigationStatusData} options={{ maintainAspectRatio: false, responsive: true }} /></div></CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-sm">Top 10 Risiko dengan Skor Tertinggi</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {stats.top10.length === 0 && <p className="text-xs text-muted-foreground">Belum ada data.</p>}
              {stats.top10.map((r, i) => (
                <div key={r.id} className="flex items-center justify-between gap-3 border-b py-2 last:border-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs font-bold text-muted-foreground w-5 shrink-0">#{i + 1}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{r.risiko}</p>
                      <p className="text-xs text-muted-foreground">{r.unitLokasi} · {r.riskCode}</p>
                    </div>
                  </div>
                  {r.assessment && (
                    <Badge style={{ backgroundColor: RISK_LEVEL_COLOR[r.assessment.levelSkor], color: 'white', border: 'none' }} className="shrink-0">
                      {r.assessment.skorRisiko}
                    </Badge>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
