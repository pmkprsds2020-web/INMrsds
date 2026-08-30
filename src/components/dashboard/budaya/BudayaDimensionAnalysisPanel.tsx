'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { Loader2, ChevronDown } from 'lucide-react';
import { getBudayaSurveys, getBudayaDimensionResults, getBudayaDimensions } from '@/lib/budayaData';
import { BUDAYA_CATEGORY_LABEL, BUDAYA_CATEGORY_COLOR, type BudayaSurvey, type BudayaDimensionResult, type BudayaDimension } from '@/types/budaya';

export function BudayaDimensionAnalysisPanel({ surveyId, onSelectSurvey }: { surveyId?: string; onSelectSurvey: (id: string) => void }) {
  const [surveys, setSurveys] = useState<BudayaSurvey[]>([]);
  const [selected, setSelected] = useState<string | undefined>(surveyId);
  const [dims, setDims] = useState<BudayaDimension[]>([]);
  const [results, setResults] = useState<BudayaDimensionResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => { getBudayaSurveys().then(setSurveys); getBudayaDimensions().then(setDims); }, []);
  useEffect(() => { if (!selected && surveys.length) setSelected(surveys[0].id); }, [surveys, selected]);
  useEffect(() => {
    if (!selected) return;
    setLoading(true);
    getBudayaDimensionResults(selected).then((r) => { setResults(r); setLoading(false); });
  }, [selected]);

  const dim = (id: string) => dims.find((d) => d.id === id);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Analisis Dimensi</h2>
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
        <Card><CardContent className="py-10 text-center text-muted-foreground">Belum ada hasil untuk survei ini — jalankan finalisasi di menu Hasil Survey.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {results.map((r) => {
            const d = dim(r.dimensionId);
            const isOpen = openId === r.id;
            return (
              <Card key={r.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">{d?.name ?? r.dimensionId}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-1 max-w-xl">{d?.description}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold">{r.positivePercentage ?? '-'}%</span>
                      {r.category && <Badge style={{ backgroundColor: BUDAYA_CATEGORY_COLOR[r.category] }}>{BUDAYA_CATEGORY_LABEL[r.category]}</Badge>}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Collapsible open={isOpen} onOpenChange={(o) => setOpenId(o ? r.id : null)}>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-xs"><ChevronDown className={`size-3.5 mr-1 transition-transform ${isOpen ? 'rotate-180' : ''}`} /> Lihat Detail Perhitungan</Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2 text-sm bg-muted/40 rounded-md p-3 font-mono">
                      Positive = {r.positiveCount}<br />
                      Negative = {r.negativeCount}<br />
                      Neutral = {r.neutralCount}<br />
                      Total = {r.totalResponses}<br /><br />
                      {r.positiveCount} / {r.totalResponses} × 100 = {r.positivePercentage}%<br /><br />
                      Category: {r.category ? BUDAYA_CATEGORY_LABEL[r.category] : '-'}
                    </CollapsibleContent>
                  </Collapsible>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
