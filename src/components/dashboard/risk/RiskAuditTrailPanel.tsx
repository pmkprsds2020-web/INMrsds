'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { History, Loader2 } from 'lucide-react';
import { type RiskAuditEntry } from '@/types/risk';
import { getRiskAuditTrail } from '@/lib/riskData';

export function RiskAuditTrailPanel() {
  const [logs, setLogs] = useState<RiskAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getRiskAuditTrail(undefined, 300).then((l) => { setLogs(l); setLoading(false); });
  }, []);

  return (
    <div className="p-4 space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center gap-2">
        <History className="size-5 text-primary" />
        <div>
          <h2 className="text-lg font-semibold">Audit Trail — Modul Manajemen Risiko</h2>
          <p className="text-xs text-muted-foreground">
            Seluruh perubahan penting pada modul Manajemen Risiko (identifikasi, analisis, evaluasi,
            mitigasi, monitoring, review, perubahan status) tercatat di sini — tidak ada perubahan
            data tanpa riwayat.
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
          ) : logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada aktivitas.</p>
          ) : (
            <div className="space-y-2">
              {logs.map((l) => (
                <div key={l.id} className="flex items-start justify-between gap-3 border-b pb-2 last:border-0 text-sm">
                  <div>
                    <p>{l.msg}</p>
                    <p className="text-xs text-muted-foreground">{l.ts}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px] shrink-0">{l.badge}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
