'use client';

import { useEffect, useMemo, useState } from 'react';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement, LineElement,
  ArcElement, Tooltip as ChartTooltip, Legend as ChartLegend,
} from 'chart.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  ClipboardList, CalendarClock, AlarmClock, Search as SearchIcon, CheckCircle2, Loader2,
} from 'lucide-react';
import {
  type IkpFilters, IKP_STATUS_LABEL, IKP_INCIDENT_TYPES, IKP_SEVERITY_GRADES, IKP_PATIENT_IMPACTS,
} from '@/types/ikp';
import { subscribeToIkpIncidents, computeIkpDashboardStats } from '@/lib/ikpData';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, ChartTooltip, ChartLegend);

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

export function IkpDashboardPanel() {
  const [filters, setFilters] = useState<IkpFilters>({ dateField: 'incident' });
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const unsub = subscribeToIkpIncidents(filters, (data) => { setRows(data); setLoading(false); }, () => setLoading(false));
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(filters)]);

  const stats = useMemo(() => computeIkpDashboardStats(rows), [rows]);

  const trendData = {
    labels: stats.byMonth.map((m) => m.month),
    datasets: [{ label: 'Jumlah Insiden', data: stats.byMonth.map((m) => m.count), backgroundColor: '#4f8ef7', borderColor: '#4f8ef7', tension: 0.3 }],
  };

  const typeData = {
    labels: Object.keys(stats.byType).map((k) => IKP_INCIDENT_TYPES.find((t) => t.id === k)?.label.split(' — ')[0] ?? k),
    datasets: [{ data: Object.values(stats.byType), backgroundColor: ['#38bdf8', '#facc15', '#f87171'] }],
  };

  const severityData = {
    labels: Object.keys(stats.bySeverity).map((k) => IKP_SEVERITY_GRADES.find((g) => g.id === k)?.label ?? k),
    datasets: [{ data: Object.values(stats.bySeverity), backgroundColor: Object.keys(stats.bySeverity).map((k) => IKP_SEVERITY_GRADES.find((g) => g.id === k)?.color ?? '#94a3b8') }],
  };

  const unitData = {
    labels: Object.keys(stats.byUnit),
    datasets: [{ label: 'Insiden per Unit', data: Object.values(stats.byUnit), backgroundColor: '#a78bfa' }],
  };

  const impactData = {
    labels: Object.keys(stats.byImpact).map((k) => IKP_PATIENT_IMPACTS.find((p) => p.id === k)?.label ?? k),
    datasets: [{ data: Object.values(stats.byImpact), backgroundColor: ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e'] }],
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Dashboard Insiden Keselamatan Pasien</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Input type="date" className="h-9 w-[150px]" value={filters.startDate ?? ''} onChange={(e) => setFilters((f) => ({ ...f, startDate: e.target.value }))} />
          <span className="text-xs text-muted-foreground">s/d</span>
          <Input type="date" className="h-9 w-[150px]" value={filters.endDate ?? ''} onChange={(e) => setFilters((f) => ({ ...f, endDate: e.target.value }))} />
          <Select value={filters.status ?? 'all'} onValueChange={(v) => setFilters((f) => ({ ...f, status: v === 'all' ? undefined : (v as any) }))}>
            <SelectTrigger className="w-[150px] h-9"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Status</SelectItem>
              {Object.entries(IKP_STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <KpiCard icon={ClipboardList} label="Total Insiden" value={stats.total} color="#4f8ef7" />
            <KpiCard icon={CalendarClock} label="Bulan Berjalan" value={stats.bulanIni} color="#a78bfa" />
            <KpiCard icon={SearchIcon} label="Belum Ditindaklanjuti" value={stats.belumDitindaklanjuti} color="#f59e0b" />
            <KpiCard icon={AlarmClock} label="Sedang Investigasi" value={stats.sedangInvestigasi} color="#fb923c" />
            <KpiCard icon={CheckCircle2} label="Selesai" value={stats.selesai} color="#22c55e" />
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">Tren Jumlah Insiden per Bulan</CardTitle></CardHeader>
              <CardContent><div className="h-64"><Line data={trendData} options={{ maintainAspectRatio: false, responsive: true }} /></div></CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Distribusi Berdasarkan Unit</CardTitle></CardHeader>
              <CardContent><div className="h-64"><Bar data={unitData} options={{ maintainAspectRatio: false, responsive: true, indexAxis: 'y' as const }} /></div></CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Distribusi Berdasarkan Jenis Insiden</CardTitle></CardHeader>
              <CardContent><div className="h-64 flex items-center justify-center"><Doughnut data={typeData} options={{ maintainAspectRatio: false, responsive: true }} /></div></CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Distribusi Berdasarkan Grading Risiko</CardTitle></CardHeader>
              <CardContent><div className="h-64 flex items-center justify-center"><Doughnut data={severityData} options={{ maintainAspectRatio: false, responsive: true }} /></div></CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Distribusi Berdasarkan Akibat Terhadap Pasien</CardTitle></CardHeader>
              <CardContent><div className="h-64 flex items-center justify-center"><Doughnut data={impactData} options={{ maintainAspectRatio: false, responsive: true }} /></div></CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
