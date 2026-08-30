'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, ShieldPlus, CheckCircle2 } from 'lucide-react';
import { getBudayaSurveys, getBudayaSurveyById, getBudayaDimensionResults, getBudayaDimensions, createRiskFromBudayaDimension } from '@/lib/budayaData';
import { BUDAYA_CATEGORY_LABEL, BUDAYA_CATEGORY_COLOR, type BudayaSurvey, type BudayaDimensionResult, type BudayaDimension } from '@/types/budaya';

function priorityLabel(pct: number | null): { label: string; color: string } {
  if (pct == null) return { label: '-', color: '#94a3b8' };
  if (pct < 50) return { label: 'Prioritas Sangat Tinggi', color: BUDAYA_CATEGORY_COLOR.lemah };
  if (pct < 75) return { label: 'Prioritas Perbaikan', color: BUDAYA_CATEGORY_COLOR.sedang };
  return { label: 'Pertahankan', color: BUDAYA_CATEGORY_COLOR.kuat };
}

export function BudayaRiskAreaPanel({
  surveyId, userId, onSelectSurvey, onNavigateFollowup,
}: {
  surveyId?: string;
  userId: string;
  onSelectSurvey: (id: string) => void;
  onNavigateFollowup: () => void;
}) {
  const [surveys, setSurveys] = useState<BudayaSurvey[]>([]);
  const [selected, setSelected] = useState<string | undefined>(surveyId);
  const [survey, setSurvey] = useState<BudayaSurvey | null>(null);
  const [dims, setDims] = useState<BudayaDimension[]>([]);
  const [results, setResults] = useState<BudayaDimensionResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingId, setCreatingId] = useState<string | null>(null);
  const [createdIds, setCreatedIds] = useState<Set<string>>(new Set());

  useEffect(() => { getBudayaSurveys().then(setSurveys); getBudayaDimensions().then(setDims); }, []);
  useEffect(() => { if (!selected && surveys.length) setSelected(surveys[0].id); }, [surveys, selected]);
  useEffect(() => {
    if (!selected) return;
    setLoading(true);
    Promise.all([getBudayaSurveyById(selected), getBudayaDimensionResults(selected)]).then(([s, r]) => {
      setSurvey(s); setResults(r); setLoading(false);
    });
  }, [selected]);

  const dimName = (id: string) => dims.find((d) => d.id === id)?.name ?? id;
  const priorityAreas = [...results]
    .filter((r) => r.positivePercentage != null && r.positivePercentage <= 75)
    .sort((a, b) => (a.positivePercentage ?? 0) - (b.positivePercentage ?? 0));

  const handleJadikanRisiko = async (r: BudayaDimensionResult) => {
    if (!survey) return;
    setCreatingId(r.id);
    try {
      await createRiskFromBudayaDimension(
        { surveyName: survey.name, dimensionName: dimName(r.dimensionId), positivePercentage: r.positivePercentage ?? 0, category: r.category ?? 'sedang' },
        userId
      );
      setCreatedIds((prev) => new Set(prev).add(r.id));
    } finally {
      setCreatingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Priority Improvement Area</h2>
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
      ) : priorityAreas.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">Tidak ada dimensi dengan skor ≤75% — atau survei belum difinalisasi.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {priorityAreas.map((r) => {
            const p = priorityLabel(r.positivePercentage);
            const created = createdIds.has(r.id);
            return (
              <Card key={r.id}>
                <CardContent className="pt-6 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold">{dimName(r.dimensionId)}</h3>
                      <Badge style={{ backgroundColor: p.color }}>{p.label}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">Skor: {r.positivePercentage}% ({r.category ? BUDAYA_CATEGORY_LABEL[r.category] : '-'})</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" variant="outline" onClick={onNavigateFollowup}>Buat Tindak Lanjut</Button>
                    <Button size="sm" disabled={created || creatingId === r.id} onClick={() => handleJadikanRisiko(r)}>
                      {creatingId === r.id ? <Loader2 className="size-4 mr-1 animate-spin" /> : created ? <CheckCircle2 className="size-4 mr-1" /> : <ShieldPlus className="size-4 mr-1" />}
                      {created ? 'Sudah Jadi Risiko' : 'Jadikan Risiko'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          <p className="text-xs text-muted-foreground">
            "Jadikan Risiko" hanya membuat draft di Risk Register — Risk Owner, Probabilitas, Dampak, dan Controllability tetap wajib ditentukan manual oleh user berwenang di modul Manajemen Risiko (poin BH).
          </p>
        </div>
      )}
    </div>
  );
}
