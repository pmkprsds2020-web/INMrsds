'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, CheckCircle2, CircleDashed, ShieldAlert } from 'lucide-react';
import type { OppeCategoryScore, OppeResultCategory } from '@/types/oppe';
import { fmtNum } from '@/lib/oppeScoring';
import { OppeTrendBadge } from './OppeShared';
import type { OppeTrend } from '@/types/oppe';

interface Props {
  categoryScores: OppeCategoryScore[];
  finalScore: number | null;
  finalCategory: OppeResultCategory | null;
  metCount: number;
  attentionCount: number;
  triggerCount: number;
  noDataCount: number;
  criticalTriggerNames: string[];
  trend?: OppeTrend | null;
  previousScore?: number | null;
  live?: boolean;
}

/** Ringkasan skor: per kategori × bobot, total, kategori hasil, dan peringatan trigger kritis (poin 18–20, 25). */
export function OppeScoreSummary(p: Props) {
  const color = p.finalCategory?.color ?? '#94a3b8';
  return (
    <div className="space-y-3">
      {p.criticalTriggerNames.length > 0 && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 flex items-start gap-2">
          <ShieldAlert className="size-5 text-red-500 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-red-600 dark:text-red-400">Terdapat indikator kritis yang terkena trigger.</p>
            <p className="text-xs mt-0.5">{p.criticalTriggerNames.join('; ')}</p>
            <p className="text-xs mt-1 font-medium">Perlu evaluasi lebih lanjut / FPPE sesuai keputusan Komite Medik — skor total tidak menjadi satu-satunya penentu.</p>
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {p.categoryScores.map((c) => (
          <Card key={c.code}>
            <CardContent className="pt-4 pb-3 space-y-1.5">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground leading-tight">{c.code}. {c.name}</p>
              <p className="text-xl font-bold">{fmtNum(c.score)}</p>
              <Progress value={c.score ?? 0} className="h-1.5" />
              <p className="text-[11px] text-muted-foreground">× {fmtNum(c.weight)}% = <b className="text-foreground">{fmtNum(c.weighted)}</b> · {c.metCount}/{c.itemCount} memenuhi</p>
            </CardContent>
          </Card>
        ))}
        <Card className="col-span-2" style={{ borderColor: color }}>
          <CardContent className="pt-4 pb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Skor Akhir Terbobot {p.live && <span className="normal-case text-amber-600">(pratinjau — belum disimpan)</span>}</p>
              <p className="text-3xl font-bold" style={{ color }}>{fmtNum(p.finalScore)}</p>
              <p className="text-sm font-semibold" style={{ color }}>{p.finalCategory?.label ?? 'Belum ada kategori'}</p>
              {p.previousScore !== undefined && p.previousScore !== null && (
                <p className="text-[11px] text-muted-foreground mt-1">Periode sebelumnya {fmtNum(p.previousScore)} · <OppeTrendBadge trend={p.trend ?? null} /></p>
              )}
            </div>
            <div className="text-xs space-y-1 text-right">
              <p className="flex items-center justify-end gap-1"><CheckCircle2 className="size-3.5 text-green-500" />{p.metCount} memenuhi</p>
              <p className="flex items-center justify-end gap-1"><AlertTriangle className="size-3.5 text-amber-500" />{p.attentionCount} perlu perhatian</p>
              <p className="flex items-center justify-end gap-1"><ShieldAlert className="size-3.5 text-red-500" />{p.triggerCount} trigger</p>
              <p className="flex items-center justify-end gap-1"><CircleDashed className="size-3.5 text-slate-400" />{p.noDataCount} belum ada data</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
