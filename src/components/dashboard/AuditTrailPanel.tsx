'use client';

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Trash2,
  ShieldAlert,
  LogIn,
  PenLine,
  ArrowRightLeft,
  Filter,
  Circle,
  ClipboardList,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { id as idLocale } from 'date-fns/locale/id';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import type { AuditLogEntry } from '@/types';

/* ── Props ────────────────────────────────────────────────────── */
export interface AuditTrailPanelProps {
  open: boolean;
  onClose: () => void;
  logs: AuditLogEntry[];
  onClear: () => void;
}

/* ── Type configuration with color-coded icons ────────────────── */
const TYPE_CONFIG: Record<
  string,
  { icon: React.ReactNode; bg: string; text: string; label: string; ring: string; line: string }
> = {
  block: {
    icon: <ShieldAlert className="size-3.5" />,
    bg: 'bg-red-500/20',
    text: 'text-red-400',
    label: 'Blokir',
    ring: 'ring-red-500/30',
    line: 'bg-red-500/30',
  },
  login: {
    icon: <LogIn className="size-3.5" />,
    bg: 'bg-sky-500/20',
    text: 'text-sky-400',
    label: 'Login',
    ring: 'ring-sky-500/30',
    line: 'bg-sky-500/30',
  },
  input: {
    icon: <PenLine className="size-3.5" />,
    bg: 'bg-emerald-500/20',
    text: 'text-emerald-400',
    label: 'Input',
    ring: 'ring-emerald-500/30',
    line: 'bg-emerald-500/30',
  },
  mapping: {
    icon: <ArrowRightLeft className="size-3.5" />,
    bg: 'bg-amber-500/20',
    text: 'text-amber-400',
    label: 'Mapping',
    ring: 'ring-amber-500/30',
    line: 'bg-amber-500/30',
  },
  ikp: {
    icon: <ClipboardList className="size-3.5" />,
    bg: 'bg-orange-500/20',
    text: 'text-orange-400',
    label: 'IKP',
    ring: 'ring-orange-500/30',
    line: 'bg-orange-500/30',
  },
};

type FilterType = 'all' | 'block' | 'login' | 'input' | 'mapping' | 'ikp';

/* ── Format timestamp ─────────────────────────────────────────── */
function formatTs(ts: string): string {
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return ts;
    return format(d, 'dd MMM yyyy, HH:mm', { locale: idLocale });
  } catch {
    return ts;
  }
}

/* ── Relative time ────────────────────────────────────────────── */
function formatRelative(ts: string): string {
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return '';
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    // Only show relative time for events within the last 24 hours
    if (diffMs < 0 || diffMs > 24 * 60 * 60 * 1000) return '';
    return formatDistanceToNow(d, { addSuffix: true, locale: idLocale });
  } catch {
    return '';
  }
}

/* ── Check if two timestamps are on the same date ─────────────── */
function isSameDay(ts1: string, ts2: string): boolean {
  try {
    const d1 = new Date(ts1);
    const d2 = new Date(ts2);
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  } catch {
    return false;
  }
}

function formatDateHeader(ts: string): string {
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return ts;
    const now = new Date();
    if (isSameDay(ts, now.toISOString())) return 'Hari Ini';
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (isSameDay(ts, yesterday.toISOString())) return 'Kemarin';
    return format(d, 'EEEE, dd MMMM yyyy', { locale: idLocale });
  } catch {
    return ts;
  }
}

/* ── Component ────────────────────────────────────────────────── */
export function AuditTrailPanel({
  open,
  onClose,
  logs,
  onClear,
}: AuditTrailPanelProps) {
  const [filter, setFilter] = useState<FilterType>('all');

  const filteredLogs = useMemo(() => {
    if (filter === 'all') return logs;
    return logs.filter((l) => l.type === filter);
  }, [logs, filter]);

  /* Group logs by date for date headers */
  const groupedLogs = useMemo(() => {
    const groups: { dateHeader: string; logs: AuditLogEntry[] }[] = [];
    let currentDateHeader = '';

    for (const log of filteredLogs) {
      const header = formatDateHeader(log.ts);
      if (header !== currentDateHeader) {
        currentDateHeader = header;
        groups.push({ dateHeader: header, logs: [log] });
      } else {
        groups[groups.length - 1].logs.push(log);
      }
    }
    return groups;
  }, [filteredLogs]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 280, mass: 0.8 }}
            className="fixed right-0 top-0 z-50 h-full w-full sm:w-[420px] flex flex-col border-l border-border"
            
          >
            {/* ── Header ───────────────────────────────────────── */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="flex size-8 items-center justify-center rounded-lg bg-[#4f8ef7]/10">
                  <Filter className="size-4 text-[#4f8ef7]" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Audit Trail</h2>
                  <p className="text-[10px] text-muted-foreground">
                    {filteredLogs.length} entri log
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground hover:text-foreground hover:bg-muted/50"
                onClick={onClose}
              >
                <X className="size-4" />
              </Button>
            </div>

            {/* ── Filter ───────────────────────────────────────── */}
            <div className="flex items-center gap-2 px-5 py-3 border-b border-border">
              <Select
                value={filter}
                onValueChange={(v) => setFilter(v as FilterType)}
              >
                <SelectTrigger
                  className="h-8 text-xs bg-muted/30 border-border text-foreground/80 w-full"
                  size="sm"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent
                  style={{
                    backgroundColor: 'hsl(var(--popover))',
                    borderColor: 'rgba(255,255,255,0.1)',
                  }}
                >
                  <SelectItem value="all" className="text-foreground/80 text-xs focus:bg-muted/50 focus:text-foreground">
                    Semua
                  </SelectItem>
                  <SelectItem value="block" className="text-foreground/80 text-xs focus:bg-muted/50 focus:text-foreground">
                    Blokir
                  </SelectItem>
                  <SelectItem value="login" className="text-foreground/80 text-xs focus:bg-muted/50 focus:text-foreground">
                    Login
                  </SelectItem>
                  <SelectItem value="input" className="text-foreground/80 text-xs focus:bg-muted/50 focus:text-foreground">
                    Input
                  </SelectItem>
                  <SelectItem value="mapping" className="text-foreground/80 text-xs focus:bg-muted/50 focus:text-foreground">
                    Mapping
                  </SelectItem>
                  <SelectItem value="ikp" className="text-foreground/80 text-xs focus:bg-muted/50 focus:text-foreground">
                    IKP
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* ── Timeline log list ────────────────────────────── */}
            <ScrollArea className="flex-1">
              <div className="px-5 py-4">
                {filteredLogs.length === 0 && (
                  <div className="py-16 text-center">
                    <div className="flex size-12 items-center justify-center rounded-xl bg-muted/30 mx-auto mb-3">
                      <Circle className="size-5 text-muted-foreground/40" />
                    </div>
                    <p className="text-xs text-muted-foreground/60">
                      Tidak ada log untuk ditampilkan
                    </p>
                  </div>
                )}

                {groupedLogs.map((group, groupIdx) => (
                  <div key={groupIdx} className={groupIdx > 0 ? 'mt-4' : ''}>
                    {/* Date header */}
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex items-center justify-center size-6 rounded-md bg-muted/50">
                        <span className="text-[10px] font-bold text-muted-foreground">
                          {group.dateHeader === 'Hari Ini'
                            ? '📋'
                            : group.dateHeader === 'Kemarin'
                            ? '📅'
                            : '📆'}
                        </span>
                      </div>
                      <span className="text-[11px] font-semibold text-muted-foreground">
                        {group.dateHeader}
                      </span>
                      <div className="flex-1 h-px bg-muted/50" />
                    </div>

                    {/* Timeline items */}
                    <div className="relative ml-3">
                      {/* Vertical timeline line */}
                      <div className="absolute left-[11px] top-2 bottom-2 w-px bg-muted/50" />

                      <div className="space-y-1">
                        {group.logs.map((log, logIdx) => {
                          const config = TYPE_CONFIG[log.type] ?? TYPE_CONFIG.input;
                          const relativeTime = formatRelative(log.ts);
                          const isLast = logIdx === group.logs.length - 1;

                          return (
                            <motion.div
                              key={log.id}
                              initial={{ opacity: 0, x: 12 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{
                                duration: 0.25,
                                delay: logIdx * 0.03,
                                ease: 'easeOut',
                              }}
                              className="relative flex items-start gap-3 pl-4 py-2 group"
                            >
                              {/* Timeline dot with color-coded ring */}
                              <div
                                className={`
                                  absolute left-0 top-3 flex size-[22px] shrink-0 items-center justify-center
                                  rounded-full ${config.bg} ${config.text}
                                  ring-2 ${config.ring}
                                  ring-offset-1 z-10
                                `}
                                style={{ ringOffsetColor: 'hsl(var(--card))' }}
                              >
                                {config.icon}
                              </div>

                              {/* Connector line segment (colored) */}
                              {!isLast && (
                                <div
                                  className={`absolute left-[10px] top-[36px] w-px h-[calc(100%-28px)] ${config.line} opacity-30`}
                                />
                              )}

                              {/* Content card */}
                              <div className="flex-1 min-w-0 rounded-lg bg-muted/20 border border-border px-3 py-2.5 group-hover:bg-muted/30 transition-colors">
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge
                                    className={`${config.bg} ${config.text} border-0 text-[9px] font-semibold px-1.5`}
                                  >
                                    {config.label}
                                  </Badge>
                                  {log.badge && (
                                    <Badge className="bg-muted/30 text-muted-foreground border-border text-[9px]">
                                      {log.badge}
                                    </Badge>
                                  )}
                                  {relativeTime && (
                                    <span className="text-[9px] text-muted-foreground/50 ml-auto font-medium">
                                      {relativeTime}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-foreground/70 leading-relaxed break-words">
                                  {log.msg}
                                </p>
                                <p className="text-[10px] text-muted-foreground/50 mt-1.5">
                                  {formatTs(log.ts)}
                                </p>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {/* ── Footer ───────────────────────────────────────── */}
            <div className="border-t border-border px-5 py-3">
              <Button
                variant="outline"
                size="sm"
                onClick={onClear}
                disabled={logs.length === 0}
                className="w-full h-8 border-red-500/20 text-red-400 hover:bg-red-500/10 hover:text-red-300 hover:border-red-500/30 text-xs gap-1.5 disabled:opacity-30"
              >
                <Trash2 className="size-3" />
                Hapus Semua Log
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
