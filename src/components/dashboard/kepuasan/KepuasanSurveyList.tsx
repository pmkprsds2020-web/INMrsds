'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Loader2, Calendar, Send } from 'lucide-react';
import { getKepuasanSurveys, updateKepuasanSurvey } from '@/lib/kepuasanData';
import { KEPUASAN_STATUS_LABEL, formatKepuasanTarget, type KepuasanSurvey, type KepuasanSurveyStatus } from '@/types/kepuasan';

const STATUS_COLOR: Record<KepuasanSurveyStatus, string> = {
  draft: '#94a3b8', aktif: '#22c55e', ditutup: '#f59e0b', arsip: '#64748b',
};

const SELECTABLE_STATUSES: KepuasanSurveyStatus[] = ['draft', 'aktif', 'ditutup', 'arsip'];

export function KepuasanSurveyList({
  statusFilter, title, canManageSurvey, onSelect, onCreateNew,
}: {
  statusFilter: KepuasanSurveyStatus[];
  title: string;
  canManageSurvey: boolean;
  onSelect: (id: string, tab?: string) => void;
  onCreateNew?: () => void;
}) {
  const [surveys, setSurveys] = useState<KepuasanSurvey[]>([]);
  const [loading, setLoading] = useState(true);
  const [changingId, setChangingId] = useState<string | null>(null);

  const reload = async () => {
    setLoading(true);
    const all = await getKepuasanSurveys();
    setSurveys(all.filter((s) => statusFilter.includes(s.status)));
    setLoading(false);
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(statusFilter)]);

  const handleStatusChange = async (id: string, status: KepuasanSurveyStatus) => {
    setChangingId(id);
    try {
      await updateKepuasanSurvey(id, { status });
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
          <Button onClick={onCreateNew}><Plus className="size-4 mr-1" /> Buat Survey Kepuasan Pasien</Button>
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
                  <button className="font-semibold text-left hover:underline" onClick={() => onSelect(s.id, 'kepuasan-dashboard')}>{s.name}</button>
                  {canManageSurvey ? (
                    <Select value={s.status} onValueChange={(v) => handleStatusChange(s.id, v as KepuasanSurveyStatus)} disabled={changingId === s.id}>
                      <SelectTrigger className="w-24 h-7 text-xs" style={{ backgroundColor: STATUS_COLOR[s.status], color: 'white', borderColor: 'transparent' }}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SELECTABLE_STATUSES.map((st) => <SelectItem key={st} value={st}>{KEPUASAN_STATUS_LABEL[st]}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge style={{ backgroundColor: STATUS_COLOR[s.status] }}>{KEPUASAN_STATUS_LABEL[s.status]}</Badge>
                  )}
                </div>
                <div className="text-sm text-muted-foreground flex items-center gap-4 flex-wrap">
                  <span className="flex items-center gap-1"><Calendar className="size-3.5" /> {s.startDate} – {s.endDate}</span>
                  <span>{s.unitId === 'all' ? 'Semua Unit' : s.unitId}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  Target IKM {formatKepuasanTarget(s.targetValue, s.targetOperator)} · Mode {s.surveyMode === 'both' ? 'Online + Kiosk' : s.surveyMode === 'kiosk' ? 'Kiosk' : 'Online'}
                  {s.linkedIndicatorId && ' · Tertaut ke Indikator Mutu'}
                </div>
                {canManageSurvey && s.status === 'draft' && (
                  <p className="text-xs text-amber-600">Ubah status ke &quot;Aktif&quot; dulu supaya link pengisian bisa dibuat dan dibuka pasien.</p>
                )}
                {canManageSurvey && s.status === 'aktif' && (
                  <Button size="sm" variant="outline" className="w-full mt-1" onClick={() => onSelect(s.id, 'kepuasan-distribusi')}>
                    <Send className="size-3.5 mr-1" /> Buat / Lihat Link & QR Code
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
