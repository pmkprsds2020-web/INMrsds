'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, FileDown, Plus } from 'lucide-react';
import {
  getBudayaSurveys, getBudayaSurveyById, getBudayaDimensionResults, getBudayaDimensions, getBudayaPeriodResult,
  getBudayaReports, createBudayaReport, advanceBudayaReportStatus, getBudayaResponseStats,
} from '@/lib/budayaData';
import {
  BUDAYA_CATEGORY_LABEL, BUDAYA_REPORT_STATUS_LABEL, type BudayaSurvey, type BudayaDimensionResult, type BudayaDimension, type BudayaReport,
} from '@/types/budaya';

const STATUS_FLOW: BudayaReport['status'][] = ['draft', 'diperiksa_komite', 'disetujui_manajemen', 'final'];

export function BudayaLaporanPanel({
  surveyId, userId, userName, canReview, onSelectSurvey,
}: {
  surveyId?: string; userId: string; userName: string; canReview: boolean; onSelectSurvey: (id: string) => void;
}) {
  void userName;
  const [surveys, setSurveys] = useState<BudayaSurvey[]>([]);
  const [selected, setSelected] = useState<string | undefined>(surveyId);
  const [survey, setSurvey] = useState<BudayaSurvey | null>(null);
  const [dims, setDims] = useState<BudayaDimension[]>([]);
  const [results, setResults] = useState<BudayaDimensionResult[]>([]);
  const [reports, setReports] = useState<BudayaReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => { getBudayaSurveys().then(setSurveys); getBudayaDimensions().then(setDims); }, []);
  useEffect(() => { if (!selected && surveys.length) setSelected(surveys[0].id); }, [surveys, selected]);

  const reload = async (id: string) => {
    setLoading(true);
    const [s, r, rep] = await Promise.all([getBudayaSurveyById(id), getBudayaDimensionResults(id), getBudayaReports(id)]);
    setSurvey(s); setResults(r); setReports(rep); setLoading(false);
  };
  useEffect(() => { if (selected) reload(selected); }, [selected]);

  const dimName = (id: string) => dims.find((d) => d.id === id)?.name ?? id;

  const handleGenerate = async () => {
    if (!selected || !survey) return;
    setGenerating(true);
    const period = await getBudayaPeriodResult(selected);
    const stats = await getBudayaResponseStats(selected);
    const strongest = [...results].filter((r) => r.positivePercentage != null).sort((a, b) => (b.positivePercentage ?? 0) - (a.positivePercentage ?? 0)).slice(0, 3);
    const weakest = [...results].filter((r) => r.positivePercentage != null).sort((a, b) => (a.positivePercentage ?? 0) - (b.positivePercentage ?? 0)).slice(0, 3);
    const summary = [
      `Hasil survey menunjukkan overall budaya keselamatan sebesar ${period?.overallScore ?? '-'}% (${period?.overallCategory ? BUDAYA_CATEGORY_LABEL[period.overallCategory] : '-'}), dengan ${stats.completed} responden (response rate ${stats.responseRate}%).`,
      '',
      'Dimensi terkuat:',
      ...strongest.map((r, i) => `${i + 1}. ${dimName(r.dimensionId)} (${r.positivePercentage}%)`),
      '',
      'Dimensi yang membutuhkan perhatian:',
      ...weakest.map((r, i) => `${i + 1}. ${dimName(r.dimensionId)} (${r.positivePercentage}%)`),
    ].join('\n');
    await createBudayaReport(selected, 'survey', summary, userId);
    setReports(await getBudayaReports(selected));
    setGenerating(false);
  };

  const nextStatus = (s: BudayaReport['status']) => STATUS_FLOW[Math.min(STATUS_FLOW.indexOf(s) + 1, STATUS_FLOW.length - 1)];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Laporan</h2>
        {canReview && selected && (
          <Button size="sm" onClick={handleGenerate} disabled={generating || results.length === 0}>
            {generating ? <Loader2 className="size-4 mr-1 animate-spin" /> : <Plus className="size-4 mr-1" />} Buat Laporan dari Hasil
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {surveys.map((s) => (
          <button key={s.id} onClick={() => { setSelected(s.id); onSelectSurvey(s.id); }}
            className={`text-sm px-3 py-1.5 rounded-md border ${selected === s.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>
            {s.name}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center py-16 text-muted-foreground"><Loader2 className="size-5 animate-spin mr-2" /> Memuat…</div>
      ) : results.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">Hasil belum tersedia — finalisasi survei dulu di menu Hasil Survey.</CardContent></Card>
      ) : (
        <>
          <Card>
            <CardHeader><CardTitle className="text-base">Tabel Hasil 12 Dimensi</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow><TableHead>No</TableHead><TableHead>Dimensi</TableHead><TableHead>Positif</TableHead><TableHead>Negatif</TableHead><TableHead>Netral</TableHead><TableHead>Jumlah</TableHead><TableHead>% Positif</TableHead><TableHead>Kategori</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((r, i) => (
                    <TableRow key={r.id}>
                      <TableCell>{i + 1}</TableCell><TableCell>{dimName(r.dimensionId)}</TableCell>
                      <TableCell>{r.positiveCount}</TableCell><TableCell>{r.negativeCount}</TableCell><TableCell>{r.neutralCount}</TableCell>
                      <TableCell>{r.totalResponses}</TableCell><TableCell>{r.positivePercentage}%</TableCell>
                      <TableCell>{r.category && BUDAYA_CATEGORY_LABEL[r.category]}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Riwayat Laporan & Approval</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {reports.length === 0 && <p className="text-sm text-muted-foreground">Belum ada laporan dibuat.</p>}
              {reports.map((rep) => (
                <div key={rep.id} className="border rounded-md p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline">{BUDAYA_REPORT_STATUS_LABEL[rep.status]}</Badge>
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost"><FileDown className="size-4 mr-1" /> Export</Button>
                      {canReview && rep.status !== 'final' && (
                        <Button size="sm" variant="outline" onClick={async () => { await advanceBudayaReportStatus(rep.id, nextStatus(rep.status), userId); reload(selected!); }}>
                          Lanjutkan ke &quot;{BUDAYA_REPORT_STATUS_LABEL[nextStatus(rep.status)]}&quot;
                        </Button>
                      )}
                    </div>
                  </div>
                  <pre className="text-xs whitespace-pre-wrap font-sans text-muted-foreground">{rep.contentSummary}</pre>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
