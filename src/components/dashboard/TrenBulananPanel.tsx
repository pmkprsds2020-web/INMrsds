'use client';

import React, { useMemo, useState, useCallback } from 'react';
import { useTheme } from 'next-themes';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  RadialLinearScale,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line, Radar } from 'react-chartjs-2';
import {
  TrendingUp,
  TrendingDown,
  Target,
  BarChart3,
  FileSpreadsheet,
  GitCompareArrows,
  Radar as RadarIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip as ShadTooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import {
  IndicatorType,
  IndicatorEntry,
  INDICATORS,
} from '@/types';
import {
  calculateStats,
  calculateMonthlyStats,
  getAvailableYears,
  getIndicatorMeta,
  MonthlyStat,
  MONTH_NAMES,
} from '@/lib/calculations';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  RadialLinearScale,
  Title,
  Tooltip,
  Legend,
  Filler,
);

// ────────────── Theme-aware chart colors ──────────────
function getChartColors() {
  if (typeof document === 'undefined') return { text: '#fff', grid: 'rgba(255,255,255,0.04)', bg: '#1a1d27', border: 'rgba(255,255,255,0.06)' };
  const style = getComputedStyle(document.documentElement);
  return {
    text: style.getPropertyValue('--color-foreground').trim() || '#fff',
    grid: style.getPropertyValue('--color-border').trim() || 'rgba(255,255,255,0.04)',
    bg: style.getPropertyValue('--color-card').trim() || '#1a1d27',
    border: style.getPropertyValue('--color-border').trim() || 'rgba(255,255,255,0.06)',
  };
}

// ────────────── Types ──────────────

interface TrenBulananPanelProps {
  entries: Partial<Record<IndicatorType, IndicatorEntry[]>>;
  activeUnit: string;
}

// ────────────── KPI Card ──────────────

function KpiCard({
  label,
  value,
  subtitle,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  subtitle?: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="rounded-lg border border-border p-4 bg-card transition-colors hover:border-foreground/20">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] text-muted-foreground font-medium truncate">{label}</p>
          <p className="text-xl font-bold font-mono tracking-tight mt-0.5" style={{ color }}>
            {value}
          </p>
          {subtitle && (
            <p className="text-[10px] text-muted-foreground/60 mt-0.5 truncate">{subtitle}</p>
          )}
        </div>
        <div
          className="flex size-8 items-center justify-center rounded-md shrink-0"
          style={{ backgroundColor: `${color}18` }}
        >
          <Icon className="size-4" style={{ color }} />
        </div>
      </div>
    </div>
  );
}

// ────────────── Pill for % value ──────────────

function PctPill({ pct, target, isLowerBetter }: { pct: number; target: number; isLowerBetter: boolean }) {
  if (pct === 0) {
    return <span className="text-muted-foreground/40 text-xs">—</span>;
  }
  const met = isLowerBetter ? pct <= target : pct >= target;
  return (
    <Badge
      className={`text-[10px] font-mono font-semibold border-0 ${
        met
          ? 'bg-emerald-500/20 text-emerald-400'
          : 'bg-red-500/20 text-red-400'
      }`}
    >
      {pct.toFixed(1)}%
    </Badge>
  );
}

// ────────────── Delta Pill ──────────────

function DeltaPill({ value }: { value: number }) {
  if (value === 0) {
    return <span className="text-muted-foreground/50 text-xs font-mono">0.0</span>;
  }
  const positive = value > 0;
  return (
    <Badge
      className={`text-[10px] font-mono font-semibold border-0 ${
        positive
          ? 'bg-emerald-500/20 text-emerald-400'
          : 'bg-red-500/20 text-red-400'
      }`}
    >
      {positive ? '+' : ''}{value.toFixed(1)}
    </Badge>
  );
}

// ────────────── Main Component ──────────────

export function TrenBulananPanel({ entries, activeUnit }: TrenBulananPanelProps) {
  const { resolvedTheme } = useTheme();
  const [selectedIndicator, setSelectedIndicator] = useState<IndicatorType>('tangan');
  const [compareMode, setCompareMode] = useState(false);
  const [chartView, setChartView] = useState<'tren' | 'radar'>('tren');

  const indicatorMeta = getIndicatorMeta(selectedIndicator)!;
  const allEntries = entries[selectedIndicator] ?? [];

  // Available years from entries
  const availableYears = useMemo(() => getAvailableYears(allEntries), [allEntries]);

  // Selected years
  const [year1, setYear1] = useState<number>(() => availableYears[0] ?? new Date().getFullYear());
  const [year2, setYear2] = useState<number>(() => {
    const idx = availableYears.length > 1 ? 1 : 0;
    return availableYears[idx] ?? new Date().getFullYear();
  });

  // Recalculate when indicator or years change
  const monthly1 = useMemo(
    () => calculateMonthlyStats(selectedIndicator, allEntries, year1),
    [selectedIndicator, allEntries, year1],
  );

  const monthly2 = useMemo(
    () => calculateMonthlyStats(selectedIndicator, allEntries, year2),
    [selectedIndicator, allEntries, year2],
  );

  // ── KPI calculations for year1 ──
  const kpis = useMemo(() => {
    const withData = monthly1.filter((m) => m.denominator > 0);
    const avgPct = withData.length > 0
      ? withData.reduce((s, m) => s + m.pct, 0) / withData.length
      : 0;

    let highest = { month: '—', pct: 0 };
    let lowest = { month: '—', pct: Infinity };

    for (const m of withData) {
      if (m.pct > highest.pct) highest = { month: MONTH_NAMES[parseInt(m.yearMonth.slice(5, 7), 10) - 1], pct: m.pct };
      if (m.pct < lowest.pct) lowest = { month: MONTH_NAMES[parseInt(m.yearMonth.slice(5, 7), 10) - 1], pct: m.pct };
    }

    if (lowest.pct === Infinity) lowest.pct = 0;

    return {
      avgPct,
      highestMonth: highest.month,
      highestPct: highest.pct,
      lowestMonth: lowest.month,
      lowestPct: lowest.pct,
      target: indicatorMeta.target,
    };
  }, [monthly1, indicatorMeta.target]);

  // ── Chart data ──
  const chartData = useMemo(() => {
    const colors = getChartColors();
    const labels = MONTH_NAMES;

    const datasets: any[] = [
      {
        label: `${indicatorMeta.label} ${year1}`,
        data: monthly1.map((m) => (m.denominator > 0 ? m.pct : null)),
        borderColor: indicatorMeta.color,
        backgroundColor: `${indicatorMeta.color}20`,
        fill: true,
        tension: 0.35,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: indicatorMeta.color,
        pointBorderColor: colors.bg,
        pointBorderWidth: 2,
      },
    ];

    if (compareMode) {
      datasets.push({
        label: `${indicatorMeta.label} ${year2}`,
        data: monthly2.map((m) => (m.denominator > 0 ? m.pct : null)),
        borderColor: '#fbbf24',
        backgroundColor: '#fbbf2420',
        fill: false,
        tension: 0.35,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: '#fbbf24',
        pointBorderColor: colors.bg,
        pointBorderWidth: 2,
        borderDash: [5, 5],
      });
    }

    // Target line
    datasets.push({
      label: `Target (${indicatorMeta.targetLabel})`,
      data: Array(12).fill(indicatorMeta.target),
      borderColor: '#f8717190',
      borderDash: [8, 4],
      borderWidth: 1.5,
      pointRadius: 0,
      fill: false,
    });

    return { labels, datasets };
  }, [monthly1, monthly2, compareMode, indicatorMeta, year1, year2, resolvedTheme]);

  const chartOptions = useMemo(
    () => {
      const colors = getChartColors();
      return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index' as const,
        intersect: false,
      },
      plugins: {
        legend: {
          display: true,
          position: 'top' as const,
          labels: {
            color: colors.text,
            font: { size: 11 },
            usePointStyle: true,
            pointStyle: 'circle',
            padding: 16,
          },
        },
        tooltip: {
          backgroundColor: colors.bg,
          borderColor: colors.border,
          borderWidth: 1,
          titleColor: colors.text,
          bodyColor: colors.text,
          padding: 10,
          cornerRadius: 8,
          callbacks: {
            label: (ctx: any) => {
              if (ctx.parsed.y === null) return `${ctx.dataset.label}: —`;
              return `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)}%`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: { color: colors.grid },
          ticks: { color: colors.text, font: { size: 11 } },
        },
        y: {
          beginAtZero: true,
          max: 105,
          grid: { color: colors.grid },
          ticks: {
            color: colors.text,
            font: { size: 11 },
            callback: (v: any) => `${v}%`,
          },
        },
      },
    };
    },
    [resolvedTheme],
  );

  // ── Radar chart data ──
  const radarData = useMemo(() => {
    const labels = INDICATORS.map((ind) => ind.label);
    const capaianData = INDICATORS.map((ind) => {
      const indEntries = entries[ind.id] ?? [];
      const s = calculateStats(ind.id, indEntries);
      return s.den > 0 ? s.pct : 0;
    });
    const targetData = INDICATORS.map((ind) => ind.target);

    // Use each indicator's color as pointBackgroundColor for capaian
    const capaianColors = INDICATORS.map((ind) => ind.color);

    return {
      labels,
      datasets: [
        {
          label: 'Capaian (%)',
          data: capaianData,
          borderColor: '#4f8ef7',
          backgroundColor: 'rgba(79,142,247,0.15)',
          pointBackgroundColor: capaianColors,
          pointBorderColor: capaianColors,
          pointRadius: 5,
          pointHoverRadius: 7,
          borderWidth: 2,
        },
        {
          label: 'Target (%)',
          data: targetData,
          borderColor: 'rgba(255,255,255,0.25)',
          backgroundColor: 'rgba(255,255,255,0.05)',
          pointBackgroundColor: 'rgba(255,255,255,0.3)',
          pointBorderColor: 'rgba(255,255,255,0.3)',
          pointRadius: 3,
          pointHoverRadius: 5,
          borderWidth: 1.5,
          borderDash: [4, 4],
        },
      ],
    };
  }, [entries]);

  const radarOptions = useMemo(
    () => {
      const colors = getChartColors();
      return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top' as const,
          labels: {
            color: colors.text,
            font: { size: 11 },
            usePointStyle: true,
            pointStyle: 'circle',
            padding: 16,
          },
        },
        tooltip: {
          backgroundColor: colors.bg,
          borderColor: colors.border,
          borderWidth: 1,
          titleColor: colors.text,
          bodyColor: colors.text,
          padding: 10,
          cornerRadius: 8,
          callbacks: {
            label: (ctx: any) => {
              return `${ctx.dataset.label}: ${ctx.parsed.r.toFixed(1)}%`;
            },
          },
        },
      },
      scales: {
        r: {
          beginAtZero: true,
          max: 110,
          ticks: {
            color: colors.text,
            backdropColor: 'transparent',
            font: { size: 9 },
            stepSize: 20,
            callback: (v: any) => `${v}%`,
          },
          grid: {
            color: colors.border,
          },
          angleLines: {
            color: colors.border,
          },
          pointLabels: {
            color: colors.text,
            font: { size: 10 },
          },
        },
      },
    };
    },
    [resolvedTheme],
  );

  // ── Export to Excel ──
  const handleExport = useCallback(() => {
    const rows: Record<string, any>[] = [];

    for (let i = 0; i < 12; i++) {
      const row: Record<string, any> = {
        Bulan: MONTH_NAMES[i],
        [`${year1} - Numerator`]: monthly1[i].denominator > 0 ? monthly1[i].numerator : '—',
        [`${year1} - Denominator`]: monthly1[i].denominator > 0 ? monthly1[i].denominator : '—',
        [`${year1} - Capaian (%)`]: monthly1[i].denominator > 0 ? Number(monthly1[i].pct.toFixed(1)) : '—',
      };
      if (compareMode) {
        row[`${year2} - Numerator`] = monthly2[i].denominator > 0 ? monthly2[i].numerator : '—';
        row[`${year2} - Denominator`] = monthly2[i].denominator > 0 ? monthly2[i].denominator : '—';
        row[`${year2} - Capaian (%)`] = monthly2[i].denominator > 0 ? Number(monthly2[i].pct.toFixed(1)) : '—';
        row['Delta (%)'] = (monthly1[i].denominator > 0 && monthly2[i].denominator > 0)
          ? Number((monthly1[i].pct - monthly2[i].pct).toFixed(1))
          : '—';
      }
      rows.push(row);
    }

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Tren ${indicatorMeta.label}`);
    XLSX.writeFile(wb, `Tren_${indicatorMeta.label}_${year1}${compareMode ? `_vs_${year2}` : ''}.xlsx`);
    toast.success('Berhasil export ke Excel');
  }, [monthly1, monthly2, compareMode, year1, year2, indicatorMeta.label]);

  // ── Sync year1 when availableYears change ──
  React.useEffect(() => {
    if (availableYears.length > 0 && !availableYears.includes(year1)) {
      setYear1(availableYears[0]);
    }
  }, [availableYears, year1]);

  React.useEffect(() => {
    if (availableYears.length > 1 && !availableYears.includes(year2)) {
      setYear2(availableYears[1] ?? availableYears[0]);
    }
  }, [availableYears, year2]);

  return (
    <div className="space-y-5">
      {/* ── Header + Controls ── */}
      <div className="rounded-xl border border-border p-4 bg-card">
        <div className="flex flex-col gap-4">
          {/* Title row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="size-5 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Tren Bulanan</h2>
            </div>
            <div className="flex items-center gap-3">
              {/* Chart view toggle */}
              <div className="flex items-center rounded-lg border border-border overflow-hidden">
                <button
                  onClick={() => setChartView('tren')}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
                    chartView === 'tren'
                      ? 'bg-muted text-foreground'
                      : 'text-muted-foreground hover:text-foreground/60'
                  }`}
                >
                  <BarChart3 className="size-3.5" />
                  Tren
                </button>
                <button
                  onClick={() => setChartView('radar')}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
                    chartView === 'radar'
                      ? 'bg-muted text-foreground'
                      : 'text-muted-foreground hover:text-foreground/60'
                  }`}
                >
                  <RadarIcon className="size-3.5" />
                  Radar
                </button>
              </div>

              {/* Compare mode toggle */}
              <div className="flex items-center gap-2">
                <ShadTooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-2 cursor-pointer">
                      <GitCompareArrows className="size-3.5 text-muted-foreground" />
                      <span className="text-[11px] text-muted-foreground hidden sm:inline">Bandingkan</span>
                      <Switch
                        checked={compareMode}
                        onCheckedChange={setCompareMode}
                        className="data-[state=checked]:bg-amber-500/60"
                      />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>Bandingkan dua tahun</TooltipContent>
                </ShadTooltip>
              </div>

              {/* Export button */}
              <Button
                size="sm"
                onClick={handleExport}
                className="h-8 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border-0 text-xs font-medium gap-1.5"
              >
                <FileSpreadsheet className="size-3.5" />
                Excel
              </Button>
            </div>
          </div>

          {/* Selectors row */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Indicator selector */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground shrink-0">Indikator</span>
              <Select
                value={selectedIndicator}
                onValueChange={(v) => setSelectedIndicator(v as IndicatorType)}
              >
                <SelectTrigger className="h-8 w-[200px] bg-muted/50 border-border text-foreground/80 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-border bg-popover">
                  {INDICATORS.map((ind) => (
                    <SelectItem key={ind.id} value={ind.id} className="text-muted-foreground text-xs focus:text-foreground focus:bg-muted/50">
                      <div className="flex items-center gap-2">
                        <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: ind.color }} />
                        {ind.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Year 1 selector */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground shrink-0">Tahun</span>
              <Select
                value={String(year1)}
                onValueChange={(v) => setYear1(Number(v))}
              >
                <SelectTrigger className="h-8 w-[90px] bg-muted/50 border-border text-foreground/80 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-border bg-popover">
                  {availableYears.map((y) => (
                    <SelectItem key={y} value={String(y)} className="text-muted-foreground text-xs focus:text-foreground focus:bg-muted/50">
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Year 2 selector (compare mode) */}
            {compareMode && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-amber-400/70 shrink-0">vs</span>
                <Select
                  value={String(year2)}
                  onValueChange={(v) => setYear2(Number(v))}
                >
                  <SelectTrigger className="h-8 w-[90px] bg-muted/50 border-border text-amber-400/80 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-border bg-popover">
                    {availableYears.map((y) => (
                      <SelectItem key={y} value={String(y)} className="text-muted-foreground text-xs focus:text-foreground focus:bg-muted/50">
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Active unit badge */}
            <Badge
              variant="outline"
              className="border-border text-muted-foreground text-[10px] ml-auto"
            >
              {activeUnit}
            </Badge>
          </div>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Rata-rata Tahunan"
          value={`${kpis.avgPct.toFixed(1)}%`}
          subtitle={String(year1)}
          icon={TrendingUp}
          color="#4f8ef7"
        />
        <KpiCard
          label="Bulan Tertinggi"
          value={`${kpis.highestPct.toFixed(1)}%`}
          subtitle={kpis.highestMonth}
          icon={TrendingUp}
          color="#6ee7b7"
        />
        <KpiCard
          label="Bulan Terendah"
          value={`${kpis.lowestPct.toFixed(1)}%`}
          subtitle={kpis.lowestMonth}
          icon={TrendingDown}
          color="#f87171"
        />
        <KpiCard
          label="Target Indikator"
          value={indicatorMeta.targetLabel}
          subtitle={indicatorMeta.isLowerBetter ? 'Lower is better' : 'Higher is better'}
          icon={Target}
          color="#fbbf24"
        />
      </div>

      {/* ── Chart Area ── */}
      <div className="rounded-xl border border-border p-4 bg-card">
        {chartView === 'tren' ? (
          <div className="h-[300px] sm:h-[360px]">
            <Line data={chartData} options={chartOptions} />
          </div>
        ) : (
          <div className="h-[360px] sm:h-[420px]">
            <Radar data={radarData} options={radarOptions} />
          </div>
        )}
      </div>

      {/* ── Rekap Bulanan Table ── */}
      <div className="rounded-xl border border-border overflow-hidden bg-card">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <BarChart3 className="size-4 text-muted-foreground" />
          <h3 className="text-xs font-semibold text-foreground/70">Rekap Bulanan</h3>
          {compareMode && (
            <Badge className="bg-amber-500/20 text-amber-400 border-0 text-[10px] ml-2">
              {year1} vs {year2}
            </Badge>
          )}
        </div>

        <div className="max-h-96 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-muted-foreground/20 [&::-webkit-scrollbar-thumb]:rounded-full">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground text-[11px] font-semibold">Bulan</TableHead>
                <TableHead className="text-muted-foreground text-[11px] font-semibold text-right">
                  Num {year1}
                </TableHead>
                <TableHead className="text-muted-foreground text-[11px] font-semibold text-right">
                  Den {year1}
                </TableHead>
                <TableHead className="text-muted-foreground text-[11px] font-semibold text-right">
                  Capaian {year1}
                </TableHead>
                {compareMode && (
                  <>
                    <TableHead className="text-muted-foreground text-[11px] font-semibold text-right">
                      Num {year2}
                    </TableHead>
                    <TableHead className="text-muted-foreground text-[11px] font-semibold text-right">
                      Den {year2}
                    </TableHead>
                    <TableHead className="text-muted-foreground text-[11px] font-semibold text-right">
                      Capaian {year2}
                    </TableHead>
                    <TableHead className="text-muted-foreground text-[11px] font-semibold text-right">
                      Delta
                    </TableHead>
                  </>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {monthly1.map((m, i) => {
                const m2 = compareMode ? monthly2[i] : null;
                const hasData1 = m.denominator > 0;
                const hasData2 = m2 ? m2.denominator > 0 : false;

                return (
                  <TableRow
                    key={m.yearMonth}
                    className="border-border/50 hover:bg-muted/30"
                  >
                    <TableCell className="text-foreground/70 text-xs font-medium">
                      {MONTH_NAMES[i]}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground text-xs font-mono">
                      {hasData1 ? m.numerator : '—'}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground text-xs font-mono">
                      {hasData1 ? m.denominator : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <PctPill
                        pct={m.pct}
                        target={indicatorMeta.target}
                        isLowerBetter={indicatorMeta.isLowerBetter}
                      />
                    </TableCell>
                    {compareMode && m2 && (
                      <>
                        <TableCell className="text-right text-muted-foreground text-xs font-mono">
                          {hasData2 ? m2.numerator : '—'}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground text-xs font-mono">
                          {hasData2 ? m2.denominator : '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          <PctPill
                            pct={m2.pct}
                            target={indicatorMeta.target}
                            isLowerBetter={indicatorMeta.isLowerBetter}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          {hasData1 && hasData2 ? (
                            <DeltaPill value={m.pct - m2.pct} />
                          ) : (
                            <span className="text-muted-foreground/40 text-xs">—</span>
                          )}
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
