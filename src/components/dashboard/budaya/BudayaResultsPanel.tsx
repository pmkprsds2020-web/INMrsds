'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, ArrowUpDown, ShieldCheck, AlertTriangle } from 'lucide-react';
import {
  getBudayaSurveys, getBudayaSurveyById, getBudayaPeriodResult, getBudayaDimensionResults,
  getBudayaDimensions, getBudayaResponseStats, runBudayaQualityCheck, finalizeBudayaSurvey,
} from '@/lib/budayaData';
import {
  BUDAYA_CATEGORY_LABEL, BUDAYA_CATEGORY_COLOR, BUDAYA_SURVEY_STATUS_LABEL,
  type BudayaSurvey, type BudayaDimensionResult, type BudayaDimension, type BudayaQualityIssue,
} from '@/types/budaya';

export function BudayaResultsPanel({
  surveyId, canReview, userId, onSelectSurvey, onNavigate,
}: {
  surveyId?: string;
  canReview: boolean;
  userId: string;
  onSelectSurvey: (id: string) => void;
  onNavigate: (tab: string) => void;
}) {
  const [surveys, setSurveys] = useState<BudayaSurvey[]>([]);
  const [selected, setSelected] = useState<string | undefined>(surveyId);
  const [survey, setSurvey] = useState<BudayaSurvey | null>(null);
  const [dims, setDims] = useState<BudayaDimension[]>([]);
  const [results, setResults] = useState<BudayaDimensionResult[]>([]);
  const [overall, setOverall] = useState<{ score: number | null; category: string | null } | null>(null);
  const [respondentTotal, setRespondentTotal] = useState(0);
  const [sortDesc, setSortDesc] = useState(true);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [issues, setIssues] = useState<BudayaQualityIssue[] | null>(null);
  const [finalizing, setFinalizing] = useState(false);

  useEffect(() => { getBudayaSurveys().then(setSurveys); getBudayaDimensions().then(setDims); }, []);
  useEffect(() => { if (!selected && surveys.length) setSelected(surveys[0].id); }, [surveys, selected]);

  const reload = async (id: string) => {
    setLoading(true);
    const [s, period, dimResults, stats] = await Promise.all([
      getBudayaSurveyById(id), getBudayaPeriodResult(id), getBudayaDimensionResults(id), getBudayaResponseStats(id),
    ]);
    setSurvey(s);
    setOverall(period ? { score: period.overallScore, category: period.overallCategory } : null);
    setResults(dimResults);
    setRespondentTotal(stats.completed);
    setIssues(null);
    setLoading(false);
  };

  useEffect(() => { if (selected) reload(selected); }, [selected]);

  const handleCheck = async () => {
    if (!selected) return;
    setChecking(true);
    const res = await runBudayaQualityCheck(selected);
    setIssues(res.issues);
    setChecking(false);
  };

  const handleFinalize = async () => {
    if (!selected) return;
    setFinalizing(true);
    const res = await finalizeBudayaSurvey(selected, userId);
    setIssues(res.issues);
    if (res.passed) await reload(selected);
    setFinalizing(false);
  };

  const dimName = (id: string) => dims.find((d) => d.id === id)?.name ?? id;
  const sorted = [...results].sort((a, b) => sortDesc
    ? (b.positivePercentage ?? -1) - (a.positivePercentage ?? -1)
    : (a.positivePercentage ?? -1) - (b.positivePercentage ?? -1));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Hasil Survey</h2>
      </div>

      <div className="flex flex-wrap gap-2">
        {surveys.map((s) => (
          <button
            key={s.id}
            onClick={() => { setSelected(s.id); onSelectSurvey(s.id); }}
            className={`text-sm px-3 py-1.5 rounded-md border ${selected === s.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
          >
            {s.name}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center py-16 text-muted-foreground"><Loader2 className="size-5 animate-spin mr-2" /> Memuat…</div>
      ) : survey ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="md:col-span-1">
              <CardHeader><CardTitle className="text-base">Overall Score</CardTitle></CardHeader>
              <CardContent className="text-center py-2">
                {overall?.score != null ? (
                  <>
                    <p className="text-3xl font-bold" style={{ color: BUDAYA_CATEGORY_COLOR[(overall.category as any) ?? 'sedang'] }}>{overall.score}%</p>
                    <Badge className="mt-2" style={{ backgroundColor: BUDAYA_CATEGORY_COLOR[(overall.category as any) ?? 'sedang'] }}>{BUDAYA_CATEGORY_LABEL[(overall.category as any) ?? 'sedang']}</Badge>
                  </>
                ) : <p className="text-sm text-muted-foreground">Belum difinalisasi</p>}
              </CardContent>
            </Card>
            <Card className="md:col-span-1"><CardHeader><CardTitle className="text-base">Jumlah Responden</CardTitle></CardHeader><CardContent className="text-3xl font-bold text-center py-2">{respondentTotal}</CardContent></Card>
            <Card className="md:col-span-2">
              <CardHeader><CardTitle className="text-base">Status Survey</CardTitle></CardHeader>
              <CardContent className="flex items-center justify-between">
                <Badge variant="outline">{BUDAYA_SURVEY_STATUS_LABEL[survey.status]}</Badge>
                {canReview && survey.status !== 'final' && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={handleCheck} disabled={checking}>
                      {checking && <Loader2 className="size-4 mr-1 animate-spin" />} Cek Kesiapan Data
                    </Button>
                    <Button size="sm" onClick={handleFinalize} disabled={finalizing}>
                      {finalizing && <Loader2 className="size-4 mr-1 animate-spin" />} Finalisasi Survey
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {issues && issues.length > 0 && (
            <Card className="border-amber-300">
              <CardHeader><CardTitle className="text-base flex items-center gap-2 text-amber-600"><AlertTriangle className="size-4" /> Data belum dapat difinalisasi karena terdapat masalah pada perhitungan</CardTitle></CardHeader>
              <CardContent>
                <ul className="list-disc list-inside text-sm space-y-1">
                  {issues.map((i) => <li key={i.code}>{i.message}</li>)}
                </ul>
              </CardContent>
            </Card>
          )}
          {issues && issues.length === 0 && (
            <Card className="border-emerald-300">
              <CardContent className="flex items-center gap-2 py-4 text-emerald-600 text-sm"><ShieldCheck className="size-4" /> Data lolos quality check — siap difinalisasi.</CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">12 Dimensi — Ranking</CardTitle>
              <Button size="sm" variant="ghost" onClick={() => setSortDesc((v) => !v)}><ArrowUpDown className="size-4 mr-1" /> {sortDesc ? 'Terbaik → Terburuk' : 'Terburuk → Terbaik'}</Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead><TableHead>Dimensi</TableHead><TableHead>Positif</TableHead><TableHead>Negatif</TableHead>
                    <TableHead>Netral</TableHead><TableHead>Jumlah</TableHead><TableHead>% Positif</TableHead><TableHead>Kategori</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map((r, i) => (
                    <TableRow key={r.id}>
                      <TableCell>{i + 1}</TableCell>
                      <TableCell>{dimName(r.dimensionId)}</TableCell>
                      <TableCell>{r.positiveCount}</TableCell>
                      <TableCell>{r.negativeCount}</TableCell>
                      <TableCell>{r.neutralCount}</TableCell>
                      <TableCell>{r.totalResponses}</TableCell>
                      <TableCell className="font-medium">{r.positivePercentage ?? '-'}%</TableCell>
                      <TableCell>{r.category && <Badge style={{ backgroundColor: BUDAYA_CATEGORY_COLOR[r.category] }}>{BUDAYA_CATEGORY_LABEL[r.category]}</Badge>}</TableCell>
                    </TableRow>
                  ))}
                  {sorted.length === 0 && (
                    <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Belum ada hasil — jalankan finalisasi survei.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button variant="outline" onClick={() => onNavigate('budaya-laporan')}>Buat Laporan dari Hasil Ini →</Button>
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Pilih survei untuk melihat hasil.</p>
      )}
    </div>
  );
}
