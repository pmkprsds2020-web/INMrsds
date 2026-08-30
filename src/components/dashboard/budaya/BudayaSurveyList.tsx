'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Loader2, Calendar, Users, Send } from 'lucide-react';
import { getBudayaSurveys, updateBudayaSurvey } from '@/lib/budayaData';
import { BUDAYA_SURVEY_STATUS_LABEL, type BudayaSurvey, type BudayaSurveyStatus } from '@/types/budaya';

const STATUS_BADGE_VARIANT: Record<BudayaSurveyStatus, string> = {
  draft: '#94a3b8', aktif: '#22c55e', ditutup: '#f59e0b', final: '#0ea5e9', arsip: '#64748b',
};

// Status yang boleh dipilih manual dari sini. 'final' HANYA lewat tombol
// Finalisasi di menu Hasil Survey (melewati quality check) — tidak lewat
// dropdown bebas ini.
const SELECTABLE_STATUSES: BudayaSurveyStatus[] = ['draft', 'aktif', 'ditutup', 'arsip'];

export function BudayaSurveyList({
  statusFilter, title, canReview, canManageSurvey, userId, onSelect, onCreateNew,
}: {
  statusFilter: BudayaSurveyStatus[];
  title: string;
  canReview: boolean;
  canManageSurvey: boolean;
  userId: string;
  onSelect: (id: string, tab?: string) => void;
  onCreateNew?: () => void;
}) {
  void userId;
  const [surveys, setSurveys] = useState<BudayaSurvey[]>([]);
  const [loading, setLoading] = useState(true);
  const [changingId, setChangingId] = useState<string | null>(null);

  const reload = async () => {
    setLoading(true);
    const all = await getBudayaSurveys();
    setSurveys(all.filter((s) => statusFilter.includes(s.status)));
    setLoading(false);
  };

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

  const handleStatusChange = async (id: string, status: BudayaSurveyStatus) => {
    setChangingId(id);
    try {
      await updateBudayaSurvey(id, { status });
      await reload();
    } finally {
      setChangingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">{title}</h2>
        {canManageSurvey && onCreateNew && (
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
            <Card key={s.id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <button className="font-semibold text-left hover:underline" onClick={() => onSelect(s.id)}>{s.name}</button>
                  {canManageSurvey ? (
                    <Select value={s.status} onValueChange={(v) => handleStatusChange(s.id, v as BudayaSurveyStatus)} disabled={changingId === s.id}>
                      <SelectTrigger className="w-28 h-7 text-xs" style={{ backgroundColor: STATUS_BADGE_VARIANT[s.status], color: 'white', borderColor: 'transparent' }}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SELECTABLE_STATUSES.map((st) => <SelectItem key={st} value={st}>{BUDAYA_SURVEY_STATUS_LABEL[st]}</SelectItem>)}
                        {s.status === 'final' && <SelectItem value="final" disabled>{BUDAYA_SURVEY_STATUS_LABEL.final}</SelectItem>}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge style={{ backgroundColor: STATUS_BADGE_VARIANT[s.status] }}>{BUDAYA_SURVEY_STATUS_LABEL[s.status]}</Badge>
                  )}
                </div>
                <div className="text-sm text-muted-foreground flex items-center gap-4">
                  <span className="flex items-center gap-1"><Calendar className="size-3.5" /> {s.startDate} – {s.endDate}</span>
                  <span className="flex items-center gap-1"><Users className="size-3.5" /> Target {s.targetRespondents}</span>
                </div>
                <div className="text-xs text-muted-foreground">Instrumen {s.instrumentVersion} · {s.anonymityMode === 'anonymous' ? 'Anonim' : 'Teridentifikasi'}</div>
                {canManageSurvey && s.status === 'draft' && (
                  <p className="text-xs text-amber-600">Ubah status ke &quot;Aktif&quot; dulu supaya link pengisian bisa dibuat dan dibuka responden.</p>
                )}
                {canReview && s.status === 'aktif' && (
                  <Button size="sm" variant="outline" className="w-full mt-1" onClick={() => onSelect(s.id, 'budaya-kuesioner')}>
                    <Send className="size-3.5 mr-1" /> Buat / Lihat Link Pengisian
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
