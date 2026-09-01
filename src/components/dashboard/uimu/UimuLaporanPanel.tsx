'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileSpreadsheet, Printer, Loader2, FileBarChart } from 'lucide-react';
import {
  type UimuProposal, type UimuUnit, type UimuStatus,
  UIMU_STATUS_LABEL, INDICATOR_CATEGORY_OPTIONS,
} from '@/types/uimu';
import { getUimuProposals, getUimuUnits } from '@/lib/uimuData';

const CURRENT_YEAR = new Date().getFullYear();

function exportCsv(filename: string, header: string[], rows: (string | number)[][]) {
  const csv = [header, ...rows].map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function UimuLaporanPanel() {
  const [year, setYear] = useState<number | 'all'>(CURRENT_YEAR);
  const [unitId, setUnitId] = useState<string>('all');
  const [status, setStatus] = useState<UimuStatus | 'all'>('all');
  const [rows, setRows] = useState<UimuProposal[]>([]);
  const [units, setUnits] = useState<UimuUnit[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [proposals, unitList] = await Promise.all([
        getUimuProposals({
          periodYear: year === 'all' ? undefined : year,
          unitId: unitId === 'all' ? undefined : unitId,
          status: status === 'all' ? undefined : status,
        }),
        getUimuUnits(true),
      ]);
      setRows(proposals);
      setUnits(unitList);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [year, unitId, status]);

  const establishedRows = useMemo(() => rows.filter((r) => ['ditetapkan', 'aktif'].includes(r.status)), [rows]);

  const yearlyComparison = useMemo(() => {
    const years = Array.from(new Set(rows.map((r) => r.periodYear))).sort();
    return years.map((y) => ({
      year: y,
      total: rows.filter((r) => r.periodYear === y).length,
      ditetapkan: rows.filter((r) => r.periodYear === y && ['ditetapkan', 'aktif'].includes(r.status)).length,
    }));
  }, [rows]);

  const yearOptions = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - 3 + i);

  return (
    <div className="p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold flex items-center gap-2"><FileBarChart className="size-4" /> Laporan Usulan Indikator Mutu Unit</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={String(year)} onValueChange={(v) => setYear(v === 'all' ? 'all' : Number(v))}>
            <SelectTrigger className="w-[120px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Tahun</SelectItem>
              {yearOptions.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={unitId} onValueChange={setUnitId}>
            <SelectTrigger className="w-[180px] h-9"><SelectValue placeholder="Unit" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Unit</SelectItem>
              {units.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={(v) => setStatus(v as any)}>
            <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Status</SelectItem>
              {Object.entries(UIMU_STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm">A. Rekap Usulan Indikator Mutu Unit ({rows.length})</CardTitle>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => exportCsv('rekap-usulan-uimu.csv',
                  ['No. Usulan', 'Unit', 'Nama Indikator', 'Jenis', 'Status', 'Tahun', 'Tanggal'],
                  rows.map((r) => [r.proposalNumber, r.unitNameSnapshot ?? '', r.indicatorName ?? '', r.indicatorCategory ?? '', UIMU_STATUS_LABEL[r.status], r.periodYear, r.createdAt.slice(0, 10)]))}>
                  <FileSpreadsheet className="size-3.5" /> Excel
                </Button>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => window.print()}><Printer className="size-3.5" /> Cetak</Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow><TableHead>No. Usulan</TableHead><TableHead>Unit</TableHead><TableHead>Nama Indikator</TableHead><TableHead>Jenis</TableHead><TableHead>Status</TableHead><TableHead>Tahun</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">{r.proposalNumber}</TableCell>
                      <TableCell>{r.unitNameSnapshot ?? '—'}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{r.indicatorName ?? '—'}</TableCell>
                      <TableCell className="text-xs uppercase">{INDICATOR_CATEGORY_OPTIONS.find((o) => o.value === r.indicatorCategory)?.label ?? '—'}</TableCell>
                      <TableCell>{UIMU_STATUS_LABEL[r.status]}</TableCell>
                      <TableCell>{r.periodYear}</TableCell>
                    </TableRow>
                  ))}
                  {rows.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Tidak ada data.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm">B. Laporan Penetapan Indikator ({establishedRows.length})</CardTitle>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => exportCsv('penetapan-indikator-uimu.csv',
                ['No. Usulan', 'Unit', 'Nama Indikator', 'Definisi Operasional', 'Numerator', 'Denominator', 'Formula', 'Target', 'Frekuensi', 'PIC', 'No. Penetapan', 'Tanggal Penetapan'],
                establishedRows.map((r) => [r.proposalNumber, r.unitNameSnapshot ?? '', r.indicatorName ?? '', r.operationalDefinition ?? '', r.numerator ?? '', r.denominator ?? '', r.formula ?? '', `${r.targetValue ?? ''} ${r.targetUnit ?? ''}`, r.collectionFrequency ?? '', r.picName ?? '', r.decreeNumber ?? '', r.establishedDate ?? '']))}>
                <FileSpreadsheet className="size-3.5" /> Excel
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow><TableHead>No. Usulan</TableHead><TableHead>Nama Indikator</TableHead><TableHead>Target</TableHead><TableHead>PIC</TableHead><TableHead>No. Penetapan</TableHead><TableHead>Tgl. Penetapan</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {establishedRows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">{r.proposalNumber}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{r.indicatorName ?? '—'}</TableCell>
                      <TableCell>{r.targetValue ?? '—'} {r.targetUnit ?? ''}</TableCell>
                      <TableCell>{r.picName ?? '—'}</TableCell>
                      <TableCell>{r.decreeNumber ?? '—'}</TableCell>
                      <TableCell>{r.establishedDate ?? '—'}</TableCell>
                    </TableRow>
                  ))}
                  {establishedRows.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Belum ada indikator ditetapkan pada filter ini.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm">D. Laporan Tahunan (Perbandingan Antar Tahun)</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Tahun</TableHead><TableHead className="text-right">Total Usulan</TableHead><TableHead className="text-right">Ditetapkan/Aktif</TableHead></TableRow></TableHeader>
                <TableBody>
                  {yearlyComparison.map((y) => (
                    <TableRow key={y.year}><TableCell>{y.year}</TableCell><TableCell className="text-right">{y.total}</TableCell><TableCell className="text-right">{y.ditetapkan}</TableCell></TableRow>
                  ))}
                  {yearlyComparison.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">Tidak ada data.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
