'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, Loader2, Calendar, Users } from 'lucide-react';
import { getBudayaSurveys } from '@/lib/budayaData';
import { BUDAYA_SURVEY_STATUS_LABEL, type BudayaSurvey, type BudayaSurveyStatus } from '@/types/budaya';

const STATUS_BADGE_VARIANT: Record<BudayaSurveyStatus, string> = {
  draft: '#94a3b8', aktif: '#22c55e', ditutup: '#f59e0b', final: '#0ea5e9', arsip: '#64748b',
};

export function BudayaSurveyList({
  statusFilter, title, canReview, userId, onSelect, onCreateNew,
}: {
  statusFilter: BudayaSurveyStatus[];
  title: string;
  canReview: boolean;
  userId: string;
  onSelect: (id: string, tab?: string) => void;
  onCreateNew?: () => void;
}) {
  const [surveys, setSurveys] = useState<BudayaSurvey[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const all = await getBudayaSurveys();
      if (!cancelled) {
        setSurveys(all.filter((s) => statusFilter.includes(s.status)));
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(statusFilter)]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">{title}</h2>
        {canReview && onCreateNew && (
          <Button onClick={onCreateNew}><Plus className="size-4 mr-1" /> Buat Survey Baru</Button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="size-5 animate-spin mr-2" /> Memuat…</div>
      ) : surveys.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">Belum ada survei pada kategori ini.</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {surveys.map((s) => (
            <Card key={s.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => onSelect(s.id)}>
              <CardContent className="pt-6 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold">{s.name}</h3>
                  <Badge style={{ backgroundColor: STATUS_BADGE_VARIANT[s.status] }}>{BUDAYA_SURVEY_STATUS_LABEL[s.status]}</Badge>
                </div>
                <div className="text-sm text-muted-foreground flex items-center gap-4">
                  <span className="flex items-center gap-1"><Calendar className="size-3.5" /> {s.startDate} – {s.endDate}</span>
                  <span className="flex items-center gap-1"><Users className="size-3.5" /> Target {s.targetRespondents}</span>
                </div>
                <div className="text-xs text-muted-foreground">Instrumen {s.instrumentVersion} · {s.anonymityMode === 'anonymous' ? 'Anonim' : 'Teridentifikasi'}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
