'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Plus, Loader2, ChevronLeft, ChevronRight, Pencil, ShieldAlert } from 'lucide-react';
import {
  type UimuProposal, type UimuFilters, type UimuStatus,
  UIMU_STATUS_LABEL, UIMU_STATUS_COLOR, PRIORITY_CATEGORY_LABEL, PRIORITY_CATEGORY_COLOR,
  computeUimuPriority,
} from '@/types/uimu';
import { getUimuProposals, subscribeToUimuProposals } from '@/lib/uimuData';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale/id';

const PAGE_SIZE = 15;

type ListMode = 'mine' | 'review_unit' | 'telaah_mutu' | 'approval';

const MODE_META: Record<ListMode, { title: string; description: string; statusFilter?: UimuStatus }> = {
  mine: {
    title: 'Daftar Usulan Saya',
    description: 'Seluruh usulan indikator mutu unit yang pernah Anda buat, termasuk draft yang belum dikirim.',
  },
  review_unit: {
    title: 'Review Kepala Unit / PJ Mutu',
    description: 'Usulan yang menunggu review awal Kepala Unit/PJ Mutu sebelum diteruskan ke Komite Mutu.',
    statusFilter: 'review_unit',
  },
  telaah_mutu: {
    title: 'Telaah Komite/Departemen Mutu',
    description: 'Usulan yang sudah lolos review unit dan menunggu telaah kelayakan oleh Komite/Departemen Mutu.',
    statusFilter: 'telaah_mutu',
  },
  approval: {
    title: 'Persetujuan & Penetapan',
    description: 'Usulan yang sudah disetujui Komite Mutu — siap untuk persetujuan akhir/penetapan resmi.',
    statusFilter: 'disetujui',
  },
};

function StatusBadge({ status }: { status: UimuStatus }) {
  return (
    <Badge variant="outline" style={{ borderColor: UIMU_STATUS_COLOR[status], color: UIMU_STATUS_COLOR[status] }} className="text-[10px]">
      {UIMU_STATUS_LABEL[status]}
    </Badge>
  );
}

function PriorityBadge({ totalScore }: { totalScore: number | null }) {
  const cat = computeUimuPriority(totalScore);
  if (!totalScore) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <Badge variant="outline" style={{ borderColor: PRIORITY_CATEGORY_COLOR[cat], color: PRIORITY_CATEGORY_COLOR[cat] }} className="text-[10px]">
      {PRIORITY_CATEGORY_LABEL[cat]} ({totalScore})
    </Badge>
  );
}

interface UimuListProps {
  userId: string;
  mode: ListMode;
  canReview?: boolean;
  onSelect: (id: string) => void;
  onCreateNew: () => void;
  onEditDraft?: (id: string) => void;
}

export function UimuList({ userId, mode, canReview, onSelect, onCreateNew, onEditDraft }: UimuListProps) {
  const [rows, setRows] = useState<UimuProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<UimuStatus | 'all'>('all');
  const [page, setPage] = useState(0);
  const meta = MODE_META[mode];

  async function load() {
    setLoading(true);
    try {
      const filters: UimuFilters = meta.statusFilter ? { status: meta.statusFilter } : {};
      const data = await getUimuProposals(filters);
      setRows(mode === 'mine' ? data.filter((r) => r.createdBy === userId || r.proposerId === userId) : data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const unsub = subscribeToUimuProposals(() => load());
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const filtered = useMemo(() => {
    let list = rows;
    if (mode === 'mine' && statusFilter !== 'all') list = list.filter((r) => r.status === statusFilter);
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter((r) =>
      r.proposalNumber.toLowerCase().includes(q) ||
      (r.indicatorName ?? '').toLowerCase().includes(q) ||
      (r.proposerName ?? '').toLowerCase().includes(q) ||
      (r.unitNameSnapshot ?? '').toLowerCase().includes(q)
    );
  }, [rows, search, statusFilter, mode]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  useEffect(() => setPage(0), [search, statusFilter, mode]);

  if (mode !== 'mine' && canReview === false) {
    return (
      <div className="p-4">
        <Card>
          <CardContent className="py-16 flex flex-col items-center gap-2 text-center">
            <ShieldAlert className="size-8 text-muted-foreground" />
            <p className="text-sm font-medium">Anda tidak memiliki hak akses ke halaman ini.</p>
            <p className="text-xs text-muted-foreground max-w-sm">Hanya Kepala Unit/PJ Mutu, Komite Mutu, Manajemen, atau Administrator yang dapat mengakses menu review/telaah/persetujuan.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">{meta.title}</h2>
          <p className="text-xs text-muted-foreground mt-0.5 max-w-2xl">{meta.description}</p>
        </div>
        {mode === 'mine' && (
          <Button size="sm" onClick={onCreateNew} className="gap-1.5">
            <Plus className="size-4" /> Buat Usulan
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input placeholder="Cari nomor usulan, indikator, pengusul, unit…" className="pl-8 h-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {mode === 'mine' && (
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
            <SelectTrigger className="w-[170px] h-9"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Status</SelectItem>
              {Object.entries(UIMU_STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>No. Usulan</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Nama Indikator</TableHead>
                  <TableHead>Jenis</TableHead>
                  <TableHead>Prioritas</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tanggal</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((r) => (
                  <TableRow key={r.id} className="cursor-pointer hover:bg-muted/40" onClick={() => onSelect(r.id)}>
                    <TableCell className="font-mono text-xs">{r.proposalNumber}</TableCell>
                    <TableCell>{r.unitNameSnapshot ?? '—'}</TableCell>
                    <TableCell className="max-w-[220px] truncate">{r.indicatorName || <span className="text-muted-foreground">(Belum diisi)</span>}</TableCell>
                    <TableCell className="text-xs uppercase">{r.indicatorCategory ?? '—'}</TableCell>
                    <TableCell><PriorityBadge totalScore={r.totalScore} /></TableCell>
                    <TableCell><StatusBadge status={r.status} /></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{format(new Date(r.createdAt), 'd MMM yyyy', { locale: idLocale })}</TableCell>
                    <TableCell>
                      {mode === 'mine' && r.status === 'draft' && onEditDraft && (
                        <Button size="icon" variant="ghost" className="size-7" onClick={(e) => { e.stopPropagation(); onEditDraft(r.id); }}>
                          <Pencil className="size-3.5" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {pageRows.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-10">Tidak ada usulan ditemukan.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Halaman {page + 1} dari {totalPages} · {filtered.length} usulan</span>
          <div className="flex items-center gap-1">
            <Button size="icon" variant="outline" className="size-7" disabled={page === 0} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="size-3.5" /></Button>
            <Button size="icon" variant="outline" className="size-7" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}><ChevronRight className="size-3.5" /></Button>
          </div>
        </div>
      )}
    </div>
  );
}
