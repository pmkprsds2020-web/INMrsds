'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileSpreadsheet, Printer, Loader2, FileBarChart } from 'lucide-react';
import {
  type Risk, RISK_STATUS_LABEL, RISK_LEVEL_LABEL, RISK_CATEGORIES, RISK_YEARS,
} from '@/types/risk';
import { getRisks, getAllRiskMitigations } from '@/lib/riskData';
import { format } from 'date-fns';

type ReportType =
  | 'tahunan' | 'per_unit' | 'prioritas' | 'tinggi' | 'sangat_tinggi'
  | 'belum_ditindaklanjuti' | 'melebihi_deadline' | 'residual' | 'rekap_mitigasi';

const REPORT_LABEL: Record<ReportType, string> = {
  tahunan: 'Risk Register Tahunan',
  per_unit: 'Risk Register per Unit',
  prioritas: 'Risiko Prioritas (Top Ranking)',
  tinggi: 'Risiko Tinggi',
  sangat_tinggi: 'Risiko Sangat Tinggi',
  belum_ditindaklanjuti: 'Risiko Belum Ditindaklanjuti',
  melebihi_deadline: 'Risiko Melebihi Deadline',
  residual: 'Risiko Residual',
  rekap_mitigasi: 'Rekapitulasi Mitigasi',
};

export function RiskLaporanPanel() {
  const [reportType, setReportType] = useState<ReportType>('tahunan');
  const [year, setYear] = useState<number | undefined>(new Date().getFullYear());
  const [rows, setRows] = useState<Risk[]>([]);
  const [mitigations, setMitigations] = useState<Awaited<ReturnType<typeof getAllRiskMitigations>>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([getRisks(year ? { year } : {}), getAllRiskMitigations()]).then(([r, m]) => {
      setRows(r); setMitigations(m); setLoading(false);
    });
  }, [year]);

  const filteredRows = useMemo(() => {
    switch (reportType) {
      case 'prioritas': return rows.slice(0, 10);
      case 'tinggi': return rows.filter((r) => r.assessment?.levelSkor === 'tinggi');
      case 'sangat_tinggi': return rows.filter((r) => r.assessment?.levelSkor === 'sangat_tinggi');
      case 'belum_ditindaklanjuti': return rows.filter((r) => r.status === 'draft' || r.status === 'identifikasi');
      case 'melebihi_deadline': {
        const overdueRiskIds = new Set(mitigations.filter((m) => m.status === 'terlambat').map((m) => m.riskId));
        return rows.filter((r) => overdueRiskIds.has(r.id));
      }
      default: return rows;
    }
  }, [rows, mitigations, reportType]);

  function exportCsv() {
    const header = [
      'No', 'Kode Risiko', 'Tahun', 'Unit/Lokasi', 'Risiko', 'Sebab', 'Efek/Dampak',
      'Skor Risiko', 'Level', 'Risk Owner/PIC', 'Status',
    ];
    const lines = filteredRows.map((r, i) => [
      i + 1, r.riskCode, r.riskYear, r.unitLokasi, r.risiko, r.sebabInsiden, r.efekDampak,
      r.assessment?.skorRisiko ?? '', r.assessment ? RISK_LEVEL_LABEL[r.assessment.levelSkor] : '',
      r.riskOwnerName ?? '', RISK_STATUS_LABEL[r.status],
    ]);
    const csv = [header, ...lines].map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${reportType}-risiko-${format(new Date(), 'yyyy-MM-dd')}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FileBarChart className="size-5 text-primary" />
          <h2 className="text-lg font-semibold">Laporan Risiko</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv}><FileSpreadsheet className="size-4 mr-1.5" />Export Excel</Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="size-4 mr-1.5" />Print / PDF</Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={reportType} onValueChange={(v) => setReportType(v as ReportType)}>
          <SelectTrigger className="w-[240px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>{Object.entries(REPORT_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={year ? String(year) : 'all'} onValueChange={(v) => setYear(v === 'all' ? undefined : Number(v))}>
          <SelectTrigger className="w-[130px] h-9"><SelectValue placeholder="Tahun" /></SelectTrigger>
          <SelectContent><SelectItem value="all">Semua Tahun</SelectItem>{RISK_YEARS.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">
              RISK REGISTER — {REPORT_LABEL[reportType].toUpperCase()} {year ? `TAHUN ${year}` : ''}
            </CardTitle>
            <p className="text-xs text-muted-foreground">{filteredRows.length} risiko ditemukan</p>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>No</TableHead><TableHead>Lokasi</TableHead><TableHead>Risiko</TableHead>
                  <TableHead>Sebab Insiden/Kejadian</TableHead><TableHead>Efek/Dampak</TableHead>
                  <TableHead className="text-center">Skor Risiko</TableHead><TableHead>Rangking Risiko</TableHead>
                  <TableHead>Pengelolaan Risiko</TableHead><TableHead>Risk Owner/PIC</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.map((r, i) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs">{i + 1}</TableCell>
                    <TableCell className="text-xs">{r.unitLokasi}</TableCell>
                    <TableCell className="text-xs max-w-[180px]">{r.risiko}</TableCell>
                    <TableCell className="text-xs max-w-[220px]">{r.sebabInsiden}</TableCell>
                    <TableCell className="text-xs max-w-[180px]">{r.efekDampak}</TableCell>
                    <TableCell className="text-center text-xs font-semibold">{r.assessment?.skorRisiko ?? '—'}</TableCell>
                    <TableCell className="text-xs">#{i + 1}</TableCell>
                    <TableCell className="text-xs max-w-[200px]">
                      {mitigations.find((m) => m.riskId === r.id)?.rencanaTindakan ?? '—'}
                    </TableCell>
                    <TableCell className="text-xs">{r.riskOwnerName ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
