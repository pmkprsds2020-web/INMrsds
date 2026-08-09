'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip as ChartTooltip, Legend as ChartLegend } from 'chart.js';
import {
  Hand,
  Stethoscope,
  ScanLine,
  Shield,
  TriangleAlert,
  Clock,
  Clock4,
  Monitor,
  FlaskConical,
  Pill,
  FileText,
  Scissors,
  CheckCircle2,
  XCircle,
  Database,
  Target,
  Activity,
  Building2,
  Loader2,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Sun,
  CloudSun,
  Sunset,
  Moon,
  Sparkles,
  Calendar,
  AlertTriangle,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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

import {
  type IndicatorType,
  type IndicatorEntry,
  INDICATORS,
  UNIT_MAP,
} from '@/types';
import { calculateStats, type IndicatorStats } from '@/lib/calculations';
import { getFilteredEntries } from '@/lib/supabaseData';
import { OnboardingGuide } from '@/components/dashboard/OnboardingGuide';

/* ── Register Chart.js components ─────────────────────────────── */
ChartJS.register(ArcElement, ChartTooltip, ChartLegend);

/* ── Props ────────────────────────────────────────────────────── */
export interface DashboardOverviewPanelProps {
  activeUnit: string;
  onNavigateToIndicator: (type: IndicatorType) => void;
  userName?: string;
}

/* ── Icon map (same as IndicatorPanel) ────────────────────────── */
const ICON_MAP: Record<string, LucideIcon> = {
  hand: Hand,
  stethoscope: Stethoscope,
  'scan-line': ScanLine,
  shield: Shield,
  'triangle-alert': TriangleAlert,
  clock: Clock,
  monitor: Monitor,
  'flask-conical': FlaskConical,
  pill: Pill,
  'file-text': FileText,
  scissors: Scissors,
};

/* ── Greeting helpers ─────────────────────────────────────────── */
function getGreeting(): { text: string; Icon: LucideIcon } {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 11) return { text: 'Selamat Pagi', Icon: Sun };
  if (hour >= 11 && hour < 15) return { text: 'Selamat Siang', Icon: CloudSun };
  if (hour >= 15 && hour < 18) return { text: 'Selamat Sore', Icon: Sunset };
  return { text: 'Selamat Malam', Icon: Moon };
}

function getIndonesianDate(): string {
  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const now = new Date();
  return `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
}

/* ── Today's date string for heatmap comparison ──────────────── */
const TODAY_STR = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
})();

/* ── Animated number hook ─────────────────────────────────────── */
function useAnimatedNumber(target: number, duration = 900) {
  const [current, setCurrent] = useState(0);
  const prevTarget = useRef(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const start = prevTarget.current;
    const diff = target - start;
    if (diff === 0) return;
    const startTime = performance.now();

    function tick(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      const value = Math.round(start + diff * ease);
      setCurrent(value);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        prevTarget.current = target;
      }
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return current;
}

/* ── Animated decimal number hook (for percentages) ────────────── */
function useAnimatedDecimal(target: number, duration = 900) {
  const [current, setCurrent] = useState(0);
  const prevTarget = useRef(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const start = prevTarget.current;
    const diff = target - start;
    if (Math.abs(diff) < 0.01) return;
    const startTime = performance.now();

    function tick(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      const val = start + diff * ease;
      setCurrent(Math.round(val * 10) / 10);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        prevTarget.current = target;
      }
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return current;
}

/* ── Progress Ring Component ──────────────────────────────────── */
function ProgressRing({
  percentage,
  color,
  size = 72,
  strokeWidth = 5,
}: {
  percentage: number;
  color: string;
  size?: number;
  strokeWidth?: number;
}) {
  const animatedPct = useAnimatedDecimal(Math.min(100, Math.max(0, percentage)));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (animatedPct / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
        role="img"
        aria-label={`Compliance: ${percentage}%`}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--muted-foreground) / 0.2)"
          strokeWidth={strokeWidth}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
          style={{
            filter: `drop-shadow(0 0 6px ${color}50)`,
          }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-bold text-foreground/90 font-mono">
          {animatedPct.toFixed(1)}
          <span className="text-[10px] text-muted-foreground">%</span>
        </span>
      </div>
    </div>
  );
}

/* ── Mini Progress Ring for KPI cards ─────────────────────────── */
function MiniProgressRing({
  percentage,
  color,
  size = 44,
  strokeWidth = 3,
}: {
  percentage: number;
  color: string;
  size?: number;
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(100, Math.max(0, percentage)) / 100) * circumference;

  return (
    <svg
      width={size}
      height={size}
      className="transform -rotate-90"
      role="img"
      aria-label={`${percentage}%`}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="hsl(var(--muted-foreground) / 0.2)"
        strokeWidth={strokeWidth}
      />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 1, ease: 'easeOut' }}
      />
    </svg>
  );
}

/* ── Sparkline Component ──────────────────────────────────────── */
function Sparkline({
  data,
  color,
  width = 80,
  height = 30,
}: {
  data: number[];
  color: string;
  width?: number;
  height?: number;
}) {
  if (data.length < 2) return null;

  const padding = 3;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * (width - padding * 2) + padding;
    const y = height - padding - ((val - min) / range) * (height - padding * 2);
    return { x, y };
  });

  const linePathD = `M${points.map((p) => `${p.x},${p.y}`).join(' L')}`;
  // Area fill path: line + close to bottom
  const areaPathD = `${linePathD} L${points[points.length - 1].x},${height} L${points[0].x},${height} Z`;

  const gradientId = `sparkline-grad-${color.replace(/[^a-zA-Z0-9]/g, '')}-${Math.random().toString(36).slice(2, 8)}`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="shrink-0"
      role="img"
      aria-label="Trend sparkline"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {/* Gradient fill area */}
      <path
        d={areaPathD}
        fill={`url(#${gradientId})`}
      />
      {/* Line stroke */}
      <path
        d={linePathD}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* End dot */}
      <circle
        cx={points[points.length - 1].x}
        cy={points[points.length - 1].y}
        r={2}
        fill={color}
      />
    </svg>
  );
}

/* ── Motivational message helper ──────────────────────────────── */
function getMotivationalMessage(meetingTarget: number, totalIndicators: number): { text: string; emoji: string } {
  if (totalIndicators === 0) return { text: 'Mulai input data untuk melihat perkembangan', emoji: '📊' };
  const ratio = meetingTarget / totalIndicators;
  if (ratio >= 1) return { text: 'Luar biasa! Semua target tercapai! 🎉', emoji: '🏆' };
  if (ratio >= 0.8) return { text: 'Hampir sempurna! Sedikit lagi menuju 100%!', emoji: '🌟' };
  if (ratio >= 0.5) return { text: 'Terus tingkatkan! Setengah jalan sudah tercapai.', emoji: '💪' };
  return { text: 'Ayo semangat! Setiap langkah kecil berarti.', emoji: '🚀' };
}

/* ── Mini Compliance Donut (SVG) ──────────────────────────────── */
function MiniComplianceDonut({ percentage, size = 56 }: { percentage: number; size?: number }) {
  const strokeWidth = 5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(100, Math.max(0, percentage));
  const offset = circumference - (pct / 100) * circumference;
  const color = pct >= 80 ? '#34d399' : pct >= 50 ? '#fbbf24' : '#f87171';

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="hsl(var(--muted-foreground) / 0.15)" strokeWidth={strokeWidth} />
        <motion.circle
          cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: 'easeOut' }}
          style={{ filter: `drop-shadow(0 0 4px ${color}40)` }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[10px] font-bold font-mono text-foreground/80">{Math.round(pct)}%</span>
      </div>
    </div>
  );
}

/* ── Welcome Card Component ───────────────────────────────────── */
function WelcomeCard({
  userName,
  notMeetingTarget,
  meetingTarget,
  totalIndicators,
  overallCompliance,
}: {
  userName: string;
  notMeetingTarget: number;
  meetingTarget: number;
  totalIndicators: number;
  overallCompliance: number;
}) {
  const { text: greeting, Icon: GreetingIcon } = getGreeting();
  const indonesianDate = getIndonesianDate();
  const motivational = getMotivationalMessage(meetingTarget, totalIndicators);

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="relative overflow-hidden rounded-xl border border-border backdrop-blur-xl p-5"
    >
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-gradient-to-r from-teal-500/5 via-emerald-500/8 to-teal-500/5" style={{ backgroundSize: '200% 100%', animation: 'gradient-shift 6s ease-in-out infinite' }} />
      {/* Gradient accent at top */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-teal-500 via-emerald-400 to-teal-500" />

      {/* Decorative background orbs */}
      <div className="pointer-events-none absolute -right-8 -top-8 size-32 rounded-full bg-teal-400/5 blur-2xl" />
      <div className="pointer-events-none absolute -left-4 -bottom-4 size-24 rounded-full bg-emerald-400/5 blur-2xl" />

      <div className="relative z-10 flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex size-12 items-center justify-center rounded-xl bg-teal-500/10 border border-teal-500/15">
              <GreetingIcon className="size-6 text-teal-500" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground/90">
                {greeting}, <span className="text-teal-600 dark:text-teal-400">{userName}</span>!
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <Calendar className="size-3 text-muted-foreground/60" />
                <p className="text-xs text-muted-foreground">{indonesianDate}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Mini compliance donut */}
            <MiniComplianceDonut percentage={overallCompliance} size={56} />

            <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2">
              <Sparkles className="size-4 text-amber-500 dark:text-amber-400" />
              <div>
                <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                  {notMeetingTarget > 0
                    ? `Anda memiliki ${notMeetingTarget} indikator yang perlu diperhatikan`
                    : 'Semua indikator memenuhi target!'
                  }
                </p>
                <p className="text-[10px] text-amber-500/80 dark:text-amber-400/60">
                  {notMeetingTarget > 0 ? 'Indikator belum memenuhi target' : 'Pertahankan prestasi!'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Motivational message */}
        <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/20 px-3 py-2">
          <span className="text-sm">{motivational.emoji}</span>
          <p className="text-xs font-medium text-foreground/70">{motivational.text}</p>
        </div>
      </div>
    </motion.div>
  );
}

/* ── Recent Activity Section ────────────────────────────────────── */
function RecentActivitySection({
  indicatorData,
  onNavigateToIndicator,
}: {
  indicatorData: Record<IndicatorType, IndicatorEntry[]>;
  onNavigateToIndicator: (type: IndicatorType) => void;
}) {
  const recentEntries = useMemo(() => {
    const all: Array<{ entry: IndicatorEntry; indicatorId: IndicatorType; indicatorLabel: string; indicatorColor: string }> = [];
    INDICATORS.forEach((ind) => {
      (indicatorData[ind.id] || []).forEach((e) => {
        all.push({ entry: e, indicatorId: ind.id, indicatorLabel: ind.label, indicatorColor: ind.color });
      });
    });
    // Sort by createdAt descending
    all.sort((a, b) => (b.entry.createdAt || '').localeCompare(a.entry.createdAt || ''));
    return all.slice(0, 5);
  }, [indicatorData]);

  if (recentEntries.length === 0) return null;

  const formatTimestamp = (ts: string) => {
    if (!ts) return '';
    try {
      const d = new Date(ts);
      const now = new Date();
      const diff = now.getTime() - d.getTime();
      const minutes = Math.floor(diff / 60000);
      if (minutes < 1) return 'Baru saja';
      if (minutes < 60) return `${minutes} menit lalu`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours} jam lalu`;
      const days = Math.floor(hours / 24);
      if (days < 7) return `${days} hari lalu`;
      return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return ts;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="relative overflow-hidden rounded-xl border border-border bg-card/70 backdrop-blur-xl p-5"
    >
      {/* Gradient accent at top */}
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-teal-400/40 to-transparent" />

      <div className="flex items-center gap-2 mb-4">
        <Clock4 className="size-4 text-teal-500" />
        <h3 className="text-sm font-semibold text-foreground/80">Aktivitas Terkini</h3>
        <span className="text-[10px] text-muted-foreground/50 ml-auto">5 data terakhir</span>
      </div>

      <div className="space-y-2">
        {recentEntries.map(({ entry, indicatorId, indicatorLabel, indicatorColor }, idx) => (
          <motion.div
            key={`${entry.id}-${idx}`}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: idx * 0.06 }}
            onClick={() => onNavigateToIndicator(indicatorId)}
            className="group flex items-center gap-3 rounded-lg border border-border/40 bg-muted/10 px-3 py-2.5 cursor-pointer transition-colors hover:bg-muted/30"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md" style={{ backgroundColor: `${indicatorColor}18` }}>
              <Database className="h-3.5 w-3.5" style={{ color: indicatorColor }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-foreground/80 truncate">{indicatorLabel}</span>
                <span className="text-[9px] text-muted-foreground/50 truncate">{entry.date || ''}</span>
              </div>
              <p className="text-[10px] text-muted-foreground/50 truncate">{entry.unitId || ''}</p>
            </div>
            <span className="text-[10px] text-muted-foreground/40 shrink-0">{formatTimestamp(entry.createdAt || '')}</span>
            <ArrowRight className="size-3 text-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity" />
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

/* ── Activity Heatmap Component ───────────────────────────────── */
function ActivityHeatmap({
  indicatorData,
}: {
  indicatorData: Record<IndicatorType, IndicatorEntry[]>;
}) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollHint, setShowScrollHint] = useState(false);

  // Build a 7-column grid (Mon–Sun) × ~5 rows for the last 30 days
  const { grid, dayLabels, monthLabels } = useMemo(() => {
    const today = new Date();
    const countMap: Record<string, number> = {};
    const cellInfo: { date: string; label: string; month: number }[] = [];

    // Generate last 30 days
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];
      cellInfo.push({
        date: dateStr,
        label: `${dayNames[d.getDay()]}, ${d.getDate()} ${monthNames[d.getMonth()]} ${d.getFullYear()}`,
        month: d.getMonth(),
      });
      countMap[dateStr] = 0;
    }

    // Count entries per date across all indicators
    Object.values(indicatorData).forEach((entries) => {
      entries.forEach((e) => {
        const date = e.date || '';
        if (date in countMap) {
          countMap[date]++;
        }
      });
    });

    // Build 7-column grid (0=Sen, 1=Sel, ..., 5=Sab, 6=Min)
    function toCol(jsDay: number): number {
      return jsDay === 0 ? 6 : jsDay - 1;
    }

    const firstDate = new Date(today);
    firstDate.setDate(firstDate.getDate() - 29);
    const firstCol = toCol(firstDate.getDay());

    const totalCells = firstCol + 30;
    const numRows = Math.ceil(totalCells / 7);

    // Build grid[row][col] = { date, label, count, month } or null
    const gridCells: (null | { date: string; label: string; count: number; month: number })[][] = [];
    let cellIdx = 0;

    for (let row = 0; row < numRows; row++) {
      const rowCells: (null | { date: string; label: string; count: number; month: number })[] = [];
      for (let col = 0; col < 7; col++) {
        const linearIdx = row * 7 + col;
        if (linearIdx < firstCol) {
          rowCells.push(null);
        } else if (cellIdx < 30) {
          const ci = cellInfo[cellIdx];
          rowCells.push({ date: ci.date, label: ci.label, count: countMap[ci.date] || 0, month: ci.month });
          cellIdx++;
        } else {
          rowCells.push(null);
        }
      }
      gridCells.push(rowCells);
    }

    // Compute month labels: for each column position, find the month of the first cell in that column
    const mLabels: { label: string; col: number }[] = [];
    let lastMonth = -1;
    for (let col = 0; col < 7; col++) {
      for (let row = 0; row < numRows; row++) {
        const cell = gridCells[row]?.[col];
        if (cell && cell.month !== lastMonth) {
          const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];
          mLabels.push({ label: monthNames[cell.month], col });
          lastMonth = cell.month;
          break;
        }
      }
    }

    const labels = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

    return { grid: gridCells, dayLabels: labels, monthLabels: mLabels };
  }, [indicatorData]);

  // Check if scroll hint should show (mobile)
  useEffect(() => {
    const checkScroll = () => {
      if (scrollContainerRef.current) {
        const { scrollWidth, clientWidth } = scrollContainerRef.current;
        setShowScrollHint(scrollWidth > clientWidth + 2);
      }
    };
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [grid]);

  function getColor(count: number): string {
    if (count === 0) return 'bg-muted/30 dark:bg-muted/30';
    if (count <= 5) return 'bg-emerald-600/30 dark:bg-emerald-500/30';
    if (count <= 15) return 'bg-emerald-600/55 dark:bg-emerald-500/50';
    return 'bg-emerald-600/80 dark:bg-emerald-400/70';
  }

  return (
    <div className="relative rounded-xl border border-border bg-card/70 backdrop-blur-xl p-4">
      {/* Gradient accent at top */}
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent" />

      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-xs font-semibold text-foreground/80">Aktivitas Input Data (30 Hari Terakhir)</h3>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] text-muted-foreground/50">Sedikit</span>
          <span className="size-2.5 rounded-[3px] bg-muted/30" />
          <span className="size-2.5 rounded-[3px] bg-emerald-600/30 dark:bg-emerald-500/30" />
          <span className="size-2.5 rounded-[3px] bg-emerald-600/55 dark:bg-emerald-500/50" />
          <span className="size-2.5 rounded-[3px] bg-emerald-600/80 dark:bg-emerald-400/70" />
          <span className="text-[9px] text-muted-foreground/50">Banyak</span>
        </div>
      </div>

      <div className="flex gap-1.5">
        {/* Day-of-week labels */}
        <div className="flex flex-col gap-1 shrink-0">
          {/* Spacer row for month labels */}
          <div className="h-4" />
          {dayLabels.map((label, i) => (
            <span
              key={label}
              className="flex items-center justify-end text-[9px] text-muted-foreground/50 leading-none"
              style={{ height: 20, width: i % 2 === 0 ? 20 : 20, visibility: i % 2 === 0 ? 'visible' : 'hidden' }}
            >
              {label}
            </span>
          ))}
        </div>

        {/* Grid of cells — horizontally scrollable on small screens */}
        <div className="flex-1 min-w-0">
          {/* Month labels row */}
          <div className="relative h-4 mb-0.5">
            {monthLabels.map((ml, i) => {
              // Calculate left position based on column index
              const left = ml.col * 21; // 20px cell + 1px gap approx
              const prevEnd = i > 0 ? monthLabels[i - 1].col * 21 : 0;
              return (
                <span
                  key={`${ml.label}-${ml.col}`}
                  className="absolute text-[9px] text-muted-foreground/60 font-medium leading-none"
                  style={{ left: Math.max(prevEnd, left) }}
                >
                  {ml.label}
                </span>
              );
            })}
          </div>

          {/* Scrollable grid container */}
          <div className="relative">
            <div
              ref={scrollContainerRef}
              className="overflow-x-auto -webkit-overflow-scrolling-touch scrollbar-thin"
            >
              <div className="inline-flex flex-col gap-1 min-w-max">
                {grid.map((row, rowIdx) => (
                  <div key={rowIdx} className="flex gap-1">
                    {row.map((cell, colIdx) => {
                      const isToday = cell?.date === TODAY_STR;
                      return cell ? (
                        <Tooltip key={`${rowIdx}-${colIdx}`}>
                          <TooltipTrigger asChild>
                            <motion.div
                              className={`relative size-5 rounded-[3px] transition-colors duration-200 ${getColor(cell.count)} cursor-default heatmap-cell`}
                              whileHover={{ scale: 1.3, zIndex: 10 }}
                              transition={{ duration: 0.15 }}
                            >
                              {/* Today ring indicator */}
                              {isToday && (
                                <div className="absolute -inset-[2px] rounded-[5px] border-2 border-foreground/40 pointer-events-none" />
                              )}
                              {/* Count badge for >10 entries */}
                              {cell.count > 10 && (
                                <span className="absolute -top-1 -right-1 flex size-3.5 items-center justify-center rounded-full bg-emerald-600 dark:bg-emerald-400 text-[6px] font-bold text-white leading-none">
                                  {cell.count > 99 ? '99+' : cell.count}
                                </span>
                              )}
                              {/* Hari Ini label for today */}
                              {isToday && (
                                <span className="absolute -bottom-3.5 left-1/2 -translate-x-1/2 text-[7px] font-semibold text-foreground/50 whitespace-nowrap">
                                  Hari Ini
                                </span>
                              )}
                            </motion.div>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">
                            <span className="font-medium">{cell.label}</span>: {cell.count} entri
                            {isToday && <span className="ml-1 text-emerald-400">(Hari Ini)</span>}
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <div key={`${rowIdx}-${colIdx}`} className="size-5" />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            {/* Scroll indicator for mobile */}
            {showScrollHint && (
              <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-card/90 to-transparent" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Compliance Overview Chart ─────────────────────────────────── */
function ComplianceOverviewChart({
  meetingTarget,
  totalIndicators,
  indicatorStats,
  onNavigateToIndicator,
  hasNoData = false,
}: {
  meetingTarget: number;
  totalIndicators: number;
  indicatorStats: Record<string, IndicatorStats>;
  onNavigateToIndicator: (type: IndicatorType) => void;
  hasNoData?: boolean;
}) {
  const notMeeting = totalIndicators - meetingTarget;
  const compliancePct = totalIndicators > 0 ? Math.round((meetingTarget / totalIndicators) * 100) : 0;

  // Doughnut chart data
  const chartData = useMemo(() => {
    if (hasNoData) {
      return {
        labels: ['Belum Ada Data'],
        datasets: [{
          data: [1],
          backgroundColor: ['hsl(var(--muted-foreground) / 0.12)'],
          borderColor: ['hsl(var(--muted-foreground) / 0.25)'],
          borderWidth: 1,
          hoverBackgroundColor: ['hsl(var(--muted-foreground) / 0.18)'],
        }],
      };
    }
    if (meetingTarget === 0 && notMeeting === 0) {
      return {
        labels: ['Belum Ada Data'],
        datasets: [{
          data: [1],
          backgroundColor: ['hsl(var(--muted-foreground) / 0.12)'],
          borderColor: ['hsl(var(--muted-foreground) / 0.25)'],
          borderWidth: 1,
          hoverBackgroundColor: ['hsl(var(--muted-foreground) / 0.18)'],
        }],
      };
    }
    return {
      labels: ['Target Tercapai', 'Belum Tercapai'],
      datasets: [{
        data: [meetingTarget, notMeeting],
        backgroundColor: [
          'rgba(52, 211, 153, 0.7)',
          'rgba(248, 113, 113, 0.7)',
        ],
        borderColor: [
          'rgba(52, 211, 153, 1)',
          'rgba(248, 113, 113, 1)',
        ],
        borderWidth: 1,
        hoverBackgroundColor: [
          'rgba(52, 211, 153, 0.9)',
          'rgba(248, 113, 113, 0.9)',
        ],
      }],
    };
  }, [meetingTarget, notMeeting, hasNoData]);

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: true,
    cutout: '70%',
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: true,
        backgroundColor: 'rgba(0,0,0,0.8)',
        titleFont: { size: 11 },
        bodyFont: { size: 11 },
        padding: 8,
        cornerRadius: 8,
        callbacks: {
          label: function(ctx: { label: string; raw: number }) {
            return `${ctx.label}: ${ctx.raw} indikator`;
          },
        },
      },
    },
    animation: {
      animateRotate: true,
      animateScale: true,
    },
  }), []);

  // Get indicators not meeting target, sorted ascending by pct (worst first)
  const worstIndicators = useMemo(() => {
    return INDICATORS
      .filter((ind) => {
        const stats = indicatorStats[ind.id];
        return !stats.ok && stats.den > 0;
      })
      .sort((a, b) => {
        const statsA = indicatorStats[a.id];
        const statsB = indicatorStats[b.id];
        return statsA.pct - statsB.pct;
      })
      .slice(0, 5);
  }, [indicatorStats]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="relative overflow-hidden rounded-xl border border-border bg-card/70 backdrop-blur-xl p-5"
    >
      {/* Gradient accent at top */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 via-[#4f8ef7] to-red-400" />

      <div className="flex items-center gap-2 mb-4">
        <Target className="size-4 text-[#4f8ef7]" />
        <h3 className="text-sm font-semibold text-foreground/80">Ringkasan Kepatuhan</h3>
      </div>

      <div className="flex flex-col md:flex-row gap-6 items-start">
        {/* Left: Doughnut chart */}
        <div className="flex flex-col items-center gap-3 shrink-0">
          <div className="relative" style={{ width: 220, height: 220 }}>
            <Doughnut data={chartData} options={chartOptions} width={220} height={220} />
            {/* Center text overlay */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-3xl font-bold font-mono text-foreground/90">
                {compliancePct}
                <span className="text-base text-muted-foreground">%</span>
              </span>
              <span className="text-[10px] text-muted-foreground/60 font-medium mt-0.5">
                Target Tercapai
              </span>
            </div>
          </div>

          {/* Legend below chart */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-emerald-400" />
              <span className="text-[10px] text-muted-foreground">
                Tercapai ({meetingTarget})
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-red-400" />
              <span className="text-[10px] text-muted-foreground">
                Belum ({notMeeting})
              </span>
            </div>
          </div>
        </div>

        {/* Right: Top indicators needing attention */}
        <div className="flex-1 min-w-0 w-full">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="size-3.5 text-amber-400" />
            <h4 className="text-xs font-semibold text-foreground/70">
              Indikator Perlu Perhatian
            </h4>
          </div>

          {hasNoData ? (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <Database className="size-8 text-muted-foreground/30 mb-2" />
              <p className="text-xs text-muted-foreground/50">
                Belum ada data yang tersedia
              </p>
              <p className="text-[10px] text-muted-foreground/30 mt-1">
                Mulai input data untuk melihat ringkasan kepatuhan
              </p>
            </div>
          ) : worstIndicators.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <CheckCircle2 className="size-8 text-emerald-400/60 mb-2" />
              <p className="text-xs text-muted-foreground/60">
                Semua indikator memenuhi target!
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {worstIndicators.map((ind, idx) => {
                const stats = indicatorStats[ind.id];
                const Icon = ICON_MAP[ind.icon] ?? FileText;
                const barPct = Math.min(100, Math.max(0, stats.pct));

                return (
                  <motion.div
                    key={ind.id}
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: idx * 0.08, ease: 'easeOut' }}
                    className="group flex items-center gap-2.5 rounded-lg border border-border/50 bg-muted/20 px-3 py-2 transition-colors hover:bg-muted/40"
                  >
                    <span
                      className="flex size-7 shrink-0 items-center justify-center rounded-md"
                      style={{ backgroundColor: `${ind.color}18` }}
                    >
                      <Icon className="size-3.5" style={{ color: ind.color }} />
                    </span>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-[11px] font-medium text-foreground/80 truncate">
                          {ind.label}
                        </span>
                        <span className="text-[10px] font-bold font-mono text-red-400 shrink-0">
                          {stats.pct.toFixed(1)}%
                        </span>
                      </div>
                      {/* Mini progress bar */}
                      <div className="h-1.5 w-full rounded-full bg-muted/50 overflow-hidden">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ backgroundColor: ind.color }}
                          initial={{ width: 0 }}
                          animate={{ width: `${barPct}%` }}
                          transition={{ duration: 0.8, delay: idx * 0.1, ease: 'easeOut' }}
                        />
                      </div>
                    </div>

                    <button
                      onClick={() => onNavigateToIndicator(ind.id)}
                      className="shrink-0 text-[10px] text-muted-foreground/50 transition-colors hover:text-[#4f8ef7] font-medium"
                      aria-label={`Lihat detail ${ind.label}`}
                    >
                      Lihat
                    </button>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* ── KPI Card ─────────────────────────────────────────────────── */
function KpiCard({
  icon: Icon,
  label,
  value,
  suffix,
  color,
  subtitle,
  progress,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  suffix?: string;
  color: string;
  subtitle?: string;
  progress?: number;
}) {
  const animatedValue = useAnimatedNumber(value);

  // Determine gradient based on value (green when meeting target, amber when close, red when far)
  const gradientClass = progress !== undefined
    ? progress >= 80
      ? 'from-emerald-500/10 via-emerald-500/5 to-transparent'
      : progress >= 50
        ? 'from-amber-500/10 via-amber-500/5 to-transparent'
        : 'from-red-500/10 via-red-500/5 to-transparent'
    : `from-[${color}]/10 via-[${color}]/5 to-transparent`;

  const borderGlowClass = progress !== undefined
    ? progress >= 80
      ? 'group-hover:border-emerald-500/30 group-hover:shadow-emerald-500/10'
      : progress >= 50
        ? 'group-hover:border-amber-500/30 group-hover:shadow-amber-500/10'
        : 'group-hover:border-red-500/30 group-hover:shadow-red-500/10'
    : `group-hover:border-[${color}]/30`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      whileHover={{ scale: 1.02, y: -2 }}
      className={`group relative overflow-hidden rounded-xl border border-border bg-card/70 backdrop-blur-xl p-3 sm:p-4 transition-all duration-300 hover:shadow-lg ${borderGlowClass}`}
    >
      {/* Gradient background based on value */}
      <div className={`absolute inset-0 bg-gradient-to-br ${gradientClass} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />

      {/* Thin gradient accent at top */}
      <div
        className="absolute top-0 left-0 right-0 h-0.5 opacity-60 group-hover:opacity-100 transition-opacity"
        style={{
          background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
        }}
      />

      {/* Shimmer loading overlay */}
      <div className="absolute inset-0 shimmer opacity-0 group-hover:opacity-100 transition-opacity" />

      {/* Subtle gradient overlay on hover */}
      <div
        className="absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{
          background: `linear-gradient(135deg, ${color}08 0%, transparent 60%)`,
        }}
      />

      {/* Animated border glow on hover */}
      <div
        className="absolute inset-0 rounded-xl opacity-0 transition-opacity duration-500 group-hover:opacity-100 pointer-events-none"
        style={{ boxShadow: `0 0 20px ${color}15, inset 0 0 20px ${color}08` }}
      />

      <div className="relative z-10 flex items-center gap-2 sm:gap-3">
        {/* Icon with ring */}
        <div className="relative shrink-0">
          <span
            className="flex size-8 sm:size-10 items-center justify-center rounded-lg transition-transform duration-300 group-hover:scale-110"
            style={{ backgroundColor: `${color}18` }}
          >
            <Icon className="size-3.5 sm:size-4.5" style={{ color }} />
          </span>
          {progress !== undefined && (
            <div className="absolute -bottom-0.5 -right-0.5">
              <MiniProgressRing percentage={progress} color={color} size={22} strokeWidth={2} />
            </div>
          )}
        </div>

        {/* Text content */}
        <div className="min-w-0 flex-1">
          <p className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
            {label}
          </p>
          <p className="text-lg sm:text-2xl font-bold font-mono leading-none" style={{ color }}>
            {animatedValue.toLocaleString('id-ID')}
            {suffix && <span className="text-xs sm:text-sm text-muted-foreground">{suffix}</span>}
          </p>
          {subtitle && (
            <p className="text-[9px] sm:text-[10px] text-muted-foreground/60 mt-1 truncate">{subtitle}</p>
          )}
        </div>
      </div>

      {/* Last updated indicator */}
      <div className="relative z-10 flex items-center justify-end mt-2 gap-1">
        <span className="size-1 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-[8px] text-muted-foreground/40">Live</span>
      </div>
    </motion.div>
  );
}

/* ── Indicator Card ───────────────────────────────────────────── */
function IndicatorCard({
  meta,
  stats,
  onClick,
  index,
  entries,
}: {
  meta: typeof INDICATORS[number];
  stats: IndicatorStats;
  onClick: () => void;
  index: number;
  entries: IndicatorEntry[];
}) {
  const Icon = ICON_MAP[meta.icon] ?? FileText;
  const isMeetingTarget = stats.ok;
  const statusColor = isMeetingTarget ? '#34d399' : '#f87171';

  // Compute sparkline data: last 7 data points grouped by date
  const sparklineData = useMemo(() => {
    if (entries.length < 2) return [];
    // Group entries by date and calculate compliance for each date
    const byDate = new Map<string, IndicatorEntry[]>();
    entries.forEach((e) => {
      const d = e.date || '';
      if (!d) return;
      if (!byDate.has(d)) byDate.set(d, []);
      byDate.get(d)!.push(e);
    });
    // Sort dates descending, take last 7
    const sortedDates = Array.from(byDate.keys()).sort((a, b) => a.localeCompare(b));
    const last7 = sortedDates.slice(-7);
    if (last7.length < 2) return [];
    return last7.map((date) => {
      const dateEntries = byDate.get(date) || [];
      const dateStats = calculateStats(meta.id, dateEntries);
      return dateStats.pct;
    });
  }, [entries, meta.id]);

  // Use indicator's color for sparkline (matching the indicator theme)
  const sparklineColor = meta.color;

  return (
    <motion.button
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05, ease: 'easeOut' }}
      onClick={onClick}
      className="group relative w-full overflow-hidden rounded-xl border border-border bg-card/60 backdrop-blur-xl p-5 text-left transition-all duration-300 hover:border-border hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4f8ef7]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      aria-label={`${meta.label}: ${stats.pct}% compliance. ${isMeetingTarget ? 'Target met' : 'Below target'}. Click to view details.`}
    >
      {/* Gradient accent at top */}
      <div
        className="absolute top-0 left-0 right-0 h-0.5 opacity-60"
        style={{
          background: `linear-gradient(90deg, transparent, ${meta.color}, transparent)`,
        }}
      />

      {/* Gradient background matching indicator color */}
      <div
        className="absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{
          background: `linear-gradient(145deg, ${meta.color}0A 0%, transparent 50%)`,
        }}
      />

      {/* Subtle glow on hover */}
      <div
        className="absolute -inset-px rounded-xl opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{
          boxShadow: `0 0 24px ${meta.color}15, inset 0 0 24px ${meta.color}08`,
        }}
      />

      <div className="relative z-10">
        {/* Header: Icon + Name + Status Badge */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className="flex size-9 shrink-0 items-center justify-center rounded-lg transition-transform duration-300 group-hover:scale-110"
              style={{ backgroundColor: `${meta.color}20` }}
            >
              <Icon className="size-4" style={{ color: meta.color }} />
            </span>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-foreground/90 truncate leading-tight">
                {meta.label}
              </h3>
              <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                Target: {meta.targetLabel}
              </p>
            </div>
          </div>

          {/* Status Badge */}
          <Badge
            className="shrink-0 border-0 text-[9px] font-semibold gap-1 px-2 py-0.5"
            style={{
              backgroundColor: isMeetingTarget ? 'rgba(52,211,153,0.15)' : 'rgba(248,113,113,0.15)',
              color: statusColor,
            }}
          >
            {isMeetingTarget ? (
              <>
                <CheckCircle2 className="size-3" />
                Tercapai
              </>
            ) : (
              <>
                <XCircle className="size-3" />
                Belum
              </>
            )}
          </Badge>
        </div>

        {/* Ring + Stats Row */}
        <div className="flex items-center gap-4">
          {/* Progress Ring */}
          <ProgressRing percentage={stats.pct} color={statusColor} size={72} strokeWidth={5} />

          {/* Quick Stats */}
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Numerator</span>
              <span className="text-xs font-semibold font-mono text-foreground/80">{stats.num}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Denominator</span>
              <span className="text-xs font-semibold font-mono text-foreground/80">{stats.den}</span>
            </div>
            <div className="h-px bg-border my-1" />
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Capaian</span>
              <span
                className="text-xs font-bold font-mono"
                style={{ color: statusColor }}
              >
                {stats.pct.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>

        {/* Bottom row: Navigate hint + Sparkline */}
        <div className="mt-3 flex items-end justify-between">
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground/40 transition-colors duration-300 group-hover:text-foreground/50">
            <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">Klik untuk detail</span>
            <ArrowRight className="size-3 transition-transform duration-300 group-hover:translate-x-0.5" />
          </div>
          {/* Sparkline mini-chart in bottom-right */}
          {sparklineData.length >= 2 && (
            <Sparkline data={sparklineData} color={sparklineColor} width={80} height={30} />
          )}
        </div>
      </div>
    </motion.button>
  );
}

/* ── Skeleton Card ────────────────────────────────────────────── */
function SkeletonCard() {
  return (
    <div className="rounded-xl border border-border p-5 bg-card/60 relative overflow-hidden">
      {/* Shimmer overlay */}
      <div className="absolute inset-0 shimmer" />
      {/* Top gradient accent placeholder */}
      <div className="h-0.5 w-full rounded bg-muted/30 mb-4" />
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <Skeleton className="size-9 rounded-lg bg-muted/40" />
          <div className="space-y-1.5">
            <Skeleton className="h-3.5 w-28 bg-muted/40" />
            <Skeleton className="h-2.5 w-20 bg-muted/30" />
          </div>
        </div>
        <Skeleton className="h-5 w-16 rounded-full bg-muted/30" />
      </div>
      <div className="flex items-center gap-4">
        {/* Circle matching the progress ring shape */}
        <div className="size-[72px] rounded-full border-2 border-muted/30 flex items-center justify-center">
          <Skeleton className="h-4 w-10 bg-muted/30" />
        </div>
        <div className="flex-1 space-y-2.5">
          <div className="flex items-center justify-between">
            <Skeleton className="h-2.5 w-16 bg-muted/30" />
            <Skeleton className="h-2.5 w-8 bg-muted/40" />
          </div>
          <div className="flex items-center justify-between">
            <Skeleton className="h-2.5 w-20 bg-muted/30" />
            <Skeleton className="h-2.5 w-8 bg-muted/40" />
          </div>
          <div className="h-px bg-border my-1" />
          <div className="flex items-center justify-between">
            <Skeleton className="h-2.5 w-12 bg-muted/30" />
            <Skeleton className="h-3 w-12 bg-muted/40" />
          </div>
        </div>
      </div>
      {/* Navigate hint placeholder */}
      <div className="mt-3 flex justify-end">
        <Skeleton className="h-2.5 w-16 bg-muted/20" />
      </div>
    </div>
  );
}

/* ── Skeleton KPI Card ────────────────────────────────────────── */
function SkeletonKpiCard() {
  return (
    <div className="rounded-xl border border-border p-3 sm:p-4 bg-card/70 relative overflow-hidden">
      {/* Shimmer overlay */}
      <div className="absolute inset-0 shimmer" />
      <div className="flex items-center gap-2 sm:gap-3">
        <Skeleton className="size-8 sm:size-10 rounded-lg bg-muted/40" />
        <div className="space-y-1.5 flex-1">
          <Skeleton className="h-2.5 w-16 bg-muted/30" />
          <Skeleton className="h-6 w-20 bg-muted/40" />
        </div>
      </div>
    </div>
  );
}

/* ── Main Component ───────────────────────────────────────────── */
export function DashboardOverviewPanel({
  activeUnit,
  onNavigateToIndicator,
  userName = 'Pengguna',
}: DashboardOverviewPanelProps) {
  const [selectedUnit, setSelectedUnit] = useState<string>(activeUnit);
  const [indicatorData, setIndicatorData] = useState<Record<IndicatorType, IndicatorEntry[]>>(() => {
    const initial: Record<string, IndicatorEntry[]> = {};
    INDICATORS.forEach((ind) => {
      initial[ind.id] = [];
    });
    return initial as Record<IndicatorType, IndicatorEntry[]>;
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showAllIndicators, setShowAllIndicators] = useState(false);

  // Check if onboarding should be shown (only on mount)
  useEffect(() => {
    const isComplete = localStorage.getItem('onboarding_complete');
    if (!isComplete) {
      setShowOnboarding(true);
    }
  }, []);

  // Dismiss onboarding and persist
  const handleDismissOnboarding = useCallback(() => {
    setShowOnboarding(false);
    localStorage.setItem('onboarding_complete', 'true');
  }, []);

  // Check if all indicator data is empty
  const hasNoData = useMemo(() => {
    return Object.values(indicatorData).every((entries) => entries.length === 0);
  }, [indicatorData]);

  // Auto-dismiss onboarding when data appears
  useEffect(() => {
    if (!isLoading && !hasNoData && showOnboarding) {
      handleDismissOnboarding();
    }
  }, [isLoading, hasNoData, showOnboarding, handleDismissOnboarding]);

  // Sync selectedUnit with activeUnit prop
  useEffect(() => {
    setSelectedUnit(activeUnit);
  }, [activeUnit]);

  // Load data for all indicators
  const loadAllData = useCallback(async (unit: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const results = await Promise.all(
        INDICATORS.map(async (ind) => {
          try {
            const entries = await getFilteredEntries(
              ind.id,
              unit === 'all' ? null : unit,
            );
            return { type: ind.id, entries };
          } catch {
            return { type: ind.id, entries: [] as IndicatorEntry[] };
          }
        })
      );

      const dataMap: Record<string, IndicatorEntry[]> = {};
      results.forEach((r) => {
        dataMap[r.type] = r.entries;
      });
      setIndicatorData(dataMap as Record<IndicatorType, IndicatorEntry[]>);
    } catch (err) {
      console.error('Error loading overview data:', err);
      setError('Gagal memuat data. Silakan coba lagi.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllData(selectedUnit);
  }, [selectedUnit, loadAllData]);

  // Calculate stats for each indicator
  const indicatorStats = useMemo(() => {
    const map: Record<string, IndicatorStats> = {};
    INDICATORS.forEach((ind) => {
      const entries = indicatorData[ind.id] || [];
      map[ind.id] = calculateStats(ind.id, entries);
    });
    return map;
  }, [indicatorData]);

  // Count indicators not meeting target
  const notMeetingTarget = useMemo(() => {
    let count = 0;
    INDICATORS.forEach((ind) => {
      const stats = indicatorStats[ind.id];
      if (!stats.ok) count++;
    });
    return count;
  }, [indicatorStats]);

  // KPI summary values
  const kpiValues = useMemo(() => {
    let totalEntries = 0;
    let meetingTarget = 0;
    let totalPct = 0;
    let activeUnitCount = 0;
    let indicatorsWithData = 0;

    INDICATORS.forEach((ind) => {
      const stats = indicatorStats[ind.id];
      const entries = indicatorData[ind.id] || [];
      totalEntries += entries.length;
      if (stats.ok) meetingTarget++;
      if (entries.length > 0) {
        totalPct += stats.pct;
        indicatorsWithData++;
      }
    });

    // Count active units (units that have data)
    const unitsWithData = new Set<string>();
    Object.values(indicatorData).forEach((entries) => {
      entries.forEach((e) => {
        if (e.unitId) unitsWithData.add(e.unitId);
      });
    });
    activeUnitCount = unitsWithData.size;

    const overallCompliance = indicatorsWithData > 0 ? totalPct / indicatorsWithData : 0;

    return {
      totalEntries,
      meetingTarget,
      totalIndicators: INDICATORS.length,
      overallCompliance,
      activeUnitCount,
    };
  }, [indicatorData, indicatorStats]);

  // Filter indicators based on unit
  const visibleIndicators = useMemo(() => {
    const unitMeta = UNIT_MAP[selectedUnit] ?? UNIT_MAP['all'];
    if (selectedUnit === 'all') return INDICATORS;
    return INDICATORS.filter((ind) => unitMeta.inds.includes(ind.id));
  }, [selectedUnit]);

  // Indicator toggle logic
  const INDICATOR_COLLAPSE_THRESHOLD = 6;
  const hasMoreIndicators = visibleIndicators.length > INDICATOR_COLLAPSE_THRESHOLD;
  const displayedIndicators = useMemo(() => {
    if (!hasMoreIndicators || showAllIndicators) return visibleIndicators;
    return visibleIndicators.slice(0, INDICATOR_COLLAPSE_THRESHOLD);
  }, [visibleIndicators, hasMoreIndicators, showAllIndicators]);

  // Unit options for the selector
  const unitOptions = useMemo(() => {
    const options = Object.entries(UNIT_MAP).map(([key, meta]) => ({
      value: key,
      label: meta.label,
      color: meta.color,
    }));
    return options;
  }, []);

  return (
    <div className="flex h-full flex-col gap-5">
      {/* ── Onboarding Guide (only shows when no data and not completed) ── */}
      <AnimatePresence>
        {!isLoading && showOnboarding && hasNoData && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            <OnboardingGuide
              onComplete={handleDismissOnboarding}
              onNavigateToIndicator={() => onNavigateToIndicator('tangan')}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Welcome Card (only shows when indicators not meeting target) ── */}
      <AnimatePresence>
        {!isLoading && notMeetingTarget > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            <WelcomeCard
              userName={userName}
              notMeetingTarget={notMeetingTarget}
              meetingTarget={kpiValues.meetingTarget}
              totalIndicators={kpiValues.totalIndicators}
              overallCompliance={kpiValues.overallCompliance}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Header Section ────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold text-foreground/90">Dashboard Overview</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Ringkasan capaian mutu untuk seluruh indikator
          </p>
        </div>

        {/* Unit Selector */}
        <div className="flex items-center gap-2">
          <Building2 className="size-4 text-muted-foreground/60" />
          <Select
            value={selectedUnit}
            onValueChange={(val) => setSelectedUnit(val)}
          >
            <SelectTrigger
              className="w-[180px] h-8 border-border bg-muted/50 text-foreground/80 text-xs focus:ring-[#4f8ef7]/30"
              aria-label="Pilih unit"
            >
              <SelectValue placeholder="Pilih Unit" />
            </SelectTrigger>
            <SelectContent
              className="border-border bg-popover text-foreground/80"
            >
              {unitOptions.map((opt) => (
                <SelectItem
                  key={opt.value}
                  value={opt.value}
                  className="text-xs focus:bg-muted/50 focus:text-foreground"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="size-2 rounded-full shrink-0"
                      style={{ backgroundColor: opt.color }}
                    />
                    {opt.label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ── KPI Cards Row — CSS Grid ──────────────────────────── */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonKpiCard key={i} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <KpiCard
            icon={Database}
            label="Total Entri"
            value={kpiValues.totalEntries}
            color="#4f8ef7"
            subtitle="Seluruh data tercatat"
          />
          <KpiCard
            icon={Target}
            label="Target Tercapai"
            value={kpiValues.meetingTarget}
            suffix={` / ${kpiValues.totalIndicators}`}
            color="#34d399"
            subtitle="Indikator memenuhi target"
            progress={(kpiValues.meetingTarget / kpiValues.totalIndicators) * 100}
          />
          <KpiCard
            icon={Activity}
            label="Kepatuhan Keseluruhan"
            value={Math.round(kpiValues.overallCompliance * 10) / 10}
            suffix="%"
            color={kpiValues.overallCompliance >= 80 ? '#34d399' : '#f87171'}
            subtitle="Rata-rata semua indikator"
            progress={kpiValues.overallCompliance}
          />
          <KpiCard
            icon={Building2}
            label="Unit Aktif"
            value={kpiValues.activeUnitCount}
            color="#a78bfa"
            subtitle="Unit dengan data tercatat"
          />
        </div>
      )}

      {/* ── Compliance Overview Chart ──────────────────────────────── */}
      {!isLoading && (
        <ComplianceOverviewChart
          meetingTarget={kpiValues.meetingTarget}
          totalIndicators={kpiValues.totalIndicators}
          indicatorStats={indicatorStats}
          onNavigateToIndicator={onNavigateToIndicator}
          hasNoData={hasNoData}
        />
      )}

      {/* ── Activity Heatmap ───────────────────────────────────── */}
      {!isLoading && (
        <ActivityHeatmap indicatorData={indicatorData} />
      )}

      {/* ── Aktivitas Terkini (Recent Activity) ──────────────────── */}
      {!isLoading && !hasNoData && (
        <RecentActivitySection indicatorData={indicatorData} onNavigateToIndicator={onNavigateToIndicator} />
      )}

      {/* ── Error State ───────────────────────────────────────── */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-center"
          >
            <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
            <button
              onClick={() => loadAllData(selectedUnit)}
              className="mt-2 text-xs text-red-500 dark:text-red-300 underline hover:text-red-700 dark:hover:text-red-200 transition-colors"
            >
              Coba lagi
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Section Header ────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground/80">Indikator Mutu</h2>
          <p className="text-[10px] text-muted-foreground/60 mt-0.5">
            {visibleIndicators.length} indikator • Klik untuk melihat detail
          </p>
        </div>
        {!isLoading && (
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-emerald-400" />
            <span className="text-[10px] text-muted-foreground">Tercapai</span>
            <span className="size-2 rounded-full bg-red-400 ml-2" />
            <span className="text-[10px] text-muted-foreground">Belum</span>
          </div>
        )}
      </div>

      {/* ── Indicator Grid — CSS Grid with toggle ─────────────── */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: visibleIndicators.length || 11 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : (
        <div className="flex-1 min-h-0">
          <AnimatePresence initial={false}>
            <motion.div
              key={showAllIndicators ? 'expanded' : 'collapsed'}
              initial={false}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.35, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5 pb-2">
                {displayedIndicators.map((ind, index) => {
                  const stats = indicatorStats[ind.id];
                  const entries = indicatorData[ind.id] || [];
                  return (
                    <IndicatorCard
                      key={ind.id}
                      meta={ind}
                      stats={stats}
                      onClick={() => onNavigateToIndicator(ind.id)}
                      index={index}
                      entries={entries}
                    />
                  );
                })}
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Toggle button for expanding/collapsing indicators */}
          {hasMoreIndicators && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex justify-center mt-2"
            >
              <button
                onClick={() => setShowAllIndicators((prev) => !prev)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium text-muted-foreground/70 border border-border bg-muted/30 hover:bg-muted/50 hover:text-foreground/80 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4f8ef7]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                {showAllIndicators ? (
                  <>
                    <ChevronUp className="size-3.5" />
                    Tampilkan Sedikit
                  </>
                ) : (
                  <>
                    <ChevronDown className="size-3.5" />
                    Tampilkan Semua ({visibleIndicators.length - INDICATOR_COLLAPSE_THRESHOLD} lagi)
                  </>
                )}
              </button>
            </motion.div>
          )}
        </div>
      )}

      {/* ── Empty State ───────────────────────────────────────── */}
      {!isLoading && visibleIndicators.length === 0 && (
        <div className="flex flex-1 items-center justify-center py-12">
          <div className="text-center">
            <Database className="size-8 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground/60">Tidak ada indikator untuk unit ini</p>
            <p className="text-xs text-muted-foreground/40 mt-1">Pilih unit lain untuk melihat indikator</p>
          </div>
        </div>
      )}
    </div>
  );
}
