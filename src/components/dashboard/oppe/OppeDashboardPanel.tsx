'use client';

import { useEffect, useMemo, useState } from 'react';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, PointElement, LineElement,
  Tooltip as ChartTooltip, Legend as ChartLegend, Filler,
} from 'chart.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Users, ClipboardList, CheckCircle2, Loader2, CircleDashed, Award, Wrench, XCircle, AlertTriangle, Microscope,
  LayoutDashboard, Bell, RefreshCw, Clock,
} from 'lucide-react';
import {
  OPPE_STATUS_LABEL, OPPE_PERIOD_LABEL, periodSortKey,
  type OppeEvaluation, type OppeDoctor, type OppeFppe, type OppeEvaluationStatus, type OppePeriodType,
} from '@/types/oppe';
import { getOppeEvaluations, getAllActiveOppeDoctors, getOppeFppeList, subscribeToOppe, friendlyOppeError } from '@/lib/oppeData';
import { fmtNum, round2 } from '@/lib/oppeScoring';
import {
  OppeKpiCard, OppeLoading, OppeErrorState, OppePageHeader, OppeStatusBadge, OppeCategoryBadge, ALL, YEAR_OPTIONS, CURRENT_YEAR, fmtDate,
  type OppeMasters,
} from './OppeShared';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, PointElement, LineElement, ChartTooltip, ChartLegend, Filler);

const CHART_OPTS = { maintainAspectRatio: false, responsive: true } as const;
const PALETTE = ['#4f8ef7', '#22c55e', '#f59e0b', '#ef4444', '#a78bfa', '#14b8a6', '#f472b6', '#94a3b8', '#eab308', '#38bdf8', '#fb7185', '#84cc16'];

function periodKeyLabel(e: OppeEvaluation): { key: number; label: string } {
  return { key: periodSortKey(e), label: e.periodType === 'custom' ? `Custom ${e.year}` : `${e.year} ${e.periodType === 'semester_1' ? 'S-I' : e.periodType === 'semester_2' ? 'S-II' : 'Thn'}` };
}

const avg = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x !== null && x !== undefined);
  return v.length ? round2(v.reduce((a, b) => a + b, 0) / v.length) : null;
};

interface Props {
  masters: OppeMasters;
  onOpenEvaluation: (id: string) => void;
  onNavigate: (tab: string) => void;
}

export function OppeDashboardPanel({ masters, onOpenEvaluation, onNavigate }: Props) {
  const [year, setYear] = useState<string>(String(CURRENT_YEAR));
  const [semester, setSemester] = useState<string>(ALL);
  const [ksmId, setKsmId] = useState<string>(ALL);
  const [doctorId, setDoctorId] = useState<string>(ALL);
  const [profession, setProfession] = useState<string>(ALL);
  const [unitId, setUnitId] = useState<string>(ALL);
  const [status, setStatus] = useState<string>(ALL);
  const [category, setCategory] = useState<string>(ALL);

  const [all, setAll] = useState<OppeEvaluation[]>([]);
  const [doctors, setDoctors] = useState<OppeDoctor[]>([]);
  const [fppe, setFppe] = useState<OppeFppe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load(force = false) {
    setLoading(true);
    setError(null);
    try {
      // Semua periode (dibatasi filter non-periode) -> dipakai untuk tren; subset periode terpilih dihitung di klien.
      const [ev, docs, fp] = await Promise.all([
        getOppeEvaluations({
          ksmId: ksmId === ALL ? undefined : ksmId,
          doctorId: doctorId === ALL ? undefined : doctorId,
          profession: profession === ALL ? undefined : profession,
          unitId: unitId === ALL ? undefined : unitId,
        }),
        getAllActiveOppeDoctors(force),
        getOppeFppeList({ ksmId: ksmId === ALL ? undefined : ksmId, doctorId: doctorId === ALL ? undefined : doctorId }),
      ]);
      setAll(ev.rows);
      setDoctors(docs);
      setFppe(fp);
    } catch (e) {
      setError(friendlyOppeError(e, 'Dashboard OPPE gagal dimuat. Silakan coba kembali.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const unsub = subscribeToOppe(() => load());
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ksmId, doctorId, profession, unitId]);

  const resultCats = useMemo(() => [...masters.settings.resultCategories].sort((a, b) => b.min - a.min), [masters.settings.resultCategories]);
  // Pemetaan KPI "Baik / Perlu Perbaikan / Tidak Memenuhi" ke kategori configurable:
  // kategori terendah = Tidak Memenuhi, kedua terendah = Perlu Perbaikan, sisanya = Baik.
  const lowest = resultCats[resultCats.length - 1];
  const secondLowest = resultCats.length >= 3 ? resultCats[resultCats.length - 2] : null;
  const goodCodes = resultCats.filter((c) => c !== lowest && c !== secondLowest).map((c) => c.code);

  const inPeriod = useMemo(() => all.filter((e) => {
    if (year !== ALL && e.year !== Number(year)) return false;
    if (semester !== ALL) {
      if (semester === 'tahunan' ? e.periodType !== 'tahunan' : e.periodType !== semester) return false;
    }
    if (status !== ALL && e.status !== status) return false;
    if (category !== ALL && e.finalCategory !== category) return false;
    return true;
  }), [all, year, semester, status, category]);

  const scoped = inPeriod.filter((e) => e.finalScore !== null);
  const filteredDoctors = doctors.filter((d) =>
    (ksmId === ALL || d.ksmId === ksmId) && (profession === ALL || d.profession === profession) &&
    (unitId === ALL || d.unitId === unitId) && (doctorId === ALL || d.id === doctorId));
  const evaluatedDoctorIds = new Set(inPeriod.filter((e) => !(e.status === 'draft' && e.metCount + e.attentionCount + e.triggerCount === 0)).map((e) => e.doctorId));
  const notEvaluated = filteredDoctors.filter((d) => !evaluatedDoctorIds.has(d.id));
  const fppeEvalIds = new Set(fppe.map((f) => f.evaluationId).filter(Boolean));

  const kpi = {
    doctors: filteredDoctors.length,
    total: inPeriod.length,
    done: inPeriod.filter((e) => e.status === 'finalized').length,
    inProcess: inPeriod.filter((e) => ['in_progress', 'submitted', 'reviewed', 'approved'].includes(e.status)).length,
    notEvaluated: notEvaluated.length,
    good: scoped.filter((e) => goodCodes.includes(e.finalCategory ?? '')).length,
    improve: secondLowest ? scoped.filter((e) => e.finalCategory === secondLowest.code).length : 0,
    fail: lowest ? scoped.filter((e) => e.finalCategory === lowest.code).length : 0,
    withTrigger: inPeriod.filter((e) => e.triggerCount > 0).length,
    needFppe: new Set(inPeriod.filter((e) => e.requiresFppe).map((e) => e.doctorId)).size,
  };

  // ── Grafik ────────────────────────────────────────────────────
  const periods = useMemo(() => {
    const m = new Map<number, { label: string; rows: OppeEvaluation[] }>();
    for (const e of all) {
      if (status !== ALL && e.status !== status) continue;
      const { key, label } = periodKeyLabel(e);
      if (!m.has(key)) m.set(key, { label, rows: [] });
      m.get(key)!.rows.push(e);
    }
    return Array.from(m.entries()).sort((a, b) => a[0] - b[0]).map(([, v]) => v);
  }, [all, status]);

  const distData = {
    labels: resultCats.map((c) => c.label),
    datasets: [{ data: resultCats.map((c) => scoped.filter((e) => e.finalCategory === c.code).length), backgroundColor: resultCats.map((c) => c.color) }],
  };
  const trendData = {
    labels: periods.map((p) => p.label),
    datasets: [{ label: 'Rata-rata skor OPPE', data: periods.map((p) => avg(p.rows.map((r) => r.finalScore))), borderColor: '#4f8ef7', backgroundColor: '#4f8ef720', fill: true, tension: 0.3 }],
  };

  const ksmRows = useMemo(() => {
    const m = new Map<string, OppeEvaluation[]>();
    for (const e of inPeriod) {
      const k = e.ksmName ?? 'Tanpa KSM';
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(e);
    }
    return Array.from(m.entries()).map(([name, rows]) => {
      const items = rows.reduce((s, r) => s + r.metCount + r.attentionCount + r.triggerCount, 0);
      const met = rows.reduce((s, r) => s + r.metCount, 0);
      return {
        name,
        avg: avg(rows.map((r) => r.finalScore)),
        a: avg(rows.map((r) => r.scoreProfessional)),
        b: avg(rows.map((r) => r.scoreDevelopment)),
        c: avg(rows.map((r) => r.scoreClinical)),
        doctors: new Set(rows.map((r) => r.doctorId)).size,
        triggers: rows.reduce((s, r) => s + r.triggerCount, 0),
        fppe: rows.filter((r) => r.requiresFppe || fppeEvalIds.has(r.id)).length,
        pctMet: items ? round2((met / items) * 100) : null,
      };
    }).sort((x, y) => (y.avg ?? -1) - (x.avg ?? -1));
  }, [inPeriod, fppeEvalIds]);

  const ksmBar = (key: 'avg' | 'a' | 'b' | 'c', label: string, color: string) => ({
    labels: ksmRows.map((k) => k.name.replace(/^KSM\s+/i, '')),
    datasets: [{ label, data: ksmRows.map((k) => k[key]), backgroundColor: color }],
  });
  const scoreScale = { scales: { y: { min: 0, max: 100 } } };

  const triggerData = {
    labels: periods.map((p) => p.label),
    datasets: [
      { label: 'Jumlah indikator trigger', data: periods.map((p) => p.rows.reduce((s, r) => s + r.triggerCount, 0)), backgroundColor: '#ef4444' },
      { label: 'Trigger indikator kritis', data: periods.map((p) => p.rows.reduce((s, r) => s + r.criticalTriggerCount, 0)), backgroundColor: '#7f1d1d' },
    ],
  };
  const fppeData = {
    labels: periods.map((p) => p.label),
    datasets: [
      { label: 'Rekomendasi FPPE', data: periods.map((p) => p.rows.filter((r) => r.requiresFppe).length), backgroundColor: '#f59e0b' },
      { label: 'FPPE dibuat', data: periods.map((p) => p.rows.filter((r) => fppeEvalIds.has(r.id)).length), backgroundColor: '#a78bfa' },
    ],
  };
  const doctorCompare = [...scoped].sort((a, b) => (b.finalScore ?? 0) - (a.finalScore ?? 0)).slice(0, 20);
  const doctorData = {
    labels: doctorCompare.map((e) => `${e.doctorName ?? '?'} (${periodKeyLabel(e).label})`),
    datasets: [{ label: 'Skor akhir', data: doctorCompare.map((e) => e.finalScore), backgroundColor: doctorCompare.map((e) => masters.settings.resultCategories.find((c) => c.code === e.finalCategory)?.color ?? '#94a3b8') }],
  };
  const complianceData = {
    labels: periods.map((p) => p.label),
    datasets: [{
      label: '% indikator memenuhi target',
      data: periods.map((p) => {
        const items = p.rows.reduce((s, r) => s + r.metCount + r.attentionCount + r.triggerCount, 0);
        return items ? round2((p.rows.reduce((s, r) => s + r.metCount, 0) / items) * 100) : null;
      }),
      borderColor: '#22c55e', backgroundColor: '#22c55e20', fill: true, tension: 0.3,
    }],
  };

  // ── Notifikasi (poin 40) — dihitung dari data, tanpa tabel baru ──
  const today = new Date().toISOString().slice(0, 10);
  const soon = new Date(Date.now() + masters.settings.dueReminderDays * 86400000).toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  type Notif = { id: string; kind: string; color: string; text: string; evalId?: string };
  const notifs: Notif[] = [];
  for (const e of all) {
    const name = `${e.doctorName ?? '?'} — ${e.periodType === 'custom' ? 'Custom' : OPPE_PERIOD_LABEL[e.periodType as OppePeriodType]} ${e.year}`;
    if (e.status !== 'finalized' && e.dueDate && e.dueDate < today) notifs.push({ id: e.id + 'late', kind: 'Terlambat', color: '#ef4444', text: `OPPE melewati jatuh tempo (${fmtDate(e.dueDate)}): ${name}`, evalId: e.id });
    else if (e.status !== 'finalized' && e.dueDate && e.dueDate <= soon) notifs.push({ id: e.id + 'due', kind: 'Jatuh tempo', color: '#f59e0b', text: `OPPE jatuh tempo ${fmtDate(e.dueDate)}: ${name}`, evalId: e.id });
    if (['draft', 'in_progress'].includes(e.status) && e.year >= CURRENT_YEAR - 1) notifs.push({ id: e.id + 'open', kind: 'Belum selesai', color: '#38bdf8', text: `OPPE belum selesai (${OPPE_STATUS_LABEL[e.status]}): ${name}`, evalId: e.id });
    if (['submitted', 'reviewed'].includes(e.status)) notifs.push({ id: e.id + 'appr', kind: 'Menunggu approval', color: '#a78bfa', text: `Menunggu ${e.status === 'submitted' ? 'review' : 'approval'}: ${name}`, evalId: e.id });
    if (e.requiresFppe && !fppeEvalIds.has(e.id)) notifs.push({ id: e.id + 'fppe', kind: 'FPPE perlu dibuat', color: '#ef4444', text: `Rekomendasi FPPE belum ditindaklanjuti: ${name}${e.criticalIndicators ? ` (${e.criticalIndicators})` : ''}`, evalId: e.id });
    else if (e.triggerCount > 0 && e.status !== 'finalized') notifs.push({ id: e.id + 'trig', kind: 'Trigger', color: '#f97316', text: `${e.triggerCount} indikator trigger: ${name}`, evalId: e.id });
    if (e.approvedAt && e.approvedAt > weekAgo && e.status === 'approved') notifs.push({ id: e.id + 'ok', kind: 'Disetujui', color: '#4f8ef7', text: `OPPE disetujui: ${name}`, evalId: e.id });
    if (e.finalizedAt && e.finalizedAt > weekAgo) notifs.push({ id: e.id + 'fin', kind: 'Final', color: '#22c55e', text: `OPPE difinalisasi: ${name}`, evalId: e.id });
  }
  const notifOrder = ['Terlambat', 'FPPE perlu dibuat', 'Menunggu approval', 'Jatuh tempo', 'Trigger', 'Belum selesai', 'Disetujui', 'Final'];
  notifs.sort((a, b) => notifOrder.indexOf(a.kind) - notifOrder.indexOf(b.kind));

  const professions = masters.options.filter((o) => o.kind === 'profession' && o.isActive);

  return (
    <div className="p-4 space-y-4">
      <OppePageHeader
        icon={LayoutDashboard}
        title="Dashboard Evaluasi Praktik Profesional Berkelanjutan (OPPE)"
        description="Ringkasan hasil OPPE dokter/staf medis — skor terbobot, trigger, FPPE, dan tren antarperiode."
        actions={<Button size="sm" variant="outline" className="gap-1.5" onClick={() => load(true)}><RefreshCw className="size-3.5" />Muat ulang</Button>}
      />

      {/* Filter */}
      <Card>
        <CardContent className="pt-4 pb-4 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          <FilterSelect label="Tahun" value={year} onChange={setYear} options={[{ value: ALL, label: 'Semua tahun' }, ...YEAR_OPTIONS.map((y) => ({ value: String(y), label: String(y) }))]} />
          <FilterSelect label="Semester" value={semester} onChange={setSemester} options={[{ value: ALL, label: 'Semua' }, { value: 'semester_1', label: 'Semester I' }, { value: 'semester_2', label: 'Semester II' }, { value: 'tahunan', label: 'Tahunan' }, { value: 'custom', label: 'Custom' }]} />
          <FilterSelect label="KSM" value={ksmId} onChange={setKsmId} options={[{ value: ALL, label: 'Semua KSM' }, ...masters.ksm.map((k) => ({ value: k.id, label: k.name }))]} />
          <FilterSelect label="Dokter" value={doctorId} onChange={setDoctorId} options={[{ value: ALL, label: 'Semua dokter' }, ...doctors.map((d) => ({ value: d.id, label: d.name }))]} />
          <FilterSelect label="Profesi" value={profession} onChange={setProfession} options={[{ value: ALL, label: 'Semua profesi' }, ...professions.map((p) => ({ value: p.name, label: p.name }))]} />
          <FilterSelect label="Unit" value={unitId} onChange={setUnitId} options={[{ value: ALL, label: 'Semua unit' }, ...masters.units.map((u) => ({ value: u.id, label: u.name }))]} />
          <FilterSelect label="Status" value={status} onChange={setStatus} options={[{ value: ALL, label: 'Semua status' }, ...(Object.keys(OPPE_STATUS_LABEL) as OppeEvaluationStatus[]).map((s) => ({ value: s, label: OPPE_STATUS_LABEL[s] }))]} />
          <FilterSelect label="Kategori hasil" value={category} onChange={setCategory} options={[{ value: ALL, label: 'Semua kategori' }, ...resultCats.map((c) => ({ value: c.code, label: c.label }))]} />
        </CardContent>
      </Card>

      {loading ? <OppeLoading /> : error ? <OppeErrorState message={error} onRetry={() => load(true)} /> : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <OppeKpiCard icon={Users} label="Total dokter/staf medis aktif" value={kpi.doctors} color="#4f8ef7" onClick={() => onNavigate('oppe-doctors')} />
            <OppeKpiCard icon={ClipboardList} label="Total evaluasi OPPE" value={kpi.total} color="#6366f1" onClick={() => onNavigate('oppe-monitoring')} />
            <OppeKpiCard icon={CheckCircle2} label="OPPE selesai (final)" value={kpi.done} color="#22c55e" />
            <OppeKpiCard icon={Loader2} label="OPPE dalam proses" value={kpi.inProcess} color="#38bdf8" />
            <OppeKpiCard icon={CircleDashed} label="Dokter belum dievaluasi" value={kpi.notEvaluated} color="#94a3b8" hint={year === ALL ? 'semua periode' : `periode ${year}${semester !== ALL ? ' ' + (semester === 'semester_1' ? 'S-I' : semester === 'semester_2' ? 'S-II' : semester) : ''}`} />
            <OppeKpiCard icon={Award} label={`Hasil ${resultCats.filter((c) => goodCodes.includes(c.code)).map((c) => c.label).join(' / ') || 'Baik'}`} value={kpi.good} color="#16a34a" />
            <OppeKpiCard icon={Wrench} label={`Hasil ${secondLowest?.label ?? 'Perlu Perbaikan'}`} value={kpi.improve} color="#f59e0b" />
            <OppeKpiCard icon={XCircle} label={`Hasil ${lowest?.label ?? 'Tidak Memenuhi'}`} value={kpi.fail} color="#ef4444" />
            <OppeKpiCard icon={AlertTriangle} label="Evaluasi dengan trigger" value={kpi.withTrigger} color="#f97316" />
            <OppeKpiCard icon={Microscope} label="Dokter membutuhkan FPPE" value={kpi.needFppe} color="#b91c1c" onClick={() => onNavigate('oppe-fppe')} />
          </div>

          <div className="grid lg:grid-cols-3 gap-4">
            <ChartCard title="1. Distribusi Hasil OPPE">
              {scoped.length === 0 ? <NoChartData /> : <Doughnut data={distData} options={CHART_OPTS} />}
            </ChartCard>
            <ChartCard title="2. Tren Skor OPPE per Periode" className="lg:col-span-2">
              {periods.length === 0 ? <NoChartData /> : <Line data={trendData} options={{ ...CHART_OPTS, ...scoreScale }} />}
            </ChartCard>
            <ChartCard title="3. Skor Berdasarkan KSM">
              {ksmRows.length === 0 ? <NoChartData /> : <Bar data={ksmBar('avg', 'Rata-rata skor akhir', '#4f8ef7')} options={{ ...CHART_OPTS, indexAxis: 'y' as const, scales: { x: { min: 0, max: 100 } } }} />}
            </ChartCard>
            <ChartCard title={`4. Skor ${masters.categories.find((c) => c.code === 'A')?.name ?? 'Perilaku Profesional'}`}>
              {ksmRows.length === 0 ? <NoChartData /> : <Bar data={ksmBar('a', 'Rata-rata skor', '#14b8a6')} options={{ ...CHART_OPTS, ...scoreScale }} />}
            </ChartCard>
            <ChartCard title={`5. Skor ${masters.categories.find((c) => c.code === 'B')?.name ?? 'Pengembangan Profesional'}`}>
              {ksmRows.length === 0 ? <NoChartData /> : <Bar data={ksmBar('b', 'Rata-rata skor', '#a78bfa')} options={{ ...CHART_OPTS, ...scoreScale }} />}
            </ChartCard>
            <ChartCard title={`6. Skor ${masters.categories.find((c) => c.code === 'C')?.name ?? 'Kinerja Klinis'}`}>
              {ksmRows.length === 0 ? <NoChartData /> : <Bar data={ksmBar('c', 'Rata-rata skor', '#f472b6')} options={{ ...CHART_OPTS, ...scoreScale }} />}
            </ChartCard>
            <ChartCard title="7. Jumlah Trigger per Periode">
              {periods.length === 0 ? <NoChartData /> : <Bar data={triggerData} options={CHART_OPTS} />}
            </ChartCard>
            <ChartCard title="8. Jumlah Rekomendasi FPPE per Periode">
              {periods.length === 0 ? <NoChartData /> : <Bar data={fppeData} options={CHART_OPTS} />}
            </ChartCard>
            <ChartCard title="10. Tren Kepatuhan Indikator">
              {periods.length === 0 ? <NoChartData /> : <Line data={complianceData} options={{ ...CHART_OPTS, ...scoreScale }} />}
            </ChartCard>
            <ChartCard title="9. Perbandingan Skor Dokter (periode terpilih, 20 teratas)" className="lg:col-span-3" height="h-80">
              {doctorCompare.length === 0 ? <NoChartData /> : <Bar data={doctorData} options={{ ...CHART_OPTS, indexAxis: 'y' as const, plugins: { legend: { display: false } }, scales: { x: { min: 0, max: 100 } } }} />}
            </ChartCard>
          </div>

          <div className="grid lg:grid-cols-5 gap-4">
            <Card className="lg:col-span-3">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Perbandingan Antar KSM</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>KSM</TableHead>
                      <TableHead className="text-right">Rata-rata skor</TableHead>
                      <TableHead className="text-right">Dokter</TableHead>
                      <TableHead className="text-right">Trigger</TableHead>
                      <TableHead className="text-right">FPPE</TableHead>
                      <TableHead className="text-right">% Memenuhi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ksmRows.map((k) => (
                      <TableRow key={k.name}>
                        <TableCell className="font-medium">{k.name}</TableCell>
                        <TableCell className="text-right">{fmtNum(k.avg)}</TableCell>
                        <TableCell className="text-right">{k.doctors}</TableCell>
                        <TableCell className="text-right">{k.triggers}</TableCell>
                        <TableCell className="text-right">{k.fppe}</TableCell>
                        <TableCell className="text-right">{k.pctMet === null ? '—' : `${fmtNum(k.pctMet)}%`}</TableCell>
                      </TableRow>
                    ))}
                    {ksmRows.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Belum ada evaluasi pada filter ini.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Bell className="size-4" />Notifikasi OPPE <Badge variant="secondary" className="text-[10px]">{notifs.length}</Badge></CardTitle></CardHeader>
              <CardContent className="space-y-1.5 max-h-80 overflow-y-auto">
                {notifs.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">Tidak ada notifikasi.</p>}
                {notifs.slice(0, 40).map((n) => (
                  <button key={n.id} onClick={() => n.evalId && onOpenEvaluation(n.evalId)} className="w-full text-left flex items-start gap-2 rounded-md border p-2 hover:bg-muted/40">
                    <Clock className="size-3.5 mt-0.5 shrink-0" style={{ color: n.color }} />
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: n.color }}>{n.kind}</p>
                      <p className="text-xs">{n.text}</p>
                    </div>
                  </button>
                ))}
              </CardContent>
            </Card>
          </div>

          {notEvaluated.length > 0 && year !== ALL && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Dokter Belum Dievaluasi ({notEvaluated.length})</CardTitle></CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {notEvaluated.map((d) => <Badge key={d.id} variant="outline" className="text-xs">{d.name}{d.ksmName ? ` · ${d.ksmName}` : ''}</Badge>)}
                <Button size="sm" variant="link" className="h-auto p-0 text-xs" onClick={() => onNavigate('oppe-evaluations')}>Buat evaluasi →</Button>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Evaluasi Terbaru</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Dokter</TableHead><TableHead>KSM</TableHead><TableHead>Periode</TableHead><TableHead className="text-right">Skor</TableHead><TableHead>Kategori</TableHead><TableHead className="text-right">Trigger</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {[...inPeriod].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 8).map((e) => (
                    <TableRow key={e.id} className="cursor-pointer hover:bg-muted/40" onClick={() => onOpenEvaluation(e.id)}>
                      <TableCell className="font-medium">{e.doctorName}</TableCell>
                      <TableCell className="text-xs">{e.ksmName}</TableCell>
                      <TableCell className="text-xs">{periodKeyLabel(e).label}</TableCell>
                      <TableCell className="text-right">{fmtNum(e.finalScore)}</TableCell>
                      <TableCell><OppeCategoryBadge code={e.finalCategory} label={e.finalCategoryLabel} categories={masters.settings.resultCategories} /></TableCell>
                      <TableCell className="text-right">{e.triggerCount > 0 ? <span className="text-red-500 font-semibold">{e.triggerCount}</span> : 0}</TableCell>
                      <TableCell><OppeStatusBadge status={e.status} /></TableCell>
                    </TableRow>
                  ))}
                  {inPeriod.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Belum ada evaluasi.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div className="space-y-1 min-w-0">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-8 text-xs w-full"><SelectValue /></SelectTrigger>
        <SelectContent>{options.map((o) => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );
}

function ChartCard({ title, children, className = '', height = 'h-64' }: { title: string; children: React.ReactNode; className?: string; height?: string }) {
  return (
    <Card className={className}>
      <CardHeader className="pb-2"><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
      <CardContent><div className={`${height} flex items-center justify-center`}>{children}</div></CardContent>
    </Card>
  );
}

function NoChartData() {
  return <p className="text-xs text-muted-foreground">Belum ada data.</p>;
}

export { FilterSelect };
