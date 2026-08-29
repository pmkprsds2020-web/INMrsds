'use client';

import { useMemo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Bell,
  CheckCheck,
  ShieldAlert,
  LogIn,
  PenLine,
  ArrowRightLeft,
  Circle,
} from 'lucide-react';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale/id';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

import type { AuditLogEntry } from '@/types';

/* ── Props ────────────────────────────────────────────────────── */
export interface NotificationPanelProps {
  open: boolean;
  onClose: () => void;
  logs: AuditLogEntry[];
  activeUnit: string;
}

/* ── Type configuration with color-coded icons ────────────────── */
const TYPE_CONFIG: Record<
  string,
  {
    icon: React.ReactNode;
    bg: string;
    text: string;
    label: string;
    ring: string;
  }
> = {
  block: {
    icon: <ShieldAlert className="size-3.5" />,
    bg: 'bg-red-500/20',
    text: 'text-red-400',
    label: 'Blokir',
    ring: 'ring-red-500/30',
  },
  login: {
    icon: <LogIn className="size-3.5" />,
    bg: 'bg-sky-500/20',
    text: 'text-sky-400',
    label: 'Login',
    ring: 'ring-sky-500/30',
  },
  input: {
    icon: <PenLine className="size-3.5" />,
    bg: 'bg-emerald-500/20',
    text: 'text-emerald-400',
    label: 'Input',
    ring: 'ring-emerald-500/30',
  },
  mapping: {
    icon: <ArrowRightLeft className="size-3.5" />,
    bg: 'bg-amber-500/20',
    text: 'text-amber-400',
    label: 'Mapping',
    ring: 'ring-amber-500/30',
  },
  ikp: {
    icon: <ShieldAlert className="size-3.5" />,
    bg: 'bg-orange-500/20',
    text: 'text-orange-400',
    label: 'IKP',
    ring: 'ring-orange-500/30',
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
export function NotificationPanel({
  open,
  onClose,
  logs,
  activeUnit,
}: NotificationPanelProps) {
  const [filter, setFilter] = useState<FilterType>('all');
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  // Filter logs by active unit
  const unitLogs = useMemo(() => {
    if (activeUnit === 'all') return logs;
    return logs.filter(
      (l) => !l.unitId || l.unitId === activeUnit || l.unitId === 'all'
    );
  }, [logs, activeUnit]);

  // Apply type filter
  const filteredLogs = useMemo(() => {
    if (filter === 'all') return unitLogs;
    return unitLogs.filter((l) => l.type === filter);
  }, [unitLogs, filter]);

  // Unread count
  const unreadCount = useMemo(() => {
    return filteredLogs.filter((l) => !readIds.has(l.id)).length;
  }, [filteredLogs, readIds]);

  // Mark all as read
  const handleMarkAllRead = useCallback(() => {
    setReadIds(new Set(filteredLogs.map((l) => l.id)));
  }, [filteredLogs]);

  // Mark single as read
  const handleMarkRead = useCallback((id: string) => {
    setReadIds((prev) => new Set([...prev, id]));
  }, []);

  // Group logs by date
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

  // Filter tabs count
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { all: unitLogs.length };
    for (const log of unitLogs) {
      counts[log.type] = (counts[log.type] || 0) + 1;
    }
    return counts;
  }, [unitLogs]);

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
            className="fixed right-0 top-0 z-50 h-full w-full sm:w-[400px] flex flex-col border-l border-border"
            
          >
            {/* ── Header ───────────────────────────────────────── */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="flex size-8 items-center justify-center rounded-lg bg-[#4f8ef7]/10">
                  <Bell className="size-4 text-[#4f8ef7]" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Notifikasi</h2>
                  <p className="text-[10px] text-muted-foreground">
                    {unreadCount > 0
                      ? `${unreadCount} belum dibaca`
                      : 'Semua telah dibaca'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted/50 gap-1"
                    onClick={handleMarkAllRead}
                  >
                    <CheckCheck className="size-3" />
                    Tandai Semua
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  onClick={onClose}
                >
                  <X className="size-4" />
                </Button>
              </div>
            </div>

            {/* ── Filter tabs ──────────────────────────────────── */}
            <div className="flex items-center gap-1 px-4 py-2.5 border-b border-border overflow-x-auto">
              {(
                [
                  { key: 'all', label: 'Semua' },
                  { key: 'login', label: 'Login' },
                  { key: 'input', label: 'Input' },
                  { key: 'block', label: 'Blokir' },
                  { key: 'mapping', label: 'Mapping' },
                  { key: 'ikp', label: 'IKP' },
                ] as { key: FilterType; label: string }[]
              ).map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setFilter(tab.key)}
                  className={`
                    flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[10px] font-medium transition-colors whitespace-nowrap
                    ${
                      filter === tab.key
                        ? 'bg-[#4f8ef7]/15 text-[#4f8ef7]'
                        : 'text-muted-foreground hover:text-muted-foreground hover:bg-muted/30'
                    }
                  `}
                >
                  {tab.label}
                  <span
                    className={`text-[9px] ${
                      filter === tab.key ? 'text-[#4f8ef7]/60' : 'text-muted-foreground/40'
                    }`}
                  >
                    {typeCounts[tab.key] || 0}
                  </span>
                </button>
              ))}
            </div>

            {/* ── Notification list ────────────────────────────── */}
            <ScrollArea className="flex-1">
              <div className="px-4 py-3">
                {filteredLogs.length === 0 && (
                  <div className="py-16 text-center">
                    <div className="flex size-12 items-center justify-center rounded-xl bg-muted/30 mx-auto mb-3">
                      <Circle className="size-5 text-muted-foreground/40" />
                    </div>
                    <p className="text-xs text-muted-foreground/60">
                      Tidak ada notifikasi
                    </p>
                  </div>
                )}

                {groupedLogs.map((group, groupIdx) => (
                  <div key={groupIdx} className={groupIdx > 0 ? 'mt-4' : ''}>
                    {/* Date header */}
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                        {group.dateHeader}
                      </span>
                      <div className="flex-1 h-px bg-muted/50" />
                    </div>

                    {/* Notification items */}
                    <div className="space-y-1">
                      {group.logs.map((log, logIdx) => {
                        const config = TYPE_CONFIG[log.type] ?? TYPE_CONFIG.input;
                        const isRead = readIds.has(log.id);

                        return (
                          <motion.div
                            key={log.id}
                            initial={{ opacity: 0, x: 8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{
                              duration: 0.2,
                              delay: logIdx * 0.02,
                            }}
                            onClick={() => handleMarkRead(log.id)}
                            className={`
                              relative flex items-start gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors
                              ${
                                isRead
                                  ? 'bg-muted/10 border-border'
                                  : 'bg-muted/30 border-border hover:bg-muted/30'
                              }
                            `}
                          >
                            {/* Unread indicator */}
                            {!isRead && (
                              <div className="absolute left-1.5 top-3 size-1.5 rounded-full bg-[#4f8ef7] shadow-[0_0_6px_rgba(79,142,247,0.5)]" />
                            )}

                            {/* Type icon */}
                            <div
                              className={`
                                flex size-7 shrink-0 items-center justify-center rounded-md
                                ${config.bg} ${config.text}
                              `}
                            >
                              {config.icon}
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <Badge
                                  className={`${config.bg} ${config.text} border-0 text-[9px] font-semibold px-1.5 py-0`}
                                >
                                  {config.label}
                                </Badge>
                                {log.badge && (
                                  <Badge className="bg-muted/30 text-muted-foreground border-border text-[9px] px-1.5 py-0">
                                    {log.badge}
                                  </Badge>
                                )}
                              </div>
                              <p
                                className={`text-[11px] leading-relaxed break-words ${
                                  isRead ? 'text-muted-foreground' : 'text-foreground/70'
                                }`}
                              >
                                {log.msg}
                              </p>
                              <p className="text-[9px] text-muted-foreground/50 mt-1">
                                {formatTs(log.ts)}
                              </p>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {/* ── Footer ───────────────────────────────────────── */}
            <div className="border-t border-border px-5 py-3">
              <Separator className="bg-muted/50 mb-3" />
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-muted-foreground/60">
                  {filteredLogs.length} notifikasi
                </p>
                {unreadCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleMarkAllRead}
                    className="h-7 text-[10px] text-[#4f8ef7] hover:text-[#4f8ef7] hover:bg-[#4f8ef7]/10 gap-1"
                  >
                    <CheckCheck className="size-3" />
                    Tandai Semua Dibaca
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
