'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Copy, QrCode, Link as LinkIcon, KeyRound, Printer, Download } from 'lucide-react';
import { getKepuasanSurveys, getKepuasanSurveyTokens, createKepuasanSurveyToken, buildKepuasanQrImageUrl } from '@/lib/kepuasanData';
import type { KepuasanSurvey, KepuasanSurveyToken } from '@/types/kepuasan';

export function KepuasanDistribusiPanel({ surveyId, userId }: { surveyId?: string; userId: string }) {
  const [surveys, setSurveys] = useState<KepuasanSurvey[]>([]);
  const [selected, setSelected] = useState<string | undefined>(surveyId);
  const [tokens, setTokens] = useState<KepuasanSurveyToken[]>([]);
  const [creating, setCreating] = useState(false);
  const [qrToken, setQrToken] = useState<KepuasanSurveyToken | null>(null);

  useEffect(() => { getKepuasanSurveys({ status: 'aktif' }).then(setSurveys); }, []);
  useEffect(() => {
    if (selected) getKepuasanSurveyTokens(selected).then(setTokens);
    setQrToken(null);
  }, [selected]);

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  const handleCreate = async (kind: 'public_link' | 'qr' | 'access_code') => {
    if (!selected) return;
    setCreating(true);
    try {
      const created = await createKepuasanSurveyToken({ surveyId: selected, kind, createdBy: userId });
      const all = await getKepuasanSurveyTokens(selected);
      setTokens(all);
      if (kind === 'qr') setQrToken(created);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Distribusi Survey Kepuasan Pasien</h2>
      <div className="flex flex-wrap gap-2">
        {surveys.map((s) => (
          <Button key={s.id} size="sm" variant={selected === s.id ? 'default' : 'outline'} onClick={() => setSelected(s.id)}>{s.name}</Button>
        ))}
        {surveys.length === 0 && <p className="text-sm text-muted-foreground">Tidak ada survei berstatus Aktif — ubah status survei ke Aktif dulu untuk mendistribusikan.</p>}
      </div>

      {selected && (
        <Card>
          <CardHeader><CardTitle className="text-base">Link, QR Code & Kode Akses</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" disabled={creating} onClick={() => handleCreate('public_link')}><LinkIcon className="size-4 mr-1" /> Buat Public Link</Button>
              <Button size="sm" variant="outline" disabled={creating} onClick={() => handleCreate('qr')}>{creating ? <Loader2 className="size-4 mr-1 animate-spin" /> : <QrCode className="size-4 mr-1" />} Buat QR Code</Button>
              <Button size="sm" variant="outline" disabled={creating} onClick={() => handleCreate('access_code')}><KeyRound className="size-4 mr-1" /> Buat Access Code</Button>
            </div>

            {qrToken && (
              <div className="flex flex-col items-center gap-2 border rounded-lg p-4 print:border-none" id="kepuasan-qr-print">
                <img
                  src={buildKepuasanQrImageUrl(`${baseUrl}/survey-kepuasan/${qrToken.token}`, 320)}
                  alt="QR Code Survey Kepuasan Pasien"
                  className="size-56"
                />
                <p className="text-sm font-semibold text-center">SCAN UNTUK MENGISI SURVEY KEPUASAN PASIEN</p>
                <div className="flex gap-2 print:hidden">
                  <Button size="sm" variant="outline" onClick={() => window.print()}><Printer className="size-3.5 mr-1" /> Print</Button>
                  <Button size="sm" variant="outline" asChild>
                    <a href={buildKepuasanQrImageUrl(`${baseUrl}/survey-kepuasan/${qrToken.token}`, 600)} download={`qr-kepuasan-${qrToken.token}.png`}>
                      <Download className="size-3.5 mr-1" /> Download PNG
                    </a>
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {tokens.map((t) => {
                const url = `${baseUrl}/survey-kepuasan/${t.token}`;
                return (
                  <div key={t.id} className="flex items-center justify-between gap-2 text-sm border rounded-md p-2">
                    <div className="min-w-0">
                      <Badge variant="outline" className="mr-2">{t.kind === 'public_link' ? 'Link' : t.kind === 'qr' ? 'QR' : 'Kode Akses'}</Badge>
                      <span className="truncate">{t.kind === 'access_code' ? t.token : url}</span>
                      <span className="text-xs text-muted-foreground ml-2">({t.usedCount}x dipakai)</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {t.kind === 'qr' && (
                        <Button size="icon" variant="ghost" onClick={() => setQrToken(t)}><QrCode className="size-4" /></Button>
                      )}
                      <Button size="icon" variant="ghost" onClick={() => navigator.clipboard.writeText(t.kind === 'access_code' ? t.token : url)}><Copy className="size-4" /></Button>
                    </div>
                  </div>
                );
              })}
              {tokens.length === 0 && <p className="text-sm text-muted-foreground">Belum ada link/QR/kode dibuat untuk survei ini.</p>}
            </div>

            <p className="text-xs text-muted-foreground pt-1">
              Satu link/QR/kode akses yang sama boleh dipakai berkali-kali dari perangkat yang sama — tidak ada pembatasan jumlah pengisian per perangkat (cocok untuk tablet di loket/poliklinik).
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
