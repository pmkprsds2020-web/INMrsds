'use client';

import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  FileSpreadsheet,
  ShieldAlert,
  Trash2,
  CheckCircle2,
  XCircle,
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
  X,
  Search,
  TrendingUp,
  TrendingDown,
  Minus,
  Download,
  ArrowLeftRight,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Eye,
  type LucideIcon,
} from 'lucide-react';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip as ChartTooltip, Legend as ChartLegend } from 'chart.js';
import { toast } from 'sonner';
import { toastDataChange } from '@/lib/toast-helpers';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

import { StatCard } from '@/components/dashboard/StatCard';
import { DateFilterBar } from '@/components/dashboard/DateFilterBar';
import { ImportModal } from '@/components/dashboard/ImportModal';
import { EmptyState } from '@/components/dashboard/EmptyState';
import { DataEntryModal } from '@/components/dashboard/DataEntryModal';

import {
  type IndicatorType,
  type IndicatorEntry,
  type TanganEntry,
  type VisiteEntry,
  type IdentitasEntry,
  type ApdEntry,
  type JatuhEntry,
  type ScEntry,
  type WtrjEntry,
  type OpEntry,
  type LabEntry,
  type FornasEntry,
  type CpEntry,
  INDICATORS,
  IDENTITAS_SERVICE_OPTIONS,
} from '@/types';
import { calculateStats, timeDiffMinutes, isVisitePatuh, todayStr } from '@/lib/calculations';

/* ── Props ────────────────────────────────────────────────────── */
export interface IndicatorPanelProps {
  type: IndicatorType;
  entries: IndicatorEntry[];
  activeUnit: string;
  userId: string;
  isLoading: boolean;
  onAddEntry: (entry: Omit<IndicatorEntry, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onUpdateEntry: (id: string, data: Partial<IndicatorEntry>) => Promise<void>;
  onDeleteEntry: (id: string) => Promise<void>;
  onImport: (entries: Omit<IndicatorEntry, 'id' | 'createdAt' | 'updatedAt'>[]) => Promise<void>;
  dateFilter: { start: string; end: string };
  onDateFilterChange: (filter: { start: string; end: string }) => void;
  accessBlocked?: boolean;
  blockReason?: string;
  /** All entries for comparison (unfiltered) */
  allEntries?: IndicatorEntry[];
}

/* ── Selection props shared across tables ─────────────────────── */
interface SelectionProps {
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  allSelected: boolean;
  someSelected: boolean;
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

/* ── Register Chart.js components ─────────────────────────────── */
ChartJS.register(ArcElement, ChartTooltip, ChartLegend);

/* ── Compact Doughnut Chart ───────────────────────────────────── */
function ComplianceDoughnut({ patuh, tidakPatuh, pct }: { patuh: number; tidakPatuh: number; pct: number }) {
  const data = useMemo(() => {
    const hasData = patuh > 0 || tidakPatuh > 0;
    if (!hasData) {
      return {
        labels: ['Tidak Ada Data'],
        datasets: [{
          data: [1],
          backgroundColor: ['hsl(var(--muted-foreground) / 0.15)'],
          borderColor: ['hsl(var(--muted-foreground) / 0.3)'],
          borderWidth: 1,
          hoverBackgroundColor: ['hsl(var(--muted-foreground) / 0.2)'],
        }],
      };
    }
    return {
      labels: ['Patuh', 'Tidak Patuh'],
      datasets: [{
        data: [patuh, tidakPatuh],
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
  }, [patuh, tidakPatuh]);

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: true,
    cutout: '68%',
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: true,
        backgroundColor: 'rgba(0,0,0,0.8)',
        titleFont: { size: 10 },
        bodyFont: { size: 10 },
        padding: 6,
        cornerRadius: 6,
      },
    },
    animation: {
      animateRotate: true,
      animateScale: false,
    },
  }), []);

  return (
    <div className="shrink-0 relative flex items-center justify-center" style={{ width: 150, height: 150 }}>
      <Doughnut data={data} options={options} width={150} height={150} />
      {/* Center text overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className={`text-xl font-bold font-mono ${pct >= 100 ? 'text-emerald-400' : patuh > 0 ? 'text-foreground/80' : 'text-muted-foreground/40'}`}>
          {Math.round(pct)}%
        </span>
        <span className="text-[9px] text-muted-foreground/60 font-medium">Capaian</span>
      </div>
    </div>
  );
}

/* ── Pagination Controls ──────────────────────────────────────── */
function PaginationControls({
  currentPage,
  totalPages,
  totalItems,
  perPage,
  onPageChange,
  onPerPageChange,
}: {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  perPage: number;
  onPageChange: (page: number) => void;
  onPerPageChange?: (perPage: number) => void;
}) {
  const startItem = Math.min((currentPage - 1) * perPage + 1, totalItems);
  const endItem = Math.min(currentPage * perPage, totalItems);

  const perPageOptions = [15, 25, 50, 100];

  return (
    <div className="flex items-center justify-between px-3 py-2 border-t border-border bg-muted/20 shrink-0">
      <div className="flex items-center gap-3">
        <span className="text-[10px] text-muted-foreground">
          Menampilkan {startItem}–{endItem} dari {totalItems} data
        </span>
        {onPerPageChange && (
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-muted-foreground">Baris:</span>
            <select
              value={perPage}
              onChange={(e) => onPerPageChange(Number(e.target.value))}
              className="h-5 rounded border border-border bg-card text-[10px] text-foreground px-1 py-0 focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
            >
              {perPageOptions.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
        )}
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className="flex items-center justify-center size-7 rounded-md border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Halaman sebelumnya"
        >
          <ChevronLeft className="size-3.5" />
        </button>
        <span className="text-[10px] font-medium text-foreground/70 px-2">
          Hal. <span className="font-bold text-foreground">{currentPage}</span> dari {totalPages}
        </span>
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="flex items-center justify-center size-7 rounded-md border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Halaman berikutnya"
        >
          <ChevronRight className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

/* ── Shared small input for inline editing ────────────────────── */
function CellInput({
  value,
  onChange,
  type = 'text',
  className = '',
  placeholder = '',
}: {
  value: string | number;
  onChange: (val: string) => void;
  type?: string;
  className?: string;
  placeholder?: string;
}) {
  return (
    <Input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`h-7 bg-muted/50 border-border text-foreground/80 text-xs focus-visible:ring-ring ${className}`}
    />
  );
}

function CellCheckbox({
  checked,
  onCheckedChange,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return <Checkbox checked={checked} onCheckedChange={(v) => onCheckedChange(!!v)} className="size-4" />;
}

/* ── Selection header & cell helpers ──────────────────────────── */
function SelectHeaderCell({ selection }: { selection: SelectionProps }) {
  return (
    <TableHead className="text-muted-foreground text-[10px] w-10 text-center">
      <Checkbox
        checked={selection.allSelected ? true : selection.someSelected ? 'indeterminate' : false}
        onCheckedChange={() => selection.onToggleSelectAll()}
        className="size-3.5"
      />
    </TableHead>
  );
}

function SelectRowCell({ id, selection }: { id: string; selection: SelectionProps }) {
  return (
    <TableCell className="text-center">
      <Checkbox
        checked={selection.selectedIds.has(id)}
        onCheckedChange={() => selection.onToggleSelect(id)}
        className="size-3.5"
      />
    </TableCell>
  );
}

/* ── Column visibility toggle ─────────────────────────────────── */
const COLUMN_DEFINITIONS: Record<string, { id: string; label: string }[]> = {
  tangan: [
    { id: 'date', label: 'Tanggal' }, { id: 'staff', label: 'Petugas' }, { id: 'observer', label: 'Observer' },
    { id: 'room', label: 'Ruangan' }, { id: 'moments', label: '5 Momen' }, { id: 'method', label: 'Metode' },
    { id: 'patuh', label: 'Patuh' }, { id: 'actions', label: 'Aksi' },
  ],
  visite: [
    { id: 'date', label: 'Tanggal' }, { id: 'rm', label: 'No RM' }, { id: 'doctor', label: 'Dokter' },
    { id: 'time', label: 'Waktu' }, { id: 'patuh', label: 'Patuh' }, { id: 'actions', label: 'Aksi' },
  ],
  identitas: [
    { id: 'date', label: 'Tanggal' }, { id: 'staff', label: 'Petugas' }, { id: 'room', label: 'Ruangan' },
    { id: 'name', label: 'Nama' }, { id: 'rm', label: 'No RM' }, { id: 'service', label: 'Pelayanan' },
    { id: 'checks', label: 'Cek' }, { id: 'actions', label: 'Aksi' },
  ],
  apd: [
    { id: 'date', label: 'Tanggal' }, { id: 'room', label: 'Ruangan' }, { id: 'staff', label: 'Petugas' },
    { id: 'comp', label: 'Kepatuhan' }, { id: 'actions', label: 'Aksi' },
  ],
  jatuh: [
    { id: 'date', label: 'Tanggal' }, { id: 'rm', label: 'No RM' }, { id: 'awal', label: 'Awal' },
    { id: 're', label: 'Reassessment' }, { id: 'inv', label: 'Intervensi' }, { id: 'cedera', label: 'Cedera' },
    { id: 'actions', label: 'Aksi' },
  ],
  sc: [
    { id: 'date', label: 'Tanggal' }, { id: 'rm', label: 'No RM' }, { id: 'diag', label: 'Diagnosis' },
    { id: 'ok', label: '≤30 Menit' }, { id: 'actions', label: 'Aksi' },
  ],
  wtrj: [
    { id: 'date', label: 'Tanggal' }, { id: 'rm', label: 'No RM' }, { id: 'doc', label: 'Dokter/Poli' },
    { id: 't1', label: 'Pendaftaran' }, { id: 't2', label: 'Dilayani' }, { id: 'diff', label: 'Selisih' },
    { id: 'st', label: '>60 Mnt' }, { id: 'actions', label: 'Aksi' },
  ],
  op: [
    { id: 'date', label: 'Tanggal' }, { id: 'rm', label: 'No RM' }, { id: 't1', label: 'Jadwal' },
    { id: 't2', label: 'Aktual' }, { id: 'diff', label: 'Selisih' }, { id: 'tertunda', label: 'Tertunda' },
    { id: 'reason', label: 'Alasan' }, { id: 'actions', label: 'Aksi' },
  ],
  lab: [
    { id: 'date', label: 'Tanggal' }, { id: 'rm', label: 'No RM' }, { id: 'exam', label: 'Pemeriksaan' },
    { id: 't1', label: 'Keluar' }, { id: 't2', label: 'Diterima' }, { id: 'num', label: '≤30 Mnt' },
    { id: 'actions', label: 'Aksi' },
  ],
  fornas: [
    { id: 'date', label: 'Tanggal' }, { id: 'num', label: 'Sesuai' }, { id: 'non', label: 'Tidak Sesuai' },
    { id: 'note', label: 'Keterangan' }, { id: 'actions', label: 'Aksi' },
  ],
  cp: [
    { id: 'date', label: 'Tanggal' }, { id: 'name', label: 'Nama' }, { id: 'rm', label: 'No RM' },
    { id: 'diag', label: 'Diagnosis' }, { id: 'variants', label: 'Varian' }, { id: 'patuhPPA', label: 'Patuh PPA' },
    { id: 'los', label: 'LOS' }, { id: 'actions', label: 'Aksi' },
  ],
};

function ColumnVisibilityToggle({ type }: { type: IndicatorType }) {
  const [open, setOpen] = useState(false);
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(new Set());
  const columns = COLUMN_DEFINITIONS[type] || [];

  const toggleColumn = (id: string) => {
    setHiddenCols((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (columns.length === 0) return null;

  return (
    <div className="flex items-center justify-between border-b border-border px-3 py-1.5 bg-muted/20">
      <span className="text-[9px] text-muted-foreground/50">{columns.length} kolom</span>
      <div className="relative">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground/70 transition-colors"
        >
          <Eye className="size-3" />
          Kolom
          <ChevronDown className={`size-3 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-full mt-1 z-50 rounded-lg border border-border bg-popover p-2 shadow-lg min-w-[180px]"
            >
              <div className="space-y-0.5">
                {columns.map((col) => (
                  <label
                    key={col.id}
                    className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-muted/50 cursor-pointer text-xs text-foreground/80"
                  >
                    <Checkbox
                      checked={!hiddenCols.has(col.id)}
                      onCheckedChange={() => toggleColumn(col.id)}
                      className="size-3"
                    />
                    {col.label}
                  </label>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ── Main Component ───────────────────────────────────────────── */
/* ── Helper: get searchable text from an entry ─────────────── */
function getEntrySearchableText(entry: IndicatorEntry): string {
  const parts: string[] = [entry.date || '', entry.unitId || ''];
  switch (entry.indicatorType) {
    case 'tangan': {
      const e = entry as TanganEntry;
      parts.push(e.staff || '', e.observer || '', e.room || '', e.method || '',
        e.m1 ? 'Ya' : 'Tidak', e.m2 ? 'Ya' : 'Tidak', e.m3 ? 'Ya' : 'Tidak',
        e.m4 ? 'Ya' : 'Tidak', e.m5 ? 'Ya' : 'Tidak',
        e.patuh === true ? 'Patuh' : e.patuh === false ? 'Tidak' : '');
      break;
    }
    case 'visite': {
      const e = entry as VisiteEntry;
      parts.push(e.rm || '', e.doctor || '', e.time || '',
        isVisitePatuh(e.time) ? 'Patuh' : 'Tidak');
      break;
    }
    case 'identitas': {
      const e = entry as IdentitasEntry;
      parts.push(e.staff || '', e.observer || '', e.room || '', e.name || '',
        e.rm || '', e.service || '', e.nama ? 'Ya' : 'Tidak', e.tgl ? 'Ya' : 'Tidak',
        (e.nama && e.tgl) ? 'Tepat' : 'Tidak');
      break;
    }
    case 'apd': {
      const e = entry as ApdEntry;
      parts.push(e.room || '', e.staff || '', e.comp || '');
      break;
    }
    case 'jatuh': {
      const e = entry as JatuhEntry;
      parts.push(e.rm || '', e.awal ? 'Ya' : 'Tidak', e.re ? 'Ya' : 'Tidak',
        e.inv ? 'Ya' : 'Tidak', e.cedera ? 'Ya' : 'Tidak',
        (e.awal && e.re && e.inv && e.cedera) ? 'Patuh' : 'Tidak');
      break;
    }
    case 'sc': {
      const e = entry as ScEntry;
      parts.push(e.rm || '', e.diag || '', e.ok ? 'Ya' : 'Tidak');
      break;
    }
    case 'wtrj': {
      const e = entry as WtrjEntry;
      parts.push(e.rm || '', e.doc || '', e.t1 || '', e.t2 || '',
        String(timeDiffMinutes(e.t1, e.t2)),
        e.st_checked ? '>60' : '≤60');
      break;
    }
    case 'op': {
      const e = entry as OpEntry;
      parts.push(e.rm || '', e.t1 || '', e.t2 || '',
        String(timeDiffMinutes(e.t1, e.t2)),
        e.tertunda ? 'Tertunda' : 'Tidak', e.r || '');
      break;
    }
    case 'lab': {
      const e = entry as LabEntry;
      parts.push(e.rm || '', e.exam || '', e.t1 || '', e.t2 || '',
        e.num ? 'Ya' : 'Tidak');
      break;
    }
    case 'fornas': {
      const e = entry as FornasEntry;
      parts.push(String(e.num || 0), String(e.non || 0), e.note || '');
      break;
    }
    case 'cp': {
      const e = entry as CpEntry;
      parts.push(e.name || '', e.rm || '', e.diag || '',
        String(e.vTerapi), String(e.vLab), String(e.vRad), String(e.vLain),
        e.vLainKet || '', e.perawat || '', e.farmasi || '', e.gizi || '',
        String(e.los), e.ket || '');
      break;
    }
  }
  return parts.join(' ').toLowerCase();
}

export function IndicatorPanel({
  type,
  entries,
  activeUnit,
  userId,
  isLoading,
  onAddEntry,
  onUpdateEntry,
  onDeleteEntry,
  onImport,
  dateFilter,
  onDateFilterChange,
  accessBlocked,
  blockReason,
  allEntries = [],
}: IndicatorPanelProps) {
  const [importOpen, setImportOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dataEntryOpen, setDataEntryOpen] = useState(false);
  const [dataEntryLoading, setDataEntryLoading] = useState(false);

  // ── Period comparison state ──
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareFilter, setCompareFilter] = useState<{ start: string; end: string }>({ start: '', end: '' });

  // ── Pagination state ──
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(50);

  const meta = useMemo(() => INDICATORS.find((i) => i.id === type)!, [type]);
  const stats = useMemo(() => calculateStats(type, entries), [type, entries]);
  const Icon = ICON_MAP[meta.icon] ?? FileText;

  // ── Debounced search ──
  useEffect(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => { if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current); };
  }, [searchQuery]);

  // ── Filtered entries ──
  const filteredEntries = useMemo(() => {
    if (!debouncedSearch.trim()) return entries;
    const q = debouncedSearch.toLowerCase().trim();
    return entries.filter((e) => getEntrySearchableText(e).includes(q));
  }, [entries, debouncedSearch]);

  // ── Paginated entries ──
  const paginatedEntries = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredEntries.slice(start, start + rowsPerPage);
  }, [filteredEntries, currentPage, rowsPerPage]);

  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / rowsPerPage));

  // Reset page when search/filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, type]);

  // ── Trend calculation (last 2 entries) ──
  const trendDirection = useMemo(() => {
    if (entries.length < 2) return 'neutral';
    const prevStats = calculateStats(type, entries.slice(0, -1));
    const currStats = stats;
    if (currStats.pct > prevStats.pct) return 'up';
    if (currStats.pct < prevStats.pct) return 'down';
    return 'neutral';
  }, [type, entries, stats]);

  // ── Period comparison computation ──
  const compareStats = useMemo(() => {
    if (!compareOpen || !compareFilter.start || !compareFilter.end) return null;
    const filtered = allEntries.filter((e) => {
      const d = e.date || '';
      return d >= compareFilter.start && d <= compareFilter.end;
    });
    return calculateStats(type, filtered);
  }, [compareOpen, compareFilter, allEntries, type]);

  const compareDelta = useMemo(() => {
    if (!compareStats) return null;
    return {
      pct: Math.round((stats.pct - compareStats.pct) * 10) / 10,
      num: stats.num - compareStats.num,
      den: stats.den - compareStats.den,
    };
  }, [stats, compareStats]);

  const compareLabel = useMemo(() => {
    if (!compareFilter.start || !compareFilter.end) return '';
    return `${compareFilter.start} ~ ${compareFilter.end}`;
  }, [compareFilter]);

  /* ── Selection logic ─────────────────────────────────────── */
  const entryIds = useMemo(() => paginatedEntries.map((e) => e.id), [paginatedEntries]);
  const allSelected = entryIds.length > 0 && entryIds.every((id) => selectedIds.has(id));
  const someSelected = selectedIds.size > 0 && !allSelected;

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleToggleSelectAll = useCallback(() => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(entryIds));
    }
  }, [allSelected, entryIds]);

  // Clear selection when indicator type changes
  useEffect(() => {
    setSelectedIds(new Set());
  }, [type]);

  const selectionProps: SelectionProps = {
    selectedIds,
    onToggleSelect: handleToggleSelect,
    onToggleSelectAll: handleToggleSelectAll,
    allSelected,
    someSelected,
  };

  /* ── Batch delete ─────────────────────────────────────────── */
  const handleBatchDelete = useCallback(async () => {
    const ids = Array.from(selectedIds);
    let successCount = 0;
    for (const id of ids) {
      try {
        await onDeleteEntry(id);
        successCount++;
      } catch {
        // continue deleting others
      }
    }
    setSelectedIds(new Set());
    setBatchDeleteOpen(false);
    if (successCount > 0) {
      toastDataChange('delete', successCount);
    }
  }, [selectedIds, onDeleteEntry]);

  /* ── Handlers ─────────────────────────────────────────────── */
  const handleAdd = useCallback(() => {
    setDataEntryOpen(true);
  }, []);

  const handleDataEntrySubmit = useCallback(async (entry: Omit<IndicatorEntry, 'id' | 'createdAt' | 'updatedAt'>) => {
    setDataEntryLoading(true);
    try {
      await onAddEntry(entry);
      toastDataChange('add', 1);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal menambahkan data';
      console.error('[handleDataEntrySubmit] Error:', err);
      toast.error(message);
      throw err; // re-throw so modal doesn't close on failure
    } finally {
      setDataEntryLoading(false);
    }
  }, [onAddEntry]);

  const handleDelete = useCallback(
    async (id: string) => {
      setDeletingId(id);
      try {
        await onDeleteEntry(id);
        toastDataChange('delete', 1);
      } catch {
        toast.error('Gagal menghapus data');
      } finally {
        setDeletingId(null);
      }
    },
    [onDeleteEntry]
  );

  const handleUpdate = useCallback(
    async (id: string, data: Partial<IndicatorEntry>) => {
      try {
        await onUpdateEntry(id, data);
      } catch {
        toast.error('Gagal memperbarui data');
      }
    },
    [onUpdateEntry]
  );

  /* ── Export single indicator ──────────────────────────────── */
  const handleExportSingle = useCallback(async () => {
    const XLSX = await import('xlsx');
    const data = filteredEntries;
    if (data.length === 0) {
      toast.error('Tidak ada data untuk diekspor');
      return;
    }

    const rows = data.map((e, idx) => {
      const base: Record<string, unknown> = {
        'No': idx + 1,
        'Tanggal': e.date || '',
        'Unit': e.unitId || '',
      };
      switch (e.indicatorType) {
        case 'tangan': {
          const t = e as TanganEntry;
          Object.assign(base, {
            'Petugas': t.staff, 'Observer': t.observer, 'Ruangan': t.room,
            'M1': t.m1 ? 'Ya' : 'Tidak', 'M2': t.m2 ? 'Ya' : 'Tidak', 'M3': t.m3 ? 'Ya' : 'Tidak',
            'M4': t.m4 ? 'Ya' : 'Tidak', 'M5': t.m5 ? 'Ya' : 'Tidak',
            'Metode': t.method, 'Patuh': t.patuh === true ? 'Ya' : t.patuh === false ? 'Tidak' : '—',
          });
          break;
        }
        case 'visite': {
          const v = e as VisiteEntry;
          Object.assign(base, { 'Dokter': v.doctor, 'Waktu': v.time, 'Patuh': isVisitePatuh(v.time) ? 'Ya' : 'Tidak' });
          break;
        }
        case 'identitas': {
          const i = e as IdentitasEntry;
          Object.assign(base, { 'Petugas': i.staff, 'Observer': i.observer, 'Ruangan': i.room, 'Nama Pasien': i.name, 'No RM': i.rm, 'Pelayanan': i.service, 'Cek Nama': i.nama ? 'Ya' : 'Tidak', 'Cek Tgl': i.tgl ? 'Ya' : 'Tidak' });
          break;
        }
        case 'apd': {
          const a = e as ApdEntry;
          Object.assign(base, { 'Ruangan': a.room, 'Petugas': a.staff, 'Kepatuhan': a.comp });
          break;
        }
        case 'jatuh': {
          const j = e as JatuhEntry;
          Object.assign(base, { 'No RM': j.rm, 'Awal': j.awal ? 'Ya' : 'Tidak', 'Reassessment': j.re ? 'Ya' : 'Tidak', 'Intervensi': j.inv ? 'Ya' : 'Tidak', 'Cedera': j.cedera ? 'Ya' : 'Tidak' });
          break;
        }
        case 'sc': {
          const s = e as ScEntry;
          Object.assign(base, { 'No RM': s.rm, 'Diagnosis': s.diag, '\u226430 Menit': s.ok ? 'Ya' : 'Tidak' });
          break;
        }
        case 'wtrj': {
          const w = e as WtrjEntry;
          Object.assign(base, { 'No RM': w.rm, 'Dokter/Poli': w.doc, 'Pendaftaran': w.t1, 'Dilayani': w.t2, 'Selisih (mnt)': timeDiffMinutes(w.t1, w.t2), '>60 Mnt': w.st_checked ? 'Ya' : 'Tidak' });
          break;
        }
        case 'op': {
          const o = e as OpEntry;
          Object.assign(base, { 'No RM': o.rm, 'Jadwal': o.t1, 'Aktual': o.t2, 'Selisih (mnt)': timeDiffMinutes(o.t1, o.t2), 'Tertunda': o.tertunda ? 'Ya' : 'Tidak', 'Alasan': o.r });
          break;
        }
        case 'lab': {
          const l = e as LabEntry;
          Object.assign(base, { 'No RM': l.rm, 'Pemeriksaan': l.exam, 'Keluar Hasil': l.t1, 'Diterima': l.t2, '\u226430 Mnt': l.num ? 'Ya' : 'Tidak' });
          break;
        }
        case 'fornas': {
          const f = e as FornasEntry;
          Object.assign(base, { 'R/Sesuai': f.num, 'R/Tidak Sesuai': f.non, 'Keterangan': f.note });
          break;
        }
        case 'cp': {
          const c = e as CpEntry;
          Object.assign(base, { 'Nama Pasien': c.name, 'No RM': c.rm, 'Diagnosis': c.diag, 'Var Terapi': c.vTerapi, 'Var Lab': c.vLab, 'Var Rad': c.vRad, 'Var Lain': c.vLain, 'Ket Lain': c.vLainKet, 'Perawat': c.perawat, 'Farmasi': c.farmasi, 'Gizi': c.gizi, 'LOS': c.los, 'Keterangan': c.ket });
          break;
        }
      }
      return base;
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, meta.label.slice(0, 31));
    const datePart = dateFilter.start && dateFilter.end
      ? `_${dateFilter.start}_${dateFilter.end}`
      : dateFilter.start ? `_from_${dateFilter.start}` : '';
    XLSX.writeFile(wb, `${meta.label.replace(/\s+/g, '_')}${datePart}.xlsx`);
    toast.success('Berhasil export ke Excel');
  }, [filteredEntries, meta.label, dateFilter]);

  /* ── Date filter handlers ─────────────────────────────────── */
  const handleApplyDate = useCallback(() => {
    // The filter is already applied reactively; this can trigger a refetch
  }, []);

  const handleResetDate = useCallback(() => {
    // Reset to show all data (no date filter)
    onDateFilterChange({
      start: '',
      end: '',
    });
  }, [onDateFilterChange]);

  const isFiltered = useMemo(() => {
    // If no date filter set at all, not filtered
    if (!dateFilter.start && !dateFilter.end) return false;
    // Check if the date range matches the current month start to today
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(1).padStart(2, '0')}`;
    const todayLocal = todayStr();
    return dateFilter.start !== monthStart || dateFilter.end !== todayLocal;
  }, [dateFilter.start, dateFilter.end]);

  /* ── Render data table by type ────────────────────────────── */
  const renderTable = () => {
    switch (type) {
      case 'tangan':
        return <TanganTable entries={paginatedEntries as TanganEntry[]} onUpdate={handleUpdate} onDelete={handleDelete} deletingId={deletingId} selection={selectionProps} />;
      case 'visite':
        return <VisiteTable entries={paginatedEntries as VisiteEntry[]} onUpdate={handleUpdate} onDelete={handleDelete} deletingId={deletingId} selection={selectionProps} />;
      case 'identitas':
        return <IdentitasTable entries={paginatedEntries as IdentitasEntry[]} onUpdate={handleUpdate} onDelete={handleDelete} deletingId={deletingId} selection={selectionProps} />;
      case 'apd':
        return <ApdTable entries={paginatedEntries as ApdEntry[]} onUpdate={handleUpdate} onDelete={handleDelete} deletingId={deletingId} selection={selectionProps} />;
      case 'jatuh':
        return <JatuhTable entries={paginatedEntries as JatuhEntry[]} onUpdate={handleUpdate} onDelete={handleDelete} deletingId={deletingId} selection={selectionProps} />;
      case 'sc':
        return <ScTable entries={paginatedEntries as ScEntry[]} onUpdate={handleUpdate} onDelete={handleDelete} deletingId={deletingId} selection={selectionProps} />;
      case 'wtrj':
        return <WtrjTable entries={paginatedEntries as WtrjEntry[]} onUpdate={handleUpdate} onDelete={handleDelete} deletingId={deletingId} selection={selectionProps} />;
      case 'op':
        return <OpTable entries={paginatedEntries as OpEntry[]} onUpdate={handleUpdate} onDelete={handleDelete} deletingId={deletingId} selection={selectionProps} />;
      case 'lab':
        return <LabTable entries={paginatedEntries as LabEntry[]} onUpdate={handleUpdate} onDelete={handleDelete} deletingId={deletingId} selection={selectionProps} />;
      case 'fornas':
        return <FornasTable entries={paginatedEntries as FornasEntry[]} onUpdate={handleUpdate} onDelete={handleDelete} deletingId={deletingId} selection={selectionProps} />;
      case 'cp':
        return <CpTable entries={paginatedEntries as CpEntry[]} onUpdate={handleUpdate} onDelete={handleDelete} deletingId={deletingId} selection={selectionProps} />;
    }
  };

  return (
    <div className="relative flex h-full flex-col">
      {/* ── Access blocked overlay ─────────────────────────────── */}
      {accessBlocked && (
        <div className="absolute inset-0 z-40 flex items-center justify-center rounded-lg bg-black/70 backdrop-blur-sm">
          <div className="mx-4 max-w-sm rounded-xl border border-border bg-card p-6 text-center">
            <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-red-500/20">
              <ShieldAlert className="size-6 text-red-400" />
            </div>
            <h3 className="text-sm font-semibold text-foreground/90 mb-1">Akses Ditolak</h3>
            <p className="text-xs text-muted-foreground">{blockReason || 'Anda tidak memiliki akses ke indikator ini.'}</p>
          </div>
        </div>
      )}

      {/* ── Panel header ───────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span
            className="flex size-8 items-center justify-center rounded-lg"
            style={{ backgroundColor: `${meta.color}25` }}
          >
            <Icon className="size-4" style={{ color: meta.color }} />
          </span>
          <h2 className="text-base font-semibold text-foreground/90">{meta.label}</h2>
        </div>
        <Badge
          className="border-0 text-[10px] font-medium"
          style={{ backgroundColor: `${meta.color}20`, color: meta.color }}
        >
          Target: {meta.targetLabel}
        </Badge>
        {stats.ok ? (
          <Badge className="bg-emerald-500/20 text-emerald-400 border-0 text-[10px] font-medium gap-1">
            <CheckCircle2 className="size-3" />
            Tercapai
          </Badge>
        ) : (
          <Badge className="bg-red-500/20 text-red-400 border-0 text-[10px] font-medium gap-1">
            <XCircle className="size-3" />
            Belum Tercapai
          </Badge>
        )}
      </div>

      {/* ── Quick Stats Bar ─────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex items-center gap-1.5 rounded-md border border-border bg-muted/30 px-2.5 py-1.5">
          <span className="text-[10px] text-muted-foreground font-medium">Total</span>
          <span className="text-xs font-bold font-mono text-foreground/80">{entries.length}</span>
          {compareDelta && (
            <span className={`text-[10px] font-mono ${compareDelta.den > 0 ? 'text-emerald-400' : compareDelta.den < 0 ? 'text-red-400' : 'text-muted-foreground'}`}>
              ({compareDelta.den > 0 ? '+' : ''}{compareDelta.den})
            </span>
          )}
        </div>
        <div className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 ${
          stats.ok
            ? 'border-emerald-500/20 bg-emerald-500/10'
            : 'border-red-500/20 bg-red-500/10'
        }`}>
          <span className="text-[10px] text-muted-foreground font-medium">Capaian</span>
          <span className={`text-xs font-bold font-mono ${stats.ok ? 'text-emerald-400' : 'text-red-400'}`}>
            {stats.pct}%
          </span>
          {compareDelta && (
            <span className={`text-[10px] font-mono flex items-center gap-0.5 ${compareDelta.pct > 0 ? 'text-emerald-400' : compareDelta.pct < 0 ? 'text-red-400' : 'text-muted-foreground'}`}>
              {compareDelta.pct > 0 ? <TrendingUp className="size-3" /> : compareDelta.pct < 0 ? <TrendingDown className="size-3" /> : <Minus className="size-3" />}
              {compareDelta.pct > 0 ? '+' : ''}{compareDelta.pct}%
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 rounded-md border border-border bg-muted/30 px-2.5 py-1.5">
          <span className="text-[10px] text-muted-foreground font-medium">Target</span>
          <span className="text-xs font-bold font-mono text-foreground/70">{meta.targetLabel}</span>
        </div>
        <div className="flex items-center gap-1.5 rounded-md border border-border bg-muted/30 px-2.5 py-1.5">
          <span className="text-[10px] text-muted-foreground font-medium">Tren</span>
          {trendDirection === 'up' ? (
            <TrendingUp className="size-3.5 text-emerald-400" />
          ) : trendDirection === 'down' ? (
            <TrendingDown className="size-3.5 text-red-400" />
          ) : (
            <Minus className="size-3.5 text-muted-foreground/60" />
          )}
        </div>
        {compareOpen && compareStats && (
          <Badge variant="secondary" className="text-[10px] gap-1 bg-primary/10 text-primary border-primary/20">
            <ArrowLeftRight className="size-3" />
            vs {compareLabel}: {compareStats.pct}%
          </Badge>
        )}
      </div>

      {/* ── Comparison period selector ────────────────────────────── */}
      <AnimatePresence>
        {compareOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden mb-4"
          >
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
              <ArrowLeftRight className="size-4 text-primary shrink-0" />
              <span className="text-xs font-medium text-foreground/80">Periode Perbandingan:</span>
              <Input
                type="date"
                value={compareFilter.start}
                onChange={(e) => setCompareFilter(prev => ({ ...prev, start: e.target.value }))}
                className="h-7 w-[140px] bg-background border-border text-foreground text-xs"
              />
              <span className="text-xs text-muted-foreground">s/d</span>
              <Input
                type="date"
                value={compareFilter.end}
                onChange={(e) => setCompareFilter(prev => ({ ...prev, end: e.target.value }))}
                className="h-7 w-[140px] bg-background border-border text-foreground text-xs"
              />
              {compareStats && (
                <div className="flex items-center gap-2 ml-auto">
                  <span className="text-xs text-muted-foreground">Perbandingan:</span>
                  <span className={`text-xs font-bold font-mono ${compareStats.ok ? 'text-emerald-400' : 'text-red-400'}`}>
                    {compareStats.pct}%
                  </span>
                  {compareDelta && (
                    <span className={`text-[10px] font-mono ${compareDelta.pct > 0 ? 'text-emerald-400' : compareDelta.pct < 0 ? 'text-red-400' : 'text-muted-foreground'}`}>
                      ({compareDelta.pct > 0 ? '+' : ''}{compareDelta.pct}%)
                    </span>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Stat cards + Doughnut ──────────────────────────────── */}
      <div className="flex gap-3 mb-4">
        <div className="grid grid-cols-3 gap-3 flex-1">
          <StatCard
            label="Numerator"
            value={stats.num}
            color="blue"
          />
          <StatCard
            label="Denominator"
            value={stats.den}
            color="default"
          />
          <StatCard
            label="Capaian"
            value={`${stats.pct}%`}
            color={stats.ok ? 'green' : 'red'}
            progress={stats.pct}
            progressColor={meta.color}
          />
        </div>
        <div className="flex items-center justify-center">
          <ComplianceDoughnut patuh={stats.num} tidakPatuh={Math.max(0, stats.den - stats.num)} pct={stats.pct} />
        </div>
      </div>

      {/* ── Date filter bar ────────────────────────────────────── */}
      <div className="mb-4">
        <DateFilterBar
          startDate={dateFilter.start}
          endDate={dateFilter.end}
          onStartDateChange={(d) => onDateFilterChange({ ...dateFilter, start: d })}
          onEndDateChange={(d) => onDateFilterChange({ ...dateFilter, end: d })}
          onApply={handleApplyDate}
          onReset={handleResetDate}
          isFiltered={isFiltered}
        />
      </div>

      {/* ── Action buttons ─────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-4">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={isLoading || accessBlocked || activeUnit === 'all'}
              className="h-8 bg-[#4f8ef7]/20 text-[#4f8ef7] hover:bg-[#4f8ef7]/30 border-0 text-xs font-medium gap-1.5"
            >
              <Plus className="size-3.5" />
              Tambah Data
            </Button>
          </TooltipTrigger>
          <TooltipContent>Tambah Data Baru</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setImportOpen(true)}
              disabled={isLoading || accessBlocked}
              className="h-8 border-border text-foreground/70 hover:text-foreground hover:bg-muted text-xs font-medium gap-1.5"
            >
              <FileSpreadsheet className="size-3.5" />
              Import
            </Button>
          </TooltipTrigger>
          <TooltipContent>Import dari Excel</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              onClick={handleExportSingle}
              disabled={isLoading || accessBlocked || filteredEntries.length === 0}
              className="h-8 border-border text-foreground/70 hover:text-foreground hover:bg-muted text-xs font-medium gap-1.5"
            >
              <Download className="size-3.5" />
              Export
            </Button>
          </TooltipTrigger>
          <TooltipContent>Export ke Excel</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              variant={compareOpen ? 'default' : 'outline'}
              onClick={() => setCompareOpen(prev => !prev)}
              disabled={isLoading || accessBlocked}
              className={`h-8 text-xs font-medium gap-1.5 ${
                compareOpen
                  ? 'bg-primary/20 text-primary hover:bg-primary/30 border-0'
                  : 'border-border text-foreground/70 hover:text-foreground hover:bg-muted'
              }`}
            >
              <ArrowLeftRight className="size-3.5" />
              {compareOpen ? 'Tutup Bandingkan' : 'Bandingkan'}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Bandingkan Periode</TooltipContent>
        </Tooltip>
      </div>

      {/* ── Search bar ──────────────────────────────────────────── */}
      {entries.length > 0 && (
        <div className="flex items-center gap-2 mb-3">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/60" />
            <Input
              type="text"
              placeholder="Cari data..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 bg-muted/50 border-border text-foreground/80 text-xs placeholder:text-muted-foreground/50 focus-visible:ring-ring"
            />
          </div>
          {debouncedSearch.trim() && (
            <span className="text-[11px] text-muted-foreground shrink-0">
              {filteredEntries.length} dari {entries.length} data
            </span>
          )}
        </div>
      )}

      {/* ── Data table ─────────────────────────────────────────── */}
      {isLoading ? (
        <div className="flex flex-1 items-center justify-center py-12">
          <div className="relative">
            <div className="branded-spinner" />
          </div>
        </div>
      ) : entries.length === 0 ? (
        <EmptyState
          title="Belum Ada Data"
          description={`Data indikator ${meta.label} belum tersedia. Tambahkan data baru untuk memulai pencatatan.`}
          actionLabel="Tambah Data"
          onAction={handleAdd}
          indicatorType={type}
        />
      ) : filteredEntries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Search className="size-8 text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground">Tidak ada data yang cocok</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Coba ubah kata kunci pencarian</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 rounded-lg border border-border bg-card overflow-hidden flex flex-col" style={{ '--row-accent-color': meta.color } as React.CSSProperties}>
          {/* Column visibility toggle */}
          <ColumnVisibilityToggle type={type} />
          <div className="flex-1 min-h-0 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="overflow-x-auto -webkit-overflow-scrolling-touch table-container-enhanced">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`${type}-${currentPage}-${debouncedSearch}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    {renderTable()}
                  </motion.div>
                </AnimatePresence>
              </div>
            </ScrollArea>
          </div>
          {/* "Showing X of Y entries" text when search is active */}
          {debouncedSearch.trim() && (
            <div className="border-t border-border px-3 py-1.5 shrink-0">
              <span className="text-[10px] text-muted-foreground">
                Menampilkan <span className="font-semibold text-foreground/80">{filteredEntries.length}</span> dari <span className="font-semibold text-foreground/80">{entries.length}</span> entri
              </span>
            </div>
          )}
          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredEntries.length}
            perPage={rowsPerPage}
            onPageChange={setCurrentPage}
            onPerPageChange={(n) => { setRowsPerPage(n); setCurrentPage(1); }}
          />
        </div>
      )}

      {/* ── Floating batch action bar ───────────────────────────── */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 flex items-center gap-3 rounded-xl border border-border bg-card px-5 py-3 shadow-2xl"
          >
            <span className="text-xs font-medium text-foreground/70">
              <span className="text-foreground font-bold">{selectedIds.size}</span> baris dipilih
            </span>
            <Button
              size="sm"
              onClick={() => setBatchDeleteOpen(true)}
              className="h-8 bg-red-500/20 text-red-400 hover:bg-red-500/30 border-0 text-xs font-medium gap-1.5"
            >
              <Trash2 className="size-3.5" />
              Hapus
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedIds(new Set())}
              className="h-8 text-muted-foreground hover:text-foreground/80 hover:bg-muted text-xs gap-1"
            >
              <X className="size-3.5" />
              Batal
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Batch delete confirmation ───────────────────────────── */}
      <AlertDialog open={batchDeleteOpen} onOpenChange={setBatchDeleteOpen}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground/90">Konfirmasi Hapus</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Apakah Anda yakin ingin menghapus <strong className="text-foreground/80">{selectedIds.size}</strong> baris data? Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border text-foreground/70 hover:text-foreground hover:bg-muted">Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleBatchDelete} className="bg-red-500/80 text-white hover:bg-red-500 border-0">
              Hapus {selectedIds.size} Baris
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Import Modal (lazy import to avoid circular) ────────── */}
      {importOpen && (
        <ImportModalLazy
          open={importOpen}
          onClose={() => setImportOpen(false)}
          type={type}
          onImport={onImport}
          activeUnit={activeUnit}
          userId={userId}
        />
      )}

      {/* ── Data Entry Modal ─────────────────────────────────────── */}
      <DataEntryModal
        open={dataEntryOpen}
        onOpenChange={setDataEntryOpen}
        type={type}
        activeUnit={activeUnit}
        userId={userId}
        onSubmit={handleDataEntrySubmit}
        isLoading={dataEntryLoading}
      />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   Lazy-loaded Import Modal
   ══════════════════════════════════════════════════════════════════ */

function ImportModalLazy(props: React.ComponentProps<typeof ImportModal>) {
  return <ImportModal {...props} />;
}

/* ══════════════════════════════════════════════════════════════════
   TYPE-SPECIFIC TABLES
   ══════════════════════════════════════════════════════════════════ */

/* ── Shared delete button ────────────────────────────────────── */
function DeleteBtn({ id, onDelete, isDeleting }: { id: string; onDelete: (id: string) => void; isDeleting: boolean }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-7 text-red-400/60 hover:text-red-400 hover:bg-red-500/10"
      onClick={() => onDelete(id)}
      disabled={isDeleting}
    >
      <Trash2 className="size-3.5" />
    </Button>
  );
}

/* ── TANGAN ──────────────────────────────────────────────────── */
function TanganTable({
  entries,
  onUpdate,
  onDelete,
  deletingId,
  selection,
}: {
  entries: TanganEntry[];
  onUpdate: (id: string, data: Partial<IndicatorEntry>) => Promise<void>;
  onDelete: (id: string) => void;
  deletingId: string | null;
  selection: SelectionProps;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="border-border hover:bg-transparent">
          <SelectHeaderCell selection={selection} />
          <TableHead className="text-muted-foreground text-[10px] w-10">No</TableHead>
          <TableHead className="text-muted-foreground text-[10px]">Tanggal</TableHead>
          <TableHead className="text-muted-foreground text-[10px]">Petugas</TableHead>
          <TableHead className="text-muted-foreground text-[10px]">Observer</TableHead>
          <TableHead className="text-muted-foreground text-[10px]">Ruangan</TableHead>
          <TableHead className="text-muted-foreground text-[10px] text-center">M1</TableHead>
          <TableHead className="text-muted-foreground text-[10px] text-center">M2</TableHead>
          <TableHead className="text-muted-foreground text-[10px] text-center">M3</TableHead>
          <TableHead className="text-muted-foreground text-[10px] text-center">M4</TableHead>
          <TableHead className="text-muted-foreground text-[10px] text-center">M5</TableHead>
          <TableHead className="text-muted-foreground text-[10px] text-center">Peluang</TableHead>
          <TableHead className="text-muted-foreground text-[10px]">Metode</TableHead>
          <TableHead className="text-muted-foreground text-[10px]">Patuh</TableHead>
          <TableHead className="text-muted-foreground text-[10px] w-10" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((e, idx) => {
          const moments = [e.m1, e.m2, e.m3, e.m4, e.m5].filter(Boolean).length;
          const peluang = moments > 0 ? moments : '-';
          return (
            <TableRow key={e.id} className={`border-border/50 hover:bg-muted/50 table-row-accent ${selection.selectedIds.has(e.id) ? 'bg-[#4f8ef7]/5' : ''}`}>
              <SelectRowCell id={e.id} selection={selection} />
              <TableCell className="text-muted-foreground text-xs">{idx + 1}</TableCell>
              <TableCell>
                <CellInput value={e.date} onChange={(v) => onUpdate(e.id, { date: v })} type="date" className="w-[130px]" />
              </TableCell>
              <TableCell>
                <CellInput value={e.staff} onChange={(v) => onUpdate(e.id, { staff: v } as Partial<TanganEntry>)} placeholder="Petugas" />
              </TableCell>
              <TableCell>
                <CellInput value={e.observer} onChange={(v) => onUpdate(e.id, { observer: v } as Partial<TanganEntry>)} placeholder="Observer" />
              </TableCell>
              <TableCell>
                <span className="text-xs text-foreground/70 px-1">{e.room || '—'}</span>
              </TableCell>
              <TableCell className="text-center"><CellCheckbox checked={e.m1} onCheckedChange={(v) => onUpdate(e.id, { m1: v } as Partial<TanganEntry>)} /></TableCell>
              <TableCell className="text-center"><CellCheckbox checked={e.m2} onCheckedChange={(v) => onUpdate(e.id, { m2: v } as Partial<TanganEntry>)} /></TableCell>
              <TableCell className="text-center"><CellCheckbox checked={e.m3} onCheckedChange={(v) => onUpdate(e.id, { m3: v } as Partial<TanganEntry>)} /></TableCell>
              <TableCell className="text-center"><CellCheckbox checked={e.m4} onCheckedChange={(v) => onUpdate(e.id, { m4: v } as Partial<TanganEntry>)} /></TableCell>
              <TableCell className="text-center"><CellCheckbox checked={e.m5} onCheckedChange={(v) => onUpdate(e.id, { m5: v } as Partial<TanganEntry>)} /></TableCell>
              <TableCell className="text-center text-xs text-foreground/60">{peluang}</TableCell>
              <TableCell>
                <CellInput value={e.method} onChange={(v) => onUpdate(e.id, { method: v } as Partial<TanganEntry>)} placeholder="Metode" />
              </TableCell>
              <TableCell>
                <RadioGroup
                  value={e.patuh === null ? '' : e.patuh ? 'patuh' : 'tidak'}
                  onValueChange={(v) => onUpdate(e.id, { patuh: v === 'patuh' } as Partial<TanganEntry>)}
                  className="flex items-center gap-2"
                >
                  <div className="flex items-center gap-1">
                    <RadioGroupItem value="patuh" id={`p-${e.id}`} className="size-3" />
                    <label htmlFor={`p-${e.id}`} className="text-[10px] text-muted-foreground">Patuh</label>
                  </div>
                  <div className="flex items-center gap-1">
                    <RadioGroupItem value="tidak" id={`t-${e.id}`} className="size-3" />
                    <label htmlFor={`t-${e.id}`} className="text-[10px] text-muted-foreground">Tidak</label>
                  </div>
                </RadioGroup>
              </TableCell>
              <TableCell><DeleteBtn id={e.id} onDelete={onDelete} isDeleting={deletingId === e.id} /></TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

/* ── VISITE ──────────────────────────────────────────────────── */
function VisiteTable({
  entries,
  onUpdate,
  onDelete,
  deletingId,
  selection,
}: {
  entries: VisiteEntry[];
  onUpdate: (id: string, data: Partial<IndicatorEntry>) => Promise<void>;
  onDelete: (id: string) => void;
  deletingId: string | null;
  selection: SelectionProps;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="border-border hover:bg-transparent">
          <SelectHeaderCell selection={selection} />
          <TableHead className="text-muted-foreground text-[10px] w-10">No</TableHead>
          <TableHead className="text-muted-foreground text-[10px]">Tanggal</TableHead>
          <TableHead className="text-muted-foreground text-[10px]">No RM</TableHead>
          <TableHead className="text-muted-foreground text-[10px]">Dokter</TableHead>
          <TableHead className="text-muted-foreground text-[10px]">Waktu Visite</TableHead>
          <TableHead className="text-muted-foreground text-[10px] text-center">Patuh?</TableHead>
          <TableHead className="text-muted-foreground text-[10px] text-center">Denom</TableHead>
          <TableHead className="text-muted-foreground text-[10px] w-10" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((e, idx) => {
          const patuh = isVisitePatuh(e.time);
          return (
            <TableRow key={e.id} className={`border-border/50 hover:bg-muted/50 table-row-accent ${selection.selectedIds.has(e.id) ? 'bg-[#4f8ef7]/5' : ''}`}>
              <SelectRowCell id={e.id} selection={selection} />
              <TableCell className="text-muted-foreground text-xs">{idx + 1}</TableCell>
              <TableCell>
                <CellInput value={e.date} onChange={(v) => onUpdate(e.id, { date: v })} type="date" className="w-[130px]" />
              </TableCell>
              <TableCell>
                <CellInput value={e.rm} onChange={(v) => onUpdate(e.id, { rm: v } as Partial<VisiteEntry>)} placeholder="No RM" />
              </TableCell>
              <TableCell>
                <CellInput value={e.doctor} onChange={(v) => onUpdate(e.id, { doctor: v } as Partial<VisiteEntry>)} placeholder="Dokter" />
              </TableCell>
              <TableCell>
                <CellInput value={e.time} onChange={(v) => onUpdate(e.id, { time: v } as Partial<VisiteEntry>)} type="time" className="w-[110px]" />
              </TableCell>
              <TableCell className="text-center">
                <Badge className={`border-0 text-[10px] ${patuh ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                  {patuh ? 'Patuh' : 'Tidak'}
                </Badge>
              </TableCell>
              <TableCell className="text-center text-xs text-foreground/60">1</TableCell>
              <TableCell><DeleteBtn id={e.id} onDelete={onDelete} isDeleting={deletingId === e.id} /></TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

/* ── IDENTITAS ───────────────────────────────────────────────── */
function IdentitasTable({
  entries,
  onUpdate,
  onDelete,
  deletingId,
  selection,
}: {
  entries: IdentitasEntry[];
  onUpdate: (id: string, data: Partial<IndicatorEntry>) => Promise<void>;
  onDelete: (id: string) => void;
  deletingId: string | null;
  selection: SelectionProps;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="border-border hover:bg-transparent">
          <SelectHeaderCell selection={selection} />
          <TableHead className="text-muted-foreground text-[10px] w-10">No</TableHead>
          <TableHead className="text-muted-foreground text-[10px]">Tanggal</TableHead>
          <TableHead className="text-muted-foreground text-[10px]">Petugas</TableHead>
          <TableHead className="text-muted-foreground text-[10px]">Observer</TableHead>
          <TableHead className="text-muted-foreground text-[10px]">Ruangan</TableHead>
          <TableHead className="text-muted-foreground text-[10px]">Nama Pasien</TableHead>
          <TableHead className="text-muted-foreground text-[10px]">No RM</TableHead>
          <TableHead className="text-muted-foreground text-[10px]">Pelayanan</TableHead>
          <TableHead className="text-muted-foreground text-[10px] text-center">Cek Nama</TableHead>
          <TableHead className="text-muted-foreground text-[10px] text-center">Cek Tgl</TableHead>
          <TableHead className="text-muted-foreground text-[10px] text-center">Tepat?</TableHead>
          <TableHead className="text-muted-foreground text-[10px] w-10" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((e, idx) => {
          const tepat = e.nama && e.tgl;
          return (
            <TableRow key={e.id} className={`border-border/50 hover:bg-muted/50 table-row-accent ${selection.selectedIds.has(e.id) ? 'bg-[#4f8ef7]/5' : ''}`}>
              <SelectRowCell id={e.id} selection={selection} />
              <TableCell className="text-muted-foreground text-xs">{idx + 1}</TableCell>
              <TableCell>
                <CellInput value={e.date} onChange={(v) => onUpdate(e.id, { date: v })} type="date" className="w-[130px]" />
              </TableCell>
              <TableCell>
                <CellInput value={e.staff} onChange={(v) => onUpdate(e.id, { staff: v } as Partial<IdentitasEntry>)} placeholder="Petugas" />
              </TableCell>
              <TableCell>
                <CellInput value={e.observer} onChange={(v) => onUpdate(e.id, { observer: v } as Partial<IdentitasEntry>)} placeholder="Observer" />
              </TableCell>
              <TableCell>
                <span className="text-xs text-foreground/70 px-1">{e.room || '—'}</span>
              </TableCell>
              <TableCell>
                <CellInput value={e.name} onChange={(v) => onUpdate(e.id, { name: v } as Partial<IdentitasEntry>)} placeholder="Nama" />
              </TableCell>
              <TableCell>
                <CellInput value={e.rm} onChange={(v) => onUpdate(e.id, { rm: v } as Partial<IdentitasEntry>)} placeholder="No RM" />
              </TableCell>
              <TableCell>
                <Select value={e.service} onValueChange={(v) => onUpdate(e.id, { service: v } as Partial<IdentitasEntry>)}>
                  <SelectTrigger className="h-7 bg-muted/50 border-border text-xs min-w-[180px]">
                    <SelectValue placeholder="Pelayanan" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    {IDENTITAS_SERVICE_OPTIONS.map((opt) => (
                      <SelectItem key={opt} value={opt} className="text-xs">{opt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell className="text-center"><CellCheckbox checked={e.nama} onCheckedChange={(v) => onUpdate(e.id, { nama: v } as Partial<IdentitasEntry>)} /></TableCell>
              <TableCell className="text-center"><CellCheckbox checked={e.tgl} onCheckedChange={(v) => onUpdate(e.id, { tgl: v } as Partial<IdentitasEntry>)} /></TableCell>
              <TableCell className="text-center">
                <Badge className={`border-0 text-[10px] ${tepat ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                  {tepat ? 'Tepat' : 'Tidak'}
                </Badge>
              </TableCell>
              <TableCell><DeleteBtn id={e.id} onDelete={onDelete} isDeleting={deletingId === e.id} /></TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

/* ── APD ─────────────────────────────────────────────────────── */
function ApdTable({
  entries,
  onUpdate,
  onDelete,
  deletingId,
  selection,
}: {
  entries: ApdEntry[];
  onUpdate: (id: string, data: Partial<IndicatorEntry>) => Promise<void>;
  onDelete: (id: string) => void;
  deletingId: string | null;
  selection: SelectionProps;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="border-border hover:bg-transparent">
          <SelectHeaderCell selection={selection} />
          <TableHead className="text-muted-foreground text-[10px] w-10">No</TableHead>
          <TableHead className="text-muted-foreground text-[10px]">Tanggal</TableHead>
          <TableHead className="text-muted-foreground text-[10px]">Ruangan</TableHead>
          <TableHead className="text-muted-foreground text-[10px]">Petugas</TableHead>
          <TableHead className="text-muted-foreground text-[10px]">Ya / Tidak</TableHead>
          <TableHead className="text-muted-foreground text-[10px] w-10" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((e, idx) => (
          <TableRow key={e.id} className={`border-border/50 hover:bg-muted/50 table-row-accent ${selection.selectedIds.has(e.id) ? 'bg-[#4f8ef7]/5' : ''}`}>
            <SelectRowCell id={e.id} selection={selection} />
            <TableCell className="text-muted-foreground text-xs">{idx + 1}</TableCell>
            <TableCell>
              <CellInput value={e.date} onChange={(v) => onUpdate(e.id, { date: v })} type="date" className="w-[130px]" />
            </TableCell>
            <TableCell>
              <span className="text-xs text-foreground/70 px-1">{e.room || '—'}</span>
            </TableCell>
            <TableCell>
              <CellInput value={e.staff} onChange={(v) => onUpdate(e.id, { staff: v } as Partial<ApdEntry>)} placeholder="Petugas" />
            </TableCell>
            <TableCell>
              <RadioGroup
                value={e.comp}
                onValueChange={(v) => onUpdate(e.id, { comp: v } as Partial<ApdEntry>)}
                className="flex items-center gap-3"
              >
                <div className="flex items-center gap-1">
                  <RadioGroupItem value="ya" id={`ya-${e.id}`} className="size-3" />
                  <label htmlFor={`ya-${e.id}`} className="text-[10px] text-muted-foreground">Ya</label>
                </div>
                <div className="flex items-center gap-1">
                  <RadioGroupItem value="tidak" id={`tdk-${e.id}`} className="size-3" />
                  <label htmlFor={`tdk-${e.id}`} className="text-[10px] text-muted-foreground">Tidak</label>
                </div>
              </RadioGroup>
            </TableCell>
            <TableCell><DeleteBtn id={e.id} onDelete={onDelete} isDeleting={deletingId === e.id} /></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/* ── JATUH ───────────────────────────────────────────────────── */
function JatuhTable({
  entries,
  onUpdate,
  onDelete,
  deletingId,
  selection,
}: {
  entries: JatuhEntry[];
  onUpdate: (id: string, data: Partial<IndicatorEntry>) => Promise<void>;
  onDelete: (id: string) => void;
  deletingId: string | null;
  selection: SelectionProps;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="border-border hover:bg-transparent">
          <SelectHeaderCell selection={selection} />
          <TableHead className="text-muted-foreground text-[10px] w-10">No</TableHead>
          <TableHead className="text-muted-foreground text-[10px]">Tanggal</TableHead>
          <TableHead className="text-muted-foreground text-[10px]">No RM</TableHead>
          <TableHead className="text-muted-foreground text-[10px] text-center">Assess. Awal</TableHead>
          <TableHead className="text-muted-foreground text-[10px] text-center">Reassessment</TableHead>
          <TableHead className="text-muted-foreground text-[10px] text-center">Intervensi</TableHead>
          <TableHead className="text-muted-foreground text-[10px] text-center">Pencegahan Cedera</TableHead>
          <TableHead className="text-muted-foreground text-[10px] text-center">Patuh?</TableHead>
          <TableHead className="text-muted-foreground text-[10px] w-10" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((e, idx) => {
          const patuh = e.awal && e.re && e.inv && e.cedera;
          return (
            <TableRow key={e.id} className={`border-border/50 hover:bg-muted/50 table-row-accent ${selection.selectedIds.has(e.id) ? 'bg-[#4f8ef7]/5' : ''}`}>
              <SelectRowCell id={e.id} selection={selection} />
              <TableCell className="text-muted-foreground text-xs">{idx + 1}</TableCell>
              <TableCell>
                <CellInput value={e.date} onChange={(v) => onUpdate(e.id, { date: v })} type="date" className="w-[130px]" />
              </TableCell>
              <TableCell>
                <CellInput value={e.rm} onChange={(v) => onUpdate(e.id, { rm: v } as Partial<JatuhEntry>)} placeholder="No RM" />
              </TableCell>
              <TableCell className="text-center"><CellCheckbox checked={e.awal} onCheckedChange={(v) => onUpdate(e.id, { awal: v } as Partial<JatuhEntry>)} /></TableCell>
              <TableCell className="text-center"><CellCheckbox checked={e.re} onCheckedChange={(v) => onUpdate(e.id, { re: v } as Partial<JatuhEntry>)} /></TableCell>
              <TableCell className="text-center"><CellCheckbox checked={e.inv} onCheckedChange={(v) => onUpdate(e.id, { inv: v } as Partial<JatuhEntry>)} /></TableCell>
              <TableCell className="text-center"><CellCheckbox checked={e.cedera} onCheckedChange={(v) => onUpdate(e.id, { cedera: v } as Partial<JatuhEntry>)} /></TableCell>
              <TableCell className="text-center">
                <Badge className={`border-0 text-[10px] ${patuh ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                  {patuh ? 'Patuh' : 'Tidak'}
                </Badge>
              </TableCell>
              <TableCell><DeleteBtn id={e.id} onDelete={onDelete} isDeleting={deletingId === e.id} /></TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

/* ── SC ──────────────────────────────────────────────────────── */
function ScTable({
  entries,
  onUpdate,
  onDelete,
  deletingId,
  selection,
}: {
  entries: ScEntry[];
  onUpdate: (id: string, data: Partial<IndicatorEntry>) => Promise<void>;
  onDelete: (id: string) => void;
  deletingId: string | null;
  selection: SelectionProps;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="border-border hover:bg-transparent">
          <SelectHeaderCell selection={selection} />
          <TableHead className="text-muted-foreground text-[10px] w-10">No</TableHead>
          <TableHead className="text-muted-foreground text-[10px]">Tanggal</TableHead>
          <TableHead className="text-muted-foreground text-[10px]">No RM</TableHead>
          <TableHead className="text-muted-foreground text-[10px]">Diagnosis</TableHead>
          <TableHead className="text-muted-foreground text-[10px] text-center">≤30 Menit</TableHead>
          <TableHead className="text-muted-foreground text-[10px] w-10" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((e, idx) => (
          <TableRow key={e.id} className={`border-border/50 hover:bg-muted/50 table-row-accent ${selection.selectedIds.has(e.id) ? 'bg-[#4f8ef7]/5' : ''}`}>
            <SelectRowCell id={e.id} selection={selection} />
            <TableCell className="text-muted-foreground text-xs">{idx + 1}</TableCell>
            <TableCell>
              <CellInput value={e.date} onChange={(v) => onUpdate(e.id, { date: v })} type="date" className="w-[130px]" />
            </TableCell>
            <TableCell>
              <CellInput value={e.rm} onChange={(v) => onUpdate(e.id, { rm: v } as Partial<ScEntry>)} placeholder="No RM" />
            </TableCell>
            <TableCell>
              <CellInput value={e.diag} onChange={(v) => onUpdate(e.id, { diag: v } as Partial<ScEntry>)} placeholder="Diagnosis" />
            </TableCell>
            <TableCell className="text-center"><CellCheckbox checked={e.ok} onCheckedChange={(v) => onUpdate(e.id, { ok: v } as Partial<ScEntry>)} /></TableCell>
            <TableCell><DeleteBtn id={e.id} onDelete={onDelete} isDeleting={deletingId === e.id} /></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/* ── WTRJ ────────────────────────────────────────────────────── */
function WtrjTable({
  entries,
  onUpdate,
  onDelete,
  deletingId,
  selection,
}: {
  entries: WtrjEntry[];
  onUpdate: (id: string, data: Partial<IndicatorEntry>) => Promise<void>;
  onDelete: (id: string) => void;
  deletingId: string | null;
  selection: SelectionProps;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="border-border hover:bg-transparent">
          <SelectHeaderCell selection={selection} />
          <TableHead className="text-muted-foreground text-[10px] w-10">No</TableHead>
          <TableHead className="text-muted-foreground text-[10px]">Tanggal</TableHead>
          <TableHead className="text-muted-foreground text-[10px]">No RM</TableHead>
          <TableHead className="text-muted-foreground text-[10px]">Dokter/Poli</TableHead>
          <TableHead className="text-muted-foreground text-[10px]">Pendaftaran</TableHead>
          <TableHead className="text-muted-foreground text-[10px]">Dilayani</TableHead>
          <TableHead className="text-muted-foreground text-[10px] text-center">Selisih</TableHead>
          <TableHead className="text-muted-foreground text-[10px] text-center">&gt;60 Mnt</TableHead>
          <TableHead className="text-muted-foreground text-[10px] w-10" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((e, idx) => {
          const selisih = timeDiffMinutes(e.t1, e.t2);
          return (
            <TableRow key={e.id} className={`border-border/50 hover:bg-muted/50 table-row-accent ${selection.selectedIds.has(e.id) ? 'bg-[#4f8ef7]/5' : ''}`}>
              <SelectRowCell id={e.id} selection={selection} />
              <TableCell className="text-muted-foreground text-xs">{idx + 1}</TableCell>
              <TableCell>
                <CellInput value={e.date} onChange={(v) => onUpdate(e.id, { date: v })} type="date" className="w-[130px]" />
              </TableCell>
              <TableCell>
                <CellInput value={e.rm} onChange={(v) => onUpdate(e.id, { rm: v } as Partial<WtrjEntry>)} placeholder="No RM" />
              </TableCell>
              <TableCell>
                <CellInput value={e.doc} onChange={(v) => onUpdate(e.id, { doc: v } as Partial<WtrjEntry>)} placeholder="Dokter/Poli" />
              </TableCell>
              <TableCell>
                <CellInput value={e.t1} onChange={(v) => {
                  const selisih = timeDiffMinutes(v, e.t2);
                  onUpdate(e.id, { t1: v, st_checked: selisih > 60 } as Partial<WtrjEntry>);
                }} type="time" className="w-[110px]" />
              </TableCell>
              <TableCell>
                <CellInput value={e.t2} onChange={(v) => {
                  const selisih = timeDiffMinutes(e.t1, v);
                  onUpdate(e.id, { t2: v, st_checked: selisih > 60 } as Partial<WtrjEntry>);
                }} type="time" className="w-[110px]" />
              </TableCell>
              <TableCell className="text-center text-xs text-foreground/60">{selisih} mnt</TableCell>
              <TableCell className="text-center">
                <Badge className={`border-0 text-[10px] ${e.st_checked ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                  {e.st_checked ? 'Ya' : 'Tidak'}
                </Badge>
              </TableCell>
              <TableCell><DeleteBtn id={e.id} onDelete={onDelete} isDeleting={deletingId === e.id} /></TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

/* ── OP ──────────────────────────────────────────────────────── */
function OpTable({
  entries,
  onUpdate,
  onDelete,
  deletingId,
  selection,
}: {
  entries: OpEntry[];
  onUpdate: (id: string, data: Partial<IndicatorEntry>) => Promise<void>;
  onDelete: (id: string) => void;
  deletingId: string | null;
  selection: SelectionProps;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="border-border hover:bg-transparent">
          <SelectHeaderCell selection={selection} />
          <TableHead className="text-muted-foreground text-[10px] w-10">No</TableHead>
          <TableHead className="text-muted-foreground text-[10px]">Tanggal</TableHead>
          <TableHead className="text-muted-foreground text-[10px]">No RM/Nama</TableHead>
          <TableHead className="text-muted-foreground text-[10px]">Jadwal</TableHead>
          <TableHead className="text-muted-foreground text-[10px]">Aktual</TableHead>
          <TableHead className="text-muted-foreground text-[10px] text-center">Selisih</TableHead>
          <TableHead className="text-muted-foreground text-[10px] text-center">Tertunda</TableHead>
          <TableHead className="text-muted-foreground text-[10px]">Alasan</TableHead>
          <TableHead className="text-muted-foreground text-[10px] w-10" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((e, idx) => {
          const selisih = timeDiffMinutes(e.t1, e.t2);
          return (
            <TableRow key={e.id} className={`border-border/50 hover:bg-muted/50 table-row-accent ${selection.selectedIds.has(e.id) ? 'bg-[#4f8ef7]/5' : ''}`}>
              <SelectRowCell id={e.id} selection={selection} />
              <TableCell className="text-muted-foreground text-xs">{idx + 1}</TableCell>
              <TableCell>
                <CellInput value={e.date} onChange={(v) => onUpdate(e.id, { date: v })} type="date" className="w-[130px]" />
              </TableCell>
              <TableCell>
                <CellInput value={e.rm} onChange={(v) => onUpdate(e.id, { rm: v } as Partial<OpEntry>)} placeholder="No RM/Nama" />
              </TableCell>
              <TableCell>
                <CellInput value={e.t1} onChange={(v) => onUpdate(e.id, { t1: v } as Partial<OpEntry>)} type="time" className="w-[110px]" />
              </TableCell>
              <TableCell>
                <CellInput value={e.t2} onChange={(v) => onUpdate(e.id, { t2: v } as Partial<OpEntry>)} type="time" className="w-[110px]" />
              </TableCell>
              <TableCell className="text-center text-xs text-foreground/60">{selisih} mnt</TableCell>
              <TableCell className="text-center"><CellCheckbox checked={e.tertunda} onCheckedChange={(v) => onUpdate(e.id, { tertunda: v } as Partial<OpEntry>)} /></TableCell>
              <TableCell>
                <CellInput value={e.r} onChange={(v) => onUpdate(e.id, { r: v } as Partial<OpEntry>)} placeholder="Alasan" />
              </TableCell>
              <TableCell><DeleteBtn id={e.id} onDelete={onDelete} isDeleting={deletingId === e.id} /></TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

/* ── LAB ─────────────────────────────────────────────────────── */
function LabTable({
  entries,
  onUpdate,
  onDelete,
  deletingId,
  selection,
}: {
  entries: LabEntry[];
  onUpdate: (id: string, data: Partial<IndicatorEntry>) => Promise<void>;
  onDelete: (id: string) => void;
  deletingId: string | null;
  selection: SelectionProps;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="border-border hover:bg-transparent">
          <SelectHeaderCell selection={selection} />
          <TableHead className="text-muted-foreground text-[10px] w-10">No</TableHead>
          <TableHead className="text-muted-foreground text-[10px]">Tanggal</TableHead>
          <TableHead className="text-muted-foreground text-[10px]">No RM</TableHead>
          <TableHead className="text-muted-foreground text-[10px]">Pemeriksaan</TableHead>
          <TableHead className="text-muted-foreground text-[10px]">Keluar Hasil</TableHead>
          <TableHead className="text-muted-foreground text-[10px]">Diterima</TableHead>
          <TableHead className="text-muted-foreground text-[10px] text-center">≤30 Mnt</TableHead>
          <TableHead className="text-muted-foreground text-[10px] w-10" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((e, idx) => (
          <TableRow key={e.id} className={`border-border/50 hover:bg-muted/50 table-row-accent ${selection.selectedIds.has(e.id) ? 'bg-[#4f8ef7]/5' : ''}`}>
            <SelectRowCell id={e.id} selection={selection} />
            <TableCell className="text-muted-foreground text-xs">{idx + 1}</TableCell>
            <TableCell>
              <CellInput value={e.date} onChange={(v) => onUpdate(e.id, { date: v })} type="date" className="w-[130px]" />
            </TableCell>
            <TableCell>
              <CellInput value={e.rm} onChange={(v) => onUpdate(e.id, { rm: v } as Partial<LabEntry>)} placeholder="No RM" />
            </TableCell>
            <TableCell>
              <CellInput value={e.exam} onChange={(v) => onUpdate(e.id, { exam: v } as Partial<LabEntry>)} placeholder="Pemeriksaan" />
            </TableCell>
            <TableCell>
              <CellInput value={e.t1} onChange={(v) => onUpdate(e.id, { t1: v } as Partial<LabEntry>)} type="time" className="w-[110px]" />
            </TableCell>
            <TableCell>
              <CellInput value={e.t2} onChange={(v) => onUpdate(e.id, { t2: v } as Partial<LabEntry>)} type="time" className="w-[110px]" />
            </TableCell>
            <TableCell className="text-center"><CellCheckbox checked={e.num} onCheckedChange={(v) => onUpdate(e.id, { num: v } as Partial<LabEntry>)} /></TableCell>
            <TableCell><DeleteBtn id={e.id} onDelete={onDelete} isDeleting={deletingId === e.id} /></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/* ── FORNAS ──────────────────────────────────────────────────── */
function FornasTable({
  entries,
  onUpdate,
  onDelete,
  deletingId,
  selection,
}: {
  entries: FornasEntry[];
  onUpdate: (id: string, data: Partial<IndicatorEntry>) => Promise<void>;
  onDelete: (id: string) => void;
  deletingId: string | null;
  selection: SelectionProps;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="border-border hover:bg-transparent">
          <SelectHeaderCell selection={selection} />
          <TableHead className="text-muted-foreground text-[10px] w-10">No</TableHead>
          <TableHead className="text-muted-foreground text-[10px]">Tanggal</TableHead>
          <TableHead className="text-muted-foreground text-[10px] text-center">R/Sesuai</TableHead>
          <TableHead className="text-muted-foreground text-[10px] text-center">R/Tidak Sesuai</TableHead>
          <TableHead className="text-muted-foreground text-[10px]">Keterangan</TableHead>
          <TableHead className="text-muted-foreground text-[10px] w-10" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((e, idx) => (
          <TableRow key={e.id} className={`border-border/50 hover:bg-muted/50 table-row-accent ${selection.selectedIds.has(e.id) ? 'bg-[#4f8ef7]/5' : ''}`}>
            <SelectRowCell id={e.id} selection={selection} />
            <TableCell className="text-muted-foreground text-xs">{idx + 1}</TableCell>
            <TableCell>
              <CellInput value={e.date} onChange={(v) => onUpdate(e.id, { date: v })} type="date" className="w-[130px]" />
            </TableCell>
            <TableCell className="text-center">
              <CellInput value={e.num} onChange={(v) => onUpdate(e.id, { num: Number(v) || 0 } as Partial<FornasEntry>)} type="number" className="w-16 text-center" />
            </TableCell>
            <TableCell className="text-center">
              <CellInput value={e.non} onChange={(v) => onUpdate(e.id, { non: Number(v) || 0 } as Partial<FornasEntry>)} type="number" className="w-16 text-center" />
            </TableCell>
            <TableCell>
              <CellInput value={e.note} onChange={(v) => onUpdate(e.id, { note: v } as Partial<FornasEntry>)} placeholder="Keterangan" />
            </TableCell>
            <TableCell><DeleteBtn id={e.id} onDelete={onDelete} isDeleting={deletingId === e.id} /></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/* ── CP ──────────────────────────────────────────────────────── */
function CpTable({
  entries,
  onUpdate,
  onDelete,
  deletingId,
  selection,
}: {
  entries: CpEntry[];
  onUpdate: (id: string, data: Partial<IndicatorEntry>) => Promise<void>;
  onDelete: (id: string) => void;
  deletingId: string | null;
  selection: SelectionProps;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="border-border hover:bg-transparent">
          <SelectHeaderCell selection={selection} />
          <TableHead className="text-muted-foreground text-[10px] w-10">No</TableHead>
          <TableHead className="text-muted-foreground text-[10px]">Tanggal</TableHead>
          <TableHead className="text-muted-foreground text-[10px]">Nama Pasien</TableHead>
          <TableHead className="text-muted-foreground text-[10px]">No RM</TableHead>
          <TableHead className="text-muted-foreground text-[10px]">Diagnosis</TableHead>
          <TableHead className="text-muted-foreground text-[10px] text-center">Var Terapi</TableHead>
          <TableHead className="text-muted-foreground text-[10px] text-center">Var Lab</TableHead>
          <TableHead className="text-muted-foreground text-[10px] text-center">Var Rad</TableHead>
          <TableHead className="text-muted-foreground text-[10px] text-center">Var Lain</TableHead>
          <TableHead className="text-muted-foreground text-[10px]">Perawat</TableHead>
          <TableHead className="text-muted-foreground text-[10px]">Farmasi</TableHead>
          <TableHead className="text-muted-foreground text-[10px]">Gizi</TableHead>
          <TableHead className="text-muted-foreground text-[10px]">Patuh PPA</TableHead>
          <TableHead className="text-muted-foreground text-[10px] w-10" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((e, idx) => {
          const totalVar = e.vTerapi + e.vLab + e.vRad + e.vLain;
          const patuhPPA = totalVar === 0 && e.perawat === 'Ya' && e.farmasi === 'Ya' && e.gizi === 'Ya';
          return (
            <TableRow key={e.id} className={`border-border/50 hover:bg-muted/50 table-row-accent ${selection.selectedIds.has(e.id) ? 'bg-[#4f8ef7]/5' : ''}`}>
              <SelectRowCell id={e.id} selection={selection} />
              <TableCell className="text-muted-foreground text-xs">{idx + 1}</TableCell>
              <TableCell>
                <CellInput value={e.date} onChange={(v) => onUpdate(e.id, { date: v })} type="date" className="w-[130px]" />
              </TableCell>
              <TableCell>
                <CellInput value={e.name} onChange={(v) => onUpdate(e.id, { name: v } as Partial<CpEntry>)} placeholder="Nama" />
              </TableCell>
              <TableCell>
                <CellInput value={e.rm} onChange={(v) => onUpdate(e.id, { rm: v } as Partial<CpEntry>)} placeholder="No RM" />
              </TableCell>
              <TableCell>
                <CellInput value={e.diag} onChange={(v) => onUpdate(e.id, { diag: v } as Partial<CpEntry>)} placeholder="Diagnosis" />
              </TableCell>
              <TableCell className="text-center">
                <CellInput value={e.vTerapi} onChange={(v) => onUpdate(e.id, { vTerapi: Number(v) || 0 } as Partial<CpEntry>)} type="number" className="w-14 text-center" />
              </TableCell>
              <TableCell className="text-center">
                <CellInput value={e.vLab} onChange={(v) => onUpdate(e.id, { vLab: Number(v) || 0 } as Partial<CpEntry>)} type="number" className="w-14 text-center" />
              </TableCell>
              <TableCell className="text-center">
                <CellInput value={e.vRad} onChange={(v) => onUpdate(e.id, { vRad: Number(v) || 0 } as Partial<CpEntry>)} type="number" className="w-14 text-center" />
              </TableCell>
              <TableCell className="text-center">
                <CellInput value={e.vLain} onChange={(v) => onUpdate(e.id, { vLain: Number(v) || 0 } as Partial<CpEntry>)} type="number" className="w-14 text-center" />
              </TableCell>
              <TableCell>
                <Select value={e.perawat} onValueChange={(v) => onUpdate(e.id, { perawat: v } as Partial<CpEntry>)}>
                  <SelectTrigger className="h-7 bg-muted/50 border-border text-foreground/80 text-xs w-[80px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    <SelectItem value="Ya" className="text-foreground/70 text-xs">Ya</SelectItem>
                    <SelectItem value="Tidak" className="text-foreground/70 text-xs">Tidak</SelectItem>
                    <SelectItem value="Sebagian" className="text-foreground/70 text-xs">Sebagian</SelectItem>
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                <Select value={e.farmasi} onValueChange={(v) => onUpdate(e.id, { farmasi: v } as Partial<CpEntry>)}>
                  <SelectTrigger className="h-7 bg-muted/50 border-border text-foreground/80 text-xs w-[80px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    <SelectItem value="Ya" className="text-foreground/70 text-xs">Ya</SelectItem>
                    <SelectItem value="Tidak" className="text-foreground/70 text-xs">Tidak</SelectItem>
                    <SelectItem value="Sebagian" className="text-foreground/70 text-xs">Sebagian</SelectItem>
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                <Select value={e.gizi} onValueChange={(v) => onUpdate(e.id, { gizi: v } as Partial<CpEntry>)}>
                  <SelectTrigger className="h-7 bg-muted/50 border-border text-foreground/80 text-xs w-[80px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    <SelectItem value="Ya" className="text-foreground/70 text-xs">Ya</SelectItem>
                    <SelectItem value="Tidak" className="text-foreground/70 text-xs">Tidak</SelectItem>
                    <SelectItem value="Sebagian" className="text-foreground/70 text-xs">Sebagian</SelectItem>
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell className="text-center">
                <Badge className={`border-0 text-[10px] ${patuhPPA ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                  {patuhPPA ? 'Patuh' : 'Tidak'}
                </Badge>
              </TableCell>
              <TableCell><DeleteBtn id={e.id} onDelete={onDelete} isDeleting={deletingId === e.id} /></TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
