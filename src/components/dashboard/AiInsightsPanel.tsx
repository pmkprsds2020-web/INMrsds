'use client';

import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  RefreshCw,
  Lightbulb,
  TrendingUp,
  Target,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  INDICATORS,
  type IndicatorType,
  type IndicatorEntry,
  UNIT_MAP,
} from '@/types';
import { calculateStats } from '@/lib/calculations';

interface AiInsightsPanelProps {
  entries?: IndicatorEntry[];
  allEntries: IndicatorEntry[];
  activeUnit: string;
  stats?: { num: number; den: number; pct: number; ok: boolean };
}

/* ── Section parser ─────────────────────────────────────────── */
interface InsightSection {
  title: string;
  icon: React.ReactNode;
  color: string;
  content: string;
}

function parseInsightSections(text: string): InsightSection[] {
  const sections: InsightSection[] = [];

  const patterns: { regex: RegExp; title: string; icon: React.ReactNode; color: string }[] = [
    {
      regex: /## Temuan Utama\s*\n([\s\S]*?)(?=\n## |\n$|$)/,
      title: 'Temuan Utama',
      icon: <Lightbulb className="size-4" />,
      color: '#f59e0b',
    },
    {
      regex: /## Analisis Tren\s*\n([\s\S]*?)(?=\n## |\n$|$)/,
      title: 'Analisis Tren',
      icon: <TrendingUp className="size-4" />,
      color: '#4f8ef7',
    },
    {
      regex: /## Rekomendasi Tindakan\s*\n([\s\S]*?)(?=\n## |\n$|$)/,
      title: 'Rekomendasi Tindakan',
      icon: <AlertTriangle className="size-4" />,
      color: '#34d399',
    },
    {
      regex: /## Evaluasi Target\s*\n([\s\S]*?)(?=\n## |\n$|$)/,
      title: 'Evaluasi Target',
      icon: <Target className="size-4" />,
      color: '#e879f9',
    },
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern.regex);
    if (match && match[1]?.trim()) {
      sections.push({
        title: pattern.title,
        icon: pattern.icon,
        color: pattern.color,
        content: match[1].trim(),
      });
    }
  }

  // If no sections found, return the whole text as a single section
  if (sections.length === 0 && text.trim()) {
    sections.push({
      title: 'Analisis AI',
      icon: <Sparkles className="size-4" />,
      color: '#4f8ef7',
      content: text.trim(),
    });
  }

  return sections;
}

/* ── Indicator Summary Card ─────────────────────────────────── */
function IndicatorSummaryCard({
  indicatorId,
  entries,
}: {
  indicatorId: IndicatorType;
  entries: IndicatorEntry[];
}) {
  const meta = INDICATORS.find((i) => i.id === indicatorId);
  const stats = useMemo(() => calculateStats(indicatorId, entries), [indicatorId, entries]);

  if (!meta) return null;

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-background/50 p-3">
      <div
        className="flex size-9 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: `${meta.color}20` }}
      >
        {stats.ok ? (
          <CheckCircle2 className="size-4" style={{ color: meta.color }} />
        ) : (
          <XCircle className="size-4" style={{ color: '#f87171' }} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-foreground truncate">{meta.label}</p>
        <p className="text-[10px] text-muted-foreground">
          {entries.length} entri · Target: {meta.targetLabel}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p
          className="text-sm font-bold font-mono"
          style={{ color: stats.ok ? '#34d399' : '#f87171' }}
        >
          {stats.pct}%
        </p>
        <div className="flex items-center justify-end gap-0.5">
          {stats.ok ? (
            <ArrowUpRight className="size-3 text-emerald-400" />
          ) : (
            <ArrowDownRight className="size-3 text-red-400" />
          )}
          <span className="text-[10px] text-muted-foreground">
            {stats.ok ? 'Tercapai' : 'Belum'}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ── Loading Skeleton ───────────────────────────────────────── */
function InsightsSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3, 4].map((i) => (
        <Card key={i} className="border-border bg-card">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Skeleton className="size-4 rounded" />
              <Skeleton className="h-4 w-32" />
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
            <Skeleton className="h-3 w-3/5" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/* ── Render markdown-like content ───────────────────────────── */
function RenderContent({ content }: { content: string }) {
  const lines = content.split('\n');

  return (
    <div className="space-y-1.5 text-sm text-foreground/80 leading-relaxed">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return null;

        // Handle bullet points
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('• ')) {
          return (
            <div key={idx} className="flex items-start gap-2 ml-2">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary/40" />
              <span>{trimmed.slice(2)}</span>
            </div>
          );
        }

        // Handle numbered lists
        const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
        if (numMatch) {
          return (
            <div key={idx} className="flex items-start gap-2 ml-2">
              <span className="shrink-0 text-xs font-bold text-primary/60 mt-0.5">
                {numMatch[1]}.
              </span>
              <span>{numMatch[2]}</span>
            </div>
          );
        }

        // Handle bold text headers
        if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
          return (
            <p key={idx} className="font-semibold text-foreground/90 mt-2 first:mt-0">
              {trimmed.slice(2, -2)}
            </p>
          );
        }

        // Regular text
        return <p key={idx}>{trimmed}</p>;
      })}
    </div>
  );
}

/* ── Main Component ─────────────────────────────────────────── */
export function AiInsightsPanel({
  allEntries,
  activeUnit,
}: AiInsightsPanelProps) {
  const [insights, setInsights] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cacheKey, setCacheKey] = useState<string>('');

  // Per-indicator stats from allEntries
  const indicatorStats = useMemo(() => {
    const grouped: Partial<Record<IndicatorType, IndicatorEntry[]>> = {};
    for (const e of allEntries) {
      const type = e.indicatorType as IndicatorType;
      if (!grouped[type]) grouped[type] = [];
      grouped[type]!.push(e);
    }
    return grouped;
  }, [allEntries]);

  // Indicators to show summary for
  const unitMeta = UNIT_MAP[activeUnit] ?? UNIT_MAP['all'];
  const relevantIndicators = useMemo(() => {
    return INDICATORS.filter((ind) =>
      unitMeta.inds.includes(ind.id as IndicatorType)
    );
  }, [unitMeta.inds]);

  // Overall stats
  const overallStats = useMemo(() => {
    const metCount = relevantIndicators.filter((ind) => {
      const entriesForType = indicatorStats[ind.id] || [];
      if (entriesForType.length === 0) return false;
      const stats = calculateStats(ind.id, entriesForType);
      return stats.ok;
    }).length;
    return {
      total: relevantIndicators.length,
      met: metCount,
      notMet: relevantIndicators.length - metCount,
    };
  }, [relevantIndicators, indicatorStats]);

  // Cache key based on current state
  const currentCacheKey = useMemo(() => {
    return `${activeUnit}-${allEntries.length}-${Object.keys(indicatorStats).map(k => `${k}:${(indicatorStats[k] || []).length}`).join(',')}`;
  }, [activeUnit, allEntries.length, indicatorStats]);

  // Generate insights
  const handleGenerate = useCallback(async () => {
    if (isLoading) return;

    // Check cache
    if (cacheKey === currentCacheKey && insights) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Build aggregated stats for all indicators
      const aggregatedStats = relevantIndicators.map((ind) => {
        const entriesForType = indicatorStats[ind.id] || [];
        const stats = calculateStats(ind.id, entriesForType);
        return {
          id: ind.id,
          label: ind.label,
          target: ind.targetLabel,
          pct: stats.pct,
          ok: stats.ok,
          num: stats.num,
          den: stats.den,
          entryCount: entriesForType.length,
        };
      });

      // Use the overall stats as the main stats
      const mainStats = {
        num: overallStats.met,
        den: overallStats.total,
        pct: overallStats.total > 0
          ? Math.round((overallStats.met / overallStats.total) * 1000) / 10
          : 0,
        ok: overallStats.met >= overallStats.total * 0.8,
      };

      const response = await fetch('/api/ai-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          indicatorType: 'Semua Indikator',
          stats: mainStats,
          entries: allEntries.slice(0, 20),
          unitId: unitMeta.label,
          aggregatedStats,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'AI sedang tidak tersedia. Silakan coba kembali.');
      }

      const data = await response.json();
      setInsights(data.insights);
      setCacheKey(currentCacheKey);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan');
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, cacheKey, currentCacheKey, insights, relevantIndicators, indicatorStats, overallStats, allEntries, unitMeta.label]);

  // Parse insights into sections
  const sections = useMemo(() => {
    if (!insights) return [];
    return parseInsightSections(insights);
  }, [insights]);

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
            <Sparkles className="size-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">AI Insights</h2>
            <p className="text-sm text-muted-foreground">
              Analisis cerdas berbasis AI untuk data mutu rumah sakit
            </p>
          </div>
        </div>
        <Button
          onClick={handleGenerate}
          disabled={isLoading}
          className="gap-2 bg-primary/20 text-primary hover:bg-primary/30 border-0"
        >
          {isLoading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : insights && cacheKey === currentCacheKey ? (
            <RefreshCw className="size-4" />
          ) : (
            <Sparkles className="size-4" />
          )}
          {isLoading
            ? 'Menganalisis...'
            : insights && cacheKey === currentCacheKey
              ? 'Perbarui Analisis'
              : 'Generate AI Insights'}
        </Button>
      </div>

      {/* ── Overview Cards ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              Total Indikator
            </p>
            <p className="text-2xl font-bold font-mono text-foreground mt-1">
              {overallStats.total}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              Target Tercapai
            </p>
            <p className="text-2xl font-bold font-mono text-emerald-400 mt-1">
              {overallStats.met}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              Belum Tercapai
            </p>
            <p className="text-2xl font-bold font-mono text-red-400 mt-1">
              {overallStats.notMet}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              Unit Aktif
            </p>
            <p className="text-2xl font-bold font-mono text-foreground mt-1">
              {unitMeta.label}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Indicator Summary ──────────────────────────────────── */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Target className="size-4 text-primary" />
            Ringkasan Indikator
            <Badge variant="secondary" className="text-[10px] ml-auto">
              {relevantIndicators.length} indikator
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-80 overflow-y-auto">
            {relevantIndicators.map((ind) => (
              <IndicatorSummaryCard
                key={ind.id}
                indicatorId={ind.id}
                entries={indicatorStats[ind.id] || []}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Error State ────────────────────────────────────────── */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <Card className="border-red-500/20 bg-red-500/5">
              <CardContent className="p-4 flex items-center gap-3">
                <XCircle className="size-5 text-red-400 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-red-400">Gagal Menganalisis</p>
                  <p className="text-xs text-muted-foreground">{error}</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleGenerate}
                  className="ml-auto border-red-500/20 text-red-400 hover:bg-red-500/10 text-xs"
                >
                  Coba Lagi
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Loading Skeleton ───────────────────────────────────── */}
      {isLoading && <InsightsSkeleton />}

      {/* ── AI Insights Sections ───────────────────────────────── */}
      {!isLoading && sections.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="space-y-4"
        >
          {sections.map((section, idx) => (
            <motion.div
              key={section.title}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: idx * 0.1 }}
            >
              <Card className="border-border bg-card overflow-hidden">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <span
                      className="flex size-6 items-center justify-center rounded-md"
                      style={{ backgroundColor: `${section.color}20`, color: section.color }}
                    >
                      {section.icon}
                    </span>
                    {section.title}
                    <Badge
                      variant="secondary"
                      className="text-[10px] ml-auto"
                      style={{ backgroundColor: `${section.color}15`, color: section.color }}
                    >
                      AI
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <RenderContent content={section.content} />
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* ── Empty State ────────────────────────────────────────── */}
      {!isLoading && !insights && !error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="border-border bg-card">
            <CardContent className="p-8 flex flex-col items-center text-center">
              <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/10 mb-4">
                <Sparkles className="size-8 text-primary/50" />
              </div>
              <h3 className="text-base font-semibold text-foreground mb-2">
                Mulai Analisis AI
              </h3>
              <p className="text-sm text-muted-foreground max-w-md mb-4">
                Klik tombol &ldquo;Generate AI Insights&rdquo; untuk mendapatkan analisis cerdas
                berdasarkan data mutu rumah sakit Anda. AI akan menganalisis tren,
                memberikan rekomendasi, dan mengevaluasi pencapaian target.
              </p>
              <Button
                onClick={handleGenerate}
                className="gap-2 bg-primary/20 text-primary hover:bg-primary/30 border-0"
              >
                <Sparkles className="size-4" />
                Generate AI Insights
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
