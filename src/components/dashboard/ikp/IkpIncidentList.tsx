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
import { Search, Plus, FileSpreadsheet, Printer, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  type IkpIncident, type IkpFilters,
  IKP_STATUS_LABEL, IKP_STATUS_COLOR, IKP_INCIDENT_TYPES, IKP_SEVERITY_GRADES,
} from '@/types/ikp';
import { subscribeToIkpIncidents } from '@/lib/ikpData';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale/id';

const PAGE_SIZE = 15;

function StatusBadge({ status }: { status: IkpIncident['status'] }) {
  return (
    <Badge variant="outline" style={{ borderColor: IKP_STATUS_COLOR[status], color: IKP_STATUS_COLOR[status] }} className="text-[10px]">
      {IKP_STATUS_LABEL[status]}
    </Badge>
  );
}

function SeverityDot({ grade }: { grade: IkpIncident['severityGrade'] }) {
  if (!grade) return <span className="text-muted-foreground text-xs">—</span>;
  const meta = IKP_SEVERITY_GRADES.find((g) => g.id === grade);
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span className="inline-block size-2.5 rounded-full" style={{ backgroundColor: meta?.color }} />
      {meta?.label}
    </span>
  );
}

interface IkpIncidentListProps {
  onSelect: (id: string) => void;
  onCreateNew: () => void;
}

export function IkpIncidentList({ onSelect, onCreateNew }: IkpIncidentListProps) {
  const [rows, setRows] = useState<IkpIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<IkpFilters>({});
  const [page, setPage] = useState(0);

  useEffect(() => {
    setLoading(true);
    const unsub = subscribeToIkpIncidents(filters, (data) => {
      setRows(data);
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(filters)]);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter((r) =>
      r.reportNumber.toLowerCase().includes(q) ||
      (r.incidentSummary ?? '').toLowerCase().includes(q) ||
      (r.causingUnit ?? '').toLowerCase().includes(q) ||
      (r.patientName ?? '').toLowerCase().includes(q)
    );
  }, [rows, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  useEffect(() => setPage(0), [search, filters]);

  function exportCsv() {
    const header = ['Nomor IKP', 'Tanggal Kejadian', 'Unit Penyebab', 'Jenis', 'Dampak', 'Grading', 'Status'];
    const lines = filtered.map((r) => [
      r.reportNumber, r.incidentDate ?? '', r.causingUnit ?? '', r.incidentType ?? '',
      r.patientImpact ?? '', r.severityGrade ?? '', IKP_STATUS_LABEL[r.status],
    ]);
    const csv = [header, ...lines].map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `daftar-ikp-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Daftar Insiden Keselamatan Pasien</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv}><FileSpreadsheet className="size-4 mr-1.5" />Export</Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="size-4 mr-1.5" />Print</Button>
          <Button size="sm" onClick={onCreateNew}><Plus className="size-4 mr-1.5" />Laporan Baru</Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input placeholder="Cari nomor, ringkasan, unit, pasien…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-9" />
        </div>
        <Select value={filters.status ?? 'all'} onValueChange={(v) => setFilters((f) => ({ ...f, status: v === 'all' ? undefined : (v as any) }))}>
          <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Status</SelectItem>
            {Object.entries(IKP_STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.incidentType ?? 'all'} onValueChange={(v) => setFilters((f) => ({ ...f, incidentType: v === 'all' ? undefined : (v as any) }))}>
          <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="Jenis Insiden" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Jenis</SelectItem>
            {IKP_INCIDENT_TYPES.map((t) => <SelectItem key={t.id} value={t.id}>{t.label.split(' — ')[0]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.severityGrade ?? 'all'} onValueChange={(v) => setFilters((f) => ({ ...f, severityGrade: v === 'all' ? undefined : (v as any) }))}>
          <SelectTrigger className="w-[140px] h-9"><SelectValue placeholder="Grading" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Grading</SelectItem>
            {IKP_SEVERITY_GRADES.map((g) => <SelectItem key={g.id} value={g.id}>{g.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>No</TableHead>
                  <TableHead>Nomor IKP</TableHead>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Jenis</TableHead>
                  <TableHead>Grading</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-10">Belum ada laporan.</TableCell></TableRow>
                )}
                {pageRows.map((r, i) => (
                  <TableRow key={r.id} className="cursor-pointer hover:bg-muted/40" onClick={() => onSelect(r.id)}>
                    <TableCell className="text-xs text-muted-foreground">{page * PAGE_SIZE + i + 1}</TableCell>
                    <TableCell className="font-mono text-xs font-medium">{r.reportNumber}</TableCell>
                    <TableCell className="text-xs">{r.incidentDate ? format(new Date(r.incidentDate), 'd MMM yyyy', { locale: idLocale }) : '—'}</TableCell>
                    <TableCell className="text-xs">{r.causingUnit || r.patientServiceUnit || '—'}</TableCell>
                    <TableCell className="text-xs">{r.incidentType ? IKP_INCIDENT_TYPES.find((t) => t.id === r.incidentType)?.label.split(' — ')[0] : (r.reportKind === 'kpc' ? 'KPC' : '—')}</TableCell>
                    <TableCell><SeverityDot grade={r.severityGrade} /></TableCell>
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
          <span>Halaman {page + 1} dari {totalPages} ({filtered.length} laporan)</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="size-3.5" /></Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}><ChevronRight className="size-3.5" /></Button>
          </div>
        </div>
      )}
    </div>
  );
}
