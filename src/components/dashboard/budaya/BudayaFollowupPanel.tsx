'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Loader2, Plus } from 'lucide-react';
import { getBudayaSurveys, getBudayaDimensions, getBudayaFollowups, createBudayaFollowup, updateBudayaFollowup } from '@/lib/budayaData';
import {
  BUDAYA_FOLLOWUP_STATUS_LABEL, type BudayaSurvey, type BudayaDimension, type BudayaFollowup, type BudayaFollowupStatus,
} from '@/types/budaya';

const STATUS_COLOR: Record<BudayaFollowupStatus, string> = {
  belum_dimulai: '#94a3b8', dalam_proses: '#3b82f6', selesai: '#22c55e', ditunda: '#f59e0b', tidak_efektif: '#ef4444',
};

function NewFollowupDialog({ surveyId, dims, onCreated }: { surveyId: string; dims: BudayaDimension[]; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [dimensionId, setDimensionId] = useState('');
  const [problem, setProblem] = useState('');
  const [rootCause, setRootCause] = useState('');
  const [actionPlan, setActionPlan] = useState('');
  const [deadline, setDeadline] = useState('');
  const [indicator, setIndicator] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!dimensionId || !actionPlan) return;
    setSaving(true);
    await createBudayaFollowup({
      surveyId, dimensionId, problemDescription: problem, rootCause, actionPlan,
      deadline: deadline || null, successIndicator: indicator, status: 'belum_dimulai', progressPercentage: 0,
    });
    setSaving(false); setOpen(false); onCreated();
    setDimensionId(''); setProblem(''); setRootCause(''); setActionPlan(''); setDeadline(''); setIndicator('');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Plus className="size-4 mr-1" /> Rencana Baru</Button></DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Rencana Tindak Lanjut Baru</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label>Dimensi</Label>
            <Select value={dimensionId} onValueChange={setDimensionId}>
              <SelectTrigger><SelectValue placeholder="Pilih dimensi" /></SelectTrigger>
              <SelectContent>{dims.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label>Masalah</Label><Textarea value={problem} onChange={(e) => setProblem(e.target.value)} rows={2} /></div>
          <div className="space-y-1"><Label>Analisis Penyebab</Label><Textarea value={rootCause} onChange={(e) => setRootCause(e.target.value)} rows={2} /></div>
          <div className="space-y-1"><Label>Rencana Tindakan</Label><Textarea value={actionPlan} onChange={(e) => setActionPlan(e.target.value)} rows={2} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Deadline</Label><Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} /></div>
            <div className="space-y-1"><Label>Indikator Keberhasilan</Label><Input value={indicator} onChange={(e) => setIndicator(e.target.value)} /></div>
          </div>
          <div className="flex justify-end"><Button onClick={submit} disabled={saving}>{saving && <Loader2 className="size-4 mr-1 animate-spin" />} Simpan</Button></div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function BudayaFollowupPanel({ surveyId, userId, canReview, onSelectSurvey }: { surveyId?: string; userId: string; canReview: boolean; onSelectSurvey: (id: string) => void }) {
  void userId;
  const [surveys, setSurveys] = useState<BudayaSurvey[]>([]);
  const [selected, setSelected] = useState<string | undefined>(surveyId);
  const [dims, setDims] = useState<BudayaDimension[]>([]);
  const [items, setItems] = useState<BudayaFollowup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { getBudayaSurveys().then(setSurveys); getBudayaDimensions().then(setDims); }, []);
  useEffect(() => { if (!selected && surveys.length) setSelected(surveys[0].id); }, [surveys, selected]);

  const reload = (id: string) => { setLoading(true); getBudayaFollowups(id).then((r) => { setItems(r); setLoading(false); }); };
  useEffect(() => { if (selected) reload(selected); }, [selected]);

  const dimName = (id: string) => dims.find((d) => d.id === id)?.name ?? id;

  const handleStatusChange = async (id: string, status: BudayaFollowupStatus) => {
    await updateBudayaFollowup(id, { status });
    if (selected) reload(selected);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Rencana Tindak Lanjut</h2>
        {canReview && selected && <NewFollowupDialog surveyId={selected} dims={dims} onCreated={() => reload(selected)} />}
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
      ) : items.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">Belum ada rencana tindak lanjut untuk survei ini.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {items.map((f) => (
            <Card key={f.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{dimName(f.dimensionId)}</CardTitle>
                  {canReview ? (
                    <Select value={f.status} onValueChange={(v) => handleStatusChange(f.id, v as BudayaFollowupStatus)}>
                      <SelectTrigger className="w-44 h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(BUDAYA_FOLLOWUP_STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge style={{ backgroundColor: STATUS_COLOR[f.status] }}>{BUDAYA_FOLLOWUP_STATUS_LABEL[f.status]}</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                {f.problemDescription && <p><span className="font-medium">Masalah:</span> {f.problemDescription}</p>}
                {f.actionPlan && <p><span className="font-medium">Rencana:</span> {f.actionPlan}</p>}
                <div className="flex gap-4 text-xs text-muted-foreground pt-1">
                  {f.deadline && <span>Deadline: {f.deadline}</span>}
                  <span>Progress: {f.progressPercentage}%</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
