'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { getBudayaSurveys, getBudayaRespondents, getBudayaResponseStats, getBudayaUnits } from '@/lib/budayaData';
import type { BudayaSurvey, BudayaRespondent, BudayaUnit } from '@/types/budaya';

export function BudayaRespondentsPanel({ surveyId, onSelectSurvey }: { surveyId?: string; onSelectSurvey: (id: string) => void }) {
  const [surveys, setSurveys] = useState<BudayaSurvey[]>([]);
  const [selected, setSelected] = useState<string | undefined>(surveyId);
  const [respondents, setRespondents] = useState<BudayaRespondent[]>([]);
  const [units, setUnits] = useState<BudayaUnit[]>([]);
  const [stats, setStats] = useState<{ target: number; started: number; completed: number; incomplete: number; responseRate: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { getBudayaSurveys().then(setSurveys); getBudayaUnits().then(setUnits); }, []);
  useEffect(() => { if (!selected && surveys.length) setSelected(surveys[0].id); }, [surveys, selected]);
  useEffect(() => {
    if (!selected) return;
    setLoading(true);
    Promise.all([getBudayaRespondents(selected), getBudayaResponseStats(selected)]).then(([r, s]) => {
      setRespondents(r); setStats(s); setLoading(false);
    });
  }, [selected]);

  const unitName = (id: string | null) => units.find((u) => u.id === id)?.name ?? '-';
  const byUnit = units.map((u) => ({
    unit: u,
    total: respondents.filter((r) => r.unitId === u.id).length,
    completed: respondents.filter((r) => r.unitId === u.id && r.status === 'completed').length,
  })).filter((x) => x.total > 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Responden</h2>
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
      ) : selected && stats ? (
        <>
          <Card>
            <CardHeader><CardTitle className="text-base">Response Rate</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-4 gap-4 text-center text-sm">
                <div><p className="text-2xl font-bold">{stats.target}</p><p className="text-muted-foreground">Target</p></div>
                <div><p className="text-2xl font-bold">{stats.started}</p><p className="text-muted-foreground">Started</p></div>
                <div><p className="text-2xl font-bold">{stats.completed}</p><p className="text-muted-foreground">Completed</p></div>
                <div><p className="text-2xl font-bold">{stats.incomplete}</p><p className="text-muted-foreground">Incomplete</p></div>
              </div>
              <Progress value={Math.min(stats.responseRate, 100)} />
              <p className="text-sm text-right font-medium">{stats.responseRate}%</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Progres per Unit</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {byUnit.length === 0 && <p className="text-sm text-muted-foreground">Belum ada data per unit.</p>}
              {byUnit.map(({ unit, total, completed }) => (
                <div key={unit.id} className="flex items-center gap-3 text-sm">
                  <span className="w-40 truncate">{unit.name}</span>
                  <Progress value={total > 0 ? (completed / total) * 100 : 0} className="flex-1" />
                  <span className="w-16 text-right text-muted-foreground">{completed}/{total}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Status Pengisian</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1">
                {respondents.map((r) => (
                  <Badge key={r.id} variant="outline" title={unitName(r.unitId)}>
                    {r.status === 'completed' ? '✓' : r.status === 'in_progress' ? '…' : '·'}
                  </Badge>
                ))}
                {respondents.length === 0 && <p className="text-sm text-muted-foreground">Belum ada responden.</p>}
              </div>
              <p className="text-xs text-muted-foreground mt-2">Identitas individual tidak ditampilkan (survei anonim) — hanya status agregat per sesi.</p>
            </CardContent>
          </Card>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Pilih survei untuk melihat progres responden.</p>
      )}
    </div>
  );
}
