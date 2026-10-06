'use client';

import { useEffect, useMemo, useState } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip as ChartTooltip, Legend as ChartLegend, Filler,
} from 'chart.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Award, TrendingDown } from 'lucide-react';
import { periodLabel, periodSortKey, type OppeEvaluation, type OppeDoctor, type OppeFppe } from '@/types/oppe';
import { getDoctorEvaluationHistory, getAllActiveOppeDoctors, getMyOppeDoctor, getOppeFppeList, friendlyOppeError } from '@/lib/oppeData';
import { computeTrend, fmtNum } from '@/lib/oppeScoring';
import {
  OppeLoading, OppeEmpty, OppeErrorState, OppePageHeader, OppeStatusBadge, OppeCategoryBadge, OppeTrendBadge, OppeFppeStatusBadge, type OppeMasters,
} from './OppeShared';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, ChartTooltip, ChartLegend, Filler);

const shortPeriod = (e: OppeEvaluation) => (e.periodType === 'semester_1' ? `${e.year} Semester I` : e.periodType === 'semester_2' ? `${e.year} Semester II` : e.periodType === 'tahunan' ? `${e.year} Tahunan` : periodLabel(e));

/** Grafik "Trend Skor OPPE" per dokter + label naik/stabil/turun + warning penurunan signifikan (poin 26). */
export function OppeTrendCard({ history, masters, currentId }: { history: OppeEvaluation[]; masters: OppeMasters; currentId?: string }) {
  const scored = history.filter((h) => h.finalScore !== null).sort((a, b) => periodSortKey(a) - periodSortKey(b));
  if (scored.length === 0) return <OppeEmpty title="Belum ada riwayat skor" />;
  const last = scored[scored.length - 1];
  const prev = scored[scored.length - 2];
  const t = computeTrend(last.finalScore, prev?.finalScore ?? null, masters.settings);
  const data = {
    labels: scored.map(shortPeriod),
    datasets: [
      { label: 'Skor akhir OPPE', data: scored.map((h) => h.finalScore), borderColor: '#4f8ef7', backgroundColor: '#4f8ef720', fill: true, tension: 0.25, pointRadius: scored.map((h) => (h.id === currentId ? 6 : 3)) },
      { label: masters.categories.find((c) => c.code === 'A')?.name ?? 'A', data: scored.map((h) => h.scoreProfessional), borderColor: '#14b8a6', borderDash: [4, 4], tension: 0.25, pointRadius: 2 },
      { label: masters.categories.find((c) => c.code === 'B')?.name ?? 'B', data: scored.map((h) => h.scoreDevelopment), borderColor: '#a78bfa', borderDash: [4, 4], tension: 0.25, pointRadius: 2 },
      { label: masters.categories.find((c) => c.code === 'C')?.name ?? 'C', data: scored.map((h) => h.scoreClinical), borderColor: '#f472b6', borderDash: [4, 4], tension: 0.25, pointRadius: 2 },
    ],
  };
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span>Trend terakhir: <OppeTrendBadge trend={t.trend} /></span>
        {t.diff !== null && <span className="text-xs text-muted-foreground">({t.diff > 0 ? '+' : ''}{fmtNum(t.diff)} poin dari {shortPeriod(prev!)})</span>}
        {t.significantDecline && (
          <span className="inline-flex items-center gap-1 rounded-md bg-red-500/10 px-2 py-0.5 text-xs font-semibold text-red-600"><TrendingDown className="size-3.5" />Penurunan signifikan (≥ {masters.settings.significantDrop} poin)</span>
        )}
      </div>
      <div className="h-64"><Line data={data} options={{ maintainAspectRatio: false, responsive: true, scales: { y: { min: 0, max: 100 } } }} /></div>
      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        {scored.map((h, i) => (
          <span key={h.id}>{shortPeriod(h)} → <b className="text-foreground">{fmtNum(h.finalScore)}</b>{i < scored.length - 1 ? ' ·' : ''}</span>
        ))}
      </div>
    </div>
  );
}

interface Props {
  masters: OppeMasters;
  userId: string;
  /** Mode dokter: hanya OPPE milik sendiri. */
  doctorMode: boolean;
  initialDoctorId?: string | null;
  onOpenEvaluation: (id: string) => void;
}

export function OppeResultsPanel({ masters, userId, doctorMode, initialDoctorId, onOpenEvaluation }: Props) {
  const [doctors, setDoctors] = useState<OppeDoctor[]>([]);
  const [doctorId, setDoctorId] = useState<string>(initialDoctorId ?? '');
  const [history, setHistory] = useState<OppeEvaluation[]>([]);
  const [fppe, setFppe] = useState<OppeFppe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        if (doctorMode) {
          const me = await getMyOppeDoctor(userId);
          if (me) { setDoctors([me]); setDoctorId(me.id); } else { setLoading(false); }
        } else {
          const list = await getAllActiveOppeDoctors();
          setDoctors(list);
          if (!initialDoctorId && list[0]) setDoctorId(list[0].id);
        }
      } catch (e) {
        setError(friendlyOppeError(e, 'Data dokter gagal dimuat.'));
        setLoading(false);
      }
    })();
  }, [doctorMode, userId, initialDoctorId]);

  useEffect(() => {
    if (!doctorId) return;
    setLoading(true);
    setError(null);
    Promise.all([getDoctorEvaluationHistory(doctorId), getOppeFppeList({ doctorId })])
      .then(([h, f]) => { setHistory(h); setFppe(f); })
      .catch((e) => setError(friendlyOppeError(e, 'Hasil evaluasi gagal dimuat.')))
      .finally(() => setLoading(false));
  }, [doctorId]);

  const doctor = doctors.find((d) => d.id === doctorId);
  const ordered = useMemo(() => [...history].sort((a, b) => periodSortKey(b) - periodSortKey(a)), [history]);
  const latest = ordered.find((h) => h.finalScore !== null);

  if (doctorMode && !loading && doctors.length === 0) {
    return (
      <div className="p-4">
        <OppeEmpty title="Akun Anda belum terhubung dengan data dokter OPPE" description="Minta admin/Komite Medik menghubungkan akun login Anda pada menu Data Dokter (kolom ID akun login dokter)." />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <OppePageHeader
        icon={Award}
        title={doctorMode ? 'Hasil OPPE Saya' : 'Hasil Evaluasi OPPE'}
        description={doctorMode ? 'Hasil OPPE yang sudah disetujui/final, histori, dan rekomendasi.' : 'Histori hasil OPPE per dokter, tren skor antarperiode, rekomendasi, dan FPPE.'}
        actions={!doctorMode && (
          <Select value={doctorId} onValueChange={setDoctorId}>
            <SelectTrigger className="w-[280px] h-9"><SelectValue placeholder="Pilih dokter" /></SelectTrigger>
            <SelectContent>{doctors.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}{d.ksmName ? ` — ${d.ksmName}` : ''}</SelectItem>)}</SelectContent>
          </Select>
        )}
      />

      {loading ? <OppeLoading /> : error ? <OppeErrorState message={error} /> : !doctor ? <OppeEmpty title="Pilih dokter" /> : (
        <>
          <Card>
            <CardContent className="pt-4 grid sm:grid-cols-4 gap-3 text-sm">
              <div><p className="text-[10px] uppercase text-muted-foreground">Dokter</p><p className="font-semibold">{doctor.name}{doctor.title ? `, ${doctor.title}` : ''}</p></div>
              <div><p className="text-[10px] uppercase text-muted-foreground">KSM</p><p>{doctor.ksmName ?? '—'}</p></div>
              <div><p className="text-[10px] uppercase text-muted-foreground">Hasil terakhir</p><p className="font-semibold">{latest ? `${fmtNum(latest.finalScore)} · ${latest.finalCategoryLabel ?? ''}` : '—'}</p></div>
              <div><p className="text-[10px] uppercase text-muted-foreground">Jumlah evaluasi</p><p>{history.length}</p></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Trend Skor OPPE</CardTitle></CardHeader>
            <CardContent><OppeTrendCard history={history} masters={masters} /></CardContent>
          </Card>

          {latest && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Rekomendasi Terakhir — {shortPeriod(latest)}</CardTitle></CardHeader>
              <CardContent className="text-sm whitespace-pre-line">{latest.recommendationOverride || latest.recommendation || '—'}</CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Histori Evaluasi</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Periode</TableHead><TableHead className="text-right">Perilaku</TableHead><TableHead className="text-right">Pengembangan</TableHead><TableHead className="text-right">Klinis</TableHead><TableHead className="text-right">Skor Akhir</TableHead><TableHead>Kategori</TableHead><TableHead className="text-right">Trigger</TableHead><TableHead>Trend</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {ordered.map((h) => (
                    <TableRow key={h.id} className="cursor-pointer hover:bg-muted/40" onClick={() => onOpenEvaluation(h.id)}>
                      <TableCell className="text-sm">{shortPeriod(h)}</TableCell>
                      <TableCell className="text-right">{fmtNum(h.scoreProfessional)}</TableCell>
                      <TableCell className="text-right">{fmtNum(h.scoreDevelopment)}</TableCell>
                      <TableCell className="text-right">{fmtNum(h.scoreClinical)}</TableCell>
                      <TableCell className="text-right font-semibold">{fmtNum(h.finalScore)}</TableCell>
                      <TableCell><OppeCategoryBadge code={h.finalCategory} label={h.finalCategoryLabel} categories={masters.settings.resultCategories} /></TableCell>
                      <TableCell className="text-right">{h.triggerCount}{h.criticalTriggerCount > 0 && <span className="text-red-500 text-[10px] ml-1">({h.criticalTriggerCount} kritis)</span>}</TableCell>
                      <TableCell><OppeTrendBadge trend={h.trend} /></TableCell>
                      <TableCell><OppeStatusBadge status={h.status} /></TableCell>
                    </TableRow>
                  ))}
                  {ordered.length === 0 && <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-6">Belum ada evaluasi{doctorMode ? ' yang disetujui/final' : ''}.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {fppe.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Riwayat FPPE</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {fppe.map((f) => (
                  <div key={f.id} className="flex flex-wrap items-center justify-between gap-2 rounded border p-2 text-sm">
                    <span><span className="font-mono text-xs text-muted-foreground mr-2">{f.fppeNumber}</span>{f.triggerIndicatorName ?? f.reason}</span>
                    <OppeFppeStatusBadge status={f.status} />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
