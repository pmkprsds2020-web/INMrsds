'use client';

import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { useTheme } from 'next-themes';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import {
  ShieldCheck,
  ShieldAlert,
  ClipboardList,
  Bell,
  FileSpreadsheet,
  ArrowUpDown,
  AlertTriangle,
  CalendarDays,
  Filter,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
  IndicatorEntry,
  IndicatorType,
  UNIT_MAP,
  INDICATORS,
} from '@/types';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
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

interface KepatuhanUnitPanelProps {
  allEntries: IndicatorEntry[];
  activeUnit: string;
}

interface UnitCompliance {
  unitId: string;
  unitLabel: string;
  requiredIndicators: IndicatorType[];
  hasData: Record<IndicatorType, boolean>;
  isCompliant: boolean;
  lastInputDate: string | null;
  entryCount: number;
  compliancePct: number; // % of required indicators that have data
}

type SortMode = 'belum-first' | 'alphabetical';
type PeriodMode = 'harian' | 'bulanan';

// ────────────── KPI Card ──────────────

function KpiCard({
  label,
  value,
  icon: Icon,
  color,
  subtitle,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  subtitle?: string;
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

// ────────────── Compliance badge ──────────────

function ComplianceBadge({ compliant }: { compliant: boolean }) {
  return compliant ? (
    <Badge className="bg-emerald-500/20 text-emerald-400 border-0 text-[10px] font-semibold gap-1">
      <ShieldCheck className="size-3" />
      Patuh
    </Badge>
  ) : (
    <Badge className="bg-red-500/20 text-red-400 border-0 text-[10px] font-semibold gap-1">
      <ShieldAlert className="size-3" />
      Belum
    </Badge>
  );
}

// ────────────── Indicator chip ──────────────

function IndicatorChip({ type, hasData }: { type: IndicatorType; hasData: boolean }) {
  const meta = INDICATORS.find((i) => i.id === type);
  if (!meta) return null;

  return (
    <Badge
      className={`text-[9px] font-medium border-0 gap-0.5 ${
        hasData
          ? 'bg-emerald-500/15 text-emerald-400'
          : 'bg-red-500/15 text-red-400'
      }`}
    >
      <span
        className="size-1.5 rounded-full shrink-0"
        style={{ backgroundColor: hasData ? '#6ee7b7' : '#f87171' }}
      />
      {meta.label}
    </Badge>
  );
}

// ────────────── Main Component ──────────────

export function KepatuhanUnitPanel({ allEntries, activeUnit }: KepatuhanUnitPanelProps) {
  const { resolvedTheme } = useTheme();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [period, setPeriod] = useState<PeriodMode>('bulanan');
  const [indicatorFilter, setIndicatorFilter] = useState<IndicatorType | 'all'>('all');
  const [sortMode, setSortMode] = useState<SortMode>('belum-first');

  // ── Filter entries by date range ──
  const filteredEntries = useMemo(() => {
    let result = allEntries;
    if (startDate) {
      result = result.filter((e) => (e.date || '') >= startDate);
    }
    if (endDate) {
      result = result.filter((e) => (e.date || '') <= endDate);
    }
    return result;
  }, [allEntries, startDate, endDate]);

  // ── Calculate compliance for each unit ──
  const unitCompliances = useMemo(() => {
    const units: UnitCompliance[] = [];

    for (const [unitId, unitMeta] of Object.entries(UNIT_MAP)) {
      // Skip 'all' virtual unit and units with no indicators
      if (unitId === 'all') continue;
      if (!unitMeta.inds || unitMeta.inds.length === 0) continue;

      // Apply indicator filter
      const relevantIndicators = indicatorFilter === 'all'
        ? unitMeta.inds
        : unitMeta.inds.filter((ind) => ind === indicatorFilter);

      if (relevantIndicators.length === 0 && indicatorFilter !== 'all') continue;

      const indicatorsToCheck = indicatorFilter === 'all' ? unitMeta.inds : [indicatorFilter as IndicatorType];

      const unitEntries = filteredEntries.filter((e) => e.unitId === unitId);

      const hasData: Record<IndicatorType, boolean> = {} as any;
      let compliantCount = 0;

      for (const ind of indicatorsToCheck) {
        const hasSome = unitEntries.some((e) => e.indicatorType === ind);
        hasData[ind] = hasSome;
        if (hasSome) compliantCount++;
      }

      const lastInputEntry = unitEntries.length > 0
        ? unitEntries.reduce((latest, e) =>
            (e.date || '') > (latest.date || '') ? e : latest,
          )
        : null;

      const isCompliant = indicatorsToCheck.every((ind) => hasData[ind]);
      const compliancePct = indicatorsToCheck.length > 0
        ? (compliantCount / indicatorsToCheck.length) * 100
        : 0;

      units.push({
        unitId,
        unitLabel: unitMeta.label,
        requiredIndicators: unitMeta.inds,
        hasData,
        isCompliant,
        lastInputDate: lastInputEntry?.date ?? null,
        entryCount: unitEntries.length,
        compliancePct,
      });
    }

    return units;
  }, [filteredEntries, indicatorFilter]);

  // ── Sort ──
  const sortedUnits = useMemo(() => {
    const sorted = [...unitCompliances];
    if (sortMode === 'belum-first') {
      sorted.sort((a, b) => {
        if (a.isCompliant !== b.isCompliant) return a.isCompliant ? 1 : -1;
        return a.unitLabel.localeCompare(b.unitLabel);
      });
    } else {
      sorted.sort((a, b) => a.unitLabel.localeCompare(b.unitLabel));
    }
    return sorted;
  }, [unitCompliances, sortMode]);

  // ── KPI values ──
  const kpis = useMemo(() => {
    const totalUnits = unitCompliances.length;
    const compliantUnits = unitCompliances.filter((u) => u.isCompliant).length;
    const nonCompliantUnits = totalUnits - compliantUnits;
    const kepatuhanPct = totalUnits > 0 ? (compliantUnits / totalUnits) * 100 : 0;

    return { totalUnits, compliantUnits, nonCompliantUnits, kepatuhanPct };
  }, [unitCompliances]);

  // ── Overdue check (assuming deadline is 10th of current month) ──
  const isOverdue = useMemo(() => {
    const now = new Date();
    return now.getDate() > 10;
  }, []);

  // ── Bar chart data ──
  const chartData = useMemo(() => {
    const labels = sortedUnits.map((u) => u.unitLabel);
    const data = sortedUnits.map((u) => u.compliancePct);
    const colors = sortedUnits.map((u) =>
      u.isCompliant ? '#6ee7b7' : '#f87171',
    );
    const bgColors = sortedUnits.map((u) =>
      u.isCompliant ? 'rgba(110,231,183,0.7)' : 'rgba(248,113,113,0.7)',
    );

    return {
      labels,
      datasets: [
        {
          label: 'Kepatuhan %',
          data,
          backgroundColor: bgColors,
          borderColor: colors,
          borderWidth: 1,
          borderRadius: 4,
          barPercentage: 0.7,
        },
      ],
    };
  }, [sortedUnits]);

  const chartOptions = useMemo(
    () => {
      const colors = getChartColors();
      return {
      indexAxis: 'y' as const,
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: colors.bg,
          borderColor: colors.border,
          borderWidth: 1,
          titleColor: colors.text,
          bodyColor: colors.text,
          padding: 10,
          cornerRadius: 8,
          callbacks: {
            label: (ctx: any) => `Kepatuhan: ${ctx.parsed.x.toFixed(0)}%`,
          },
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          max: 100,
          grid: { color: colors.grid },
          ticks: {
            color: colors.text,
            font: { size: 11 },
            callback: (v: any) => `${v}%`,
          },
        },
        y: {
          grid: { display: false },
          ticks: {
            color: colors.text,
            font: { size: 11 },
          },
        },
      },
    };
    },
    [resolvedTheme],
  );

  // ── Send reminder ──
  const handleReminder = useCallback(
    (unitLabel: string) => {
      toast.success(`Reminder terkirim ke ${unitLabel}`, {
        description: 'Notifikasi telah dikirim ke unit terkait.',
      });
    },
    [],
  );

  // ── Export to Excel ──
  const handleExport = useCallback(() => {
    const rows = sortedUnits.map((u) => ({
      'Unit': u.unitLabel,
      'Status': u.isCompliant ? 'Patuh' : 'Belum Input',
      'Kepatuhan (%)': Number(u.compliancePct.toFixed(0)),
      'Jumlah Entry': u.entryCount,
      'Terakhir Input': u.lastInputDate ?? '—',
      'Indikator Wajib': u.requiredIndicators
        .map((ind) => {
          const meta = INDICATORS.find((i) => i.id === ind);
          return meta?.label ?? ind;
        })
        .join(', '),
      'Indikator Sudah Input': u.requiredIndicators
        .filter((ind) => u.hasData[ind])
        .map((ind) => {
          const meta = INDICATORS.find((i) => i.id === ind);
          return meta?.label ?? ind;
        })
        .join(', '),
      'Indikator Belum Input': u.requiredIndicators
        .filter((ind) => !u.hasData[ind])
        .map((ind) => {
          const meta = INDICATORS.find((i) => i.id === ind);
          return meta?.label ?? ind;
        })
        .join(', '),
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Kepatuhan Unit');
    XLSX.writeFile(wb, `Kepatuhan_Unit_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success('Berhasil export ke Excel');
  }, [sortedUnits]);

  // ── Chart height based on number of units ──
  const chartHeight = Math.max(180, sortedUnits.length * 42);

  // ── Indicator filter options based on activeUnit ──
  const relevantIndicatorOptions = useMemo(() => {
    if (indicatorFilter === 'all') return INDICATORS;
    return INDICATORS;
  }, [indicatorFilter]);

  return (
    <div className="space-y-5">
      {/* ── Filter Controls ── */}
      <div className="rounded-xl border border-border p-4 bg-card">
        <div className="flex flex-col gap-4">
          {/* Title row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-5 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Kepatuhan Unit</h2>
              {isOverdue && (
                <Badge className="bg-red-500/20 text-red-400 border-0 text-[10px] gap-1 ml-1">
                  <AlertTriangle className="size-3" />
                  Overdue
                </Badge>
              )}
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

          {/* Filter row */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Start date */}
            <div className="flex items-center gap-2">
              <CalendarDays className="size-3.5 text-muted-foreground shrink-0" />
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                placeholder="Mulai"
                className="h-8 w-[130px] bg-muted/50 border-border text-foreground/80 text-xs focus-visible:ring-foreground/20 dark:[&::-webkit-calendar-picker-indicator]:invert dark:[&::-webkit-calendar-picker-indicator]:opacity-40"
                aria-label="Tanggal mulai"
              />
              <span className="text-muted-foreground/50 text-xs">—</span>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                placeholder="Akhir"
                className="h-8 w-[130px] bg-muted/50 border-border text-foreground/80 text-xs focus-visible:ring-foreground/20 dark:[&::-webkit-calendar-picker-indicator]:invert dark:[&::-webkit-calendar-picker-indicator]:opacity-40"
                aria-label="Tanggal akhir"
              />
            </div>

            {/* Period selector */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground shrink-0">Periode</span>
              <Select
                value={period}
                onValueChange={(v) => setPeriod(v as PeriodMode)}
              >
                <SelectTrigger className="h-8 w-[110px] bg-muted/50 border-border text-foreground/80 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-border bg-popover">
                  <SelectItem value="harian" className="text-muted-foreground text-xs focus:text-foreground focus:bg-muted/50">
                    Harian
                  </SelectItem>
                  <SelectItem value="bulanan" className="text-muted-foreground text-xs focus:text-foreground focus:bg-muted/50">
                    Bulanan
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Indicator filter */}
            <div className="flex items-center gap-2">
              <Filter className="size-3.5 text-muted-foreground shrink-0" />
              <Select
                value={indicatorFilter}
                onValueChange={(v) => setIndicatorFilter(v as IndicatorType | 'all')}
              >
                <SelectTrigger className="h-8 w-[170px] bg-muted/50 border-border text-foreground/80 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-border bg-popover">
                  <SelectItem value="all" className="text-muted-foreground text-xs focus:text-foreground focus:bg-muted/50">
                    Semua Indikator
                  </SelectItem>
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

            {/* Sort toggle */}
            <ShadTooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setSortMode((prev) =>
                      prev === 'belum-first' ? 'alphabetical' : 'belum-first',
                    )
                  }
                  className="h-8 text-muted-foreground hover:text-foreground/80 hover:bg-muted/50 text-xs gap-1.5"
                >
                  <ArrowUpDown className="size-3.5" />
                  <span className="hidden sm:inline">
                    {sortMode === 'belum-first' ? 'Belum dulu' : 'A-Z'}
                  </span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {sortMode === 'belum-first'
                  ? 'Urutkan: Belum input di atas'
                  : 'Urutkan: Alfabetis'}
              </TooltipContent>
            </ShadTooltip>

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
          label="Total Unit Wajib"
          value={kpis.totalUnits}
          icon={Users}
          color="#4f8ef7"
        />
        <KpiCard
          label="Sudah Input"
          value={kpis.compliantUnits}
          icon={ShieldCheck}
          color="#6ee7b7"
          subtitle={`${kpis.compliantUnits} unit patuh`}
        />
        <KpiCard
          label="Belum Input"
          value={kpis.nonCompliantUnits}
          icon={ShieldAlert}
          color="#f87171"
          subtitle={`${kpis.nonCompliantUnits} unit belum`}
        />
        <KpiCard
          label="Kepatuhan Pelaporan"
          value={`${kpis.kepatuhanPct.toFixed(0)}%`}
          icon={ClipboardList}
          color={kpis.kepatuhanPct >= 80 ? '#6ee7b7' : '#fbbf24'}
          subtitle={kpis.kepatuhanPct >= 80 ? 'Target tercapai' : 'Di bawah target'}
        />
      </div>

      {/* ── Horizontal Bar Chart ── */}
      <div className="rounded-xl border border-border p-4 bg-card">
        <div className="flex items-center gap-2 mb-3">
          <ClipboardList className="size-4 text-muted-foreground" />
          <h3 className="text-xs font-semibold text-foreground/70">Kepatuhan per Unit</h3>
        </div>
        <div style={{ height: `${chartHeight}px` }}>
          <Bar data={chartData} options={chartOptions} />
        </div>
      </div>

      {/* ── Detail Table ── */}
      <div className="rounded-xl border border-border overflow-hidden bg-card">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <Users className="size-4 text-muted-foreground" />
          <h3 className="text-xs font-semibold text-foreground/70">Detail Kepatuhan Unit</h3>
          <Badge variant="outline" className="border-border text-muted-foreground text-[10px] ml-auto">
            {sortedUnits.length} unit
          </Badge>
        </div>

        <div className="max-h-96 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-muted-foreground/20 [&::-webkit-scrollbar-thumb]:rounded-full">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground text-[11px] font-semibold">Unit</TableHead>
                <TableHead className="text-muted-foreground text-[11px] font-semibold">Status</TableHead>
                <TableHead className="text-muted-foreground text-[11px] font-semibold text-right">Entry</TableHead>
                <TableHead className="text-muted-foreground text-[11px] font-semibold">Terakhir Input</TableHead>
                <TableHead className="text-muted-foreground text-[11px] font-semibold">Indikator</TableHead>
                <TableHead className="text-muted-foreground text-[11px] font-semibold text-center">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedUnits.length === 0 && (
                <TableRow className="border-border/50 hover:bg-transparent">
                  <TableCell colSpan={6} className="text-center text-muted-foreground/50 text-xs py-8">
                    Tidak ada data unit
                  </TableCell>
                </TableRow>
              )}
              {sortedUnits.map((u) => (
                <TableRow
                  key={u.unitId}
                  className="border-border/50 hover:bg-muted/30"
                >
                  <TableCell className="text-foreground/80 text-xs font-medium whitespace-nowrap">
                    {u.unitLabel}
                  </TableCell>
                  <TableCell>
                    <ComplianceBadge compliant={u.isCompliant} />
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground text-xs font-mono">
                    {u.entryCount}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs font-mono">
                    {u.lastInputDate ?? (
                      <span className="text-muted-foreground/40">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1 max-w-[280px]">
                      {u.requiredIndicators.map((ind) => (
                        <IndicatorChip
                          key={ind}
                          type={ind}
                          hasData={u.hasData[ind] ?? false}
                        />
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <ShadTooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleReminder(u.unitLabel)}
                          className="h-7 text-amber-400/70 hover:text-amber-400 hover:bg-amber-500/10 text-xs gap-1"
                          disabled={u.isCompliant}
                        >
                          <Bell className="size-3" />
                          <span className="hidden md:inline">Remind</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Kirim reminder ke {u.unitLabel}</TooltipContent>
                    </ShadTooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
