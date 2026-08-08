'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: string | number;
  color?: 'green' | 'blue' | 'red' | 'default';
  progress?: number;
  progressColor?: string;
  subtitle?: string;
  /** Trend indicator: positive = up (green), negative = down (red), 0 = flat */
  trend?: number;
  /** Optional trend label (e.g., "vs bulan lalu") */
  trendLabel?: string;
  /** Mini sparkline data points */
  sparklineData?: number[];
}

const COLOR_MAP = {
  green: 'text-emerald-400',
  blue: 'text-sky-400',
  red: 'text-red-400',
  default: 'text-foreground',
} as const;

const PROGRESS_COLOR_MAP = {
  green: '[&>[data-slot=progress-indicator]]:bg-gradient-to-r [&>[data-slot=progress-indicator]]:from-emerald-500 [&>[data-slot=progress-indicator]]:to-emerald-300',
  blue: '[&>[data-slot=progress-indicator]]:bg-gradient-to-r [&>[data-slot=progress-indicator]]:from-sky-500 [&>[data-slot=progress-indicator]]:to-sky-300',
  red: '[&>[data-slot=progress-indicator]]:bg-gradient-to-r [&>[data-slot=progress-indicator]]:from-red-500 [&>[data-slot=progress-indicator]]:to-red-300',
  default: '[&>[data-slot=progress-indicator]]:bg-gradient-to-r [&>[data-slot=progress-indicator]]:from-foreground/70 [&>[data-slot=progress-indicator]]:to-foreground/40',
} as const;

const GRADIENT_MAP = {
  green: 'from-emerald-500/8 via-transparent to-transparent',
  blue: 'from-sky-500/8 via-transparent to-transparent',
  red: 'from-red-500/8 via-transparent to-transparent',
  default: 'from-foreground/5 via-transparent to-transparent',
} as const;

const ACCENT_CSS_COLOR = {
  green: '#34d399',
  blue: '#38bdf8',
  red: '#f87171',
  default: 'hsl(var(--foreground))',
} as const;

/* ── Animated number hook ────────────────────────────────────── */
function useAnimatedNumber(target: number, duration = 500) {
  const [current, setCurrent] = useState(target);
  const prevTarget = useRef(target);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (prevTarget.current === target) return;
    const start = prevTarget.current;
    const diff = target - start;
    const startTime = performance.now();

    function tick(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const ease = 1 - Math.pow(1 - progress, 3);
      setCurrent(Math.round(start + diff * ease));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        prevTarget.current = target;
        setCurrent(target);
      }
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return current;
}

/* ── Mini sparkline SVG ──────────────────────────────────────── */
function MiniSparkline({ data, color, width = 60, height = 24 }: { data: number[]; color: string; width?: number; height?: number }) {
  if (data.length < 2) return null;
  const padding = 2;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * (width - padding * 2) + padding;
    const y = height - padding - ((val - min) / range) * (height - padding * 2);
    return { x, y };
  });

  const pathD = `M${points.map((p) => `${p.x},${p.y}`).join(' L')}`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="shrink-0 opacity-50 group-hover:opacity-80 transition-opacity" role="img" aria-label="Trend sparkline">
      <path d={pathD} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r={1.5} fill={color} />
    </svg>
  );
}

/* ── Trend badge ─────────────────────────────────────────────── */
function TrendBadge({ trend, label }: { trend: number; label?: string }) {
  if (trend === 0) {
    return (
      <div className="flex items-center gap-1">
        <span className="flex items-center gap-0.5 text-[10px] font-medium text-muted-foreground">
          <Minus className="size-3" />
          0%
        </span>
        {label && (
          <span className="text-[9px] text-muted-foreground/50 hidden sm:inline">{label}</span>
        )}
      </div>
    );
  }

  const isUp = trend > 0;
  const Icon = isUp ? TrendingUp : TrendingDown;
  const colorClass = isUp ? 'text-emerald-400' : 'text-red-400';
  const bgClass = isUp ? 'bg-emerald-500/10' : 'bg-red-500/10';

  return (
    <div className="flex items-center gap-1.5">
      <span
        className={cn(
          'inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-semibold',
          bgClass,
          colorClass
        )}
      >
        <Icon className="size-3" />
        {Math.abs(trend).toFixed(1)}%
      </span>
      {label && (
        <span className="text-[9px] text-muted-foreground/50 hidden sm:inline">{label}</span>
      )}
    </div>
  );
}

/* ── Main component ──────────────────────────────────────────── */
export function StatCard({
  label,
  value,
  color = 'default',
  progress,
  progressColor,
  subtitle,
  trend,
  trendLabel,
  sparklineData,
}: StatCardProps) {
  const hasProgress = progress !== undefined && progress !== null;
  const hasTrend = trend !== undefined && trend !== null;
  const hasSparkline = sparklineData && sparklineData.length >= 2;

  // Parse numeric value for animation
  const numericValue = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.-]/g, ''));
  const isNumeric = !isNaN(numericValue) && typeof value === 'number';
  const animatedValue = useAnimatedNumber(isNumeric ? numericValue : 0);

  /* Resolve progress bar color: gradient fill instead of solid */
  const resolvedProgressClass = progressColor
    ? `[&>[data-slot=progress-indicator]]:bg-[${progressColor}]`
    : PROGRESS_COLOR_MAP[color];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      whileHover={{ scale: 1.01 }}
      className={cn(
        'group relative rounded-xl border border-border bg-card p-5 transition-all duration-300 overflow-hidden stat-card-accent card-lift'
      )}
      style={{ '--stat-accent-color': ACCENT_CSS_COLOR[color] } as React.CSSProperties}
    >
      {/* Subtle gradient overlay on background */}
      <div
        className={cn(
          'absolute inset-0 bg-gradient-to-br opacity-40 group-hover:opacity-100 transition-opacity duration-500',
          GRADIENT_MAP[color]
        )}
      />

      {/* Animated border on hover */}
      <div
        className="absolute inset-0 rounded-xl border border-transparent group-hover:border-[var(--stat-accent-color)]/20 transition-all duration-500 pointer-events-none"
      />

      {/* Decorative accent line on left side (matching card color) */}
      <div
        className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full opacity-60 group-hover:opacity-100 transition-opacity duration-300"
        style={{ backgroundColor: ACCENT_CSS_COLOR[color] }}
      />

      <div className="relative z-10 pl-2">
        {/* Top row: Label + Trend */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider truncate">
            {label}
          </p>
          <div className="flex items-center gap-2">
            {hasTrend && <TrendBadge trend={trend} label={trendLabel} />}
          </div>
        </div>

        {/* Value row with sparkline */}
        <div className="flex items-end justify-between gap-2">
          <p
            className={cn(
              'text-3xl font-bold font-mono tracking-tight leading-none',
              COLOR_MAP[color]
            )}
          >
            {isNumeric ? animatedValue.toLocaleString('id-ID') : value}
          </p>
          {hasSparkline && (
            <MiniSparkline data={sparklineData!} color={ACCENT_CSS_COLOR[color]} />
          )}
        </div>

        {/* Subtitle */}
        {subtitle && (
          <p className="text-[11px] text-muted-foreground/60 mt-1.5 truncate">{subtitle}</p>
        )}

        {/* Progress bar with gradient fill */}
        {hasProgress && (
          <div className="mt-4">
            <Progress
              value={Math.min(100, Math.max(0, progress))}
              className={cn('h-1.5 bg-muted progress-pulse-bar', resolvedProgressClass)}
            />
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-[10px] text-muted-foreground/50 font-mono">0%</span>
              <span className="text-[10px] text-muted-foreground font-semibold font-mono">
                {Math.round(progress)}%
              </span>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
