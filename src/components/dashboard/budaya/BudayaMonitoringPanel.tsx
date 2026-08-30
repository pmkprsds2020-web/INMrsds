'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Plus } from 'lucide-react';
import { getBudayaSurveys, getBudayaFollowups, getBudayaFollowupMonitorings, createBudayaFollowupMonitoring, getBudayaDimensions, updateBudayaFollowup } from '@/lib/budayaData';
import type { BudayaSurvey, BudayaFollowup, BudayaFollowupMonitoring, BudayaDimension } from '@/types/budaya';

export function BudayaMonitoringPanel({ userId, canReview }: { userId: string; canReview: boolean }) {
  const [surveys, setSurveys] = useState<BudayaSurvey[]>([]);
  const [dims, setDims] = useState<BudayaDimension[]>([]);
  const [allFollowups, setAllFollowups] = useState<BudayaFollowup[]>([]);
  const [selectedFollowup, setSelectedFollowup] = useState<string | null>(null);
  const [entries, setEntries] = useState<BudayaFollowupMonitoring[]>([]);
  const [loading, setLoading] = useState(true);
  const [activity, setActivity] = useState('');
  const [progress, setProgress] = useState(0);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const [surveyList, dimensions] = await Promise.all([getBudayaSurveys(), getBudayaDimensions()]);
      setSurveys(surveyList); setDims(dimensions);
      const all: BudayaFollowup[] = [];
      for (const s of surveyList) all.push(...(await getBudayaFollowups(s.id)));
      setAllFollowups(all.filter((f) => f.status !== 'selesai'));
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (selectedFollowup) getBudayaFollowupMonitorings(selectedFollowup).then(setEntries);
  }, [selectedFollowup]);

  const dimName = (id: string) => dims.find((d) => d.id === id)?.name ?? id;
  const current = allFollowups.find((f) => f.id === selectedFollowup) ?? null;

  const handleAdd = async () => {
    if (!selectedFollowup || !activity) return;
    setSaving(true);
    await createBudayaFollowupMonitoring({
      followupId: selectedFollowup, monitoringDate: new Date().toISOString().slice(0, 10),
      activity, picId: userId, progressPercentage: progress, notes, evidenceUrl: null, createdBy: userId,
    });
    await updateBudayaFollowup(selectedFollowup, { progressPercentage: progress, status: progress >= 100 ? 'selesai' : 'dalam_proses' }, userId);
    setEntries(await getBudayaFollowupMonitorings(selectedFollowup));
    setActivity(''); setNotes(''); setSaving(false);
  };

  if (loading) return <div className="flex items-center py-16 text-muted-foreground"><Loader2 className="size-5 animate-spin mr-2" /> Memuat…</div>;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Monitoring Tindak Lanjut</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="md:col-span-1">
          <CardHeader><CardTitle className="text-base">Rencana Berjalan</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {allFollowups.length === 0 && <p className="text-sm text-muted-foreground">Tidak ada rencana tindak lanjut yang sedang berjalan.</p>}
            {allFollowups.map((f) => (
              <button
                key={f.id}
                onClick={() => setSelectedFollowup(f.id)}
                className={`w-full text-left p-2 rounded-md text-sm border ${selectedFollowup === f.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
              >
                <p className="font-medium truncate">{dimName(f.dimensionId)}</p>
                <Progress value={f.progressPercentage} className="mt-1 h-1.5" />
              </button>
            ))}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader><CardTitle className="text-base">Timeline Progress</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {!current ? (
              <p className="text-sm text-muted-foreground">Pilih rencana tindak lanjut di sebelah kiri.</p>
            ) : (
              <>
                <div className="space-y-2">
                  {entries.map((e) => (
                    <div key={e.id} className="border-l-2 pl-3 py-1 text-sm">
                      <p className="text-xs text-muted-foreground">{e.monitoringDate} — Progress {e.progressPercentage}%</p>
                      <p>{e.activity}</p>
                      {e.notes && <p className="text-xs text-muted-foreground">{e.notes}</p>}
                    </div>
                  ))}
                  {entries.length === 0 && <p className="text-sm text-muted-foreground">Belum ada catatan monitoring.</p>}
                </div>

                {canReview && (
                  <div className="border-t pt-3 space-y-2">
                    <Textarea placeholder="Kegiatan yang dilakukan…" value={activity} onChange={(e) => setActivity(e.target.value)} rows={2} />
                    <div className="flex gap-2 items-center">
                      <Input type="number" min={0} max={100} value={progress} onChange={(e) => setProgress(Number(e.target.value))} className="w-24" />
                      <span className="text-sm text-muted-foreground">% progress</span>
                    </div>
                    <Input placeholder="Catatan (opsional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
                    <Button size="sm" onClick={handleAdd} disabled={saving}><Plus className="size-4 mr-1" /> Tambah Catatan</Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
