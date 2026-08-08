'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  ShieldCheck,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Target,
  Lightbulb,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  INDICATORS,
  UNIT_MAP,
  type IndicatorEntry,
  type IndicatorType,
} from '@/types';
import { calculateStats } from '@/lib/calculations';

interface DataQualityPanelProps {
  allEntries: IndicatorEntry[];
  activeUnit: string;
}

/* ── Quality badge color helper ─────────────────────────────────── */
function getQualityBadge(score: number): { label: string; color: string; bgClass: string; textColor: string } {
  if (score >= 90) return { label: 'Excellent', color: '#34d399', bgClass: 'bg-emerald-500/10', textColor: 'text-emerald-500' };
  if (score >= 70) return { label: 'Good', color: '#4f8ef7', bgClass: 'bg-blue-500/10', textColor: 'text-blue-500' };
  if (score >= 50) return { label: 'Fair', color: '#f59e0b', bgClass: 'bg-amber-500/10', textColor: 'text-amber-500' };
  return { label: 'Poor', color: '#f87171', bgClass: 'bg-red-500/10', textColor: 'text-red-500' };
}

/* ── Circular Gauge Component ───────────────────────────────────── */
function CircularGauge({ value, size = 160 }: { value: number; size?: number }) {
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  const badge = getQualityBadge(value);

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/30"
        />
        {/* Progress circle */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={badge.color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          className="text-3xl font-bold font-mono text-foreground"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          {Math.round(value)}
        </motion.span>
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">
          / 100
        </span>
        <Badge className={`mt-1.5 text-[9px] font-bold ${badge.bgClass} ${badge.textColor} border-0`}>
          {badge.label}
        </Badge>
      </div>
    </div>
  );
}

/* ── Metric Card Component ──────────────────────────────────────── */
function MetricCard({
  icon,
  label,
  value,
  description,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  description: string;
  color: string;
}) {
  const badge = getQualityBadge(value);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex items-center gap-3 rounded-lg border border-border bg-background/50 p-3"
    >
      <div
        className="flex size-9 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: `${color}20` }}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-medium text-foreground">{label}</p>
          <Badge className={`text-[9px] font-bold ${badge.bgClass} ${badge.textColor} border-0`}>
            {badge.label}
          </Badge>
        </div>
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-sm font-bold font-mono text-foreground">
            {Math.round(value)}%
          </span>
          <span className="text-[10px] text-muted-foreground">{description}</span>
        </div>
        <Progress
          value={value}
          className="h-1.5 bg-muted"
        />
      </div>
    </motion.div>
  );
}

/* ── Indicator Quality Row ──────────────────────────────────────── */
function IndicatorQualityRow({
  indicatorId,
  entries,
  index,
}: {
  indicatorId: IndicatorType;
  entries: IndicatorEntry[];
  index: number;
}) {
  const meta = INDICATORS.find(i => i.id === indicatorId);
  const stats = useMemo(() => calculateStats(indicatorId, entries), [indicatorId, entries]);

  if (!meta) return null;

  // Calculate quality metrics per indicator
  const completeness = entries.length > 0
    ? Math.min(100, Math.round((entries.filter(e => {
        // Check if critical fields are filled
        switch (e.indicatorType) {
          case 'tangan': return (e as IndicatorEntry & { staff: string }).staff;
          case 'visite': return (e as IndicatorEntry & { doctor: string }).doctor;
          case 'identitas': return (e as IndicatorEntry & { name: string }).name;
          case 'apd': return (e as IndicatorEntry & { comp: string }).comp;
          case 'jatuh': return (e as IndicatorEntry & { rm: string }).rm;
          case 'sc': return (e as IndicatorEntry & { rm: string }).rm;
          case 'wtrj': return (e as IndicatorEntry & { rm: string }).rm;
          case 'op': return (e as IndicatorEntry & { rm: string }).rm;
          case 'lab': return (e as IndicatorEntry & { rm: string }).rm;
          case 'fornas': return (e as IndicatorEntry & { num: number }).num > 0 || (e as IndicatorEntry & { non: number }).non > 0;
          case 'cp': return (e as IndicatorEntry & { name: string }).name;
          default: return true;
        }
      }).length / entries.length) * 100))
    : 0;

  const timeliness = entries.length > 0
    ? Math.min(100, Math.round((entries.filter(e => {
        // Check if entry was created on the same day as its date
        if (!e.createdAt || !e.date) return true;
        return e.createdAt.slice(0, 10) === e.date;
      }).length / entries.length) * 100))
    : 0;

  const consistency = entries.length > 0
    ? Math.min(100, Math.round((entries.filter(e => {
        // Check for contradictions — e.g., patuh but no moments checked for tangan
        if (e.indicatorType === 'tangan') {
          const t = e as IndicatorEntry & { m1: boolean; m2: boolean; m3: boolean; m4: boolean; m5: boolean; patuh: boolean | null };
          if (t.patuh === true && !t.m1 && !t.m2 && !t.m3 && !t.m4 && !t.m5) return false;
        }
        return true;
      }).length / entries.length) * 100))
    : 0;

  const accuracy = stats.den > 0 ? Math.min(100, Math.round(stats.pct)) : 0;

  // Overall quality for this indicator (weighted average)
  const overallQuality = Math.round(
    completeness * 0.3 + timeliness * 0.2 + consistency * 0.2 + accuracy * 0.3
  );

  const overallBadge = getQualityBadge(overallQuality);

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25, delay: index * 0.04 }}
      className="flex items-center gap-3 py-2.5 border-b border-border/50 last:border-0"
    >
      <div
        className="flex size-8 shrink-0 items-center justify-center rounded-md text-xs font-bold"
        style={{ backgroundColor: `${meta.color}20`, color: meta.color }}
      >
        {index + 1}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <p className="text-xs font-medium text-foreground truncate">{meta.label}</p>
          <Badge className={`text-[8px] font-bold ${overallBadge.bgClass} ${overallBadge.textColor} border-0 shrink-0`}>
            {overallBadge.label}
          </Badge>
        </div>
        <div className="grid grid-cols-4 gap-2">
          <div>
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[9px] text-muted-foreground">Kelengkapan</span>
              <span className="text-[9px] font-mono text-foreground/60">{completeness}%</span>
            </div>
            <Progress value={completeness} className="h-1 bg-muted" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[9px] text-muted-foreground">Ketepatan</span>
              <span className="text-[9px] font-mono text-foreground/60">{timeliness}%</span>
            </div>
            <Progress value={timeliness} className="h-1 bg-muted" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[9px] text-muted-foreground">Konsistensi</span>
              <span className="text-[9px] font-mono text-foreground/60">{consistency}%</span>
            </div>
            <Progress value={consistency} className="h-1 bg-muted" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[9px] text-muted-foreground">Akurasi</span>
              <span className="text-[9px] font-mono text-foreground/60">{accuracy}%</span>
            </div>
            <Progress value={accuracy} className="h-1 bg-muted" />
          </div>
        </div>
      </div>
      <div className="text-right shrink-0 pl-2">
        <p className="text-lg font-bold font-mono text-foreground">{overallQuality}</p>
        <p className="text-[9px] text-muted-foreground">Skor</p>
      </div>
    </motion.div>
  );
}

/* ── Main Component ─────────────────────────────────────────────── */
export function DataQualityPanel({ allEntries, activeUnit }: DataQualityPanelProps) {
  const unitMeta = UNIT_MAP[activeUnit] ?? UNIT_MAP['all'];

  // Group entries by indicator type
  const entriesByType = useMemo(() => {
    const grouped: Partial<Record<IndicatorType, IndicatorEntry[]>> = {};
    for (const e of allEntries) {
      const type = e.indicatorType as IndicatorType;
      if (activeUnit !== 'all' && e.unitId !== activeUnit) continue;
      if (!unitMeta.inds.includes(type)) continue;
      if (!grouped[type]) grouped[type] = [];
      grouped[type]!.push(e);
    }
    return grouped;
  }, [allEntries, activeUnit, unitMeta.inds]);

  // Relevant indicators
  const relevantIndicators = useMemo(() => {
    return INDICATORS.filter(ind => unitMeta.inds.includes(ind.id as IndicatorType));
  }, [unitMeta.inds]);

  // Calculate overall quality metrics
  const qualityMetrics = useMemo(() => {
    let totalCompleteness = 0;
    let totalTimeliness = 0;
    let totalConsistency = 0;
    let totalAccuracy = 0;
    let indicatorCount = 0;

    for (const ind of relevantIndicators) {
      const entries = entriesByType[ind.id] || [];
      if (entries.length === 0) continue;

      indicatorCount++;

      // Completeness
      const completeness = Math.min(100, Math.round(
        (entries.filter(e => {
          switch (e.indicatorType) {
            case 'tangan': return !!(e as IndicatorEntry & { staff: string }).staff;
            case 'visite': return !!(e as IndicatorEntry & { doctor: string }).doctor;
            case 'identitas': return !!(e as IndicatorEntry & { name: string }).name;
            case 'apd': return !!(e as IndicatorEntry & { comp: string }).comp;
            case 'jatuh': return !!(e as IndicatorEntry & { rm: string }).rm;
            case 'sc': return !!(e as IndicatorEntry & { rm: string }).rm;
            case 'wtrj': return !!(e as IndicatorEntry & { rm: string }).rm;
            case 'op': return !!(e as IndicatorEntry & { rm: string }).rm;
            case 'lab': return !!(e as IndicatorEntry & { rm: string }).rm;
            case 'fornas': return (e as IndicatorEntry & { num: number }).num > 0 || (e as IndicatorEntry & { non: number }).non > 0;
            case 'cp': return !!(e as IndicatorEntry & { name: string }).name;
            default: return true;
          }
        }).length / entries.length) * 100
      ));
      totalCompleteness += completeness;

      // Timeliness
      const timeliness = Math.min(100, Math.round(
        (entries.filter(e => {
          if (!e.createdAt || !e.date) return true;
          return e.createdAt.slice(0, 10) === e.date;
        }).length / entries.length) * 100
      ));
      totalTimeliness += timeliness;

      // Consistency
      const consistency = Math.min(100, Math.round(
        (entries.filter(e => {
          if (e.indicatorType === 'tangan') {
            const t = e as IndicatorEntry & { m1: boolean; m2: boolean; m3: boolean; m4: boolean; m5: boolean; patuh: boolean | null };
            if (t.patuh === true && !t.m1 && !t.m2 && !t.m3 && !t.m4 && !t.m5) return false;
          }
          return true;
        }).length / entries.length) * 100
      ));
      totalConsistency += consistency;

      // Accuracy (compliance percentage)
      const stats = calculateStats(ind.id, entries);
      totalAccuracy += Math.min(100, Math.round(stats.pct));
    }

    const count = indicatorCount || 1;
    return {
      completeness: Math.round(totalCompleteness / count),
      timeliness: Math.round(totalTimeliness / count),
      consistency: Math.round(totalConsistency / count),
      accuracy: Math.round(totalAccuracy / count),
    };
  }, [relevantIndicators, entriesByType]);

  // Overall score (weighted)
  const overallScore = useMemo(() => {
    return Math.round(
      qualityMetrics.completeness * 0.3 +
      qualityMetrics.timeliness * 0.2 +
      qualityMetrics.consistency * 0.2 +
      qualityMetrics.accuracy * 0.3
    );
  }, [qualityMetrics]);

  // Generate recommendations
  const recommendations = useMemo(() => {
    const tips: { icon: React.ReactNode; text: string; priority: 'high' | 'medium' | 'low' }[] = [];

    if (qualityMetrics.completeness < 70) {
      tips.push({
        icon: <CheckCircle2 className="size-4 text-emerald-500" />,
        text: 'Lengkapi field yang kosong pada data entri. Kelengkapan data saat ini masih di bawah 70%.',
        priority: 'high',
      });
    }

    if (qualityMetrics.timeliness < 70) {
      tips.push({
        icon: <Clock className="size-4 text-blue-500" />,
        text: 'Tingkatkan ketepatan waktu input data. Input harus dilakukan pada hari yang sama dengan tanggal data.',
        priority: 'high',
      });
    }

    if (qualityMetrics.consistency < 80) {
      tips.push({
        icon: <AlertTriangle className="size-4 text-amber-500" />,
        text: 'Periksa kembali konsistensi data. Ada entri yang mungkin bertentangan (misal: patuh tapi tidak ada momen yang dicentang).',
        priority: 'medium',
      });
    }

    if (qualityMetrics.accuracy < 70) {
      tips.push({
        icon: <Target className="size-4 text-red-500" />,
        text: 'Tingkatkan akurasi pencapaian indikator. Beberapa indikator masih di bawah target.',
        priority: 'high',
      });
    }

    // Specific indicator recommendations
    for (const ind of relevantIndicators) {
      const entries = entriesByType[ind.id] || [];
      if (entries.length === 0) {
        tips.push({
          icon: <TrendingDown className="size-4 text-red-400" />,
          text: `Indikator "${ind.label}" belum memiliki data. Mulai input data untuk indikator ini.`,
          priority: 'high',
        });
      } else {
        const stats = calculateStats(ind.id, entries);
        if (!stats.ok) {
          tips.push({
            icon: <TrendingUp className="size-4 text-amber-500" />,
            text: `"${ind.label}" belum mencapai target (${stats.pct}% vs ${ind.targetLabel}). Perlu perhatian khusus.`,
            priority: 'medium',
          });
        }
      }
    }

    if (tips.length === 0) {
      tips.push({
        icon: <ShieldCheck className="size-4 text-emerald-500" />,
        text: 'Kualitas data sudah sangat baik! Pertahankan konsistensi input dan monitoring berkala.',
        priority: 'low',
      });
    }

    return tips;
  }, [qualityMetrics, relevantIndicators, entriesByType]);

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-blue-500/10">
            <ShieldCheck className="size-5 text-blue-500" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Kualitas Data</h2>
            <p className="text-sm text-muted-foreground">
              Metrik kualitas dan kelengkapan data — {unitMeta.label}
            </p>
          </div>
        </div>
      </div>

      {/* ── Overall Score + Metrics ─────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Circular gauge */}
        <Card className="border-border bg-card lg:row-span-2">
          <CardContent className="p-6 flex flex-col items-center justify-center">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">
              Skor Kualitas Keseluruhan
            </p>
            <CircularGauge value={overallScore} />
            <p className="text-xs text-muted-foreground mt-4 text-center">
              Berdasarkan rata-rata tertimbang dari 4 metrik kualitas
            </p>
          </CardContent>
        </Card>

        {/* Quality metric cards */}
        <MetricCard
          icon={<CheckCircle2 className="size-4 text-emerald-500" />}
          label="Kelengkapan"
          value={qualityMetrics.completeness}
          description="Field wajib terisi"
          color="#34d399"
        />
        <MetricCard
          icon={<Clock className="size-4 text-blue-500" />}
          label="Ketepatan Waktu"
          value={qualityMetrics.timeliness}
          description="Input tepat waktu"
          color="#4f8ef7"
        />
        <MetricCard
          icon={<AlertTriangle className="size-4 text-amber-500" />}
          label="Konsistensi"
          value={qualityMetrics.consistency}
          description="Data tanpa kontradiksi"
          color="#f59e0b"
        />
        <MetricCard
          icon={<Target className="size-4 text-red-500" />}
          label="Akurasi"
          value={qualityMetrics.accuracy}
          description="Pencapaian target"
          color="#f87171"
        />
      </div>

      {/* ── Quality Breakdown Table ─────────────────────────────── */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
            <ShieldCheck className="size-4 text-blue-500" />
            Kualitas Per Indikator
            <Badge variant="secondary" className="text-[10px] ml-auto">
              {relevantIndicators.length} indikator
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="max-h-96 overflow-y-auto">
          {relevantIndicators.map((ind, idx) => (
            <IndicatorQualityRow
              key={ind.id}
              indicatorId={ind.id}
              entries={entriesByType[ind.id] || []}
              index={idx}
            />
          ))}
        </CardContent>
      </Card>

      {/* ── Recommendations ─────────────────────────────────────── */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Lightbulb className="size-4 text-amber-500" />
            Rekomendasi Perbaikan
            <Badge variant="secondary" className="text-[10px] ml-auto">
              {recommendations.length} saran
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {recommendations.map((rec, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: idx * 0.06 }}
                className={`flex items-start gap-3 rounded-lg border p-3 ${
                  rec.priority === 'high'
                    ? 'border-red-500/20 bg-red-500/5'
                    : rec.priority === 'medium'
                    ? 'border-amber-500/20 bg-amber-500/5'
                    : 'border-emerald-500/20 bg-emerald-500/5'
                }`}
              >
                <div className="shrink-0 mt-0.5">{rec.icon}</div>
                <p className="text-xs text-foreground/80 leading-relaxed">{rec.text}</p>
                <Badge
                  className={`text-[8px] font-bold border-0 shrink-0 ${
                    rec.priority === 'high'
                      ? 'bg-red-500/10 text-red-500'
                      : rec.priority === 'medium'
                      ? 'bg-amber-500/10 text-amber-500'
                      : 'bg-emerald-500/10 text-emerald-500'
                  }`}
                >
                  {rec.priority === 'high' ? 'Tinggi' : rec.priority === 'medium' ? 'Sedang' : 'Rendah'}
                </Badge>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
