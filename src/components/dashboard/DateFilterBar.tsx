'use client';

import { useCallback } from 'react';
import {
  CalendarDays,
  Filter,
  RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfQuarter, endOfQuarter, startOfYear, endOfYear, subMonths } from 'date-fns';

interface DateFilterBarProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  onApply: () => void;
  onReset: () => void;
  isFiltered: boolean;
}

/* ── Quick preset type ───────────────────────────────────────── */
type PresetKey = 'today' | 'this_week' | 'this_month' | 'last_month' | 'this_quarter';

interface Preset {
  key: PresetKey;
  label: string;
  shortLabel: string;
}

const PRESETS: Preset[] = [
  { key: 'today', label: 'Hari Ini', shortLabel: 'Hari' },
  { key: 'this_week', label: 'Minggu Ini', shortLabel: 'Mgg' },
  { key: 'this_month', label: 'Bulan Ini', shortLabel: 'Bln' },
  { key: 'last_month', label: 'Bulan Lalu', shortLabel: 'Lalu' },
  { key: 'this_quarter', label: 'Kuartal Ini', shortLabel: 'Krt' },
];

function getPresetRange(key: PresetKey): { start: string; end: string } {
  const now = new Date();
  const fmt = 'yyyy-MM-dd';

  switch (key) {
    case 'today':
      return {
        start: fmt === 'yyyy-MM-dd' ? now.toISOString().slice(0, 10) : format(now, fmt),
        end: fmt === 'yyyy-MM-dd' ? now.toISOString().slice(0, 10) : format(now, fmt),
      };
    case 'this_week': {
      const weekStart = startOfWeek(now, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
      return {
        start: format(weekStart, fmt),
        end: format(weekEnd, fmt),
      };
    }
    case 'this_month':
      return {
        start: format(startOfMonth(now), fmt),
        end: format(endOfMonth(now), fmt),
      };
    case 'last_month': {
      const last = subMonths(now, 1);
      return {
        start: format(startOfMonth(last), fmt),
        end: format(endOfMonth(last), fmt),
      };
    }
    case 'this_quarter':
      return {
        start: format(startOfQuarter(now), fmt),
        end: format(endOfQuarter(now), fmt),
      };
  }
}

/* ── Detect if current range matches a preset ────────────────── */
function detectActivePreset(start: string, end: string): PresetKey | null {
  for (const p of PRESETS) {
    const range = getPresetRange(p.key);
    if (range.start === start && range.end === end) return p.key;
  }
  return null;
}

/* ── Format date for display ─────────────────────────────────── */
function formatDateShort(dateStr: string): string {
  try {
    return format(new Date(dateStr), 'dd MMM yyyy');
  } catch {
    return dateStr;
  }
}

/* ── Component ───────────────────────────────────────────────── */
export function DateFilterBar({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onApply,
  onReset,
  isFiltered,
}: DateFilterBarProps) {
  const activePreset = detectActivePreset(startDate, endDate);

  const handlePresetClick = useCallback(
    (key: PresetKey) => {
      const range = getPresetRange(key);
      onStartDateChange(range.start);
      onEndDateChange(range.end);
      // Auto-apply after a short delay to allow state to settle
      setTimeout(() => onApply(), 50);
    },
    [onStartDateChange, onEndDateChange, onApply]
  );

  return (
    <div
      className="flex flex-col gap-3 rounded-xl border border-border bg-card px-4 py-3"
    >
      {/* Row 1: Presets + Date inputs */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Icon + Label */}
        <div className="flex items-center gap-2 text-muted-foreground shrink-0">
          <CalendarDays className="size-4" />
          <span className="text-xs font-medium hidden sm:inline">Periode</span>
        </div>

        {/* Quick presets — segmented control style */}
        <div className="flex items-center rounded-lg bg-muted/50 p-0.5 border border-border">
          {PRESETS.map((p) => {
            const isActive = activePreset === p.key;
            return (
              <button
                key={p.key}
                onClick={() => handlePresetClick(p.key)}
                className={`
                  relative px-2 py-1 text-[10px] font-medium rounded-md transition-all duration-200
                  ${
                    isActive
                      ? 'bg-[#4f8ef7]/20 text-[#4f8ef7] shadow-sm'
                      : 'text-muted-foreground hover:text-foreground/70 hover:bg-muted/50'
                  }
                `}
              >
                <span className="hidden sm:inline">{p.label}</span>
                <span className="sm:hidden">{p.shortLabel}</span>
                {isActive && (
                  <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-3/4 h-[2px] rounded-full bg-[#4f8ef7]" />
                )}
              </button>
            );
          })}
        </div>

        {/* Date inputs */}
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={startDate}
            onChange={(e) => onStartDateChange(e.target.value)}
            className="h-8 w-[130px] bg-muted/50 border-border text-foreground/80 text-xs focus-visible:ring-[#4f8ef7]/30 dark:[&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:opacity-40"
            aria-label="Tanggal mulai"
          />
          <span className="text-muted-foreground/60 text-xs">—</span>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => onEndDateChange(e.target.value)}
            className="h-8 w-[130px] bg-muted/50 border-border text-foreground/80 text-xs focus-visible:ring-[#4f8ef7]/30 dark:[&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:opacity-40"
            aria-label="Tanggal akhir"
          />
        </div>
      </div>

      {/* Row 2: Actions + Badge */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={onApply}
            className={`h-7 text-[11px] font-medium gap-1.5 border-0 transition-all ${
              isFiltered
                ? 'bg-[#4f8ef7]/25 text-[#4f8ef7] hover:bg-[#4f8ef7]/35 animate-pulse-once'
                : 'bg-[#4f8ef7]/15 text-[#4f8ef7] hover:bg-[#4f8ef7]/25'
            }`}
          >
            <Filter className="size-3" />
            Terapkan
          </Button>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={onReset}
                disabled={!isFiltered}
                className="h-7 text-muted-foreground hover:text-foreground/80 hover:bg-muted text-[11px] gap-1.5 disabled:opacity-30"
              >
                <RotateCcw className="size-3" />
                <span className="hidden sm:inline">Reset</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Reset filter ke default</TooltipContent>
          </Tooltip>
        </div>

        {/* Active filter badge with date range and pulse animation */}
        {isFiltered && (
          <Badge
            className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[10px] font-medium gap-1.5 shrink-0"
          >
            <span className="size-1.5 rounded-full bg-amber-400 animate-pulse" />
            {formatDateShort(startDate)} — {formatDateShort(endDate)}
          </Badge>
        )}
      </div>
    </div>
  );
}
