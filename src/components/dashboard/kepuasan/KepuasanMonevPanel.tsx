'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, TrendingUp } from 'lucide-react';
import { getKepuasanPeriodTrend } from '@/lib/kepuasanData';
import { formatKepuasanTarget, type KepuasanSurvey, type KepuasanPeriodResult } from '@/types/kepuasan';

export function KepuasanMonevPanel({ onSelectSurvey }: { onSelectSurvey: (id: string, tab?: string) => void }) {
  const [rows, setRows] = useState<{ survey: KepuasanSurvey; result: KepuasanPeriodResult }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getKepuasanPeriodTrend().then((r) => { setRows(r); setLoading(false); });
  }, []);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold flex items-center gap-2"><TrendingUp className="size-5" /> Monev — Trend IKM Kepuasan Pasien</h2>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="size-5 animate-spin mr-2" /> Memuat…</div>
      ) : rows.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">Belum ada survei dengan response — jalankan Dashboard survei terlebih dahulu supaya hasil terhitung.</CardContent></Card>
      ) : (
        <Card>
          <CardHeader><CardTitle className="text-base">Riwayat per Periode</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Periode/Survei</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead className="text-right">Responden</TableHead>
                    <TableHead className="text-right">NI</TableHead>
                    <TableHead className="text-right">IKM</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Mutu</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(({ survey, result }) => (
                    <TableRow key={survey.id} className="cursor-pointer hover:bg-muted/30" onClick={() => onSelectSurvey(survey.id, 'kepuasan-dashboard')}>
                      <TableCell className="font-medium">{survey.name}</TableCell>
                      <TableCell>{survey.unitId === 'all' ? 'Semua Unit' : survey.unitId}</TableCell>
                      <TableCell className="text-right">{result.totalRespondents}</TableCell>
                      <TableCell className="text-right">{result.nilaiIndeks?.toFixed(2) ?? '-'}</TableCell>
                      <TableCell className="text-right font-semibold">{result.ikm?.toFixed(2) ?? '-'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatKepuasanTarget(survey.targetValue, survey.targetOperator)}</TableCell>
                      <TableCell><Badge variant="outline">{result.grade ?? '-'} — {result.gradeLabel ?? '-'}</Badge></TableCell>
                      <TableCell>
                        {result.statusCapaian && (
                          <Badge className={result.statusCapaian === 'tercapai' ? 'bg-emerald-500/15 text-emerald-600 border-emerald-300' : 'bg-rose-500/15 text-rose-600 border-rose-300'}>
                            {result.statusCapaian === 'tercapai' ? 'Tercapai' : 'Tidak Tercapai'}
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <p className="text-xs text-muted-foreground pt-3">
              Survei yang ditautkan ke Master Indikator Mutu Custom otomatis mengirimkan baris IKM di atas sebagai data pengukuran indikator &quot;Kepuasan Pasien&quot; — lihat Monev lengkapnya di modul Indikator Mutu Custom &gt; Kepuasan Pasien.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
