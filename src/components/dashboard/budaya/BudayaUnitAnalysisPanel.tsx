'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { getBudayaSurveys, getBudayaUnitHeatmap } from '@/lib/budayaData';
import { BUDAYA_CATEGORY_COLOR, type BudayaSurvey, type BudayaUnit, type BudayaDimension, type BudayaUnitResult } from '@/types/budaya';

export function BudayaUnitAnalysisPanel({ surveyId, onSelectSurvey }: { surveyId?: string; onSelectSurvey: (id: string) => void }) {
  const [surveys, setSurveys] = useState<BudayaSurvey[]>([]);
  const [selected, setSelected] = useState<string | undefined>(surveyId);
  const [units, setUnits] = useState<BudayaUnit[]>([]);
  const [dims, setDims] = useState<BudayaDimension[]>([]);
  const [cells, setCells] = useState<Map<string, BudayaUnitResult>>(new Map());
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => { getBudayaSurveys().then(setSurveys); }, []);
  useEffect(() => { if (!selected && surveys.length) setSelected(surveys[0].id); }, [surveys, selected]);
  useEffect(() => {
    if (!selected) return;
    setLoading(true);
    getBudayaUnitHeatmap(selected).then((h) => {
      setUnits(h.units); setDims(h.dimensions); setCells(h.cells); setHidden(h.hiddenUnitIds); setLoading(false);
    });
  }, [selected]);

  const visibleUnits = units.filter((u) => !hidden.has(u.id) && [...cells.keys()].some((k) => k.startsWith(`${u.id}:`)));

  const cellColor = (pct: number | null | undefined) => {
    if (pct == null) return '#e2e8f0';
    if (pct > 75) return BUDAYA_CATEGORY_COLOR.kuat;
    if (pct >= 50) return BUDAYA_CATEGORY_COLOR.sedang;
    return BUDAYA_CATEGORY_COLOR.lemah;
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Analisis Unit</h2>
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
      ) : (
        <Card>
          <CardHeader><CardTitle className="text-base">Heatmap Unit × Dimensi</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            {visibleUnits.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Belum ada data unit yang memenuhi ambang minimum responden untuk survei ini.</p>
            ) : (
              <table className="text-xs border-collapse w-full">
                <thead>
                  <tr>
                    <th className="text-left p-2 sticky left-0 bg-background">Unit</th>
                    {dims.map((d) => <th key={d.id} className="p-1 font-medium text-center w-16" title={d.name}>{d.code}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {visibleUnits.map((u) => (
                    <tr key={u.id}>
                      <td className="p-2 sticky left-0 bg-background font-medium whitespace-nowrap">{u.name}</td>
                      {dims.map((d) => {
                        const cell = cells.get(`${u.id}:${d.id}`);
                        const pct = cell?.positivePercentage ?? null;
                        return (
                          <td key={d.id} className="p-1 text-center">
                            <div className="rounded size-12 flex items-center justify-center text-white font-semibold mx-auto" style={{ backgroundColor: cellColor(pct) }}>
                              {pct != null ? `${pct}%` : '-'}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {hidden.size > 0 && (
              <p className="text-xs text-muted-foreground mt-3">
                {hidden.size} unit tidak ditampilkan karena jumlah responden belum memenuhi batas minimum anonimitas.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
