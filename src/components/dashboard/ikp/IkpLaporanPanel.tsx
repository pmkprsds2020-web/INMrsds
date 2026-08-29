'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileSpreadsheet, Printer, Loader2, FileBarChart } from 'lucide-react';
import {
  type IkpFilters, IKP_STATUS_LABEL, IKP_INCIDENT_TYPES, IKP_SEVERITY_GRADES,
} from '@/types/ikp';
import { getIkpIncidents, computeIkpDashboardStats } from '@/lib/ikpData';
import { format } from 'date-fns';

export function IkpLaporanPanel() {
  const [filters, setFilters] = useState<IkpFilters>({ dateField: 'incident' });
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getIkpIncidents(filters).then((r) => { setRows(r); setLoading(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(filters)]);

  const stats = useMemo(() => computeIkpDashboardStats(rows), [rows]);

  function exportCsv() {
    const header = ['Nomor IKP', 'Tgl Kejadian', 'Tgl Lapor', 'Unit', 'Jenis', 'Grading', 'Dampak', 'Status'];
    const lines = rows.map((r) => [
      r.reportNumber, r.incidentDate ?? '', r.reportDate ?? '', r.causingUnit ?? '',
      r.incidentType ?? '', r.severityGrade ?? '', r.patientImpact ?? '', IKP_STATUS_LABEL[r.status],
    ]);
    const csv = [header, ...lines].map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `laporan-ikp-${format(new Date(), 'yyyy-MM-dd')}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FileBarChart className="size-5 text-primary" />
          <h2 className="text-lg font-semibold">Laporan & Rekapitulasi IKP</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv}><FileSpreadsheet className="size-4 mr-1.5" />Export Excel/CSV</Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="size-4 mr-1.5" />Print</Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input type="date" className="h-9 w-[150px]" value={filters.startDate ?? ''} onChange={(e) => setFilters((f) => ({ ...f, startDate: e.target.value }))} />
        <span className="text-xs text-muted-foreground">s/d</span>
        <Input type="date" className="h-9 w-[150px]" value={filters.endDate ?? ''} onChange={(e) => setFilters((f) => ({ ...f, endDate: e.target.value }))} />
        <Select value={filters.incidentType ?? 'all'} onValueChange={(v) => setFilters((f) => ({ ...f, incidentType: v === 'all' ? undefined : (v as any) }))}>
          <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="Jenis" /></SelectTrigger>
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

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card><CardContent className="pt-6"><p className="text-2xl font-bold">{stats.total}</p><p className="text-xs text-muted-foreground">Total Laporan</p></CardContent></Card>
            <Card><CardContent className="pt-6"><p className="text-2xl font-bold">{stats.selesai}</p><p className="text-xs text-muted-foreground">Selesai</p></CardContent></Card>
            <Card><CardContent className="pt-6"><p className="text-2xl font-bold">{stats.sedangInvestigasi}</p><p className="text-xs text-muted-foreground">Investigasi</p></CardContent></Card>
            <Card><CardContent className="pt-6"><p className="text-2xl font-bold">{stats.belumDitindaklanjuti}</p><p className="text-xs text-muted-foreground">Belum Ditindaklanjuti</p></CardContent></Card>
          </div>
          <Card>
            <CardHeader><CardTitle className="text-sm">Rincian Laporan</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nomor IKP</TableHead><TableHead>Tgl Kejadian</TableHead><TableHead>Unit</TableHead>
                    <TableHead>Jenis</TableHead><TableHead>Grading</TableHead><TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">{r.reportNumber}</TableCell>
                      <TableCell className="text-xs">{r.incidentDate ?? '—'}</TableCell>
                      <TableCell className="text-xs">{r.causingUnit ?? '—'}</TableCell>
                      <TableCell className="text-xs">{r.incidentType ?? (r.reportKind === 'kpc' ? 'KPC' : '—')}</TableCell>
                      <TableCell className="text-xs">{r.severityGrade ?? '—'}</TableCell>
                      <TableCell className="text-xs">{IKP_STATUS_LABEL[r.status]}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
