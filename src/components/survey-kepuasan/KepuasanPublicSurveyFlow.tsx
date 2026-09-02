'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, HeartHandshake, CheckCircle2, AlertCircle } from 'lucide-react';
import { getKepuasanPublicSurvey, submitKepuasanResponse } from '@/lib/kepuasanData';
import {
  KEPUASAN_UNSUR_FIELDS, KEPUASAN_UNSUR_QUESTION, KEPUASAN_SCALE_LABEL,
  type KepuasanUnsurField, type KepuasanPublicSurveyInfo,
} from '@/types/kepuasan';
import { UNIT_MAP } from '@/types';

// Daftar unit untuk pilihan pasien ketika survei berlaku untuk "Semua Unit"
// — memakai daftar UnitId yang sudah ada di aplikasi (reuse, bukan master baru).
const UNIT_OPTIONS = Object.keys(UNIT_MAP).filter((k) => k !== 'all');

type Step = 'loading' | 'not_found' | 'intro' | number | 'review' | 'submitting' | 'done' | 'error';

const emptyScores = (): Record<KepuasanUnsurField, 1 | 2 | 3 | 4 | undefined> =>
  Object.fromEntries(KEPUASAN_UNSUR_FIELDS.map((f) => [f, undefined])) as any;

export function KepuasanPublicSurveyFlow({ token }: { token: string }) {
  const [step, setStep] = useState<Step>('loading');
  const [info, setInfo] = useState<KepuasanPublicSurveyInfo | null>(null);
  const [unitId, setUnitId] = useState('');
  const [respondentName, setRespondentName] = useState('');
  const [scores, setScores] = useState<Record<KepuasanUnsurField, 1 | 2 | 3 | 4 | undefined>>(emptyScores());
  const [kritikSaran, setKritikSaran] = useState('');
  const [willingToContact, setWillingToContact] = useState(false);
  const [contactPhone, setContactPhone] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [lastCode, setLastCode] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);

  const isKiosk = info?.surveyMode === 'kiosk' || info?.surveyMode === 'both';

  const loadSurvey = async () => {
    setStep('loading');
    try {
      const publicInfo = await getKepuasanPublicSurvey(token);
      if (!publicInfo) { setStep('not_found'); return; }
      setInfo(publicInfo);
      setStep('intro');
    } catch {
      setStep('error');
    }
  };

  useEffect(() => {
    loadSurvey();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Reset SELURUH state form ke kosong — dipakai baik oleh tombol "Isi
  // Survey Berikutnya" (bagian 15) maupun auto-reset Mode Kiosk (bagian 16).
  // SENGAJA tidak menyimpan/membawa apapun dari pengisian sebelumnya.
  const resetForm = () => {
    setUnitId(info?.unitId && info.unitId !== 'all' ? info.unitId : '');
    setRespondentName('');
    setScores(emptyScores());
    setKritikSaran('');
    setWillingToContact(false);
    setContactPhone('');
    setValidationError(null);
    setLastCode(null);
    setStep('intro');
  };

  // Auto-reset mode kiosk setelah submit berhasil.
  useEffect(() => {
    if (step !== 'done' || !isKiosk) return;
    const seconds = info?.kioskResetSeconds ?? 5;
    setCountdown(seconds);
    const interval = setInterval(() => {
      setCountdown((c) => (c === null ? null : c - 1));
    }, 1000);
    const timeout = setTimeout(() => {
      clearInterval(interval);
      resetForm();
    }, seconds * 1000);
    return () => { clearInterval(interval); clearTimeout(timeout); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, isKiosk]);

  const unansweredCount = useMemo(() => KEPUASAN_UNSUR_FIELDS.filter((f) => !scores[f]).length, [scores]);

  const handleSubmit = async () => {
    if (info?.unitId === 'all' && !unitId) {
      setValidationError('Pilih unit pelayanan terlebih dahulu.');
      return;
    }
    if (unansweredCount > 0) {
      setValidationError('Seluruh 9 unsur pelayanan wajib dinilai sebelum mengirim.');
      return;
    }
    setValidationError(null);
    setStep('submitting');
    setSubmitting(true);
    try {
      const { responseCode } = await submitKepuasanResponse({
        token,
        unitId: info?.unitId === 'all' ? unitId : undefined,
        respondentName: respondentName.trim() || undefined,
        scores: scores as Record<KepuasanUnsurField, 1 | 2 | 3 | 4>,
        kritikSaran: kritikSaran.trim() || undefined,
        willingToContact,
        contactPhone: willingToContact ? contactPhone.trim() || undefined : undefined,
        source: isKiosk ? 'kiosk' : 'online',
      });
      setLastCode(responseCode);
      setStep('done');
    } catch {
      setValidationError('Gagal mengirim survei. Periksa koneksi internet Anda dan coba lagi.');
      setStep('review');
    } finally {
      setSubmitting(false);
    }
  };

  const progressPct = step === 'intro' ? 5 : step === 'review' ? 95 : step === 'done' ? 100
    : typeof step === 'number' ? Math.round(((step + 1) / (KEPUASAN_UNSUR_FIELDS.length + 1)) * 100) : 0;

  if (step === 'loading') {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="size-6 animate-spin mr-2" /> Memuat survei…</div>;
  }
  if (step === 'not_found') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-sm w-full"><CardContent className="pt-6 text-center space-y-2">
          <AlertCircle className="size-8 mx-auto text-amber-500" />
          <p className="font-medium">Survei tidak ditemukan</p>
          <p className="text-sm text-muted-foreground">Link ini sudah kedaluwarsa, di luar periode pengisian, atau survei tidak lagi aktif.</p>
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
        <Card className="max-w-sm w-full"><CardContent className="pt-6 text-center space-y-3">
          <CheckCircle2 className="size-10 mx-auto text-emerald-500" />
          <p className="font-medium">Survei Anda telah berhasil dikirim.</p>
          <p className="text-sm text-muted-foreground">Terima kasih atas partisipasi Anda dalam meningkatkan mutu pelayanan kami.{lastCode ? ` (${lastCode})` : ''}</p>
          {isKiosk ? (
            <p className="text-xs text-muted-foreground">Form berikutnya akan muncul dalam {countdown ?? info?.kioskResetSeconds ?? 5} detik…</p>
          ) : (
            <Button className="w-full" size="lg" onClick={resetForm}>Isi Survey Berikutnya</Button>
          )}
        </CardContent></Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/20 py-6 px-4">
      <div className="max-w-lg mx-auto space-y-4">
        <Progress value={progressPct} />

        {step === 'intro' && info && (
          <Card>
            <CardHeader className="text-center">
              <HeartHandshake className="size-8 mx-auto text-primary mb-1" />
              <CardTitle className="text-lg">SURVEY KEPUASAN PASIEN</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm font-medium text-center">{info.name}</p>
              {info.description && <p className="text-sm text-muted-foreground text-center">{info.description}</p>}
              <p className="text-sm text-muted-foreground text-center">
                Bantu kami meningkatkan kualitas pelayanan dengan memberikan penilaian terhadap pengalaman Anda. Pengisian tidak memerlukan login dan hanya membutuhkan waktu singkat.
              </p>

              {info.unitId === 'all' && (
                <div className="space-y-2 pt-1">
                  <Label>Unit pelayanan yang Anda gunakan</Label>
                  <RadioGroup value={unitId} onValueChange={setUnitId} className="space-y-1.5">
                    {UNIT_OPTIONS.map((u) => (
                      <div key={u} className="flex items-center gap-2">
                        <RadioGroupItem value={u} id={`unit-${u}`} />
                        <Label htmlFor={`unit-${u}`} className="font-normal cursor-pointer">{u}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="respondent-name">Nama Anda (opsional)</Label>
                <Input id="respondent-name" placeholder="Masukkan nama Anda (opsional)" value={respondentName} onChange={(e) => setRespondentName(e.target.value)} />
              </div>

              {validationError && <p className="text-sm text-destructive">{validationError}</p>}
              <Button
                className="w-full"
                size="lg"
                onClick={() => {
                  if (info.unitId === 'all' && !unitId) { setValidationError('Pilih unit pelayanan terlebih dahulu.'); return; }
                  setValidationError(null);
                  setStep(0);
                }}
              >
                Mulai Mengisi
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Data Anda digunakan hanya untuk keperluan peningkatan mutu pelayanan.
              </p>
            </CardContent>
          </Card>
        )}

        {typeof step === 'number' && (
          <Card>
            <CardHeader>
              <p className="text-xs text-muted-foreground">Pertanyaan {step + 1} dari {KEPUASAN_UNSUR_FIELDS.length}</p>
              <CardTitle className="text-base leading-snug">{KEPUASAN_UNSUR_QUESTION[KEPUASAN_UNSUR_FIELDS[step]]}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 gap-2">
                {[1, 2, 3, 4].map((n) => {
                  const field = KEPUASAN_UNSUR_FIELDS[step];
                  const selected = scores[field] === n;
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setScores((prev) => ({ ...prev, [field]: n as 1 | 2 | 3 | 4 }))}
                      className={`text-left px-4 py-3.5 rounded-lg border text-sm font-medium transition-colors ${
                        selected ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted border-border'
                      }`}
                    >
                      {n} — {KEPUASAN_SCALE_LABEL[n as 1 | 2 | 3 | 4]}
                    </button>
                  );
                })}
              </div>
              {validationError && <p className="text-sm text-destructive">{validationError}</p>}
              <div className="flex justify-between pt-1">
                <Button variant="outline" onClick={() => setStep(step === 0 ? 'intro' : step - 1)}>Sebelumnya</Button>
                <Button
                  disabled={!scores[KEPUASAN_UNSUR_FIELDS[step]]}
                  onClick={() => setStep(step === KEPUASAN_UNSUR_FIELDS.length - 1 ? 'review' : step + 1)}
                >
                  Berikutnya
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 'review' && (
          <Card>
            <CardHeader><CardTitle className="text-base">Kritik dan Saran</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="kritik-saran">Tuliskan kritik, saran, atau masukan Anda untuk meningkatkan pelayanan kami (opsional)</Label>
                <Textarea id="kritik-saran" rows={4} value={kritikSaran} onChange={(e) => setKritikSaran(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label>Apakah Anda bersedia dihubungi terkait masukan Anda?</Label>
                <RadioGroup value={willingToContact ? 'ya' : 'tidak'} onValueChange={(v) => setWillingToContact(v === 'ya')} className="flex gap-4">
                  <div className="flex items-center gap-2"><RadioGroupItem value="ya" id="wc-ya" /><Label htmlFor="wc-ya" className="font-normal cursor-pointer">Ya</Label></div>
                  <div className="flex items-center gap-2"><RadioGroupItem value="tidak" id="wc-tidak" /><Label htmlFor="wc-tidak" className="font-normal cursor-pointer">Tidak</Label></div>
                </RadioGroup>
              </div>

              {willingToContact && (
                <div className="space-y-2">
                  <Label htmlFor="contact-phone">Nomor WhatsApp/Telepon (opsional)</Label>
                  <Input id="contact-phone" placeholder="08xx-xxxx-xxxx" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
                </div>
              )}

              <p className="text-sm text-muted-foreground pt-2">Apakah Anda yakin jawaban yang diberikan sudah benar? Survei tidak dapat diubah setelah dikirim.</p>
              {validationError && <p className="text-sm text-destructive">{validationError}</p>}
              <div className="flex justify-between pt-1">
                <Button variant="outline" onClick={() => setStep(KEPUASAN_UNSUR_FIELDS.length - 1)}>Sebelumnya</Button>
                <Button size="lg" onClick={handleSubmit} disabled={submitting}>{submitting && <Loader2 className="size-4 mr-1 animate-spin" />} Kirim Survey</Button>
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
