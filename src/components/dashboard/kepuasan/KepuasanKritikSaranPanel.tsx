'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, MessageSquare, Phone } from 'lucide-react';
import { getKepuasanSurveys, getKepuasanResponsesWithKritikSaran, updateKepuasanFollowup } from '@/lib/kepuasanData';
import { KEPUASAN_FOLLOWUP_STATUS_LABEL, type KepuasanSurvey, type KepuasanResponse, type KepuasanFollowupStatus } from '@/types/kepuasan';

const STATUS_COLOR: Record<KepuasanFollowupStatus, string> = {
  belum_ditindaklanjuti: '#f59e0b', dalam_proses: '#3b82f6', selesai: '#22c55e',
};

export function KepuasanKritikSaranPanel({ surveyId: initialSurveyId, userId }: { surveyId?: string; userId: string }) {
  const [surveys, setSurveys] = useState<KepuasanSurvey[]>([]);
  const [selected, setSelected] = useState<string | undefined>(initialSurveyId);
  const [items, setItems] = useState<KepuasanResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    getKepuasanSurveys().then((all) => {
      setSurveys(all);
      if (!selected && all.length > 0) setSelected(initialSurveyId ?? all[0].id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reload = async (id: string) => {
    setLoading(true);
    try {
      setItems(await getKepuasanResponsesWithKritikSaran(id));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selected) reload(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  const handleStatusChange = async (id: string, status: KepuasanFollowupStatus) => {
    setSavingId(id);
    try {
      await updateKepuasanFollowup(id, { followupStatus: status }, userId);
      if (selected) await reload(selected);
    } finally {
      setSavingId(null);
    }
  };

  const handleNoteBlur = async (id: string, note: string) => {
    setSavingId(id);
    try {
      await updateKepuasanFollowup(id, { followupNote: note }, userId);
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-xl font-semibold">Kritik &amp; Saran</h2>
        {surveys.length > 0 && (
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger className="w-64"><SelectValue placeholder="Pilih survei" /></SelectTrigger>
            <SelectContent>{surveys.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
          </Select>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="size-5 animate-spin mr-2" /> Memuat…</div>
      ) : items.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">Belum ada kritik/saran untuk survei ini.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {items.map((r) => (
            <Card key={r.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <MessageSquare className="size-4 text-muted-foreground" />
                    {r.respondentName ?? 'Anonim'} · {r.unitId} · {new Date(r.submittedAt).toLocaleDateString('id-ID')}
                  </CardTitle>
                  <Select value={r.followupStatus} onValueChange={(v) => handleStatusChange(r.id, v as KepuasanFollowupStatus)} disabled={savingId === r.id}>
                    <SelectTrigger className="w-44 h-7 text-xs" style={{ backgroundColor: STATUS_COLOR[r.followupStatus], color: 'white', borderColor: 'transparent' }}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(KEPUASAN_FOLLOWUP_STATUS_LABEL) as KepuasanFollowupStatus[]).map((st) => (
                        <SelectItem key={st} value={st}>{KEPUASAN_FOLLOWUP_STATUS_LABEL[st]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm">{r.kritikSaran}</p>
                {r.willingToContact && (
                  <Badge variant="outline" className="gap-1"><Phone className="size-3" /> {r.contactPhone || 'Bersedia dihubungi'}</Badge>
                )}
                <Textarea
                  placeholder="Catatan tindak lanjut…"
                  defaultValue={r.followupNote ?? ''}
                  rows={2}
                  className="text-sm"
                  onBlur={(e) => handleNoteBlur(r.id, e.target.value)}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
