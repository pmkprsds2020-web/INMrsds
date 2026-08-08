'use client';

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  Filter,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  ChevronDown,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { INDICATORS, UNIT_MAP, type IndicatorType, type IndicatorEntry } from '@/types';
import { calculateStats, MONTH_NAMES } from '@/lib/calculations';
import { cn } from '@/lib/utils';

/* ── Types ────────────────────────────────────────────────────── */

interface TimelineEntry {
  id: string;
  date: string;
  indicatorType: IndicatorType;
  indicatorLabel: string;
  indicatorColor: string;
  change: 'improved' | 'declined' | 'neutral';
  oldPct: number;
  newPct: number;
  description: string;
  monthKey: string;
  monthLabel: string;
}

interface ComplianceTimelineProps {
  allEntries: IndicatorEntry[];
  activeUnit: string;
}

/* ── Helpers ──────────────────────────────────────────────────── */

function formatPct(pct: number): string {
  return `${Math.round(pct)}%`;
}

function getMonthLabel(yearMonth: string): string {
  const [year, month] = yearMonth.split('-');
  const monthIdx = parseInt(month, 10) - 1;
  return `${MONTH_NAMES[monthIdx]} ${year}`;
}

/* ── Timeline Card ────────────────────────────────────────────── */

function TimelineCard({ entry, index, isRight }: { entry: TimelineEntry; index: number; isRight: boolean }) {
  const changeIcon = entry.change === 'improved'
    ? <ArrowUpRight className="size-3.5" />
    : entry.change === 'declined'
      ? <ArrowDownRight className="size-3.5" />
      : <Minus className="size-3.5" />;

  const changeColor = entry.change === 'improved'
    ? 'text-emerald-500'
    : entry.change === 'declined'
      ? 'text-red-500'
      : 'text-muted-foreground';

  const changeBg = entry.change === 'improved'
    ? 'bg-emerald-500/10 border-emerald-500/20'
    : entry.change === 'declined'
      ? 'bg-red-500/10 border-red-500/20'
      : 'bg-muted/50 border-border';

  const dotColor = entry.change === 'improved'
    ? 'bg-emerald-500 shadow-emerald-500/40'
    : entry.change === 'declined'
      ? 'bg-red-500 shadow-red-500/40'
      : 'bg-muted-foreground/50';

  return (
    <motion.div
      initial={{ opacity: 0, x: isRight ? 30 : -30, y: 10 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.06, ease: 'easeOut' }}
      className={cn(
        'relative w-full md:w-[calc(50%-1.5rem)]',
        isRight ? 'md:ml-auto' : 'md:mr-auto',
      )}
    >
      {/* Connector line to center */}
      <div className={cn(
        'hidden md:block absolute top-5 h-[2px] w-6',
        isRight ? 'left-0 -translate-x-full' : 'right-0 translate-x-full',
      )}
        style={{ backgroundColor: `${entry.indicatorColor}30` }}
      />

      <Card className={cn(
        'border transition-all duration-200 hover:shadow-md',
        changeBg,
      )}>
        <CardContent className="p-3.5">
          <div className="flex items-start gap-2.5">
            {/* Change indicator */}
            <div className={cn(
              'flex size-8 shrink-0 items-center justify-center rounded-full border',
              changeBg,
              changeColor,
            )}>
              {changeIcon}
            </div>

            <div className="flex-1 min-w-0">
              {/* Indicator name */}
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="size-2 rounded-full shrink-0"
                  style={{ backgroundColor: entry.indicatorColor }}
                />
                <span className="text-xs font-semibold text-foreground/90 truncate">
                  {entry.indicatorLabel}
                </span>
              </div>

              {/* Change display */}
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-sm font-mono font-bold text-foreground/80">
                  {formatPct(entry.oldPct)}
                </span>
                <span className="text-muted-foreground text-xs">→</span>
                <span className={cn('text-sm font-mono font-bold', changeColor)}>
                  {formatPct(entry.newPct)}
                </span>
                <Badge
                  variant="outline"
                  className={cn(
                    'text-[10px] px-1.5 py-0 h-5 font-semibold border-0',
                    entry.change === 'improved' && 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
                    entry.change === 'declined' && 'bg-red-500/15 text-red-600 dark:text-red-400',
                    entry.change === 'neutral' && 'bg-muted text-muted-foreground',
                  )}
                >
                  {entry.change === 'improved' ? '+' : entry.change === 'declined' ? '−' : ''}
                  {formatPct(Math.abs(entry.newPct - entry.oldPct))}
                </Badge>
              </div>

              {/* Description */}
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {entry.description}
              </p>

              {/* Date */}
              <div className="flex items-center gap-1 mt-1.5">
                <Calendar className="size-3 text-muted-foreground/50" />
                <span className="text-[10px] text-muted-foreground/70">{entry.date}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Timeline dot (center) */}
      <div className={cn(
        'hidden md:flex absolute top-4 size-3.5 rounded-full border-2 border-card z-10',
        isRight ? 'left-0 -translate-x-[calc(50%+1.5rem)]' : 'right-0 translate-x-[calc(50%+1.5rem)]',
        dotColor,
        'shadow-sm',
      )}
        style={{ backgroundColor: entry.change === 'improved' ? '#10b981' : entry.change === 'declined' ? '#ef4444' : undefined }}
      />
    </motion.div>
  );
}

/* ── Main Component ───────────────────────────────────────────── */

export function ComplianceTimeline({ allEntries, activeUnit }: ComplianceTimelineProps) {
  const [filterIndicator, setFilterIndicator] = useState<string>('all');
  const [filterYear, setFilterYear] = useState<string>('all');

  // Build timeline entries from allEntries
  const timelineEntries = useMemo(() => {
    if (!allEntries || allEntries.length === 0) return [];

    // Filter by active unit if not 'all'
    const filteredByUnit = activeUnit === 'all' ? allEntries : allEntries.filter(e => e.unitId === activeUnit);

    // Group entries by indicator type and then by month
    const grouped: Partial<Record<IndicatorType, IndicatorEntry[]>> = {};
    for (const e of filteredByUnit) {
      const t = e.indicatorType as IndicatorType;
      if (!grouped[t]) grouped[t] = [];
      grouped[t]!.push(e);
    }

    const entries: TimelineEntry[] = [];

    for (const [type, typeEntries] of Object.entries(grouped)) {
      const indicator = INDICATORS.find(i => i.id === type);
      if (!indicator) continue;

      // Sort by date
      const sorted = [...typeEntries].sort((a, b) => (a.date || '').localeCompare(b.date || ''));

      // Group by month
      const monthGroups: Record<string, IndicatorEntry[]> = {};
      for (const e of sorted) {
        const monthKey = (e.date || '').slice(0, 7);
        if (!monthGroups[monthKey]) monthGroups[monthKey] = [];
        monthGroups[monthKey].push(e);
      }

      // Calculate per-month compliance and compare with previous month
      const monthKeys = Object.keys(monthGroups).sort();
      let prevPct: number | null = null;

      for (const monthKey of monthKeys) {
        const monthEntries = monthGroups[monthKey];
        const stats = calculateStats(type as IndicatorType, monthEntries);
        const currentPct = stats.pct;

        if (prevPct !== null) {
          const diff = currentPct - prevPct;
          const change: 'improved' | 'declined' | 'neutral' =
            Math.abs(diff) < 0.5 ? 'neutral'
            : indicator.isLowerBetter
              ? (diff < 0 ? 'improved' : 'declined')
              : (diff > 0 ? 'improved' : 'declined');

          let description = '';
          if (change === 'improved') {
            description = `Kepatuhan ${indicator.label} meningkat dari ${formatPct(prevPct)} menjadi ${formatPct(currentPct)} pada ${getMonthLabel(monthKey)}.`;
          } else if (change === 'declined') {
            description = `Kepatuhan ${indicator.label} menurun dari ${formatPct(prevPct)} menjadi ${formatPct(currentPct)} pada ${getMonthLabel(monthKey)}.`;
          } else {
            description = `Kepatuhan ${indicator.label} stabil di ${formatPct(currentPct)} pada ${getMonthLabel(monthKey)}.`;
          }

          entries.push({
            id: `${type}-${monthKey}`,
            date: `${monthKey}-01`,
            indicatorType: type as IndicatorType,
            indicatorLabel: indicator.label,
            indicatorColor: indicator.color,
            change,
            oldPct: prevPct,
            newPct: currentPct,
            description,
            monthKey,
            monthLabel: getMonthLabel(monthKey),
          });
        } else {
          // First month - add as neutral baseline
          const metTarget = indicator.isLowerBetter
            ? currentPct <= indicator.target
            : currentPct >= indicator.target;

          entries.push({
            id: `${type}-${monthKey}`,
            date: `${monthKey}-01`,
            indicatorType: type as IndicatorType,
            indicatorLabel: indicator.label,
            indicatorColor: indicator.color,
            change: 'neutral',
            oldPct: currentPct,
            newPct: currentPct,
            description: `Baseline: Kepatuhan ${indicator.label} tercatat ${formatPct(currentPct)} (${metTarget ? 'mencapai' : 'belum mencapai'} target ${indicator.targetLabel}).`,
            monthKey,
            monthLabel: getMonthLabel(monthKey),
          });
        }

        prevPct = currentPct;
      }
    }

    // Sort by date descending (most recent first)
    entries.sort((a, b) => b.date.localeCompare(a.date));
    return entries;
  }, [allEntries, activeUnit]);

  // Available years from entries
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    for (const e of timelineEntries) {
      const year = e.monthKey.split('-')[0];
      years.add(year);
    }
    return Array.from(years).sort().reverse();
  }, [timelineEntries]);

  // Filtered entries
  const filteredEntries = useMemo(() => {
    let result = timelineEntries;
    if (filterIndicator !== 'all') {
      result = result.filter(e => e.indicatorType === filterIndicator);
    }
    if (filterYear !== 'all') {
      result = result.filter(e => e.monthKey.startsWith(filterYear));
    }
    return result;
  }, [timelineEntries, filterIndicator, filterYear]);

  // Group by month for display
  const groupedByMonth = useMemo(() => {
    const groups: Record<string, TimelineEntry[]> = {};
    for (const e of filteredEntries) {
      if (!groups[e.monthKey]) groups[e.monthKey] = [];
      groups[e.monthKey].push(e);
    }
    // Sort month keys descending
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [filteredEntries]);

  // Summary stats
  const summary = useMemo(() => {
    let improved = 0;
    let declined = 0;
    let neutral = 0;
    for (const e of filteredEntries) {
      if (e.change === 'improved') improved++;
      else if (e.change === 'declined') declined++;
      else neutral++;
    }
    return { improved, declined, neutral, total: filteredEntries.length };
  }, [filteredEntries]);

  const unitLabel = activeUnit === 'all' ? 'Semua Unit' : (UNIT_MAP[activeUnit]?.label || activeUnit);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Clock className="size-5 text-muted-foreground" />
            Timeline Kepatuhan
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Riwayat perubahan kepatuhan indikator mutu — {unitLabel}
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-emerald-500/20 bg-emerald-500/5">
          <CardContent className="p-3 text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <TrendingUp className="size-4 text-emerald-500" />
              <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{summary.improved}</span>
            </div>
            <p className="text-[10px] text-emerald-600/70 dark:text-emerald-400/70 font-medium">Meningkat</p>
          </CardContent>
        </Card>
        <Card className="border-red-500/20 bg-red-500/5">
          <CardContent className="p-3 text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <TrendingDown className="size-4 text-red-500" />
              <span className="text-xl font-bold text-red-600 dark:text-red-400">{summary.declined}</span>
            </div>
            <p className="text-[10px] text-red-600/70 dark:text-red-400/70 font-medium">Menurun</p>
          </CardContent>
        </Card>
        <Card className="border-border bg-muted/30">
          <CardContent className="p-3 text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <Minus className="size-4 text-muted-foreground" />
              <span className="text-xl font-bold text-foreground/60">{summary.neutral}</span>
            </div>
            <p className="text-[10px] text-muted-foreground/70 font-medium">Stabil</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
        <div className="flex items-center gap-2">
          <Filter className="size-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground font-medium">Filter:</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={filterIndicator} onValueChange={setFilterIndicator}>
            <SelectTrigger className="h-8 w-[180px] text-xs bg-muted/50 border-border">
              <SelectValue placeholder="Semua Indikator" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Indikator</SelectItem>
              {INDICATORS.map(ind => (
                <SelectItem key={ind.id} value={ind.id}>
                  <span className="flex items-center gap-2">
                    <span className="size-2 rounded-full" style={{ backgroundColor: ind.color }} />
                    {ind.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterYear} onValueChange={setFilterYear}>
            <SelectTrigger className="h-8 w-[130px] text-xs bg-muted/50 border-border">
              <SelectValue placeholder="Semua Tahun" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Tahun</SelectItem>
              {availableYears.map(year => (
                <SelectItem key={year} value={year}>{year}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {(filterIndicator !== 'all' || filterYear !== 'all') && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-muted-foreground"
              onClick={() => { setFilterIndicator('all'); setFilterYear('all'); }}
            >
              Reset Filter
            </Button>
          )}
        </div>
      </div>

      {/* Timeline */}
      {filteredEntries.length === 0 ? (
        <Card className="border-border">
          <CardContent className="p-8 text-center">
            <Clock className="size-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground font-medium">Belum ada data timeline</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Data akan muncul setelah ada perubahan kepatuhan antar bulan
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="relative">
          {/* Center vertical line (desktop only) */}
          <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-[2px] -translate-x-1/2 bg-border/60" />

          <AnimatePresence mode="wait">
            <motion.div
              key={`${filterIndicator}-${filterYear}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              {groupedByMonth.map(([monthKey, monthEntries], groupIdx) => (
                <div key={monthKey}>
                  {/* Month header */}
                  <div className="relative flex items-center justify-center mb-4">
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.3, delay: groupIdx * 0.1 }}
                      className="relative z-10 flex items-center gap-2 rounded-full bg-card border border-border px-4 py-1.5 shadow-sm"
                    >
                      <Calendar className="size-3.5 text-muted-foreground" />
                      <span className="text-xs font-semibold text-foreground">
                        {getMonthLabel(monthKey)}
                      </span>
                      <Badge variant="outline" className="text-[10px] h-5 px-1.5 border-border">
                        {monthEntries.length}
                      </Badge>
                    </motion.div>
                  </div>

                  {/* Timeline entries */}
                  <div className="space-y-3 md:space-y-4">
                    {monthEntries.map((entry, idx) => {
                      const globalIdx = groupIdx * 10 + idx;
                      const isRight = idx % 2 === 1;
                      return (
                        <div key={entry.id} className="relative flex justify-center">
                          {/* Mobile: single column, always left-aligned */}
                          <div className="md:hidden w-full">
                            <TimelineCard entry={entry} index={globalIdx} isRight={false} />
                          </div>
                          {/* Desktop: alternating */}
                          <div className="hidden md:block w-full">
                            <TimelineCard entry={entry} index={globalIdx} isRight={isRight} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </motion.div>
          </AnimatePresence>

          {/* Show total count */}
          <div className="text-center mt-6">
            <p className="text-[11px] text-muted-foreground/60">
              Menampilkan {filteredEntries.length} dari {timelineEntries.length} perubahan kepatuhan
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
