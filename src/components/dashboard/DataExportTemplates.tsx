'use client';

import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileBarChart,
  CalendarDays,
  Download,
  FileText,
  FileSpreadsheet,
  ChevronDown,
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
  INDICATORS,
  UNIT_MAP,
} from '@/types';
import { getFilteredEntries } from '@/lib/firestore';
import { calculateStats, type IndicatorStats } from '@/lib/calculations';

/* ── Types ────────────────────────────────────────────────────── */

interface DataExportTemplatesProps {
  activeUnit: string;
}

type TemplateType = 'monthly' | 'quarterly' | 'annual';

interface TemplateMeta {
  key: TemplateType;
  label: string;
  description: string;
  icon: typeof FileText;
  periodLabel: string;
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

/* ── Template metadata ────────────────────────────────────────── */
const TEMPLATES: TemplateMeta[] = [
  {
    key: 'monthly',
    label: 'Laporan Bulanan',
    description: 'Laporan mutu bulanan dengan ringkasan capaian per indikator, analisis tren, dan rekomendasi.',
    icon: FileText,
    periodLabel: 'Bulanan',
  },
  {
    key: 'quarterly',
    label: 'Laporan Kuartalan',
    description: 'Laporan mutu triwulanan dengan perbandingan antar bulan, ringkasan kepatuhan, dan tindak lanjut.',
    icon: FileBarChart,
    periodLabel: 'Kuartalan',
  },
  {
    key: 'annual',
    label: 'Laporan Kepatuhan Tahunan',
    description: 'Laporan kepatuhan tahunan lengkap dengan ringkasan eksekutif, analisis per indikator, dan rencana perbaikan.',
    icon: FileSpreadsheet,
    periodLabel: 'Tahunan',
  },
];

/* ── Get default date range based on template type ────────────── */
function getDefaultDateRange(type: TemplateType): { start: string; end: string } {
  const now = new Date();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  switch (type) {
    case 'monthly': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: fmt(start), end: fmt(now) };
    }
    case 'quarterly': {
      const quarter = Math.floor(now.getMonth() / 3);
      const start = new Date(now.getFullYear(), quarter * 3, 1);
      return { start: fmt(start), end: fmt(now) };
    }
    case 'annual': {
      const start = new Date(now.getFullYear(), 0, 1);
      return { start: fmt(start), end: fmt(now) };
    }
  }
}

/* ── Main Component ───────────────────────────────────────────── */
export function DataExportTemplates({ activeUnit }: DataExportTemplatesProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateType>('monthly');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [unitFilter, setUnitFilter] = useState<string>(activeUnit === 'all' ? 'all' : activeUnit);
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportData, setReportData] = useState<IndicatorReport[] | null>(null);

  // Set default dates when template changes
  const handleTemplateChange = useCallback((type: TemplateType) => {
    setSelectedTemplate(type);
    const range = getDefaultDateRange(type);
    setStartDate(range.start);
    setEndDate(range.end);
  }, []);

  // Initialize dates on mount
  useMemo(() => {
    const range = getDefaultDateRange('monthly');
    setStartDate(range.start);
    setEndDate(range.end);
  }, []);

  const currentTemplate = TEMPLATES.find((t) => t.key === selectedTemplate)!;

  /* ── Generate report ──────────────────────────────────────── */
  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    try {
      const reports: IndicatorReport[] = [];
      const relevantIndicators = unitFilter === 'all'
        ? INDICATORS
        : INDICATORS.filter((ind) => {
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
      toast.success('Template laporan berhasil dibuat');
    } catch {
      toast.error('Gagal membuat laporan');
    } finally {
      setIsGenerating(false);
    }
  }, [startDate, endDate, unitFilter]);

  /* ── Export handler ────────────────────────────────────────── */
  const handleExport = useCallback(async () => {
    if (!reportData) return;
    try {
      const XLSX = await import('xlsx');
      const templateName = currentTemplate.label;
      const unitLabel = unitFilter === 'all' ? 'Semua_Unit' : (UNIT_MAP[unitFilter]?.label || unitFilter);

      // Cover sheet
      const coverData = [
        ['LAPORAN MUTU RUMAH SAKIT'],
        [''],
        ['Jenis Laporan', templateName],
        ['Periode', `${startDate} s/d ${endDate}`],
        ['Unit', unitFilter === 'all' ? 'Semua Unit' : unitLabel],
        ['Tanggal Cetak', new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })],
        [''],
        ['Disusun oleh', 'Tim Mutu Rumah Sakit'],
        ['Disetujui oleh', 'Direktur Rumah Sakit'],
      ];

      // Summary sheet
      const totalIndicators = reportData.length;
      const metTarget = reportData.filter((r) => r.ok).length;
      const overallPct = totalIndicators > 0
        ? reportData.reduce((sum, r) => sum + r.pct, 0) / totalIndicators
        : 0;

      const summaryData = [
        ['RINGKASAN EKSEKUTIF'],
        [''],
        ['Total Indikator', String(totalIndicators)],
        ['Indikator Tercapai', String(metTarget)],
        ['Indikator Belum Tercapai', String(totalIndicators - metTarget)],
        ['Kepatuhan Keseluruhan (%)', overallPct.toFixed(1)],
        [''],
        ['INDIKATOR YANG PERLU PERHATIAN'],
        ...reportData
          .filter((r) => !r.ok)
          .sort((a, b) => a.pct - b.pct)
          .map((r) => [r.label, `${r.pct}%`, `Target: ${r.targetLabel}`]),
      ];

      // Detail sheet
      const detailRows = reportData.map((r, idx) => ({
        'No': idx + 1,
        'Indikator': r.label,
        'Target': r.targetLabel,
        'Numerator': r.numerator,
        'Denominator': r.denominator,
        'Capaian (%)': r.pct,
        'Status': r.ok ? 'MENCAPAI TARGET' : 'BELUM MENCAPAI',
      }));

      // Recommendations sheet (for quarterly & annual)
      const recommendationData = selectedTemplate !== 'monthly' ? [
        ['REKOMENDASI TINDAK LANJUT'],
        [''],
        ...reportData
          .filter((r) => !r.ok)
          .sort((a, b) => a.pct - b.pct)
          .map((r) => [
            r.label,
            `Capaian: ${r.pct}% (Target: ${r.targetLabel})`,
            `Perlu intervensi untuk meningkatkan kepatuhan ${r.label}`,
            `Prioritas: ${r.pct < 50 ? 'TINGGI' : r.pct < 75 ? 'SEDANG' : 'RENDA'}`,
          ]),
      ] : null;

      const wb = XLSX.utils.book_new();

      // Add cover
      const coverWs = XLSX.utils.aoa_to_sheet(coverData);
      XLSX.utils.book_append_sheet(wb, coverWs, 'Sampul');

      // Add summary
      const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, summaryWs, 'Ringkasan');

      // Add detail
      const detailWs = XLSX.utils.json_to_sheet(detailRows);
      XLSX.utils.book_append_sheet(wb, detailWs, 'Detail Indikator');

      // Add recommendations for quarterly/annual
      if (recommendationData) {
        const recWs = XLSX.utils.aoa_to_sheet(recommendationData);
        XLSX.utils.book_append_sheet(wb, recWs, 'Rekomendasi');
      }

      // Add trend analysis for annual
      if (selectedTemplate === 'annual') {
        const trendData = [
          ['ANALISIS TREN TAHUNAN'],
          [''],
          ['Indikator', 'Capaian (%)', 'Target', 'Gap (%)', 'Status'],
          ...reportData.map((r) => [
            r.label,
            r.pct,
            r.targetLabel,
            (r.isLowerBetter ? (r.pct - r.target) : (r.target - r.pct)).toFixed(1),
            r.ok ? 'Tercapai' : 'Perlu Perbaikan',
          ]),
        ];
        const trendWs = XLSX.utils.aoa_to_sheet(trendData);
        XLSX.utils.book_append_sheet(wb, trendWs, 'Analisis Tren');
      }

      XLSX.writeFile(wb, `${templateName.replace(/\s+/g, '_')}_${unitLabel}_${startDate}_${endDate}.xlsx`);
      toast.success('Template berhasil diekspor ke Excel');
    } catch {
      toast.error('Gagal mengekspor template');
    }
  }, [reportData, currentTemplate, unitFilter, startDate, endDate, selectedTemplate]);

  /* ── Unit options ──────────────────────────────────────────── */
  const unitOptions = useMemo(() => {
    return Object.entries(UNIT_MAP).filter(([k]) => k !== 'all');
  }, []);

  /* ── Computed KPIs ─────────────────────────────────────────── */
  const executiveKpis = useMemo(() => {
    if (!reportData) return null;
    const totalIndicators = reportData.length;
    const metTarget = reportData.filter((r) => r.ok).length;
    const overallPct = totalIndicators > 0
      ? reportData.reduce((sum, r) => sum + r.pct, 0) / totalIndicators
      : 0;
    return { totalIndicators, metTarget, notMetTarget: totalIndicators - metTarget, overallPct };
  }, [reportData]);

  return (
    <div className="space-y-5">
      {/* ── Template selector ─────────────────────────────────── */}
      <div className="rounded-xl border border-border p-4">
        <div className="flex items-center gap-2 mb-4">
          <FileSpreadsheet className="size-5 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Template Ekspor Data</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          {TEMPLATES.map((tpl) => {
            const Icon = tpl.icon;
            const isActive = selectedTemplate === tpl.key;
            return (
              <motion.button
                key={tpl.key}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleTemplateChange(tpl.key)}
                className={`relative flex flex-col gap-2 rounded-xl border p-4 text-left transition-all duration-200 ${
                  isActive
                    ? 'border-[#4f8ef7]/40 bg-[#4f8ef7]/10 shadow-sm'
                    : 'border-border bg-card hover:border-border hover:bg-muted/30'
                }`}
              >
                {isActive && (
                  <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[#4f8ef7] to-transparent" />
                )}
                <div className="flex items-center gap-2">
                  <span className={`flex size-8 items-center justify-center rounded-lg ${isActive ? 'bg-[#4f8ef7]/20' : 'bg-muted/50'}`}>
                    <Icon className={`size-4 ${isActive ? 'text-[#4f8ef7]' : 'text-muted-foreground'}`} />
                  </span>
                  <span className={`text-xs font-semibold ${isActive ? 'text-[#4f8ef7]' : 'text-foreground/80'}`}>
                    {tpl.label}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground/60 leading-relaxed">
                  {tpl.description}
                </p>
                <Badge
                  variant="outline"
                  className={`self-start text-[9px] border-0 ${
                    isActive ? 'bg-[#4f8ef7]/15 text-[#4f8ef7]' : 'bg-muted/50 text-muted-foreground'
                  }`}
                >
                  {tpl.periodLabel}
                </Badge>
              </motion.button>
            );
          })}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="size-3.5 text-muted-foreground shrink-0" />
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-8 w-[130px] bg-muted/50 border-border text-foreground/80 text-xs"
              aria-label="Tanggal mulai"
            />
            <span className="text-muted-foreground/60 text-xs">—</span>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-8 w-[130px] bg-muted/50 border-border text-foreground/80 text-xs"
              aria-label="Tanggal akhir"
            />
          </div>

          <Select value={unitFilter} onValueChange={setUnitFilter}>
            <SelectTrigger className="h-8 w-[170px] bg-muted/50 border-border text-foreground/80 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-border">
              <SelectItem value="all" className="text-foreground/70 text-xs">Semua Unit</SelectItem>
              {unitOptions.map(([key, meta]) => (
                <SelectItem key={key} value={key} className="text-foreground/70 text-xs">
                  {meta.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

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
            Buat Template
          </Button>
        </div>
      </div>

      {/* ── Loading state ─────────────────────────────────────── */}
      {isGenerating && (
        <div className="rounded-xl border border-border p-12 text-center">
          <Loader2 className="size-8 animate-spin text-[#4f8ef7]/50 mx-auto mb-3" />
          <p className="text-xs text-muted-foreground">Menghasilkan template laporan...</p>
        </div>
      )}

      {/* ── No data state ─────────────────────────────────────── */}
      {!reportData && !isGenerating && (
        <div className="rounded-xl border border-border p-12 text-center">
          <FileSpreadsheet className="size-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-xs text-muted-foreground/60">
            Pilih template, periode, dan unit, lalu klik &quot;Buat Template&quot; untuk menghasilkan laporan.
          </p>
        </div>
      )}

      {/* ── Generated report preview ──────────────────────────── */}
      <AnimatePresence>
        {reportData && executiveKpis && !isGenerating && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            {/* Report header */}
            <div className="rounded-xl border border-border p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-foreground/90">{currentTemplate.label}</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Periode: {startDate} — {endDate} · Unit: {unitFilter === 'all' ? 'Semua Unit' : UNIT_MAP[unitFilter]?.label}
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={handleExport}
                  className="h-8 bg-[#4f8ef7]/20 text-[#4f8ef7] hover:bg-[#4f8ef7]/30 border-0 text-xs font-medium gap-1.5"
                >
                  <Download className="size-3.5" />
                  Export Excel
                </Button>
              </div>
            </div>

            {/* Executive KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="rounded-lg border border-border p-3">
                <p className="text-[10px] text-muted-foreground font-medium">Kepatuhan Keseluruhan</p>
                <p className="text-xl font-bold font-mono mt-0.5" style={{ color: executiveKpis.overallPct >= 80 ? '#6ee7b7' : '#f87171' }}>
                  {executiveKpis.overallPct.toFixed(1)}%
                </p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-[10px] text-muted-foreground font-medium">Tercapai</p>
                <p className="text-xl font-bold font-mono text-emerald-400 mt-0.5">
                  {executiveKpis.metTarget}/{executiveKpis.totalIndicators}
                </p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-[10px] text-muted-foreground font-medium">Belum Tercapai</p>
                <p className="text-xl font-bold font-mono text-red-400 mt-0.5">{executiveKpis.notMetTarget}</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-[10px] text-muted-foreground font-medium">Perlu Perbaikan</p>
                <p className="text-xl font-bold font-mono text-amber-400 mt-0.5">
                  {reportData.filter((r) => !r.ok && r.pct > 0).length}
                </p>
              </div>
            </div>

            {/* Detail table */}
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="max-h-80 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="text-muted-foreground text-[10px] font-semibold w-8">No</TableHead>
                      <TableHead className="text-muted-foreground text-[10px] font-semibold">Indikator</TableHead>
                      <TableHead className="text-muted-foreground text-[10px] font-semibold text-center">Target</TableHead>
                      <TableHead className="text-muted-foreground text-[10px] font-semibold text-center">Capaian</TableHead>
                      <TableHead className="text-muted-foreground text-[10px] font-semibold text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportData.map((r, idx) => (
                      <TableRow key={r.id} className={idx % 2 === 0 ? 'bg-transparent' : 'bg-muted/15'}>
                        <TableCell className="text-muted-foreground text-xs">{idx + 1}</TableCell>
                        <TableCell className="text-foreground/80 text-xs font-medium">
                          <div className="flex items-center gap-2">
                            <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: r.color }} />
                            {r.label}
                          </div>
                        </TableCell>
                        <TableCell className="text-center text-xs text-muted-foreground">{r.targetLabel}</TableCell>
                        <TableCell className="text-center text-xs font-mono" style={{ color: r.ok ? '#6ee7b7' : '#f87171' }}>
                          {r.pct}%
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge className={`border-0 text-[9px] font-semibold gap-0.5 ${r.ok ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                            {r.ok ? 'Mencapai' : 'Belum'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Template-specific sections */}
            {selectedTemplate !== 'monthly' && reportData.filter((r) => !r.ok).length > 0 && (
              <div className="rounded-xl border border-amber-500/20 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <FileBarChart className="size-4 text-amber-400" />
                  <h3 className="text-xs font-semibold text-foreground/70">Rekomendasi Tindak Lanjut</h3>
                </div>
                <div className="space-y-2">
                  {reportData
                    .filter((r) => !r.ok)
                    .sort((a, b) => a.pct - b.pct)
                    .map((r) => (
                      <div key={r.id} className="flex items-center gap-3 rounded-lg border border-border/50 p-2.5">
                        <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: r.color }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-foreground/80">{r.label}</p>
                          <p className="text-[10px] text-muted-foreground">
                            Capaian: {r.pct}% · Target: {r.targetLabel} · Prioritas: {r.pct < 50 ? 'TINGGI' : r.pct < 75 ? 'SEDANG' : 'RENDA'}
                          </p>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {selectedTemplate === 'annual' && (
              <div className="rounded-xl border border-border p-4">
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="size-4 text-muted-foreground" />
                  <h3 className="text-xs font-semibold text-foreground/70">Bagian Laporan Tahunan</h3>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <div className="rounded-lg border border-border/50 p-2.5">1. Ringkasan Eksekutif</div>
                  <div className="rounded-lg border border-border/50 p-2.5">2. Profil Rumah Sakit</div>
                  <div className="rounded-lg border border-border/50 p-2.5">3. Data Per Indikator</div>
                  <div className="rounded-lg border border-border/50 p-2.5">4. Analisis Tren Tahunan</div>
                  <div className="rounded-lg border border-border/50 p-2.5">5. Rekomendasi & Tindak Lanjut</div>
                  <div className="rounded-lg border border-border/50 p-2.5">6. Rencana Perbaikan</div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
