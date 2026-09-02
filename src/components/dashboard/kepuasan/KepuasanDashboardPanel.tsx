'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, RefreshCcw, Users, Gauge, Award, Target } from 'lucide-react';
import { getKepuasanSurveys, getKepuasanPeriodResult, getKepuasanUnitBreakdown, recomputeKepuasanPeriodResult } from '@/lib/kepuasanData';
import { KEPUASAN_UNSUR_FIELDS, KEPUASAN_UNSUR_LABEL, formatKepuasanTarget, type KepuasanSurvey, type KepuasanPeriodResult } from '@/types/kepuasan';

function StatCard({ icon: Icon, label, value, sub }: { icon: any; label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><Icon className="size-3.5" /> {label}</div>
        <div className="text-2xl font-semibold">{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function UnsurBars({ result }: { result: KepuasanPeriodResult }) {
  const rows = KEPUASAN_UNSUR_FIELDS.map((f) => ({ field: f, label: KEPUASAN_UNSUR_LABEL[f], value: result.unsurAverages[f] ?? 0 }));
  const max = 4;
  const highest = rows.reduce((a, b) => (b.value > a.value ? b : a), rows[0]);
  const lowest = rows.reduce((a, b) => (b.value < a.value ? b : a), rows[0]);
  return (
    <div className="space-y-3">
      <div className="flex gap-2 text-xs">
        <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-300">Tertinggi: {highest?.label} ({highest?.value.toFixed(2)})</Badge>
        <Badge className="bg-amber-500/15 text-amber-600 border-amber-300">Terendah: {lowest?.label} ({lowest?.value.toFixed(2)})</Badge>
      </div>
      {rows.map((r) => (
        <div key={r.field} className="space-y-1">
          <div className="flex justify-between text-sm"><span>{r.label}</span><span className="font-medium">{r.value.toFixed(2)}</span></div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(100, (r.value / max) * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function KepuasanDashboardPanel({ surveyId: initialSurveyId, userId, onSelectSurvey }: { surveyId?: string; userId: string; onSelectSurvey: (id: string, tab?: string) => void }) {
  void onSelectSurvey;
  const [surveys, setSurveys] = useState<KepuasanSurvey[]>([]);
  const [selected, setSelected] = useState<string | undefined>(initialSurveyId);
  const [result, setResult] = useState<KepuasanPeriodResult | null>(null);
  const [unitBreakdown, setUnitBreakdown] = useState<KepuasanPeriodResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [survey, setSurvey] = useState<KepuasanSurvey | null>(null);

  useEffect(() => {
    getKepuasanSurveys().then((all) => {
      setSurveys(all);
      if (!selected && all.length > 0) setSelected(initialSurveyId ?? all[0].id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = async (id: string) => {
    setLoading(true);
    try {
      const s = (await getKepuasanSurveys()).find((x) => x.id === id) ?? null;
      setSurvey(s);
      const r = await recomputeKepuasanPeriodResult(id, userId);
      setResult(r);
      if (s?.unitId === 'all') setUnitBreakdown(await getKepuasanUnitBreakdown(id));
      else setUnitBreakdown([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selected) load(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-xl font-semibold">Dashboard Survey Kepuasan Pasien</h2>
        <div className="flex items-center gap-2">
          {surveys.length > 0 && (
            <Select value={selected} onValueChange={setSelected}>
              <SelectTrigger className="w-64"><SelectValue placeholder="Pilih survei" /></SelectTrigger>
              <SelectContent>
                {surveys.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Button size="sm" variant="outline" disabled={!selected || loading} onClick={() => selected && load(selected)}>
            {loading ? <Loader2 className="size-4 mr-1 animate-spin" /> : <RefreshCcw className="size-4 mr-1" />} Refresh
          </Button>
        </div>
      </div>

      {!selected && <Card><CardContent className="py-10 text-center text-muted-foreground">Belum ada survei. Buat survei baru terlebih dahulu.</CardContent></Card>}

      {selected && survey && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard icon={Users} label="Total Responden" value={String(result?.totalRespondents ?? 0)} />
            <StatCard icon={Gauge} label="Nilai Indeks (NI)" value={result?.nilaiIndeks?.toFixed(4) ?? '-'} />
            <StatCard icon={Award} label="IKM / Nilai Konversi" value={result?.ikm?.toFixed(2) ?? '-'} sub={result?.grade ? `Mutu ${result.grade} — ${result.gradeLabel}` : undefined} />
            <StatCard icon={Target} label="Target" value={formatKepuasanTarget(survey.targetValue, survey.targetOperator)} sub={result?.statusCapaian ? (result.statusCapaian === 'tercapai' ? 'TERCAPAI' : 'TIDAK TERCAPAI') : undefined} />
          </div>

          {result && result.totalRespondents > 0 ? (
            <Card>
              <CardHeader><CardTitle className="text-base">Nilai per Unsur Pelayanan</CardTitle></CardHeader>
              <CardContent><UnsurBars result={result} /></CardContent>
            </Card>
          ) : (
            <Card><CardContent className="py-10 text-center text-muted-foreground">Belum ada response untuk survei ini.</CardContent></Card>
          )}

          {unitBreakdown.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Hasil per Unit (survei &quot;Semua Unit&quot;)</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {unitBreakdown.map((u) => (
                  <div key={u.unitId} className="flex items-center justify-between text-sm border-b last:border-0 pb-2 last:pb-0">
                    <span>{u.unitId}</span>
                    <span className="text-muted-foreground">{u.totalRespondents} responden</span>
                    <span className="font-medium">IKM {u.ikm?.toFixed(2) ?? '-'}</span>
                    <Badge variant="outline">{u.grade ?? '-'}</Badge>
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
