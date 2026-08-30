'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ShieldCheck, ListTodo, Users, TrendingUp, Loader2, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import {
  getBudayaSurveys, getBudayaPeriodResult, getBudayaDimensionResults, getBudayaResponseStats, getBudayaDimensions,
} from '@/lib/budayaData';
import { BUDAYA_CATEGORY_LABEL, BUDAYA_CATEGORY_COLOR, type BudayaSurvey, type BudayaDimensionResult } from '@/types/budaya';

function KpiCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: number | string; color: string }) {
  return (
    <Card>
      <CardContent className="pt-6 flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-lg shrink-0" style={{ backgroundColor: `${color}20`, color }}>
          <Icon className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="text-2xl font-bold leading-none">{value}</p>
          <p className="text-xs text-muted-foreground mt-1 truncate">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function BudayaDashboardPanel({ onSelectSurvey }: { onSelectSurvey: (id: string, tab?: string) => void }) {
  const [surveys, setSurveys] = useState<BudayaSurvey[]>([]);
  const [activeSurvey, setActiveSurvey] = useState<BudayaSurvey | null>(null);
  const [overall, setOverall] = useState<{ score: number | null; category: string | null } | null>(null);
  const [dims, setDims] = useState<BudayaDimensionResult[]>([]);
  const [dimNames, setDimNames] = useState<Record<string, string>>({});
  const [stats, setStats] = useState<{ target: number; completed: number; responseRate: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const all = await getBudayaSurveys();
      if (cancelled) return;
      setSurveys(all);
      // Survei paling relevan utk overview: yang 'final' terbaru, kalau tidak ada pakai yang 'aktif' terbaru.
      const finalOnes = all.filter((s) => s.status === 'final').sort((a, b) => b.year - a.year || b.period.localeCompare(a.period));
      const activeOnes = all.filter((s) => s.status === 'aktif').sort((a, b) => b.year - a.year || b.period.localeCompare(a.period));
      const chosen = finalOnes[0] ?? activeOnes[0] ?? null;
      setActiveSurvey(chosen);

      if (chosen) {
        const [period, dimensionResults, respStats] = await Promise.all([
          getBudayaPeriodResult(chosen.id),
          getBudayaDimensionResults(chosen.id),
          getBudayaResponseStats(chosen.id),
        ]);
        if (cancelled) return;
        setOverall(period ? { score: period.overallScore, category: period.overallCategory } : null);
        setDims(dimensionResults);
        setStats({ target: respStats.target, completed: respStats.completed, responseRate: respStats.responseRate });

        const dimensions = await getBudayaDimensions();
        if (cancelled) return;
        setDimNames(Object.fromEntries(dimensions.map((d) => [d.id, d.name])));
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center py-24 text-muted-foreground"><Loader2 className="size-6 animate-spin mr-2" /> Memuat dashboard…</div>;
  }

  const sortedDims = [...dims].filter((d) => d.positivePercentage !== null).sort((a, b) => (b.positivePercentage ?? 0) - (a.positivePercentage ?? 0));
  const top5 = sortedDims.slice(0, 5);
  const bottom5 = [...sortedDims].reverse().slice(0, 5);
  const strongCount = dims.filter((d) => d.category === 'kuat').length;
  const moderateCount = dims.filter((d) => d.category === 'sedang').length;
  const weakCount = dims.filter((d) => d.category === 'lemah').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Dashboard Survey Budaya Keselamatan Pasien</h2>
          {activeSurvey && (
            <p className="text-sm text-muted-foreground">
              Menampilkan: <button className="underline underline-offset-2" onClick={() => onSelectSurvey(activeSurvey.id)}>{activeSurvey.name}</button>
              {' '}<Badge variant="outline">{activeSurvey.status}</Badge>
            </p>
          )}
        </div>
      </div>

      {!activeSurvey && (
        <Card><CardContent className="py-10 text-center text-muted-foreground">Belum ada survei aktif atau final. Buat survei baru untuk mulai.</CardContent></Card>
      )}

      {activeSurvey && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard icon={ListTodo} label="Total Survey" value={surveys.length} color="#4f8ef7" />
            <KpiCard icon={Users} label="Target Responden" value={stats?.target ?? 0} color="#8b5cf6" />
            <KpiCard icon={Users} label="Total Responden Selesai" value={stats?.completed ?? 0} color="#0ea5e9" />
            <KpiCard icon={TrendingUp} label="Response Rate" value={`${stats?.responseRate ?? 0}%`} color="#f59e0b" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="md:col-span-1">
              <CardHeader><CardTitle className="text-base">Overall Safety Culture Score</CardTitle></CardHeader>
              <CardContent>
                {overall?.score != null ? (
                  <div className="text-center py-4">
                    <p className="text-4xl font-bold" style={{ color: BUDAYA_CATEGORY_COLOR[(overall.category as any) ?? 'sedang'] }}>{overall.score}%</p>
                    <Badge className="mt-2" style={{ backgroundColor: BUDAYA_CATEGORY_COLOR[(overall.category as any) ?? 'sedang'] }}>
                      {BUDAYA_CATEGORY_LABEL[(overall.category as any) ?? 'sedang']}
                    </Badge>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-6">Survei belum difinalisasi — skor belum tersedia.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Distribusi Kategori Budaya (12 Dimensi)</CardTitle></CardHeader>
              <CardContent className="space-y-2 pt-2">
                <div className="flex items-center justify-between text-sm"><span>Budaya Kuat</span><Badge style={{ backgroundColor: BUDAYA_CATEGORY_COLOR.kuat }}>{strongCount}</Badge></div>
                <div className="flex items-center justify-between text-sm"><span>Budaya Sedang</span><Badge style={{ backgroundColor: BUDAYA_CATEGORY_COLOR.sedang }}>{moderateCount}</Badge></div>
                <div className="flex items-center justify-between text-sm"><span>Budaya Lemah</span><Badge style={{ backgroundColor: BUDAYA_CATEGORY_COLOR.lemah }}>{weakCount}</Badge></div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Butuh Intervensi</CardTitle></CardHeader>
              <CardContent className="pt-2">
                {dims.filter((d) => d.category === 'lemah' || d.category === 'sedang').length === 0 ? (
                  <p className="text-sm text-muted-foreground">Tidak ada dimensi yang perlu intervensi segera.</p>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {dims.filter((d) => d.category !== 'kuat').map((d) => (
                      <li key={d.id} className="flex justify-between">
                        <span className="truncate">{dimNames[d.dimensionId] ?? d.dimensionId}</span>
                        <span className="font-medium" style={{ color: BUDAYA_CATEGORY_COLOR[d.category ?? 'sedang'] }}>{d.positivePercentage}%</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><ArrowUpRight className="size-4 text-emerald-500" /> Top 5 Dimensi Terbaik</CardTitle></CardHeader>
              <CardContent>
                <ol className="space-y-2 text-sm list-decimal list-inside">
                  {top5.map((d) => (
                    <li key={d.id} className="flex justify-between">
                      <span className="truncate">{dimNames[d.dimensionId] ?? d.dimensionId}</span>
                      <span className="font-semibold">{d.positivePercentage}%</span>
                    </li>
                  ))}
                  {top5.length === 0 && <p className="text-muted-foreground">Belum ada data.</p>}
                </ol>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><ArrowDownRight className="size-4 text-rose-500" /> Bottom 5 Dimensi</CardTitle></CardHeader>
              <CardContent>
                <ol className="space-y-2 text-sm list-decimal list-inside">
                  {bottom5.map((d) => (
                    <li key={d.id} className="flex justify-between">
                      <span className="truncate">{dimNames[d.dimensionId] ?? d.dimensionId}</span>
                      <span className="font-semibold">{d.positivePercentage}%</span>
                    </li>
                  ))}
                  {bottom5.length === 0 && <p className="text-muted-foreground">Belum ada data.</p>}
                </ol>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
