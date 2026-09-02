'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  BarChart3,
  TrendingUp,
  ArrowLeftRight,
  Hand,
  Stethoscope,
  ScanLine,
  Shield,
  TriangleAlert,
  Clock,
  Monitor,
  FlaskConical,
  Pill,
  FileText,
  Scissors,
  ChevronRight,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  FileBarChart,
  Sparkles,
  Activity,
  ShieldCheck,
  FileSpreadsheet,
  ShieldAlert,
  ClipboardList,
  ListChecks,
  FileSearch,
  Microscope,
  Database,
  History,
  ListTodo,
  Wrench,
  ClipboardCheck,
  Grid3x3,
  Users,
  Building2,
  Trophy,
  MessageSquare,
  QrCode,
  Gauge,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { UNIT_MAP, INDICATORS, type IndicatorType } from '@/types';
import { getActiveUnitIndicatorsForUnit, getActivePriorityIndicatorsForUnit, subscribeToCustomIndicators } from '@/lib/customIndicatorData';
import type { CustomIndicator } from '@/types/customIndicators';
import { cn } from '@/lib/utils';

interface DashboardSidebarProps {
  activeUnit: string;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onUnitChange: () => void;
  /** Optional entry counts per indicator for the current period */
  entryCounts?: Record<string, number>;
  /** Total expected entries per indicator (for progress calc) */
  expectedCounts?: Record<string, number>;
  /** Called after any nav item is clicked (useful for mobile auto-close) */
  onNavClick?: () => void;
  /** Compliance data per indicator: { indicatorId: { pct, ok } } */
  complianceData?: Record<string, { pct: number; ok: boolean }>;
}

/* ── Icon map ─────────────────────────────────────────────────── */
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

/* ── Status dot helpers ───────────────────────────────────────── */
type Status = 'done' | 'part' | 'none';

function getStatus(count: number, expected: number): Status {
  if (expected <= 0) return 'none';
  if (count >= expected) return 'done';
  if (count > 0) return 'part';
  return 'none';
}

function StatusDot({ status }: { status: Status }) {
  const map = {
    done: 'bg-emerald-400 shadow-sm shadow-emerald-400/50',
    part: 'bg-amber-400 shadow-sm shadow-amber-400/50',
    none: 'bg-muted-foreground/30',
  };
  return (
    <span
      className={`inline-block size-2 rounded-full ${map[status]}`}
      aria-label={status === 'done' ? 'Lengkap' : status === 'part' ? 'Sebagian' : 'Belum diisi'}
    />
  );
}

/* ── Compliance badge ─────────────────────────────────────────── */
function ComplianceBadge({ pct, ok }: { pct: number; ok: boolean }) {
  const color = ok ? 'text-emerald-400' : 'text-red-400';
  const bgColor = ok ? 'bg-emerald-500/10' : 'bg-red-500/10';
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-sm px-1 py-0 text-[9px] font-bold font-mono ${color} ${bgColor}`}>
      {Math.round(pct)}%
    </span>
  );
}

/* ── Indicator categories for collapsible sections ────────────── */
interface IndicatorSection {
  key: string;
  label: string;
  indicatorIds: IndicatorType[];
}

function getSections(unitKey: string): IndicatorSection[] {
  const unitMeta = UNIT_MAP[unitKey] ?? UNIT_MAP['all'];
  const inds = unitMeta.inds;

  // Split indicators into sections based on grouping logic
  const patientSafety: IndicatorType[] = [];
  const clinicalProcess: IndicatorType[] = [];
  const other: IndicatorType[] = [];

  for (const id of inds) {
    if (['tangan', 'apd', 'identitas', 'jatuh'].includes(id)) {
      patientSafety.push(id);
    } else if (['visite', 'sc', 'op', 'wtrj', 'cp'].includes(id)) {
      clinicalProcess.push(id);
    } else {
      other.push(id);
    }
  }

  const sections: IndicatorSection[] = [];
  if (patientSafety.length > 0) {
    sections.push({ key: 'safety', label: 'Keselamatan Pasien', indicatorIds: patientSafety });
  }
  if (clinicalProcess.length > 0) {
    sections.push({ key: 'clinical', label: 'Proses Klinis', indicatorIds: clinicalProcess });
  }
  if (other.length > 0) {
    sections.push({ key: 'support', label: 'Penunjang', indicatorIds: other });
  }
  return sections;
}

/* ── Main component ───────────────────────────────────────────── */
export function DashboardSidebar({
  activeUnit,
  activeTab,
  onTabChange,
  onUnitChange,
  entryCounts = {},
  expectedCounts = {},
  onNavClick,
  complianceData = {},
}: DashboardSidebarProps) {
  const [search, setSearch] = useState('');
  const [miniMode, setMiniMode] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    safety: true,
    clinical: true,
    support: true,
  });

  /* Top-level sidebar groups (accordion). Only "mutu" (data entry
     indikator) is open by default — the other groups open automatically
     when the active tab belongs to them, keeping the sidebar short. */
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    mutu: true,
    unitInd: true,
    priorityInd: true,
    ikp: false,
    risk: false,
    survey: false,
    kepuasanSurvey: false,
    uimu: false,
    customInd: false,
    analytics: false,
  });
  const toggleGroup = (key: string) =>
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));

  /* Auto-expand the group that contains the currently active tab, so
     navigating from elsewhere (top bar, deep link, refresh) never lands
     on a hidden/collapsed menu item. */
  useEffect(() => {
    let group: string | null = null;
    if (activeTab === 'overview' || INDICATORS.some((i) => i.id === activeTab)) group = 'mutu';
    else if (activeTab.startsWith('unit-ind-')) group = 'unitInd';
    else if (activeTab.startsWith('priority-ind-')) group = 'priorityInd';
    else if (activeTab.startsWith('ikp-')) group = 'ikp';
    else if (activeTab.startsWith('risk-')) group = 'risk';
    else if (activeTab.startsWith('budaya-')) group = 'survey';
    else if (activeTab.startsWith('kepuasan-')) group = 'kepuasanSurvey';
    else if (activeTab.startsWith('uimu-')) group = 'uimu';
    else if (activeTab.startsWith('custom-ind-')) group = 'customInd';
    else if (['tren', 'kepatuhan', 'ringkasan', 'export-templates', 'ai-insights', 'activity-heatmap', 'data-quality', 'compliance-timeline'].includes(activeTab)) group = 'analytics';
    if (group) setOpenGroups((prev) => (prev[group as string] ? prev : { ...prev, [group as string]: true }));
  }, [activeTab]);

  const unitMeta = UNIT_MAP[activeUnit] ?? UNIT_MAP['all'];

  /* Indikator mutu unit (custom, aktif, di-assign ke activeUnit) — untuk
     section "Indikator Mutu Unit" (PIC data entry). Live-fetched karena
     tidak seperti INDICATORS (statis), daftar ini berubah kapan saja
     Komite Mutu membuat/menonaktifkan indikator di Master Indikator Mutu. */
  const [unitIndicators, setUnitIndicators] = useState<CustomIndicator[]>([]);
  useEffect(() => {
    let cancelled = false;
    function load() {
      if (!activeUnit || activeUnit === 'all') { setUnitIndicators([]); return; }
      getActiveUnitIndicatorsForUnit(activeUnit).then((rows) => { if (!cancelled) setUnitIndicators(rows); }).catch(() => {});
    }
    load();
    const unsub = subscribeToCustomIndicators(load);
    return () => { cancelled = true; unsub(); };
  }, [activeUnit]);

  /* Indikator Prioritas RS (custom, aktif, berlaku untuk activeUnit) — untuk
     section "Indikator Mutu Prioritas" (PIC data entry), padanan section
     "Indikator Mutu Unit" di atas tapi untuk indicatorType = 'priority_rs'. */
  const [priorityIndicators, setPriorityIndicators] = useState<CustomIndicator[]>([]);
  useEffect(() => {
    let cancelled = false;
    function load() {
      if (!activeUnit || activeUnit === 'all') { setPriorityIndicators([]); return; }
      getActivePriorityIndicatorsForUnit(activeUnit).then((rows) => { if (!cancelled) setPriorityIndicators(rows); }).catch(() => {});
    }
    load();
    const unsub = subscribeToCustomIndicators(load);
    return () => { cancelled = true; unsub(); };
  }, [activeUnit]);

  /* Filtered indicators for this unit */
  const filteredIndicators = useMemo(() => {
    const base = INDICATORS.filter((ind) =>
      unitMeta.inds.includes(ind.id as IndicatorType)
    );
    if (!search.trim()) return base;
    const q = search.toLowerCase();
    return base.filter(
      (ind) =>
        ind.label.toLowerCase().includes(q) ||
        ind.id.toLowerCase().includes(q)
    );
  }, [unitMeta.inds, search]);

  /* Sections */
  const sections = useMemo(() => getSections(activeUnit), [activeUnit]);

  /* Completion stats */
  const { doneCount, totalExpected } = useMemo(() => {
    let done = 0;
    let total = 0;
    for (const ind of filteredIndicators) {
      const exp = expectedCounts[ind.id] ?? 0;
      const cnt = entryCounts[ind.id] ?? 0;
      total += exp;
      if (cnt >= exp && exp > 0) done += exp;
      else done += cnt;
    }
    return { doneCount: done, totalExpected: total };
  }, [filteredIndicators, entryCounts, expectedCounts]);

  const completionPct = totalExpected > 0 ? Math.round((doneCount / totalExpected) * 100) : 0;

  /* Count indicators meeting target */
  const metTargetCount = useMemo(() => {
    let count = 0;
    for (const ind of filteredIndicators) {
      const cnt = entryCounts[ind.id] ?? 0;
      const exp = expectedCounts[ind.id] ?? 0;
      if (exp > 0 && cnt >= exp) count++;
    }
    return count;
  }, [filteredIndicators, entryCounts, expectedCounts]);

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  /* Wrapper for tab change that also calls onNavClick */
  const handleTabChange = (tab: string) => {
    onTabChange(tab);
    onNavClick?.();
  };

  return (
    <motion.aside
      animate={{ width: miniMode ? 56 : 240 }}
      transition={{ duration: 0.25, ease: 'easeInOut' }}
      className="flex h-full flex-col border-r border-border overflow-hidden shrink-0 bg-card"
    >
      {/* ── Unit header ───────────────────────────────────────── */}
      <div className={miniMode ? 'flex flex-col items-center gap-1 py-3 px-1' : 'flex items-center gap-3 px-4 py-4'}>
        <Avatar className={miniMode ? 'size-8' : 'size-9'}>
          <AvatarFallback
            className="text-xs font-bold"
            style={{
              backgroundColor: `${unitMeta.color}25`,
              color: unitMeta.color,
            }}
          >
            {unitMeta.abbr}
          </AvatarFallback>
        </Avatar>
        {!miniMode && (
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground/90 truncate">
              {unitMeta.label}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {filteredIndicators.length} indikator
            </p>
          </div>
        )}
        {!miniMode && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground hover:text-foreground/80 hover:bg-muted"
                onClick={onUnitChange}
              >
                <ArrowLeftRight className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Ganti Unit</TooltipContent>
          </Tooltip>
        )}
      </div>

      <Separator className="bg-border" />

      {/* ── Search (hidden in mini mode) ──────────────────────── */}
      {!miniMode && (
        <div className="px-3 py-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/60" />
            <Input
              placeholder="Cari indikator…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 bg-muted/50 border-border text-foreground/80 placeholder:text-muted-foreground/60 text-xs pl-8 focus-visible:ring-[#4f8ef7]/30"
            />
          </div>
        </div>
      )}

      {/* ── Progress bar (hidden in mini mode) ────────────────── */}
      {!miniMode && (
        <div className="px-4 pb-2">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] text-muted-foreground">Input selesai</span>
            <span className="text-[11px] font-semibold text-foreground/60">
              {completionPct}%
            </span>
          </div>
          <Progress
            value={completionPct}
            className="h-1.5 bg-muted [&>[data-slot=progress-indicator]]:bg-emerald-400"
          />
        </div>
      )}

      <Separator className="bg-border" />

      {/* ── Scrollable nav area: everything below scrolls as one
           independent region, so the whole menu (down to the last
           item) is always reachable no matter how many groups exist. ── */}
      <ScrollArea className="flex-1 min-h-0">
      <div className="flex flex-col pb-2">

      {/* ── Dashboard Overview nav item ───────────────────────── */}
      <div className={miniMode ? 'px-1 py-1' : 'px-2 py-1'}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => handleTabChange('overview')}
              className={`
                group relative flex w-full items-center gap-2.5 rounded-lg px-2 py-2.5 text-left transition-all duration-200
                ${
                  activeTab === 'overview'
                    ? 'bg-[#4f8ef7]/10 text-[#4f8ef7]'
                    : 'text-foreground/60 hover:bg-muted/50 hover:text-foreground/80'
                }
                ${miniMode ? 'justify-center' : ''}
              `}
            >
              {/* Active left accent bar */}
              {activeTab === 'overview' && (
                <motion.div
                  layoutId="sidebar-active-bar"
                  className="absolute left-0 top-1 bottom-1 w-[3px] rounded-full bg-[#4f8ef7]"
                  transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                />
              )}
              {/* Active background gradient from left */}
              {activeTab === 'overview' && (
                <span
                  className="absolute inset-0 rounded-lg pointer-events-none"
                  style={{ background: 'linear-gradient(90deg, #4f8ef7 0D 0%, transparent 40%)' }}
                />
              )}
              {/* Glow effect on hover */}
              <span className="absolute inset-0 rounded-lg opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-hover:shadow-[0_0_12px_rgba(79,142,247,0.1)]" />
              <span
                className={`
                  relative flex size-7 shrink-0 items-center justify-center rounded-md transition-colors
                  ${activeTab === 'overview' ? 'bg-[#4f8ef7]/20' : 'bg-muted/50'}
                `}
              >
                <LayoutDashboard
                  className={`size-3.5 ${activeTab !== 'overview' ? 'text-muted-foreground' : ''}`}
                  style={{
                    color: activeTab === 'overview' ? '#4f8ef7' : undefined,
                  }}
                />
              </span>
              {!miniMode && (
                <div className="relative flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate">Dashboard Overview</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[10px] text-muted-foreground/60">
                      {metTargetCount}/{filteredIndicators.length} target
                    </span>
                  </div>
                </div>
              )}
              {!miniMode && activeTab !== 'overview' && (
                <ChevronRight className="relative size-3 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
              )}
            </button>
          </TooltipTrigger>
          {miniMode && <TooltipContent side="right">Dashboard Overview</TooltipContent>}
        </Tooltip>
      </div>

      {/* ── Indikator Mutu group (collapsible) ────────────────── */}
      <Collapsible open={miniMode ? true : openGroups.mutu} onOpenChange={() => !miniMode && toggleGroup('mutu')}>
        {!miniMode && (
          <div className="px-2 pt-1">
            <CollapsibleTrigger asChild>
              <button className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left hover:bg-muted/20 rounded-md transition-colors group/section">
                <ChevronRight
                  className={`size-3 text-muted-foreground/50 transition-transform duration-200 ${
                    openGroups.mutu ? 'rotate-90' : ''
                  }`}
                />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 flex-1">
                  Indikator Mutu
                </span>
                <span className="text-[9px] text-muted-foreground/40 font-medium">
                  {filteredIndicators.length}
                </span>
              </button>
            </CollapsibleTrigger>
          </div>
        )}
      <CollapsibleContent>
        <div className={miniMode ? 'px-1 py-1' : 'px-2 py-1'}>
          {miniMode ? (
            /* Mini mode: flat list of icon buttons */
            <div className="flex flex-col gap-0.5">
              {filteredIndicators.map((ind) => {
                const Icon = ICON_MAP[ind.icon] ?? FileText;
                const isActive = activeTab === ind.id;
                const count = entryCounts[ind.id] ?? 0;
                const expected = expectedCounts[ind.id] ?? 0;
                const status = getStatus(count, expected);
                const compliance = complianceData[ind.id];

                return (
                  <Tooltip key={ind.id}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => handleTabChange(ind.id)}
                        className={`
                          group relative flex items-center justify-center rounded-lg p-2 transition-all duration-200
                          ${
                            isActive
                              ? 'bg-muted text-foreground'
                              : 'text-foreground/60 hover:bg-muted/50 hover:text-foreground/80'
                          }
                        `}
                      >
                        <span className="relative">
                          <Icon
                            className={`size-4 ${!isActive ? 'text-muted-foreground' : ''}`}
                            style={{
                              color: isActive ? ind.color : undefined,
                            }}
                          />
                          {/* Status dot as absolute indicator */}
                          <span
                            className={`absolute -top-0.5 -right-0.5 size-1.5 rounded-full ${
                              status === 'done' ? 'bg-emerald-400' : status === 'part' ? 'bg-amber-400' : 'bg-muted-foreground/30'
                            }`}
                          />
                          {/* Compliance color dot */}
                          {compliance && (
                            <span
                              className={`absolute -bottom-0.5 -right-0.5 size-1.5 rounded-full ${
                                compliance.ok ? 'bg-emerald-400' : 'bg-red-400'
                              }`}
                            />
                          )}
                        </span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      {ind.label} ({count}/{expected || '—'}) {compliance ? `• ${Math.round(compliance.pct)}%` : ''}
                    </TooltipContent>
                  </Tooltip>
                );
              })}

              {filteredIndicators.length === 0 && (
                <div className="py-6 text-center">
                  <p className="text-[10px] text-muted-foreground/60">—</p>
                </div>
              )}
            </div>
          ) : (
            /* Full mode: collapsible sections */
            sections.map((section) => {
              const sectionInds = filteredIndicators.filter((ind) =>
                section.indicatorIds.includes(ind.id as IndicatorType)
              );
              if (sectionInds.length === 0 && search.trim()) return null;

              return (
                <Collapsible
                  key={section.key}
                  open={openSections[section.key]}
                  onOpenChange={() => toggleSection(section.key)}
                >
                  <CollapsibleTrigger asChild>
                    <button className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left hover:bg-muted/20 rounded-md transition-colors group/section">
                      <ChevronRight
                        className={`size-3 text-muted-foreground/50 transition-transform duration-200 ${
                          openSections[section.key] ? 'rotate-90' : ''
                        }`}
                      />
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 flex-1">
                        {section.label}
                      </span>
                      <span className="text-[9px] text-muted-foreground/40 font-medium">
                        {sectionInds.length}
                      </span>
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <nav className="flex flex-col gap-0.5 pb-1">
                      {sectionInds.map((ind) => {
                        const Icon = ICON_MAP[ind.icon] ?? FileText;
                        const isActive = activeTab === ind.id;
                        const count = entryCounts[ind.id] ?? 0;
                        const expected = expectedCounts[ind.id] ?? 0;
                        const status = getStatus(count, expected);
                        const compliance = complianceData[ind.id];

                        return (
                          <button
                            key={ind.id}
                            onClick={() => handleTabChange(ind.id)}
                            className={cn(
                              'group relative flex items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-all duration-200',
                              isActive
                                ? 'text-foreground'
                                : 'text-foreground/60 sidebar-inactive-hover hover:text-foreground/80'
                            )}
                            style={isActive ? { '--sidebar-accent-color': ind.color } as React.CSSProperties : undefined}
                          >
                            {/* Active left accent bar (3px) with gradient */}
                            {isActive && (
                              <motion.div
                                layoutId="sidebar-indicator-active"
                                className="absolute left-0 top-1 bottom-1 w-[3px] rounded-full"
                                style={{ background: `linear-gradient(180deg, ${ind.color}, ${ind.color}88)` }}
                                transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                              />
                            )}
                            {/* Active background gradient from left */}
                            {isActive && (
                              <span
                                className="absolute inset-0 rounded-lg pointer-events-none"
                                style={{
                                  background: `linear-gradient(90deg, ${ind.color}0D 0%, transparent 40%)`,
                                }}
                              />
                            )}
                            {/* Subtle glow on hover with left border accent animation */}
                            <span
                              className="absolute inset-0 rounded-lg opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                              style={{
                                boxShadow: isActive ? `0 0 16px ${ind.color}10` : `0 0 8px ${ind.color}08`,
                              }}
                            />
                            {/* Hover left border accent (animated) */}
                            {!isActive && (
                              <span
                                className="absolute left-0 top-2 bottom-2 w-[2px] rounded-full bg-foreground/0 group-hover:bg-foreground/20 transition-all duration-300"
                              />
                            )}
                            <span
                              className={`relative flex size-7 shrink-0 items-center justify-center rounded-md transition-colors ${!isActive ? 'bg-muted/50' : ''}`}
                              style={{
                                backgroundColor: isActive
                                  ? `${ind.color}20`
                                  : undefined,
                              }}
                            >
                              <Icon
                                className={`size-3.5 ${!isActive ? 'text-muted-foreground' : ''}`}
                                style={{
                                  color: isActive ? ind.color : undefined,
                                }}
                              />
                            </span>
                            <div className="relative flex-1 min-w-0">
                              <p className="text-xs font-medium truncate leading-tight">
                                {ind.label}
                              </p>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <StatusDot status={status} />
                                <span className="text-[10px] text-muted-foreground/60">
                                  {count}{expected > 0 ? `/${expected}` : ''} entri
                                </span>
                                {/* Compliance badge with animated entry */}
                                {compliance && (
                                  <motion.span
                                    initial={{ scale: 0.8, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                                  >
                                    <ComplianceBadge pct={compliance.pct} ok={compliance.ok} />
                                  </motion.span>
                                )}
                                {/* Target percentage - only show if no compliance data */}
                                {!compliance && (
                                  <span className="text-[10px] font-medium ml-auto" style={{ color: ind.color + '80' }}>
                                    Target: {ind.targetLabel}
                                  </span>
                                )}
                              </div>
                            </div>
                            {/* Animated count badge */}
                            {count > 0 && (
                              <motion.span
                                key={count}
                                initial={{ scale: 0.5, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                                className="shrink-0 flex size-5 items-center justify-center rounded-full text-[9px] font-bold"
                                style={{
                                  backgroundColor: isActive ? `${ind.color}30` : 'hsl(var(--muted) / 0.5)',
                                  color: isActive ? ind.color : 'hsl(var(--muted-foreground) / 0.7)',
                                }}
                              >
                                {count}
                              </motion.span>
                            )}
                          </button>
                        );
                      })}

                      {sectionInds.length === 0 && (
                        <div className="px-2 py-4 text-center">
                          <p className="text-[10px] text-muted-foreground/50">
                            Tidak ditemukan
                          </p>
                        </div>
                      )}
                    </nav>
                  </CollapsibleContent>
                </Collapsible>
              );
            })
          )}

          {filteredIndicators.length === 0 && !miniMode && (
            <div className="px-2 py-6 text-center">
              <p className="text-xs text-muted-foreground/60">
                Tidak ada indikator ditemukan
              </p>
            </div>
          )}
        </div>
      </CollapsibleContent>
      </Collapsible>

      <Separator className="bg-border" />

      {unitIndicators.length > 0 && (
        <Collapsible open={miniMode ? true : openGroups.unitInd} onOpenChange={() => !miniMode && toggleGroup('unitInd')}>
          {/* ── Indikator Mutu Unit section (dinamis per unit, PIC data entry) ── */}
          <div className={miniMode ? 'px-1 py-1' : 'px-2 py-2'}>
            {!miniMode && (
              <div className="flex items-center">
                <CollapsibleTrigger asChild>
                  <button className="shrink-0 p-1 -ml-1 hover:bg-muted/20 rounded transition-colors">
                    <ChevronRight
                      className={`size-3 text-muted-foreground/50 transition-transform duration-200 ${
                        openGroups.unitInd ? 'rotate-90' : ''
                      }`}
                    />
                  </button>
                </CollapsibleTrigger>
                <button
                  onClick={() => handleTabChange('unit-ind-home')}
                  className="flex-1 text-left px-1 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 hover:text-cyan-500 transition-colors"
                >
                  Indikator Mutu Unit
                </button>
              </div>
            )}
            <CollapsibleContent>
            {unitIndicators.map((ind) => {
              const tabId = `unit-ind-${ind.id}`;
              const isActive = activeTab === tabId;
              return (
                <Tooltip key={ind.id}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => handleTabChange(tabId)}
                      className={cn(
                        'group relative flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-all duration-200',
                        isActive ? 'bg-cyan-500/10 text-cyan-500' : 'text-foreground/60 hover:bg-muted/30 hover:text-foreground/80',
                        miniMode ? 'justify-center' : ''
                      )}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="sidebar-unit-ind-active"
                          className="absolute left-0 top-1 bottom-1 w-0.5 rounded-full bg-cyan-500"
                          transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                        />
                      )}
                      <span className="relative flex size-7 shrink-0 items-center justify-center rounded-md bg-muted/50">
                        <ClipboardList className="size-3.5 text-muted-foreground" />
                      </span>
                      {!miniMode && (
                        <span className="text-xs font-medium relative truncate">{ind.name}</span>
                      )}
                    </button>
                  </TooltipTrigger>
                  {miniMode && <TooltipContent side="right">{ind.name}</TooltipContent>}
                </Tooltip>
              );
            })}
            </CollapsibleContent>
          </div>
        </Collapsible>
      )}

      {priorityIndicators.length > 0 && (
        <Collapsible open={miniMode ? true : openGroups.priorityInd} onOpenChange={() => !miniMode && toggleGroup('priorityInd')}>
          {/* ── Indikator Mutu Prioritas section (dinamis per unit, PIC data entry) ── */}
          <div className={miniMode ? 'px-1 py-1' : 'px-2 py-2'}>
            {!miniMode && (
              <div className="flex items-center">
                <CollapsibleTrigger asChild>
                  <button className="shrink-0 p-1 -ml-1 hover:bg-muted/20 rounded transition-colors">
                    <ChevronRight
                      className={`size-3 text-muted-foreground/50 transition-transform duration-200 ${
                        openGroups.priorityInd ? 'rotate-90' : ''
                      }`}
                    />
                  </button>
                </CollapsibleTrigger>
                <button
                  onClick={() => handleTabChange('priority-ind-home')}
                  className="flex-1 text-left px-1 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 hover:text-fuchsia-500 transition-colors"
                >
                  Indikator Mutu Prioritas
                </button>
              </div>
            )}
            <CollapsibleContent>
            {priorityIndicators.map((ind) => {
              const tabId = `priority-ind-${ind.id}`;
              const isActive = activeTab === tabId;
              return (
                <Tooltip key={ind.id}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => handleTabChange(tabId)}
                      className={cn(
                        'group relative flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-all duration-200',
                        isActive ? 'bg-fuchsia-500/10 text-fuchsia-500' : 'text-foreground/60 hover:bg-muted/30 hover:text-foreground/80',
                        miniMode ? 'justify-center' : ''
                      )}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="sidebar-priority-ind-active"
                          className="absolute left-0 top-1 bottom-1 w-0.5 rounded-full bg-fuchsia-500"
                          transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                        />
                      )}
                      <span className="relative flex size-7 shrink-0 items-center justify-center rounded-md bg-muted/50">
                        <Trophy className="size-3.5 text-muted-foreground" />
                      </span>
                      {!miniMode && (
                        <span className="text-xs font-medium relative truncate">{ind.name}</span>
                      )}
                    </button>
                  </TooltipTrigger>
                  {miniMode && <TooltipContent side="right">{ind.name}</TooltipContent>}
                </Tooltip>
              );
            })}
            </CollapsibleContent>
          </div>
        </Collapsible>
      )}

      <Separator className="bg-border" />


      {/* ── IKP / Keselamatan Pasien section ─────────────────── */}
      <Collapsible open={miniMode ? true : openGroups.ikp} onOpenChange={() => !miniMode && toggleGroup('ikp')}>
      <div className={miniMode ? 'px-1 py-1' : 'px-2 py-2'}>
        {!miniMode && (
          <CollapsibleTrigger asChild>
            <button className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left hover:bg-muted/20 rounded-md transition-colors group/section">
              <ChevronRight
                className={`size-3 text-muted-foreground/50 transition-transform duration-200 ${
                  openGroups.ikp ? 'rotate-90' : ''
                }`}
              />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 flex-1">
                IKP / Keselamatan Pasien
              </span>
              <span className="text-[9px] text-muted-foreground/40 font-medium">9</span>
            </button>
          </CollapsibleTrigger>
        )}
        <CollapsibleContent>
        {[
          { id: 'ikp-dashboard', icon: ShieldAlert, label: 'Dashboard IKP' },
          { id: 'ikp-form', icon: ClipboardList, label: 'Pelaporan Insiden' },
          { id: 'ikp-list', icon: ListChecks, label: 'Daftar Insiden' },
          { id: 'ikp-investigasi', icon: FileSearch, label: 'Investigasi' },
          { id: 'ikp-tindak-lanjut', icon: ListTodo, label: 'Tindak Lanjut' },
          { id: 'ikp-analisis', icon: Microscope, label: 'Analisis IKP' },
          { id: 'ikp-laporan', icon: FileBarChart, label: 'Laporan IKP' },
          { id: 'ikp-master', icon: Database, label: 'Master Data IKP' },
          { id: 'ikp-audit', icon: History, label: 'Audit Trail IKP' },
        ].map((item) => (
          <Tooltip key={item.id}>
            <TooltipTrigger asChild>
              <button
                onClick={() => handleTabChange(item.id)}
                className={`
                  group relative flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-all duration-200
                  ${
                    activeTab === item.id
                      ? 'bg-amber-500/10 text-amber-500'
                      : 'text-foreground/60 hover:bg-muted/30 hover:text-foreground/80'
                  }
                  ${miniMode ? 'justify-center' : ''}
                `}
              >
                {activeTab === item.id && (
                  <motion.div
                    layoutId="sidebar-ikp-active"
                    className="absolute left-0 top-1 bottom-1 w-0.5 rounded-full bg-amber-500"
                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                  />
                )}
                <span className="relative flex size-7 shrink-0 items-center justify-center rounded-md bg-muted/50">
                  <item.icon className="size-3.5 text-muted-foreground" />
                </span>
                {!miniMode && (
                  <span className="text-xs font-medium relative">{item.label}</span>
                )}
              </button>
            </TooltipTrigger>
            {miniMode && <TooltipContent side="right">{item.label}</TooltipContent>}
          </Tooltip>
        ))}
        </CollapsibleContent>
      </div>
      </Collapsible>

      <Separator className="bg-border" />

      {/* ── Manajemen Risiko section ──────────────────────────── */}
      <Collapsible open={miniMode ? true : openGroups.risk} onOpenChange={() => !miniMode && toggleGroup('risk')}>
      <div className={miniMode ? 'px-1 py-1' : 'px-2 py-2'}>
        {!miniMode && (
          <CollapsibleTrigger asChild>
            <button className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left hover:bg-muted/20 rounded-md transition-colors group/section">
              <ChevronRight
                className={`size-3 text-muted-foreground/50 transition-transform duration-200 ${
                  openGroups.risk ? 'rotate-90' : ''
                }`}
              />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 flex-1">
                Manajemen Risiko
              </span>
              <span className="text-[9px] text-muted-foreground/40 font-medium">11</span>
            </button>
          </CollapsibleTrigger>
        )}
        <CollapsibleContent>
        {[
          { id: 'risk-dashboard', icon: ShieldAlert, label: 'Dashboard Risiko' },
          { id: 'risk-register', icon: ListChecks, label: 'Risk Register' },
          { id: 'risk-form', icon: ClipboardList, label: 'Identifikasi Risiko' },
          { id: 'risk-matrix', icon: Grid3x3, label: 'Risk Matrix' },
          { id: 'risk-mitigasi', icon: Wrench, label: 'Pengelolaan Risiko' },
          { id: 'risk-monitoring', icon: Activity, label: 'Monitoring Risiko' },
          { id: 'risk-review', icon: ClipboardCheck, label: 'Review Risiko' },
          { id: 'risk-trend', icon: TrendingUp, label: 'Analisis Trend' },
          { id: 'risk-laporan', icon: FileBarChart, label: 'Laporan Risiko' },
          { id: 'risk-master', icon: Database, label: 'Master Data Risiko' },
          { id: 'risk-audit', icon: History, label: 'Audit Trail Risiko' },
        ].map((item) => (
          <Tooltip key={item.id}>
            <TooltipTrigger asChild>
              <button
                onClick={() => handleTabChange(item.id)}
                className={`
                  group relative flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-all duration-200
                  ${
                    activeTab === item.id
                      ? 'bg-rose-500/10 text-rose-500'
                      : 'text-foreground/60 hover:bg-muted/30 hover:text-foreground/80'
                  }
                  ${miniMode ? 'justify-center' : ''}
                `}
              >
                {activeTab === item.id && (
                  <motion.div
                    layoutId="sidebar-risk-active"
                    className="absolute left-0 top-1 bottom-1 w-0.5 rounded-full bg-rose-500"
                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                  />
                )}
                <span className="relative flex size-7 shrink-0 items-center justify-center rounded-md bg-muted/50">
                  <item.icon className="size-3.5 text-muted-foreground" />
                </span>
                {!miniMode && (
                  <span className="text-xs font-medium relative">{item.label}</span>
                )}
              </button>
            </TooltipTrigger>
            {miniMode && <TooltipContent side="right">{item.label}</TooltipContent>}
          </Tooltip>
        ))}
        </CollapsibleContent>
      </div>
      </Collapsible>

      <Separator className="bg-border" />

      {/* ── Survey Budaya Keselamatan Pasien section ─────────────── */}
      <Collapsible open={miniMode ? true : openGroups.survey} onOpenChange={() => !miniMode && toggleGroup('survey')}>
      <div className={miniMode ? 'px-1 py-1' : 'px-2 py-2'}>
        {!miniMode && (
          <CollapsibleTrigger asChild>
            <button className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left hover:bg-muted/20 rounded-md transition-colors group/section">
              <ChevronRight
                className={`size-3 text-muted-foreground/50 transition-transform duration-200 ${
                  openGroups.survey ? 'rotate-90' : ''
                }`}
              />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 flex-1">
                Survey Budaya Keselamatan
              </span>
              <span className="text-[9px] text-muted-foreground/40 font-medium">14</span>
            </button>
          </CollapsibleTrigger>
        )}
        <CollapsibleContent>
        {[
          { id: 'budaya-dashboard', icon: ShieldCheck, label: 'Dashboard' },
          { id: 'budaya-aktif', icon: ListTodo, label: 'Survey Aktif' },
          { id: 'budaya-buat', icon: ClipboardList, label: 'Buat Survey' },
          { id: 'budaya-kuesioner', icon: FileSearch, label: 'Kuesioner' },
          { id: 'budaya-responden', icon: Users, label: 'Responden' },
          { id: 'budaya-hasil', icon: BarChart3, label: 'Hasil Survey' },
          { id: 'budaya-analisis-dimensi', icon: Grid3x3, label: 'Analisis Dimensi' },
          { id: 'budaya-analisis-unit', icon: Building2, label: 'Analisis Unit' },
          { id: 'budaya-risk-area', icon: TriangleAlert, label: 'Risk/Improvement Area' },
          { id: 'budaya-tindak-lanjut', icon: ListChecks, label: 'Rencana Tindak Lanjut' },
          { id: 'budaya-monitoring', icon: Activity, label: 'Monitoring Tindak Lanjut' },
          { id: 'budaya-laporan', icon: FileBarChart, label: 'Laporan' },
          { id: 'budaya-riwayat', icon: History, label: 'Riwayat Survey' },
          { id: 'budaya-master', icon: Database, label: 'Master Data' },
        ].map((item) => (
          <Tooltip key={item.id}>
            <TooltipTrigger asChild>
              <button
                onClick={() => handleTabChange(item.id)}
                className={`
                  group relative flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-all duration-200
                  ${
                    activeTab === item.id
                      ? 'bg-emerald-500/10 text-emerald-500'
                      : 'text-foreground/60 hover:bg-muted/30 hover:text-foreground/80'
                  }
                  ${miniMode ? 'justify-center' : ''}
                `}
              >
                {activeTab === item.id && (
                  <motion.div
                    layoutId="sidebar-budaya-active"
                    className="absolute left-0 top-1 bottom-1 w-0.5 rounded-full bg-emerald-500"
                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                  />
                )}
                <span className="relative flex size-7 shrink-0 items-center justify-center rounded-md bg-muted/50">
                  <item.icon className="size-3.5 text-muted-foreground" />
                </span>
                {!miniMode && (
                  <span className="text-xs font-medium relative">{item.label}</span>
                )}
              </button>
            </TooltipTrigger>
            {miniMode && <TooltipContent side="right">{item.label}</TooltipContent>}
          </Tooltip>
        ))}
        </CollapsibleContent>
      </div>
      </Collapsible>

      <Separator className="bg-border" />

      {/* ── Survey Kepuasan Pasien section ─────────────────────── */}
      <Collapsible open={miniMode ? true : openGroups.kepuasanSurvey} onOpenChange={() => !miniMode && toggleGroup('kepuasanSurvey')}>
      <div className={miniMode ? 'px-1 py-1' : 'px-2 py-2'}>
        {!miniMode && (
          <CollapsibleTrigger asChild>
            <button className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left hover:bg-muted/20 rounded-md transition-colors group/section">
              <ChevronRight
                className={`size-3 text-muted-foreground/50 transition-transform duration-200 ${
                  openGroups.kepuasanSurvey ? 'rotate-90' : ''
                }`}
              />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 flex-1">
                Survey Kepuasan Pasien
              </span>
              <span className="text-[9px] text-muted-foreground/40 font-medium">8</span>
            </button>
          </CollapsibleTrigger>
        )}
        <CollapsibleContent>
        {[
          { id: 'kepuasan-dashboard', icon: Gauge, label: 'Dashboard' },
          { id: 'kepuasan-aktif', icon: ListTodo, label: 'Survey Aktif' },
          { id: 'kepuasan-buat', icon: ClipboardList, label: 'Buat Survey' },
          { id: 'kepuasan-distribusi', icon: QrCode, label: 'Distribusi (Link/QR)' },
          { id: 'kepuasan-responses', icon: FileSearch, label: 'Responses' },
          { id: 'kepuasan-kritik-saran', icon: MessageSquare, label: 'Kritik & Saran' },
          { id: 'kepuasan-monev', icon: TrendingUp, label: 'Monev' },
          { id: 'kepuasan-riwayat', icon: History, label: 'Riwayat Survey' },
        ].map((item) => (
          <Tooltip key={item.id}>
            <TooltipTrigger asChild>
              <button
                onClick={() => handleTabChange(item.id)}
                className={`
                  group relative flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-all duration-200
                  ${
                    activeTab === item.id
                      ? 'bg-pink-500/10 text-pink-500'
                      : 'text-foreground/60 hover:bg-muted/30 hover:text-foreground/80'
                  }
                  ${miniMode ? 'justify-center' : ''}
                `}
              >
                {activeTab === item.id && (
                  <motion.div
                    layoutId="sidebar-kepuasan-active"
                    className="absolute left-0 top-1 bottom-1 w-0.5 rounded-full bg-pink-500"
                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                  />
                )}
                <span className="relative flex size-7 shrink-0 items-center justify-center rounded-md bg-muted/50">
                  <item.icon className="size-3.5 text-muted-foreground" />
                </span>
                {!miniMode && (
                  <span className="text-xs font-medium relative">{item.label}</span>
                )}
              </button>
            </TooltipTrigger>
            {miniMode && <TooltipContent side="right">{item.label}</TooltipContent>}
          </Tooltip>
        ))}
        </CollapsibleContent>
      </div>
      </Collapsible>

      <Separator className="bg-border" />

      {/* ── Usulan Indikator Mutu Unit section ────────────────── */}
      <Collapsible open={miniMode ? true : openGroups.uimu} onOpenChange={() => !miniMode && toggleGroup('uimu')}>
      <div className={miniMode ? 'px-1 py-1' : 'px-2 py-2'}>
        {!miniMode && (
          <CollapsibleTrigger asChild>
            <button className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left hover:bg-muted/20 rounded-md transition-colors group/section">
              <ChevronRight
                className={`size-3 text-muted-foreground/50 transition-transform duration-200 ${
                  openGroups.uimu ? 'rotate-90' : ''
                }`}
              />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 flex-1">
                Usulan Indikator Mutu Unit
              </span>
              <span className="text-[9px] text-muted-foreground/40 font-medium">9</span>
            </button>
          </CollapsibleTrigger>
        )}
        <CollapsibleContent>
        {[
          { id: 'uimu-dashboard', icon: LayoutDashboard, label: 'Dashboard' },
          { id: 'uimu-form', icon: ClipboardList, label: 'Buat Usulan' },
          { id: 'uimu-list', icon: ListChecks, label: 'Daftar Usulan' },
          { id: 'uimu-review', icon: ClipboardCheck, label: 'Review Unit' },
          { id: 'uimu-telaah', icon: FileSearch, label: 'Telaah Komite Mutu' },
          { id: 'uimu-approval', icon: ShieldCheck, label: 'Persetujuan' },
          { id: 'uimu-master', icon: Database, label: 'Master Indikator' },
          { id: 'uimu-laporan', icon: FileBarChart, label: 'Laporan' },
          { id: 'uimu-audit', icon: History, label: 'Audit Trail' },
        ].map((item) => (
          <Tooltip key={item.id}>
            <TooltipTrigger asChild>
              <button
                onClick={() => handleTabChange(item.id)}
                className={`
                  group relative flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-all duration-200
                  ${
                    activeTab === item.id
                      ? 'bg-violet-500/10 text-violet-500'
                      : 'text-foreground/60 hover:bg-muted/30 hover:text-foreground/80'
                  }
                  ${miniMode ? 'justify-center' : ''}
                `}
              >
                {activeTab === item.id && (
                  <motion.div
                    layoutId="sidebar-uimu-active"
                    className="absolute left-0 top-1 bottom-1 w-0.5 rounded-full bg-violet-500"
                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                  />
                )}
                <span className="relative flex size-7 shrink-0 items-center justify-center rounded-md bg-muted/50">
                  <item.icon className="size-3.5 text-muted-foreground" />
                </span>
                {!miniMode && (
                  <span className="text-xs font-medium relative">{item.label}</span>
                )}
              </button>
            </TooltipTrigger>
            {miniMode && <TooltipContent side="right">{item.label}</TooltipContent>}
          </Tooltip>
        ))}
        </CollapsibleContent>
      </div>
      </Collapsible>

      <Separator className="bg-border" />

      {/* ── Master Indikator Mutu Custom section ──────────────── */}
      <Collapsible open={miniMode ? true : openGroups.customInd} onOpenChange={() => !miniMode && toggleGroup('customInd')}>
      <div className={miniMode ? 'px-1 py-1' : 'px-2 py-2'}>
        {!miniMode && (
          <CollapsibleTrigger asChild>
            <button className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left hover:bg-muted/20 rounded-md transition-colors group/section">
              <ChevronRight
                className={`size-3 text-muted-foreground/50 transition-transform duration-200 ${
                  openGroups.customInd ? 'rotate-90' : ''
                }`}
              />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 flex-1">
                Master Indikator Mutu
              </span>
              <span className="text-[9px] text-muted-foreground/40 font-medium">8</span>
            </button>
          </CollapsibleTrigger>
        )}
        <CollapsibleContent>
        {[
          { id: 'custom-ind-dashboard', icon: LayoutDashboard, label: 'Dashboard' },
          { id: 'custom-ind-all', icon: ListChecks, label: 'Semua Indikator' },
          { id: 'custom-ind-active', icon: ShieldCheck, label: 'Indikator Aktif' },
          { id: 'custom-ind-inactive', icon: TriangleAlert, label: 'Indikator Nonaktif' },
          { id: 'custom-ind-unit', icon: Building2, label: 'Indikator Unit' },
          { id: 'custom-ind-priority', icon: Trophy, label: 'Prioritas RS' },
          { id: 'custom-ind-new', icon: ClipboardList, label: '+ Buat Indikator Baru' },
          { id: 'custom-ind-audit', icon: History, label: 'Audit Trail' },
        ].map((item) => (
          <Tooltip key={item.id}>
            <TooltipTrigger asChild>
              <button
                onClick={() => handleTabChange(item.id)}
                className={`
                  group relative flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-all duration-200
                  ${
                    activeTab === item.id
                      ? 'bg-teal-500/10 text-teal-500'
                      : 'text-foreground/60 hover:bg-muted/30 hover:text-foreground/80'
                  }
                  ${miniMode ? 'justify-center' : ''}
                `}
              >
                {activeTab === item.id && (
                  <motion.div
                    layoutId="sidebar-custom-ind-active"
                    className="absolute left-0 top-1 bottom-1 w-0.5 rounded-full bg-teal-500"
                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                  />
                )}
                <span className="relative flex size-7 shrink-0 items-center justify-center rounded-md bg-muted/50">
                  <item.icon className="size-3.5 text-muted-foreground" />
                </span>
                {!miniMode && (
                  <span className="text-xs font-medium relative">{item.label}</span>
                )}
              </button>
            </TooltipTrigger>
            {miniMode && <TooltipContent side="right">{item.label}</TooltipContent>}
          </Tooltip>
        ))}
        </CollapsibleContent>
      </div>
      </Collapsible>

      <Separator className="bg-border" />

      {/* ── Analytics section ─────────────────────────────────── */}
      <Collapsible open={miniMode ? true : openGroups.analytics} onOpenChange={() => !miniMode && toggleGroup('analytics')}>
      <div className={miniMode ? 'px-1 py-1' : 'px-2 py-2'}>
        {!miniMode && (
          <CollapsibleTrigger asChild>
            <button className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left hover:bg-muted/20 rounded-md transition-colors group/section">
              <ChevronRight
                className={`size-3 text-muted-foreground/50 transition-transform duration-200 ${
                  openGroups.analytics ? 'rotate-90' : ''
                }`}
              />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 flex-1">
                Analitik
              </span>
              <span className="text-[9px] text-muted-foreground/40 font-medium">8</span>
            </button>
          </CollapsibleTrigger>
        )}
        <CollapsibleContent>
        {[
          { id: 'tren', icon: TrendingUp, label: 'Tren Bulanan' },
          { id: 'kepatuhan', icon: BarChart3, label: 'Kepatuhan Unit' },
          { id: 'ringkasan', icon: FileBarChart, label: 'Ringkasan Laporan' },
          { id: 'export-templates', icon: FileSpreadsheet, label: 'Template Ekspor' },
          { id: 'ai-insights', icon: Sparkles, label: 'AI Insights' },
          { id: 'activity-heatmap', icon: Activity, label: 'Peta Aktivitas' },
          { id: 'data-quality', icon: ShieldCheck, label: 'Kualitas Data' },
          { id: 'compliance-timeline', icon: Clock, label: 'Timeline Kepatuhan' },
        ].map((item) => (
          <Tooltip key={item.id}>
            <TooltipTrigger asChild>
              <button
                onClick={() => handleTabChange(item.id)}
                className={`
                  group relative flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-all duration-200
                  ${
                    activeTab === item.id
                      ? 'bg-muted/80 text-foreground'
                      : 'text-foreground/60 hover:bg-muted/30 hover:text-foreground/80'
                  }
                  ${miniMode ? 'justify-center' : ''}
                `}
              >
                {/* Active left accent bar for analytics */}
                {activeTab === item.id && (
                  <motion.div
                    layoutId="sidebar-analytics-active"
                    className="absolute left-0 top-1 bottom-1 w-0.5 rounded-full bg-foreground/40"
                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                  />
                )}
                <span className="relative flex size-7 shrink-0 items-center justify-center rounded-md bg-muted/50">
                  <item.icon className="size-3.5 text-muted-foreground" />
                </span>
                {!miniMode && (
                  <span className="text-xs font-medium relative">{item.label}</span>
                )}
              </button>
            </TooltipTrigger>
            {miniMode && <TooltipContent side="right">{item.label}</TooltipContent>}
          </Tooltip>
        ))}
        </CollapsibleContent>
      </div>
      </Collapsible>

      </div>
      </ScrollArea>

      <Separator className="bg-border" />

      {/* ── Mini mode toggle ──────────────────────────────────── */}
      <div className={miniMode ? 'flex justify-center py-2' : 'px-3 py-2'}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size={miniMode ? 'icon' : 'sm'}
              onClick={() => setMiniMode((prev) => !prev)}
              className={`
                text-muted-foreground/60 hover:text-foreground/60 hover:bg-muted/50
                ${miniMode ? 'size-8' : 'w-full h-7 gap-2 text-[10px]'}
              `}
            >
              {miniMode ? (
                <PanelLeftOpen className="size-3.5" />
              ) : (
                <>
                  <PanelLeftClose className="size-3.5" />
                  <span>Minimalkan</span>
                </>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            {miniMode ? 'Perbesar sidebar' : 'Perkecil sidebar'}
          </TooltipContent>
        </Tooltip>
      </div>
    </motion.aside>
  );
}
