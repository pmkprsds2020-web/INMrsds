'use client';

import { useEffect, useMemo, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip as ChartTooltip, Legend as ChartLegend,
} from 'chart.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, TrendingUp } from 'lucide-react';
import { type Risk, RISK_YEARS } from '@/types/risk';
import { getRisks, compareRiskYears } from '@/lib/riskData';

ChartJS.register(CategoryScale, LinearScale, BarElement, ChartTooltip, ChartLegend);

/** Analisis Trend Risiko antar-tahun (poin 26) & indikasi risiko berulang (poin 27). */
export function RiskTrendComparisonPanel({ onSelectRisk }: { onSelectRisk?: (id: string) => void }) {
  const [allRows, setAllRows] = useState<Risk[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getRisks().then((r) => { setAllRows(r); setLoading(false); });
  }, []);

  const comparison = useMemo(() => compareRiskYears(allRows, [...RISK_YEARS]), [allRows]);

  const chartData = {
    labels: comparison.map((c) => String(c.year)),
    datasets: [
      { label: 'Risiko Baru', data: comparison.map((c) => c.risikoBaru), backgroundColor: '#38bdf8' },
      { label: 'Risiko Berulang', data: comparison.map((c) => c.risikoBerulang), backgroundColor: '#f59e0b' },
      { label: 'Risiko Ditutup/Selesai', data: comparison.map((c) => c.risikoDitutup), backgroundColor: '#22c55e' },
    ],
  };

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <TrendingUp className="size-5 text-primary" />
        <div>
          <h2 className="text-lg font-semibold">Analisis Trend Risiko Antar-Tahun</h2>
          <p className="text-xs text-muted-foreground">
            Membandingkan {RISK_YEARS[0]}–{RISK_YEARS[RISK_YEARS.length - 1]}: jumlah risiko, risiko baru vs. berulang
            (unit, risiko, dan sebab yang sama dengan tahun sebelumnya), serta risiko yang ditutup.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Perbandingan Jumlah Risiko per Tahun</CardTitle></CardHeader>
        <CardContent><div className="h-72"><Bar data={chartData} options={{ maintainAspectRatio: false, responsive: true }} /></div></CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Rincian per Tahun</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tahun</TableHead><TableHead className="text-center">Jumlah Risiko</TableHead>
                <TableHead className="text-center">Risiko Baru</TableHead><TableHead className="text-center">Risiko Berulang</TableHead>
                <TableHead className="text-center">Ditutup/Selesai</TableHead><TableHead>Unit Terbanyak</TableHead>
                <TableHead>Top Risk</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {comparison.map((c) => (
                <TableRow key={c.year}>
                  <TableCell className="font-medium">{c.year}</TableCell>
                  <TableCell className="text-center">{c.jumlahRisiko}</TableCell>
                  <TableCell className="text-center">{c.risikoBaru}</TableCell>
                  <TableCell className="text-center">
                    {c.risikoBerulang > 0 ? <Badge variant="outline" className="text-amber-600 border-amber-400">{c.risikoBerulang}</Badge> : c.risikoBerulang}
                  </TableCell>
                  <TableCell className="text-center">{c.risikoDitutup}</TableCell>
                  <TableCell className="text-xs">{c.topUnit ?? '—'}</TableCell>
                  <TableCell className="text-xs">
                    {c.topRisk ? (
                      <button className="hover:underline text-left" onClick={() => onSelectRisk?.(c.topRisk!.id)}>
                        {c.topRisk.risiko} (Skor {c.topRisk.assessment?.skorRisiko})
                      </button>
                    ) : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
