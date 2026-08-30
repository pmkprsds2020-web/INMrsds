'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Loader2, Copy, QrCode, Link as LinkIcon, KeyRound } from 'lucide-react';
import { getBudayaQuestions, getBudayaSurveys, getBudayaSurveyTokens, createBudayaSurveyToken } from '@/lib/budayaData';
import type { BudayaQuestion, BudayaSection, BudayaSurvey, BudayaSurveyToken } from '@/types/budaya';

const SECTION_LABEL: Record<BudayaSection, string> = {
  A: 'Bagian A — Unit Kerja Anda', B: 'Bagian B — Manajer/Supervisor/Kepala Instalasi',
  C: 'Bagian C — Komunikasi', D: 'Bagian D — Frekuensi Pelaporan Insiden',
  E: 'Bagian E — Tingkat Keselamatan Pasien', F: 'Bagian F — Rumah Sakit Anda',
  G: 'Bagian G — Jumlah Laporan Kejadian', H: 'Bagian H — Latar Belakang', I: 'Bagian I — Komentar',
};

function QuestionBank() {
  const [questions, setQuestions] = useState<BudayaQuestion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getBudayaQuestions().then((q) => { setQuestions(q); setLoading(false); });
  }, []);

  if (loading) return <div className="flex items-center py-10 text-muted-foreground"><Loader2 className="size-5 animate-spin mr-2" /> Memuat instrumen…</div>;

  const bySection = (Object.keys(SECTION_LABEL) as BudayaSection[]).map((sec) => ({
    section: sec,
    items: questions.filter((q) => q.section === sec),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Struktur instrumen bersifat baku (versi {questions[0]?.instrumentVersion ?? '-'}) — hanya dapat diubah lewat migrasi versi baru, bukan diedit bebas di sini (poin BP: versioning instrumen).
      </p>
      {bySection.map((g) => (
        <Card key={g.section}>
          <CardHeader><CardTitle className="text-base">{SECTION_LABEL[g.section]}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {g.items.map((q) => (
              <div key={q.id} className="flex items-start justify-between gap-3 text-sm border-b last:border-0 pb-2 last:pb-0">
                <div>
                  <span className="font-medium mr-2">{q.itemCode}.</span>
                  {q.questionText}
                </div>
                <div className="flex gap-1 shrink-0">
                  {q.isReverse && <Badge variant="outline" className="text-amber-600 border-amber-300">reverse</Badge>}
                  {!q.isScored && <Badge variant="outline">non-skor</Badge>}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function DistribusiPanel({ surveyId }: { surveyId?: string }) {
  const [surveys, setSurveys] = useState<BudayaSurvey[]>([]);
  const [selected, setSelected] = useState<string | undefined>(surveyId);
  const [tokens, setTokens] = useState<BudayaSurveyToken[]>([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => { getBudayaSurveys({ status: 'aktif' }).then(setSurveys); }, []);
  useEffect(() => {
    if (selected) getBudayaSurveyTokens(selected).then(setTokens);
  }, [selected]);

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  const handleCreate = async (kind: 'public_link' | 'qr' | 'access_code') => {
    if (!selected) return;
    setCreating(true);
    try {
      await createBudayaSurveyToken({ surveyId: selected, kind });
      setTokens(await getBudayaSurveyTokens(selected));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {surveys.map((s) => (
          <Button key={s.id} size="sm" variant={selected === s.id ? 'default' : 'outline'} onClick={() => setSelected(s.id)}>{s.name}</Button>
        ))}
        {surveys.length === 0 && <p className="text-sm text-muted-foreground">Tidak ada survei berstatus Aktif — ubah status survei ke Aktif dulu untuk mendistribusikan.</p>}
      </div>

      {selected && (
        <Card>
          <CardHeader><CardTitle className="text-base">Link & Kode Akses</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={creating} onClick={() => handleCreate('public_link')}><LinkIcon className="size-4 mr-1" /> Buat Public Link</Button>
              <Button size="sm" variant="outline" disabled={creating} onClick={() => handleCreate('qr')}><QrCode className="size-4 mr-1" /> Buat QR</Button>
              <Button size="sm" variant="outline" disabled={creating} onClick={() => handleCreate('access_code')}><KeyRound className="size-4 mr-1" /> Buat Access Code</Button>
            </div>
            <div className="space-y-2">
              {tokens.map((t) => {
                const url = `${baseUrl}/survey-budaya/${t.token}`;
                return (
                  <div key={t.id} className="flex items-center justify-between gap-2 text-sm border rounded-md p-2">
                    <div className="min-w-0">
                      <Badge variant="outline" className="mr-2">{t.kind}</Badge>
                      <span className="truncate">{t.kind === 'access_code' ? t.token : url}</span>
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => navigator.clipboard.writeText(t.kind === 'access_code' ? t.token : url)}><Copy className="size-4" /></Button>
                  </div>
                );
              })}
              {tokens.length === 0 && <p className="text-sm text-muted-foreground">Belum ada link/kode dibuat untuk survei ini.</p>}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export function BudayaQuestionnairePanel({ surveyId, onSelectSurvey }: { surveyId?: string; onSelectSurvey: (id: string, tab?: string) => void }) {
  void onSelectSurvey;
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Kuesioner</h2>
      <Tabs defaultValue="bank">
        <TabsList>
          <TabsTrigger value="bank">Struktur Instrumen</TabsTrigger>
          <TabsTrigger value="distribusi">Distribusi</TabsTrigger>
        </TabsList>
        <TabsContent value="bank" className="mt-4"><QuestionBank /></TabsContent>
        <TabsContent value="distribusi" className="mt-4"><DistribusiPanel surveyId={surveyId} /></TabsContent>
      </Tabs>
    </div>
  );
}
