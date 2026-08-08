'use client';

import { useMemo, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  Calendar,
  Flame,
  TrendingUp,
  Hash,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  INDICATORS,
  UNIT_MAP,
  type IndicatorEntry,
  type IndicatorType,
} from '@/types';

interface ActivityHeatmapProps {
  allEntries: IndicatorEntry[];
  activeUnit: string;
}

/* ── Day labels in Indonesian ──────────────────────────────────── */
const DAY_LABELS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const DAY_LABELS_SHORT = ['', 'Sen', '', 'Rab', '', 'Jum', ''];

/* ── Month names (imported from calculations) ───────────────────── */
import { MONTH_NAMES } from '@/lib/calculations';

/* ── Color scale (theme-aware via Tailwind classes) ────────────── */
function getColorClass(count: number): string {
  if (count === 0) return 'bg-muted/40';
  if (count <= 2) return 'bg-emerald-300/60 dark:bg-emerald-500/40';
  if (count <= 5) return 'bg-emerald-400/70 dark:bg-emerald-500/60';
  return 'bg-emerald-500 dark:bg-emerald-400/80';
}

function getColorLabel(count: number): string {
  if (count === 0) return 'Tidak ada';
  if (count <= 2) return '1–2 entri';
  if (count <= 5) return '3–5 entri';
  return '6+ entri';
}

/* ── Build heatmap data ─────────────────────────────────────────── */
interface HeatmapCell {
  date: string;        // YYYY-MM-DD
  count: number;
  dayOfWeek: number;   // 0=Sun ... 6=Sat
  weekIndex: number;   // which column (0 = oldest week)
}

function buildHeatmapData(entries: IndicatorEntry[], activeUnit: string): {
  cells: HeatmapCell[];
  weeks: number;
  monthLabels: { label: string; weekIndex: number }[];
} {
  const now = new Date();
  // Go back 52 weeks from today
  const endDate = new Date(now);
  // Start date: 52 weeks (364 days) ago, aligned to Sunday
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - 364);
  // Adjust to previous Sunday
  const startDay = startDate.getDay(); // 0=Sun
  startDate.setDate(startDate.getDate() - startDay);

  // Count entries per date, filtered by unit
  const dateCounts: Record<string, number> = {};
  const unitMeta = UNIT_MAP[activeUnit] ?? UNIT_MAP['all'];

  for (const e of entries) {
    if (!e.date) continue;
    // Filter by unit
    if (activeUnit !== 'all' && e.unitId !== activeUnit) continue;
    // Filter by indicator type
    if (!unitMeta.inds.includes(e.indicatorType as IndicatorType)) continue;
    dateCounts[e.date] = (dateCounts[e.date] || 0) + 1;
  }

  // Generate cells for each day from startDate to endDate
  const cells: HeatmapCell[] = [];
  const weekStartDates: Date[] = [];
  let currentWeekStart = new Date(startDate);
  let weekIdx = 0;

  while (currentWeekStart <= endDate) {
    weekStartDates.push(new Date(currentWeekStart));
    for (let day = 0; day < 7; day++) {
      const cellDate = new Date(currentWeekStart);
      cellDate.setDate(cellDate.getDate() + day);
      if (cellDate > endDate) break;

      const dateStr = `${cellDate.getFullYear()}-${String(cellDate.getMonth() + 1).padStart(2, '0')}-${String(cellDate.getDate()).padStart(2, '0')}`;
      cells.push({
        date: dateStr,
        count: dateCounts[dateStr] || 0,
        dayOfWeek: day,
        weekIndex: weekIdx,
      });
    }
    currentWeekStart.setDate(currentWeekStart.getDate() + 7);
    weekIdx++;
  }

  // Build month labels — show month when the 1st of the month falls in a new position
  const monthLabels: { label: string; weekIndex: number }[] = [];
  const seenMonths = new Set<string>();

  for (const cell of cells) {
    const d = new Date(cell.date);
    const monthKey = `${d.getFullYear()}-${d.getMonth()}`;
    const dayOfMonth = d.getDate();

    if (!seenMonths.has(monthKey) && dayOfMonth <= 7) {
      seenMonths.add(monthKey);
      monthLabels.push({
        label: MONTH_NAMES[d.getMonth()],
        weekIndex: cell.weekIndex,
      });
    }
  }

  return { cells, weeks: weekIdx, monthLabels };
}

/* ── Streak calculation ─────────────────────────────────────────── */
function calculateStreaks(cells: HeatmapCell[]): {
  longestStreak: number;
  currentStreak: number;
} {
  let longestStreak = 0;
  let currentStreak = 0;
  let tempStreak = 0;

  for (let i = 0; i < cells.length; i++) {
    if (cells[i].count > 0) {
      tempStreak++;
      if (tempStreak > longestStreak) longestStreak = tempStreak;
    } else {
      tempStreak = 0;
    }
  }

  // Current streak: count backwards from today
  for (let i = cells.length - 1; i >= 0; i--) {
    if (cells[i].count > 0) {
      currentStreak++;
    } else {
      break;
    }
  }

  return { longestStreak, currentStreak };
}

/* ── Format date for display ────────────────────────────────────── */
function formatDateDisplay(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  return `${dayNames[d.getDay()]}, ${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

/* ── Main Component ─────────────────────────────────────────────── */
export function ActivityHeatmap({ allEntries, activeUnit }: ActivityHeatmapProps) {
  const [hoveredCell, setHoveredCell] = useState<string | null>(null);

  const { cells, weeks, monthLabels } = useMemo(
    () => buildHeatmapData(allEntries, activeUnit),
    [allEntries, activeUnit]
  );

  // Group cells by weekIndex for rendering
  const cellsByWeek = useMemo(() => {
    const map: Record<number, HeatmapCell[]> = {};
    for (const cell of cells) {
      if (!map[cell.weekIndex]) map[cell.weekIndex] = [];
      map[cell.weekIndex].push(cell);
    }
    return map;
  }, [cells]);

  // Stats
  const totalEntries = useMemo(
    () => cells.reduce((sum, c) => sum + c.count, 0),
    [cells]
  );
  const activeDays = useMemo(
    () => cells.filter(c => c.count > 0).length,
    [cells]
  );
  const { longestStreak, currentStreak } = useMemo(
    () => calculateStreaks(cells),
    [cells]
  );

  const unitMeta = UNIT_MAP[activeUnit] ?? UNIT_MAP['all'];

  // Cell size
  const cellSize = 13;
  const cellGap = 3;
  const cellStep = cellSize + cellGap;

  const handleCellHover = useCallback((date: string | null) => {
    setHoveredCell(date);
  }, []);

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/10">
            <Activity className="size-5 text-emerald-500" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Peta Aktivitas</h2>
            <p className="text-sm text-muted-foreground">
              Aktivitas input data selama 12 bulan terakhir — {unitMeta.label}
            </p>
          </div>
        </div>
      </div>

      {/* ── Summary Stats ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-border bg-card">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-500/10">
              <Hash className="size-4 text-emerald-500" />
            </div>
            <div>
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                Total Entri
              </p>
              <p className="text-xl font-bold font-mono text-foreground">
                {totalEntries}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-blue-500/10">
              <Calendar className="size-4 text-blue-500" />
            </div>
            <div>
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                Hari Aktif
              </p>
              <p className="text-xl font-bold font-mono text-foreground">
                {activeDays}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-amber-500/10">
              <Flame className="size-4 text-amber-500" />
            </div>
            <div>
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                Streak Terpanjang
              </p>
              <p className="text-xl font-bold font-mono text-foreground">
                {longestStreak} <span className="text-xs font-normal text-muted-foreground">hari</span>
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-purple-500/10">
              <TrendingUp className="size-4 text-purple-500" />
            </div>
            <div>
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                Streak Saat Ini
              </p>
              <p className="text-xl font-bold font-mono text-foreground">
                {currentStreak} <span className="text-xs font-normal text-muted-foreground">hari</span>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Heatmap ─────────────────────────────────────────────── */}
      <Card className="border-border bg-card overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Activity className="size-4 text-emerald-500" />
            Kalender Aktivitas
            <Badge variant="secondary" className="text-[10px] ml-auto">
              52 minggu
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="overflow-x-auto">
            <div className="inline-flex flex-col gap-0.5 min-w-fit">
              {/* Month labels row */}
              <div className="flex" style={{ paddingLeft: 36 }}>
                {Array.from({ length: weeks }, (_, w) => {
                  const ml = monthLabels.find(m => m.weekIndex === w);
                  return (
                    <div
                      key={`month-${w}`}
                      style={{ width: cellStep, minWidth: cellStep }}
                      className="text-[9px] text-muted-foreground/60 overflow-visible whitespace-nowrap"
                    >
                      {ml ? ml.label : ''}
                    </div>
                  );
                })}
              </div>

              {/* Day rows with labels */}
              {DAY_LABELS_SHORT.map((dayLabel, dayIdx) => (
                <div key={`row-${dayIdx}`} className="flex items-center gap-0">
                  <div
                    className="text-[9px] text-muted-foreground/50 text-right pr-2 shrink-0"
                    style={{ width: 36 }}
                  >
                    {dayLabel}
                  </div>
                  {Array.from({ length: weeks }, (_, w) => {
                    const weekCells = cellsByWeek[w];
                    const cell = weekCells?.find(c => c.dayOfWeek === dayIdx);
                    if (!cell) {
                      return (
                        <div
                          key={`empty-${w}-${dayIdx}`}
                          style={{ width: cellStep, height: cellStep }}
                        />
                      );
                    }
                    const colorClass = getColorClass(cell.count);
                    const isHovered = hoveredCell === cell.date;

                    return (
                      <Tooltip key={cell.date}>
                        <TooltipTrigger asChild>
                          <motion.div
                            className={`rounded-sm ${colorClass} cursor-pointer transition-all duration-100 ${
                              isHovered ? 'ring-1 ring-foreground/30' : ''
                            }`}
                            style={{
                              width: cellSize,
                              height: cellSize,
                              minWidth: cellSize,
                              marginRight: cellGap,
                            }}
                            initial={{ opacity: 0, scale: 0.5 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{
                              duration: 0.15,
                              delay: w * 2 + dayIdx * 1,
                            }}
                            onMouseEnter={() => handleCellHover(cell.date)}
                            onMouseLeave={() => handleCellHover(null)}
                          />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">
                          <div className="font-medium">{formatDateDisplay(cell.date)}</div>
                          <div className="text-muted-foreground">
                            {cell.count === 0
                              ? 'Tidak ada entri'
                              : `${cell.count} entri`}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border/50">
            <span className="text-[10px] text-muted-foreground/60 mr-1">Sedikit</span>
            <div className={`size-3 rounded-sm ${getColorClass(0)}`} />
            <div className={`size-3 rounded-sm ${getColorClass(1)}`} />
            <div className={`size-3 rounded-sm ${getColorClass(3)}`} />
            <div className={`size-3 rounded-sm ${getColorClass(6)}`} />
            <span className="text-[10px] text-muted-foreground/60 ml-1">Banyak</span>
            <div className="flex items-center gap-1.5 ml-auto">
              {[
                { count: 0, label: 'Tidak ada' },
                { count: 1, label: '1–2' },
                { count: 3, label: '3–5' },
                { count: 6, label: '6+' },
              ].map(({ count, label }) => (
                <div key={label} className="flex items-center gap-1">
                  <div className={`size-2.5 rounded-sm ${getColorClass(count)}`} />
                  <span className="text-[9px] text-muted-foreground/50">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
