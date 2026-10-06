'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2, ShieldCheck, Copy } from 'lucide-react';
import { toastSuccess, toastError } from '@/lib/toast-helpers';

/** AI OPPE Analysis — decision support, memakai arsitektur AI existing (/api/* + DeepSeek service). */
export function OppeAiPanel({ evaluationId, onUseAsDraft }: { evaluationId: string; onUseAsDraft?: (text: string) => void }) {
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch('/api/oppe-ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ evaluationId }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Analisis AI gagal dibuat.');
      setText(body.analysis);
    } catch (e) {
      console.error('[OPPE AI]', e);
      setErr(e instanceof Error ? e.message : 'Analisis AI gagal dibuat. Silakan coba kembali.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-sky-500/30 bg-sky-500/10 p-3 text-xs flex items-start gap-2">
        <ShieldCheck className="size-4 text-sky-500 shrink-0 mt-0.5" />
        <p>AI hanya sebagai <b>Decision Support</b>: merangkum hasil, menyorot indikator bermasalah, tren, trigger, dan menyusun draf rekomendasi.
          AI <b>tidak</b> mengambil keputusan credentialing — keputusan final tetap oleh Komite Medik / pejabat berwenang.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={run} disabled={loading} className="gap-1.5">{loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}{text ? 'Analisis ulang' : 'Buat Analisis AI'}</Button>
        {text && (
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => { navigator.clipboard?.writeText(text).then(() => toastSuccess('Disalin'), () => toastError('Gagal menyalin')); }}>
            <Copy className="size-4" />Salin
          </Button>
        )}
        {text && onUseAsDraft && (
          <Button size="sm" variant="outline" onClick={() => {
            const m = text.match(/### Rekomendasi\s*([\s\S]*?)(###|$)/);
            onUseAsDraft((m?.[1] ?? text).trim());
          }}>Pakai sebagai draf rekomendasi</Button>
        )}
      </div>
      {err && <p className="text-sm text-red-500">{err}</p>}
      {text && (
        <div className="prose prose-sm dark:prose-invert max-w-none rounded-md border p-3 text-sm [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-3 [&_ul]:list-disc [&_ul]:pl-5">
          <ReactMarkdown>{text}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}
