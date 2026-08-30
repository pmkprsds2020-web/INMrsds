'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Loader2, ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react';
import {
  getBudayaPublicSurvey, getBudayaQuestions, startBudayaSession, submitBudayaAnswer, completeBudayaSession,
  type BudayaPublicSurveyInfo,
} from '@/lib/budayaData';
import {
  BUDAYA_LIKERT_AGREE_LABEL, BUDAYA_LIKERT_FREQUENCY_LABEL, type BudayaQuestion, type BudayaSection,
} from '@/types/budaya';

const SECTION_ORDER: BudayaSection[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];

const SECTION_TITLE: Record<BudayaSection, string> = {
  A: 'Bagian A', B: 'Bagian B — Manajer/Supervisor/Kepala Instalasi', C: 'Bagian C — Komunikasi',
  D: 'Bagian D — Frekuensi Pelaporan Insiden', E: 'Bagian E — Tingkat Keselamatan Pasien',
  F: 'Bagian F — Rumah Sakit Anda', G: 'Bagian G — Jumlah Laporan Kejadian',
  H: 'Bagian H — Latar Belakang', I: 'Bagian I — Komentar',
};

type Step = 'loading' | 'not_found' | 'intro' | 'unit' | BudayaSection | 'review' | 'submitting' | 'done' | 'error';

interface AnswerState { raw?: number; text?: string; }

function likertQuestion(q: BudayaQuestion, value: number | undefined, onChange: (v: number) => void) {
  const labels = q.scaleType === 'likert_frequency' ? BUDAYA_LIKERT_FREQUENCY_LABEL : BUDAYA_LIKERT_AGREE_LABEL;
  return (
    <div className="space-y-2">
      <p className="text-sm">{q.itemCode ? `${q.itemNo ?? ''}. ` : ''}{q.questionText}</p>
      <div className="flex flex-wrap gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`text-xs px-3 py-2 rounded-md border transition-colors ${value === n ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted'}`}
          >
            {n} — {labels[n]}
          </button>
        ))}
      </div>
    </div>
  );
}

function choiceQuestion(q: BudayaQuestion, value: string | undefined, onChange: (v: string) => void) {
  return (
    <div className="space-y-2">
      <p className="text-sm">{q.questionText}</p>
      <RadioGroup value={value} onValueChange={onChange} className="space-y-1.5">
        {(q.options ?? []).map((o) => (
          <div key={o.id} className="flex items-center gap-2">
            <RadioGroupItem value={o.optionCode} id={`${q.id}-${o.optionCode}`} />
            <Label htmlFor={`${q.id}-${o.optionCode}`} className="font-normal cursor-pointer">{o.optionLabel}</Label>
          </div>
        ))}
      </RadioGroup>
    </div>
  );
}

export function BudayaPublicSurveyFlow({ token }: { token: string }) {
  const [step, setStep] = useState<Step>('loading');
  const [info, setInfo] = useState<BudayaPublicSurveyInfo | null>(null);
  const [questions, setQuestions] = useState<BudayaQuestion[]>([]);
  const [consented, setConsented] = useState(false);
  const [unitId, setUnitId] = useState<string>('');
  const [respondentToken, setRespondentToken] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, AnswerState>>({});
  const [validationError, setValidationError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const storageKey = `budaya_session_${token}`;
  const completedKey = `budaya_completed_${token}`;

  useEffect(() => {
    // Sudah pernah selesai dari browser ini — jangan izinkan mulai lagi (poin AH).
    if (typeof window !== 'undefined' && sessionStorage.getItem(completedKey)) {
      setStep('done');
      return;
    }
    (async () => {
      try {
        const [publicInfo, qs] = await Promise.all([getBudayaPublicSurvey(token), getBudayaQuestions()]);
        if (!publicInfo) { setStep('not_found'); return; }
        setInfo(publicInfo);
        setQuestions(qs.filter((q) => q.instrumentVersion === publicInfo.instrumentVersion));
        const saved = typeof window !== 'undefined' ? sessionStorage.getItem(storageKey) : null;
        if (saved) setRespondentToken(saved);
        setStep('intro');
      } catch {
        setStep('error');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const sectionsWithQuestions = useMemo(
    () => SECTION_ORDER.filter((sec) => questions.some((q) => q.section === sec)),
    [questions]
  );
  const currentSectionIndex = sectionsWithQuestions.indexOf(step as BudayaSection);
  const progressPct = step === 'intro' || step === 'unit'
    ? 5
    : currentSectionIndex >= 0
      ? Math.round(((currentSectionIndex + 1) / (sectionsWithQuestions.length + 1)) * 100)
      : step === 'review' ? 95 : step === 'done' ? 100 : 0;

  const handleStart = async () => {
    if (!consented || !unitId || !info) return;
    setStarting(true);
    try {
      const { respondentToken: rt } = await startBudayaSession(token, unitId);
      setRespondentToken(rt);
      sessionStorage.setItem(storageKey, rt);
      setStep(sectionsWithQuestions[0] ?? 'review');
    } catch {
      setValidationError('Gagal memulai sesi — link mungkin sudah kedaluwarsa atau survei sudah ditutup.');
    } finally {
      setStarting(false);
    }
  };

  const setAnswer = (questionId: string, val: AnswerState) => {
    setAnswers((prev) => ({ ...prev, [questionId]: val }));
    if (!respondentToken) return;
    submitBudayaAnswer({
      respondentToken,
      questionId,
      rawAnswer: val.raw ?? null,
      rawAnswerText: val.text ?? null,
    }).catch(() => { /* autosave gagal diam-diam; jawaban tetap ada di state lokal, tersimpan ulang saat jawaban berikutnya berhasil */ });
  };

  const goNext = () => {
    const idx = sectionsWithQuestions.indexOf(step as BudayaSection);
    if (idx < 0) return;
    const sectionQuestions = questions.filter((q) => q.section === sectionsWithQuestions[idx]);
    const missing = sectionQuestions.filter((q) => q.isRequired && !answers[q.id]?.raw && !answers[q.id]?.text);
    if (missing.length > 0) {
      setValidationError('Pertanyaan ini belum dijawab.');
      return;
    }
    setValidationError(null);
    const next = sectionsWithQuestions[idx + 1];
    setStep(next ?? 'review');
  };

  const goPrev = () => {
    const idx = sectionsWithQuestions.indexOf(step as BudayaSection);
    setValidationError(null);
    if (idx > 0) setStep(sectionsWithQuestions[idx - 1]);
    else setStep('unit');
  };

  const handleSubmitSurvey = async () => {
    if (!respondentToken) return;
    setStep('submitting');
    try {
      await completeBudayaSession(respondentToken);
      sessionStorage.removeItem(storageKey);
      sessionStorage.setItem(completedKey, '1');
      setStep('done');
    } catch {
      setStep('error');
    }
  };

  if (step === 'loading') {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="size-6 animate-spin mr-2" /> Memuat survei…</div>;
  }
  if (step === 'not_found') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-sm w-full"><CardContent className="pt-6 text-center space-y-2">
          <AlertCircle className="size-8 mx-auto text-amber-500" />
          <p className="font-medium">Link tidak valid</p>
          <p className="text-sm text-muted-foreground">Link survei ini sudah kedaluwarsa, sudah mencapai batas penggunaan, atau survei tidak lagi aktif.</p>
        </CardContent></Card>
      </div>
    );
  }
  if (step === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-sm w-full"><CardContent className="pt-6 text-center space-y-2">
          <AlertCircle className="size-8 mx-auto text-destructive" />
          <p className="font-medium">Terjadi kesalahan</p>
          <p className="text-sm text-muted-foreground">Silakan muat ulang halaman ini dan coba lagi.</p>
        </CardContent></Card>
      </div>
    );
  }
  if (step === 'done') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-sm w-full"><CardContent className="pt-6 text-center space-y-2">
          <CheckCircle2 className="size-10 mx-auto text-emerald-500" />
          <p className="font-medium">Survey telah berhasil dikirim.</p>
          <p className="text-sm text-muted-foreground">Terima kasih atas partisipasi Anda. Jawaban Anda tersimpan secara anonim.</p>
        </CardContent></Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/20 py-8 px-4">
      <div className="max-w-lg mx-auto space-y-4">
        <Progress value={progressPct} />

        {step === 'intro' && info && (
          <Card>
            <CardHeader className="text-center"><ShieldCheck className="size-7 mx-auto text-primary mb-1" /><CardTitle>{info.name}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Survey ini bertujuan untuk mengetahui persepsi staf mengenai budaya keselamatan pasien.
              </p>
              <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                <li>Jawaban digunakan untuk peningkatan mutu.</li>
                <li>Hasil dianalisis secara agregat.</li>
                <li>Kerahasiaan responden dijaga{info.anonymityMode === 'anonymous' ? ' — survei ini ANONIM' : ''}.</li>
                <li>Tidak ada konsekuensi individual berdasarkan jawaban survei.</li>
              </ul>
              <div className="flex items-start gap-2 pt-2">
                <Checkbox id="consent" checked={consented} onCheckedChange={(v) => setConsented(!!v)} />
                <Label htmlFor="consent" className="font-normal cursor-pointer">Saya bersedia mengikuti survey.</Label>
              </div>
              <Button className="w-full" disabled={!consented} onClick={() => setStep('unit')}>Lanjutkan</Button>
            </CardContent>
          </Card>
        )}

        {step === 'unit' && info && (
          <Card>
            <CardHeader><CardTitle className="text-base">Unit Kerja Anda</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <RadioGroup value={unitId} onValueChange={setUnitId} className="space-y-1.5">
                {info.units.map((u) => (
                  <div key={u.id} className="flex items-center gap-2">
                    <RadioGroupItem value={u.id} id={`unit-${u.id}`} />
                    <Label htmlFor={`unit-${u.id}`} className="font-normal cursor-pointer">{u.name}</Label>
                  </div>
                ))}
              </RadioGroup>
              {validationError && <p className="text-sm text-destructive">{validationError}</p>}
              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={() => setStep('intro')}>Sebelumnya</Button>
                <Button disabled={!unitId || starting} onClick={handleStart}>{starting && <Loader2 className="size-4 mr-1 animate-spin" />} Mulai Mengisi</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {sectionsWithQuestions.includes(step as BudayaSection) && (
          <Card>
            <CardHeader><CardTitle className="text-base">{SECTION_TITLE[step as BudayaSection]}</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              {questions.filter((q) => q.section === step).map((q) => (
                <div key={q.id}>
                  {q.scaleType === 'likert_agree' || q.scaleType === 'likert_frequency'
                    ? likertQuestion(q, answers[q.id]?.raw, (v) => setAnswer(q.id, { raw: v }))
                    : q.scaleType === 'free_text'
                      ? (
                        <div className="space-y-2">
                          <p className="text-sm">{q.questionText}</p>
                          <Textarea rows={4} value={answers[q.id]?.text ?? ''} onChange={(e) => setAnswer(q.id, { text: e.target.value })} />
                        </div>
                      )
                      : choiceQuestion(q, answers[q.id]?.text, (v) => setAnswer(q.id, { text: v }))}
                </div>
              ))}
              {validationError && <p className="text-sm text-destructive">{validationError}</p>}
              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={goPrev}>Sebelumnya</Button>
                <Button onClick={goNext}>Berikutnya</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 'review' && (
          <Card>
            <CardHeader><CardTitle className="text-base">Review</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Anda telah menjawab {Object.keys(answers).length} dari {questions.length} pertanyaan. Pastikan semua bagian sudah terisi sebelum mengirim — survei tidak dapat diisi ulang setelah dikirim.
              </p>
              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={() => setStep(sectionsWithQuestions[sectionsWithQuestions.length - 1])}>Sebelumnya</Button>
                <Button onClick={handleSubmitSurvey}>Kirim Survey</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 'submitting' && (
          <div className="flex items-center justify-center py-10 text-muted-foreground"><Loader2 className="size-5 animate-spin mr-2" /> Mengirim…</div>
        )}
      </div>
    </div>
  );
}
