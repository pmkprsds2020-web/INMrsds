'use client';

import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronLeft, ChevronRight, Loader2, RefreshCw, ShieldAlert, Inbox } from 'lucide-react';
import {
  OPPE_ITEM_STATUS_COLOR, OPPE_ITEM_STATUS_LABEL, OPPE_STATUS_COLOR, OPPE_STATUS_LABEL,
  OPPE_FPPE_STATUS_COLOR, OPPE_FPPE_STATUS_LABEL, OPPE_TREND_LABEL,
  type OppeItemStatus, type OppeEvaluationStatus, type OppeFppeStatus, type OppeTrend,
  type OppeKsm, type OppeIndicatorCategory, type OppeSettings, type OppeTemplate, type OppeUnitRef, type OppeMasterOption,
  type OppeResultCategory,
} from '@/types/oppe';
import {
  getOppeKsmList, getOppeCategories, getOppeSettings, getOppeTemplates, getOppeUnits, getOppeMasterOptions, friendlyOppeError,
} from '@/lib/oppeData';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export function OppeStatusBadge({ status }: { status: OppeEvaluationStatus }) {
  const c = OPPE_STATUS_COLOR[status];
  return <Badge variant="outline" style={{ borderColor: c, color: c }} className="text-[10px] whitespace-nowrap">{OPPE_STATUS_LABEL[status]}</Badge>;
}

export function OppeItemStatusBadge({ status }: { status: OppeItemStatus }) {
  const c = OPPE_ITEM_STATUS_COLOR[status];
  return (
    <Badge variant="outline" style={{ borderColor: c, color: c, backgroundColor: `${c}14` }} className="text-[10px] whitespace-nowrap gap-1">
      <span className="size-1.5 rounded-full" style={{ backgroundColor: c }} />
      {OPPE_ITEM_STATUS_LABEL[status]}
    </Badge>
  );
}

export function OppeFppeStatusBadge({ status }: { status: OppeFppeStatus }) {
  const c = OPPE_FPPE_STATUS_COLOR[status];
  return <Badge variant="outline" style={{ borderColor: c, color: c }} className="text-[10px] whitespace-nowrap">{OPPE_FPPE_STATUS_LABEL[status]}</Badge>;
}

export function OppeCategoryBadge({ code, label, categories }: { code: string | null; label: string | null; categories: OppeResultCategory[] }) {
  if (!code && !label) return <span className="text-xs text-muted-foreground">—</span>;
  const c = categories.find((x) => x.code === code)?.color ?? '#94a3b8';
  return <Badge variant="outline" style={{ borderColor: c, color: c, backgroundColor: `${c}14` }} className="text-[10px] whitespace-nowrap">{label ?? code}</Badge>;
}

export function OppeTrendBadge({ trend }: { trend: OppeTrend | null }) {
  if (!trend) return <span className="text-xs text-muted-foreground">—</span>;
  const Icon = trend === 'naik' ? TrendingUp : trend === 'turun' ? TrendingDown : Minus;
  const color = trend === 'naik' ? '#22c55e' : trend === 'turun' ? '#ef4444' : '#94a3b8';
  return <span className="inline-flex items-center gap-1 text-xs font-medium" style={{ color }}><Icon className="size-3.5" />{OPPE_TREND_LABEL[trend]}</span>;
}

export function OppeKpiCard({ icon: Icon, label, value, color, hint, onClick }: { icon: any; label: string; value: number | string; color: string; hint?: string; onClick?: () => void }) {
  return (
    <Card className={onClick ? 'cursor-pointer hover:border-foreground/20 transition-colors' : ''} onClick={onClick}>
      <CardContent className="pt-5 pb-4 flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `${color}20`, color }}>
          <Icon className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="text-2xl font-bold leading-none">{value}</p>
          <p className="text-xs text-muted-foreground mt-1 leading-tight">{label}</p>
          {hint && <p className="text-[10px] text-muted-foreground/70 mt-0.5">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export function OppeLoading() {
  return <div className="flex justify-center py-16"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;
}

export function OppeEmpty({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 gap-2">
      <Inbox className="size-8 text-muted-foreground/50" />
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="text-xs text-muted-foreground max-w-md">{description}</p>}
      {action}
    </div>
  );
}

export function OppeErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 gap-3">
      <ShieldAlert className="size-8 text-red-500/70" />
      <p className="text-sm max-w-md">{message}</p>
      {onRetry && <Button size="sm" variant="outline" onClick={onRetry} className="gap-1.5"><RefreshCw className="size-3.5" />Coba lagi</Button>}
    </div>
  );
}

export function OppeNoAccess({ message }: { message?: string }) {
  return (
    <div className="p-6">
      <Card>
        <CardContent className="py-10">
          <OppeErrorState message={message ?? 'Anda belum memiliki akses ke modul OPPE. Hubungi admin untuk diberikan peran Komite Medik, Evaluator, atau Dokter (profiles.oppe_roles).'} />
        </CardContent>
      </Card>
    </div>
  );
}

export function OppePagination({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="flex items-center justify-between gap-2 pt-3 text-xs text-muted-foreground">
      <span>{total === 0 ? '0 data' : `${page * pageSize + 1}–${Math.min(total, (page + 1) * pageSize)} dari ${total}`}</span>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon" className="size-7" disabled={page <= 0} onClick={() => onPage(page - 1)} aria-label="Sebelumnya"><ChevronLeft className="size-4" /></Button>
        <span className="px-2">{page + 1} / {pages}</span>
        <Button variant="outline" size="icon" className="size-7" disabled={page + 1 >= pages} onClick={() => onPage(page + 1)} aria-label="Berikutnya"><ChevronRight className="size-4" /></Button>
      </div>
    </div>
  );
}

export function OppePageHeader({ icon: Icon, title, description, actions }: { icon: any; title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-2 min-w-0">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-rose-500/10 text-rose-500"><Icon className="size-5" /></span>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold leading-tight">{title}</h2>
          {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Debounce untuk input pencarian (poin 49). */
export function useDebounced<V>(value: V, ms = 350): V {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export interface OppeMasters {
  ksm: OppeKsm[];
  categories: OppeIndicatorCategory[];
  settings: OppeSettings;
  templates: OppeTemplate[];
  units: OppeUnitRef[];
  options: OppeMasterOption[];
}

/** Muat master data sekali (cache di oppeData) untuk dipakai banyak panel. */
export function useOppeMasters() {
  const [data, setData] = useState<OppeMasters | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      const [ksm, categories, settings, templates, units, options] = await Promise.all([
        getOppeKsmList(true, force), getOppeCategories(force), getOppeSettings(force), getOppeTemplates(), getOppeUnits(), getOppeMasterOptions(undefined, force),
      ]);
      setData({ ksm, categories, settings, templates, units, options });
    } catch (e) {
      setError(friendlyOppeError(e, 'Master data OPPE gagal dimuat. Silakan coba kembali.'));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);
  return { masters: data, error, loading, reload: () => load(true) };
}

export const CURRENT_YEAR = new Date().getFullYear();
export const YEAR_OPTIONS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - 3 + i);

export function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return d;
  }
}

export function fmtDateTime(d: string | null | undefined): string {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return d;
  }
}

/** Sentinel untuk <Select> karena Radix tidak menerima value kosong. */
export const ALL = '__all__';
