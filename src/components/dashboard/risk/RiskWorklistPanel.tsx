'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Wrench, Activity, ClipboardCheck } from 'lucide-react';
import {
  type Risk, RISK_STATUS_LABEL, RISK_STATUS_COLOR, RISK_LEVEL_LABEL, RISK_LEVEL_COLOR,
  RISK_MITIGATION_STATUS_LABEL,
} from '@/types/risk';
import { getRisks, getAllRiskMitigations } from '@/lib/riskData';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale/id';

type WorklistMode = 'mitigasi' | 'monitoring' | 'review';

const MODE_META: Record<WorklistMode, { title: string; description: string; icon: any; tab: string }> = {
  mitigasi: {
    title: 'Pengelolaan Risiko (Mitigasi)',
    description: 'Seluruh rencana mitigasi lintas-risiko — urutkan berdasarkan target penyelesaian.',
    icon: Wrench,
    tab: 'mitigasi',
  },
  monitoring: {
    title: 'Monitoring Risiko',
    description: 'Risiko berstatus "Dalam Mitigasi" atau "Monitoring" yang perlu dipantau tindak lanjutnya.',
    icon: Activity,
    tab: 'monitoring',
  },
  review: {
    title: 'Review Risiko',
    description: 'Risiko yang siap direview ulang untuk menghitung Risiko Residual.',
    icon: ClipboardCheck,
    tab: 'review',
  },
};

interface RiskWorklistPanelProps {
  mode: WorklistMode;
  onSelectRisk: (riskId: string, focusTab: string) => void;
}

export function RiskWorklistPanel({ mode, onSelectRisk }: RiskWorklistPanelProps) {
  const [risks, setRisks] = useState<Risk[]>([]);
  const [mitigations, setMitigations] = useState<Awaited<ReturnType<typeof getAllRiskMitigations>>>([]);
  const [loading, setLoading] = useState(true);
  const meta = MODE_META[mode];

  useEffect(() => {
    setLoading(true);
    (async () => {
      if (mode === 'mitigasi') {
        setMitigations(await getAllRiskMitigations());
      } else if (mode === 'monitoring') {
        const all = await getRisks();
        setRisks(all.filter((r) => r.status === 'dalam_mitigasi' || r.status === 'monitoring'));
      } else {
        const all = await getRisks();
        setRisks(all.filter((r) => r.status === 'monitoring' || r.status === 'review' || r.status === 'dalam_mitigasi'));
      }
      setLoading(false);
    })();
  }, [mode]);

  return (
    <div className="p-4 space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center gap-2">
        <meta.icon className="size-5 text-primary" />
        <div>
          <h2 className="text-lg font-semibold">{meta.title}</h2>
          <p className="text-xs text-muted-foreground">{meta.description}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
      ) : mode === 'mitigasi' ? (
        <div className="space-y-2">
          {mitigations.length === 0 && <p className="text-sm text-muted-foreground">Belum ada rencana mitigasi.</p>}
          {mitigations.map((m) => (
            <Card key={m.id} className="cursor-pointer hover:bg-muted/40" onClick={() => onSelectRisk(m.riskId, 'mitigasi')}>
              <CardContent className="pt-4 pb-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{m.rencanaTindakan}</p>
                  <p className="text-xs text-muted-foreground">
                    PIC: {m.picName || '—'} · Target: {m.targetPenyelesaian ? format(new Date(m.targetPenyelesaian), 'd MMM yyyy', { locale: idLocale }) : '—'} · Progress: {m.progressPercent}%
                  </p>
                </div>
                <Badge variant={m.status === 'terlambat' ? 'destructive' : 'outline'} className="text-[10px] shrink-0">
                  {RISK_MITIGATION_STATUS_LABEL[m.status]}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {risks.length === 0 && <p className="text-sm text-muted-foreground">Tidak ada risiko pada kategori ini.</p>}
          {risks.map((r) => (
            <Card key={r.id} className="cursor-pointer hover:bg-muted/40" onClick={() => onSelectRisk(r.id, meta.tab)}>
              <CardContent className="pt-4 pb-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium font-mono">{r.riskCode}</p>
                  <p className="text-xs text-muted-foreground truncate">{r.risiko} · {r.unitLokasi}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {r.assessment && (
                    <Badge style={{ backgroundColor: RISK_LEVEL_COLOR[r.assessment.levelSkor], color: 'white', border: 'none' }} className="text-[10px]">
                      {RISK_LEVEL_LABEL[r.assessment.levelSkor]}
                    </Badge>
                  )}
                  <Badge variant="outline" style={{ borderColor: RISK_STATUS_COLOR[r.status], color: RISK_STATUS_COLOR[r.status] }} className="text-[10px]">
                    {RISK_STATUS_LABEL[r.status]}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
