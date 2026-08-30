'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Plus, FileSpreadsheet, Printer, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  type Risk, type RiskFilters,
  RISK_STATUS_LABEL, RISK_STATUS_COLOR, RISK_LEVEL_LABEL, RISK_LEVEL_COLOR,
  RISK_CATEGORIES, RISK_UNITS, RISK_YEARS,
} from '@/types/risk';
import { subscribeToRisks } from '@/lib/riskData';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale/id';

const PAGE_SIZE = 15;

function StatusBadge({ status }: { status: Risk['status'] }) {
  return (
    <Badge variant="outline" style={{ borderColor: RISK_STATUS_COLOR[status], color: RISK_STATUS_COLOR[status] }} className="text-[10px]">
      {RISK_STATUS_LABEL[status]}
    </Badge>
  );
}

function LevelBadge({ level }: { level?: string | null }) {
  if (!level) return <span className="text-muted-foreground text-xs">—</span>;
  const label = RISK_LEVEL_LABEL[level as keyof typeof RISK_LEVEL_LABEL] ?? level;
  const color = RISK_LEVEL_COLOR[level as keyof typeof RISK_LEVEL_COLOR] ?? '#94a3b8';
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium" style={{ color }}>
      <span className="inline-block size-2.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

interface RiskRegisterListProps {
  onSelect: (id: string) => void;
  onCreateNew: () => void;
}

export function RiskRegisterList({ onSelect, onCreateNew }: RiskRegisterListProps) {
  const [rows, setRows] = useState<Risk[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<RiskFilters>({});
  const [page, setPage] = useState(0);

  useEffect(() => {
    setLoading(true);
    const unsub = subscribeToRisks(filters, (data) => { setRows(data); setLoading(false); }, () => setLoading(false));
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(filters)]);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter((r) =>
      r.riskCode.toLowerCase().includes(q) ||
      r.risiko.toLowerCase().includes(q) ||
      r.unitLokasi.toLowerCase().includes(q) ||
      (r.riskOwnerName ?? '').toLowerCase().includes(q)
    );
  }, [rows, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  useEffect(() => setPage(0), [search, filters]);

  // Ranking (poin 13) sudah diurutkan oleh subscribeToRisks/getRisks — dipakai langsung sebagai nomor rangking.

  function exportCsv() {
    const header = [
      'No', 'Kode Risiko', 'Tahun', 'Tanggal Identifikasi', 'Unit/Lokasi', 'Kategori', 'Risiko',
      'Sebab Insiden/Kejadian', 'Efek/Dampak', 'Dampak', 'Probabilitas', 'Controllability',
      'Skor Risiko', 'Level Risiko', 'Rangking', 'Risk Owner/PIC', 'Status',
    ];
    const lines = filtered.map((r, i) => [
      i + 1, r.riskCode, r.riskYear, r.identifiedDate, r.unitLokasi,
      RISK_CATEGORIES.find((c) => c.id === r.category)?.label ?? r.category,
      r.risiko, r.sebabInsiden, r.efekDampak,
      r.assessment?.dampak ?? '', r.assessment?.probabilitas ?? '', r.assessment?.controllability ?? '',
      r.assessment?.skorRisiko ?? '', r.assessment ? RISK_LEVEL_LABEL[r.assessment.levelSkor] : '',
      i + 1, r.riskOwnerName ?? '', RISK_STATUS_LABEL[r.status],
    ]);
    const csv = [header, ...lines].map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `risk-register-${filters.year ?? 'semua-tahun'}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Risk Register</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv}><FileSpreadsheet className="size-4 mr-1.5" />Export Excel</Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="size-4 mr-1.5" />Print / PDF</Button>
          <Button size="sm" onClick={onCreateNew}><Plus className="size-4 mr-1.5" />Tambah Risiko</Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input placeholder="Cari kode, risiko, unit, PIC…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-9" />
        </div>
        <Select value={filters.year ? String(filters.year) : 'all'} onValueChange={(v) => setFilters((f) => ({ ...f, year: v === 'all' ? undefined : Number(v) }))}>
          <SelectTrigger className="w-[130px] h-9"><SelectValue placeholder="Tahun" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Tahun</SelectItem>
            {RISK_YEARS.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.unit ?? 'all'} onValueChange={(v) => setFilters((f) => ({ ...f, unit: v === 'all' ? undefined : v }))}>
          <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="Unit" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Unit</SelectItem>
            {RISK_UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.level ?? 'all'} onValueChange={(v) => setFilters((f) => ({ ...f, level: v === 'all' ? undefined : (v as any) }))}>
          <SelectTrigger className="w-[150px] h-9"><SelectValue placeholder="Level Risiko" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Level</SelectItem>
            {Object.entries(RISK_LEVEL_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.status ?? 'all'} onValueChange={(v) => setFilters((f) => ({ ...f, status: v === 'all' ? undefined : (v as any) }))}>
          <SelectTrigger className="w-[150px] h-9"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Status</SelectItem>
            {Object.entries(RISK_STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rangking</TableHead>
                  <TableHead>Kode Risiko</TableHead>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Unit/Lokasi</TableHead>
                  <TableHead>Risiko</TableHead>
                  <TableHead>Risk Owner/PIC</TableHead>
                  <TableHead className="text-center">Skor Risiko</TableHead>
                  <TableHead>Level Risiko</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.length === 0 && (
                  <TableRow><TableCell colSpan={10} className="text-center text-sm text-muted-foreground py-10">Belum ada risiko yang diidentifikasi.</TableCell></TableRow>
                )}
                {pageRows.map((r, i) => (
                  <TableRow key={r.id} className="cursor-pointer hover:bg-muted/40" onClick={() => onSelect(r.id)}>
                    <TableCell className="text-xs text-muted-foreground">#{page * PAGE_SIZE + i + 1}</TableCell>
                    <TableCell className="font-mono text-xs font-medium">{r.riskCode}</TableCell>
                    <TableCell className="text-xs">{format(new Date(r.identifiedDate), 'd MMM yyyy', { locale: idLocale })}</TableCell>
                    <TableCell className="text-xs">{r.unitLokasi}</TableCell>
                    <TableCell className="text-xs max-w-[220px] truncate" title={r.risiko}>{r.risiko}</TableCell>
                    <TableCell className="text-xs">{r.riskOwnerName || '—'}</TableCell>
                    <TableCell className="text-center text-xs font-semibold">{r.assessment?.skorRisiko ?? '—'}</TableCell>
                    <TableCell><LevelBadge level={r.assessment?.levelSkor} /></TableCell>
                    <TableCell><StatusBadge status={r.status} /></TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onSelect(r.id); }}>Lihat</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Halaman {page + 1} dari {totalPages} ({filtered.length} risiko)</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="size-3.5" /></Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}><ChevronRight className="size-3.5" /></Button>
          </div>
        </div>
      )}
    </div>
  );
}
