'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, FileSearch, ListChecks, Microscope } from 'lucide-react';
import {
  type IkpIncident, type IkpAction,
  IKP_STATUS_LABEL, IKP_STATUS_COLOR, IKP_ACTION_STATUS_LABEL, getSeverityMeta,
} from '@/types/ikp';
import { getIkpIncidents, getAllIkpActions } from '@/lib/ikpData';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale/id';

type WorklistMode = 'investigasi' | 'analisis' | 'tindak_lanjut';

const MODE_META: Record<WorklistMode, { title: string; description: string; icon: any }> = {
  investigasi: {
    title: 'Investigasi Insiden',
    description: 'Insiden dengan status Investigasi — memerlukan tindak lanjut investigasi oleh Tim Keselamatan Pasien.',
    icon: FileSearch,
  },
  analisis: {
    title: 'Analisis IKP',
    description: 'Insiden dengan grading Kuning/Merah yang memerlukan analisis akar masalah (RCA).',
    icon: Microscope,
  },
  tindak_lanjut: {
    title: 'Tindak Lanjut',
    description: 'Seluruh rencana tindak lanjut (corrective/preventive action) lintas insiden.',
    icon: ListChecks,
  },
};

interface IkpWorklistPanelProps {
  mode: WorklistMode;
  onSelectIncident: (incidentId: string, focusTab: string) => void;
}

export function IkpWorklistPanel({ mode, onSelectIncident }: IkpWorklistPanelProps) {
  const [incidents, setIncidents] = useState<IkpIncident[]>([]);
  const [actions, setActions] = useState<IkpAction[]>([]);
  const [loading, setLoading] = useState(true);
  const meta = MODE_META[mode];

  useEffect(() => {
    setLoading(true);
    (async () => {
      if (mode === 'tindak_lanjut') {
        setActions(await getAllIkpActions());
      } else if (mode === 'investigasi') {
        setIncidents(await getIkpIncidents({ status: 'investigasi' }));
      } else {
        const all = await getIkpIncidents();
        setIncidents(all.filter((i) => i.severityGrade === 'kuning' || i.severityGrade === 'merah'));
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
      ) : mode === 'tindak_lanjut' ? (
        <div className="space-y-2">
          {actions.length === 0 && <p className="text-sm text-muted-foreground">Tidak ada tindak lanjut.</p>}
          {actions.map((a) => (
            <Card key={a.id} className="cursor-pointer hover:bg-muted/40" onClick={() => onSelectIncident(a.incidentId, 'tindak-lanjut')}>
              <CardContent className="pt-4 pb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{a.action}</p>
                  <p className="text-xs text-muted-foreground">PIC: {a.picName || '—'} · Target: {a.dueDate ? format(new Date(a.dueDate), 'd MMM yyyy', { locale: idLocale }) : '—'}</p>
                </div>
                <Badge variant={a.status === 'terlambat' ? 'destructive' : 'outline'} className="text-[10px] shrink-0">{IKP_ACTION_STATUS_LABEL[a.status]}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {incidents.length === 0 && <p className="text-sm text-muted-foreground">Tidak ada insiden pada kategori ini.</p>}
          {incidents.map((i) => (
            <Card key={i.id} className="cursor-pointer hover:bg-muted/40" onClick={() => onSelectIncident(i.id, mode === 'analisis' ? 'analisis' : 'investigasi')}>
              <CardContent className="pt-4 pb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium font-mono">{i.reportNumber}</p>
                  <p className="text-xs text-muted-foreground">{i.incidentSummary || i.kpcDescription || '—'}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {i.severityGrade && (
                    <Badge style={{ backgroundColor: getSeverityMeta(i.severityGrade)?.color, color: 'white', border: 'none' }} className="text-[10px]">
                      {getSeverityMeta(i.severityGrade)?.label}
                    </Badge>
                  )}
                  <Badge variant="outline" style={{ borderColor: IKP_STATUS_COLOR[i.status], color: IKP_STATUS_COLOR[i.status] }} className="text-[10px]">
                    {IKP_STATUS_LABEL[i.status]}
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
