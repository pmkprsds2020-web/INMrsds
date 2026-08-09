'use client';

import { useMemo, useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  FileBarChart,
  Printer,
  Download,
  CalendarDays,
  Filter,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Building2,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

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
  type IndicatorType,
  type IndicatorEntry,
  INDICATORS,
  UNIT_MAP,
} from '@/types';
import { getFilteredEntries } from '@/lib/supabaseData';
import { calculateStats, type IndicatorStats } from '@/lib/calculations';

/* ── Types ────────────────────────────────────────────────────── */

interface RingkasanLaporanPanelProps {
  activeUnit: string;
}

interface IndicatorReport {
  id: IndicatorType;
  label: string;
  target: number;
  targetLabel: string;
  color: string;
  isLowerBetter: boolean;
  numerator: number;
  denominator: number;
  pct: number;
  ok: boolean;
}

/* ── Animated container ───────────────────────────────────────── */

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
};

/* ── Main Component ───────────────────────────────────────────── */

export function RingkasanLaporanPanel({ activeUnit }: RingkasanLaporanPanelProps) {
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [startDate, setStartDate] = useState(firstDayOfMonth.toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(now.toISOString().slice(0, 10));
  const [unitFilter, setUnitFilter] = useState<string>(activeUnit === 'all' ? 'all' : activeUnit);
  const [reportData, setReportData] = useState<IndicatorReport[] | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Sync unitFilter with activeUnit prop changes
  useEffect(() => {
    setUnitFilter(activeUnit === 'all' ? 'all' : activeUnit);
  }, [activeUnit]);

  /* ── Generate report ──────────────────────────────────────── */
  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    try {
      const reports: IndicatorReport[] = [];

      // Determine which indicators to include based on selected unit
      const relevantIndicators = unitFilter === 'all'
        ? INDICATORS
        : INDICATORS.filter(ind => {
            const unitMeta = UNIT_MAP[unitFilter];
            return unitMeta && unitMeta.inds.includes(ind.id);
          });

      for (const ind of relevantIndicators) {
        const data = await getFilteredEntries(
          ind.id,
          unitFilter === 'all' ? null : unitFilter,
          startDate || undefined,
          endDate || undefined,
        );

        const stats: IndicatorStats = calculateStats(ind.id, data);

        reports.push({
          id: ind.id,
          label: ind.label,
          target: ind.target,
          targetLabel: ind.targetLabel,
          color: ind.color,
          isLowerBetter: ind.isLowerBetter,
          numerator: stats.num,
          denominator: stats.den,
          pct: stats.pct,
          ok: stats.ok,
        });
      }

      setReportData(reports);
      toast.success('Laporan berhasil dibuat');
    } catch {
      toast.error('Gagal membuat laporan');
    } finally {
      setIsGenerating(false);
    }
  }, [startDate, endDate, unitFilter]);

  /* ── Computed KPIs ─────────────────────────────────────────── */
  const executiveKpis = useMemo(() => {
    if (!reportData) return null;

    const totalIndicators = reportData.length;
    const metTarget = reportData.filter((r) => r.ok).length;
    const notMetTarget = totalIndicators - metTarget;
    const overallPct = totalIndicators > 0
      ? reportData.reduce((sum, r) => sum + r.pct, 0) / totalIndicators
      : 0;

    return { totalIndicators, metTarget, notMetTarget, overallPct };
  }, [reportData]);

  /* ── Print handler ─────────────────────────────────────────── */
  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const handleExportPdf = useCallback(async () => {
    try {
      const XLSX = await import('xlsx');
      if (!reportData) return;
      const rows = reportData.map((r, idx) => ({
        'No': idx + 1,
        'Indikator': r.label,
        'Target': r.targetLabel,
        'Numerator': r.numerator,
        'Denominator': r.denominator,
        'Capaian (%)': r.pct,
        'Status': r.ok ? 'MENCAPAI TARGET' : 'BELUM MENCAPAI',
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Ringkasan Laporan');
      XLSX.writeFile(wb, `Laporan_Mutu_RS_${startDate || 'all'}_${endDate || 'all'}.xlsx`);
      toast.success('Berhasil export laporan ke Excel');
    } catch {
      // Fallback to print if xlsx fails
      window.print();
    }
  }, [reportData, startDate, endDate]);

  /* ── Format period for display ─────────────────────────────── */
  const periodLabel = useMemo(() => {
    if (!startDate && !endDate) return 'Semua Periode';
    const start = startDate ? new Date(startDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '...';
    const end = endDate ? new Date(endDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '...';
    return `${start} — ${end}`;
  }, [startDate, endDate]);

  const unitLabel = useMemo(() => {
    if (unitFilter === 'all') return 'Semua Unit';
    return UNIT_MAP[unitFilter]?.label || unitFilter;
  }, [unitFilter]);

  /* ── Unit options ──────────────────────────────────────────── */
  const unitOptions = useMemo(() => {
    return Object.entries(UNIT_MAP).filter(([k]) => k !== 'all');
  }, []);

  /* ── Render ────────────────────────────────────────────────── */
  return (
    <div className="space-y-5 print-area">
      {/* ── Filter Controls ─────────────────────────────────────── */}
      <div
        className="no-print rounded-xl border border-border p-4"
        
      >
        <div className="flex flex-col gap-4">
          {/* Title */}
          <div className="flex items-center gap-2">
            <FileBarChart className="size-5 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Ringkasan Laporan</h2>
          </div>

          {/* Filters row */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Start date */}
            <div className="flex items-center gap-2">
              <CalendarDays className="size-3.5 text-muted-foreground shrink-0" />
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-8 w-[130px] bg-muted/50 border-border text-foreground/80 text-xs focus-visible:ring-white/20"
                aria-label="Tanggal mulai"
              />
              <span className="text-muted-foreground/60 text-xs">—</span>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-8 w-[130px] bg-muted/50 border-border text-foreground/80 text-xs focus-visible:ring-white/20"
                aria-label="Tanggal akhir"
              />
            </div>

            {/* Unit selector */}
            <div className="flex items-center gap-2">
              <Filter className="size-3.5 text-muted-foreground shrink-0" />
              <Select value={unitFilter} onValueChange={setUnitFilter}>
                <SelectTrigger className="h-8 w-[170px] bg-muted/50 border-border text-foreground/80 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent
                  className="border-border"
                  
                >
                  <SelectItem value="all" className="text-foreground/70 text-xs focus:text-foreground focus:bg-muted">
                    Semua Unit
                  </SelectItem>
                  {unitOptions.map(([key, meta]) => (
                    <SelectItem key={key} value={key} className="text-foreground/70 text-xs focus:text-foreground focus:bg-muted">
                      {meta.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Generate button */}
            <Button
              size="sm"
              onClick={handleGenerate}
              disabled={isGenerating}
              className="h-8 bg-[#4f8ef7]/20 text-[#4f8ef7] hover:bg-[#4f8ef7]/30 border-0 text-xs font-medium gap-1.5"
            >
              {isGenerating ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <FileBarChart className="size-3.5" />
              )}
              Buat Laporan
            </Button>
          </div>
        </div>
      </div>

      {/* ── No data state ──────────────────────────────────────── */}
      {!reportData && !isGenerating && (
        <div
          className="rounded-xl border border-border p-12 text-center"
          
        >
          <FileBarChart className="size-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-xs text-muted-foreground/60">
            Pilih periode dan unit, lalu klik &quot;Buat Laporan&quot; untuk menghasilkan ringkasan.
          </p>
        </div>
      )}

      {/* ── Loading state ──────────────────────────────────────── */}
      {isGenerating && (
        <div
          className="rounded-xl border border-border p-12 text-center"
          
        >
          <Loader2 className="size-8 animate-spin text-[#4f8ef7]/50 mx-auto mb-3" />
          <p className="text-xs text-muted-foreground">Menghasilkan laporan...</p>
        </div>
      )}

      {/* ── Report Content ─────────────────────────────────────── */}
      {reportData && executiveKpis && (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-5"
        >
          {/* ── Report Header (print + screen) ──────────────────── */}
          <motion.div
            variants={itemVariants}
            className="rounded-xl border border-border p-6 print-header"
            
          >
            <div className="flex items-start gap-4">
              {/* Logo / icon area */}
              <div
                className="flex size-14 items-center justify-center rounded-xl shrink-0"
                style={{ backgroundColor: '#4f8ef720' }}
              >
                <Building2 className="size-7 text-[#4f8ef7]" />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-lg font-bold text-foreground print:text-black">
                  Laporan Ringkasan Mutu Rumah Sakit
                </h1>
                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground print:text-gray-600">
                  <span>Periode: <strong className="text-foreground/70 print:text-black">{periodLabel}</strong></span>
                  <span>Unit: <strong className="text-foreground/70 print:text-black">{unitLabel}</strong></span>
                  <span>Dicetak: <strong className="text-foreground/70 print:text-black">{new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</strong></span>
                </div>
              </div>
              {/* Print / Export buttons (no-print) */}
              <div className="no-print flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  onClick={handlePrint}
                  className="h-8 bg-muted text-foreground/80 hover:bg-muted border-0 text-xs font-medium gap-1.5"
                >
                  <Printer className="size-3.5" />
                  Cetak Laporan
                </Button>
                <Button
                  size="sm"
                  onClick={handleExportPdf}
                  className="h-8 bg-[#4f8ef7]/20 text-[#4f8ef7] hover:bg-[#4f8ef7]/30 border-0 text-xs font-medium gap-1.5"
                >
                  <Download className="size-3.5" />
                  Export PDF
                </Button>
              </div>
            </div>
          </motion.div>

          {/* ── Executive KPIs ──────────────────────────────────── */}
          <motion.div
            variants={itemVariants}
            className="grid grid-cols-2 lg:grid-cols-4 gap-3"
          >
            {/* Overall compliance */}
            <div
              className="rounded-lg border border-border p-4 card-hover"
              
            >
              <p className="text-[11px] text-muted-foreground font-medium">Kepatuhan Keseluruhan</p>
              <p className="text-xl font-bold font-mono tracking-tight mt-0.5" style={{ color: executiveKpis.overallPct >= 80 ? '#6ee7b7' : '#f87171' }}>
                {executiveKpis.overallPct.toFixed(1)}%
              </p>
              <p className="text-[10px] text-muted-foreground/60 mt-0.5">Rata-rata capaian</p>
            </div>

            {/* Met target */}
            <div
              className="rounded-lg border border-border p-4 card-hover"
              
            >
              <p className="text-[11px] text-muted-foreground font-medium">Indikator Tercapai</p>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <p className="text-xl font-bold font-mono tracking-tight text-emerald-400">
                  {executiveKpis.metTarget}
                </p>
                <span className="text-xs text-muted-foreground/60">/ {executiveKpis.totalIndicators}</span>
              </div>
              <div className="mt-1.5">
                <CheckCircle2 className="size-3.5 text-emerald-400" />
              </div>
            </div>

            {/* Not met target */}
            <div
              className="rounded-lg border border-border p-4 card-hover"
              
            >
              <p className="text-[11px] text-muted-foreground font-medium">Belum Tercapai</p>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <p className="text-xl font-bold font-mono tracking-tight text-red-400">
                  {executiveKpis.notMetTarget}
                </p>
                <span className="text-xs text-muted-foreground/60">indikator</span>
              </div>
              <div className="mt-1.5">
                {executiveKpis.notMetTarget > 0 ? (
                  <XCircle className="size-3.5 text-red-400" />
                ) : (
                  <CheckCircle2 className="size-3.5 text-emerald-400" />
                )}
              </div>
            </div>

            {/* Areas needing improvement */}
            <div
              className="rounded-lg border border-border p-4 card-hover"
              
            >
              <p className="text-[11px] text-muted-foreground font-medium">Perlu Perbaikan</p>
              <p className="text-xl font-bold font-mono tracking-tight text-amber-400 mt-0.5">
                {reportData.filter((r) => !r.ok && r.pct > 0).length}
              </p>
              <div className="mt-1.5">
                {reportData.filter((r) => !r.ok && r.pct > 0).length > 0 ? (
                  <AlertTriangle className="size-3.5 text-amber-400" />
                ) : (
                  <CheckCircle2 className="size-3.5 text-emerald-400" />
                )}
              </div>
            </div>
          </motion.div>

          {/* ── Per-indicator table ─────────────────────────────── */}
          <motion.div
            variants={itemVariants}
            className="rounded-xl border border-border overflow-hidden print-table"
            
          >
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
              <FileBarChart className="size-4 text-muted-foreground" />
              <h3 className="text-xs font-semibold text-foreground/70">Detail Per Indikator</h3>
              <Badge variant="outline" className="border-border text-muted-foreground text-[10px] ml-auto no-print">
                {reportData.length} indikator
              </Badge>
            </div>

            <div className="max-h-96 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-muted [&::-webkit-scrollbar-thumb]:rounded-full">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground text-[10px] font-semibold w-8">No</TableHead>
                    <TableHead className="text-muted-foreground text-[10px] font-semibold">Indikator</TableHead>
                    <TableHead className="text-muted-foreground text-[10px] font-semibold text-center">Target</TableHead>
                    <TableHead className="text-muted-foreground text-[10px] font-semibold text-center">Numerator</TableHead>
                    <TableHead className="text-muted-foreground text-[10px] font-semibold text-center">Denominator</TableHead>
                    <TableHead className="text-muted-foreground text-[10px] font-semibold text-center">Capaian</TableHead>
                    <TableHead className="text-muted-foreground text-[10px] font-semibold text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportData.map((r, idx) => (
                    <TableRow key={r.id} className="border-border/50 hover:bg-muted/30">
                      <TableCell className="text-muted-foreground text-xs">{idx + 1}</TableCell>
                      <TableCell className="text-foreground/80 text-xs font-medium">
                        <div className="flex items-center gap-2">
                          <span
                            className="size-2 rounded-full shrink-0"
                            style={{ backgroundColor: r.color }}
                          />
                          {r.label}
                        </div>
                      </TableCell>
                      <TableCell className="text-center text-xs text-muted-foreground">
                        {r.targetLabel}
                      </TableCell>
                      <TableCell className="text-center text-xs text-muted-foreground font-mono">
                        {r.numerator}
                      </TableCell>
                      <TableCell className="text-center text-xs text-muted-foreground font-mono">
                        {r.denominator}
                      </TableCell>
                      <TableCell className="text-center text-xs font-mono">
                        <span style={{ color: r.ok ? '#6ee7b7' : '#f87171' }}>
                          {r.pct}%
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        {r.ok ? (
                          <Badge className="bg-emerald-500/20 text-emerald-400 border-0 text-[10px] font-semibold gap-0.5">
                            <CheckCircle2 className="size-3" />
                            Mencapai
                          </Badge>
                        ) : (
                          <Badge className="bg-red-500/20 text-red-400 border-0 text-[10px] font-semibold gap-0.5">
                            <XCircle className="size-3" />
                            Belum
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </motion.div>

          {/* ── Areas needing improvement ────────────────────────── */}
          {reportData.filter((r) => !r.ok).length > 0 && (
            <motion.div
              variants={itemVariants}
              className="rounded-xl border border-red-500/20 p-4"
              
            >
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="size-4 text-amber-400" />
                <h3 className="text-xs font-semibold text-foreground/70">Area yang Perlu Perbaikan</h3>
              </div>
              <div className="space-y-2">
                {reportData
                  .filter((r) => !r.ok)
                  .sort((a, b) => a.pct - b.pct)
                  .map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center gap-3 rounded-lg border border-border/50 p-3"
                    >
                      <span
                        className="size-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: r.color }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground/80">{r.label}</p>
                        <p className="text-[10px] text-muted-foreground">
                          Target: {r.targetLabel} · Capaian: {r.pct}% · Gap: {r.isLowerBetter ? (r.pct - r.target).toFixed(1) : (r.target - r.pct).toFixed(1)}%
                        </p>
                      </div>
                      <div className="shrink-0">
                        <Badge className="bg-red-500/20 text-red-400 border-0 text-[10px]">
                          {r.pct}%
                        </Badge>
                      </div>
                    </div>
                  ))}
              </div>
            </motion.div>
          )}

          {/* ── Print-only footer ───────────────────────────────── */}
          <motion.div
            variants={itemVariants}
            className="rounded-xl border border-border p-4 no-print"
            
          >
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-muted-foreground/60">
                Laporan ini dihasilkan secara otomatis oleh Dashboard Mutu RS
              </p>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={handlePrint}
                  className="h-8 bg-muted text-foreground/80 hover:bg-muted border-0 text-xs font-medium gap-1.5"
                >
                  <Printer className="size-3.5" />
                  Cetak Laporan
                </Button>
                <Button
                  size="sm"
                  onClick={handleExportPdf}
                  className="h-8 bg-[#4f8ef7]/20 text-[#4f8ef7] hover:bg-[#4f8ef7]/30 border-0 text-xs font-medium gap-1.5"
                >
                  <Download className="size-3.5" />
                  Export PDF
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
