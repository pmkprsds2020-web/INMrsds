'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ShieldCheck } from 'lucide-react';

/**
 * Halaman masuk untuk responden yang punya KODE AKSES (bukan link/QR
 * langsung) — poin AI. Link publik/QR langsung mengarah ke
 * /survey-budaya/[token] tanpa lewat halaman ini.
 */
export default function SurveyBudayaEntryPage() {
  const router = useRouter();
  const [code, setCode] = useState('');

  const handleSubmit = () => {
    const trimmed = code.trim();
    if (trimmed) router.push(`/survey-budaya/${encodeURIComponent(trimmed)}`);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <ShieldCheck className="size-8 mx-auto text-primary mb-2" />
          <CardTitle>Survey Budaya Keselamatan Pasien</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground text-center">Masukkan kode akses yang diberikan oleh Komite Mutu untuk mulai mengisi survei.</p>
          <Input
            placeholder="Kode akses"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          />
          <Button className="w-full" onClick={handleSubmit} disabled={!code.trim()}>Masuk</Button>
        </CardContent>
      </Card>
    </div>
  );
}
