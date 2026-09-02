'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { HeartHandshake } from 'lucide-react';

/**
 * Halaman masuk untuk responden yang punya KODE AKSES (bukan link/QR
 * langsung) — pola identik src/app/survey-budaya/page.tsx. Link publik/QR
 * langsung mengarah ke /survey-kepuasan/[token] tanpa lewat halaman ini.
 */
export default function SurveyKepuasanEntryPage() {
  const router = useRouter();
  const [code, setCode] = useState('');

  const handleSubmit = () => {
    const trimmed = code.trim();
    if (trimmed) router.push(`/survey-kepuasan/${encodeURIComponent(trimmed)}`);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <HeartHandshake className="size-8 mx-auto text-primary mb-2" />
          <CardTitle>Survey Kepuasan Pasien</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground text-center">Masukkan kode akses yang diberikan oleh petugas untuk mulai mengisi survei.</p>
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
