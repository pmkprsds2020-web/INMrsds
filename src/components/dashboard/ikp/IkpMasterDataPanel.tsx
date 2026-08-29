'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Database } from 'lucide-react';
import {
  IKP_INCIDENT_TYPES, IKP_SEVERITY_GRADES, IKP_PATIENT_IMPACTS, IKP_AGE_GROUPS,
  IKP_PAYER_TYPES, IKP_REPORTER_CATEGORIES, IKP_SERVICE_UNITS, IKP_INVESTIGATION_METHODS,
  IKP_CONTRIBUTING_FACTORS, IKP_REPORTING_DEADLINE_HOURS,
} from '@/types/ikp';
import { IkpUserManagementPanel } from './IkpUserManagementPanel';

function Section({ title, source, children }: { title: string; source: 'dokumen' | 'perlu-konfirmasi'; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm">{title}</CardTitle>
        <Badge variant={source === 'dokumen' ? 'secondary' : 'outline'} className="text-[10px]">
          {source === 'dokumen' ? 'Sumber: dokumen' : 'Perlu konfirmasi'}
        </Badge>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function IkpMasterDataPanel({ isAdmin, currentUserId }: { isAdmin: boolean; currentUserId: string }) {
  return (
    <div className="p-4 space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center gap-2">
        <Database className="size-5 text-primary" />
        <div>
          <h2 className="text-lg font-semibold">Master Data IKP</h2>
          <p className="text-xs text-muted-foreground">
            Referensi klasifikasi baku (read-only). Untuk mengubah, hubungi administrator sistem — perubahan
            perlu disetujui Tim Keselamatan Pasien agar konsisten dengan seluruh laporan yang sudah ada.
          </p>
        </div>
      </div>

      {isAdmin && <IkpUserManagementPanel currentUserId={currentUserId} />}

      <Section title="Jenis Insiden" source="dokumen">
        <ul className="space-y-1.5 text-sm">
          {IKP_INCIDENT_TYPES.map((t) => <li key={t.id}><b>{t.label}</b> — <span className="text-muted-foreground">{t.description}</span></li>)}
        </ul>
      </Section>

      <Section title="Akibat Insiden Terhadap Pasien" source="dokumen">
        <div className="flex flex-wrap gap-2">{IKP_PATIENT_IMPACTS.map((p) => <Badge key={p.id} variant="outline">{p.label}</Badge>)}</div>
      </Section>

      <Section title="Grading Risiko" source="perlu-konfirmasi">
        <div className="grid sm:grid-cols-2 gap-2">
          {IKP_SEVERITY_GRADES.map((g) => (
            <div key={g.id} className="rounded-lg border p-2.5 text-sm">
              <div className="flex items-center gap-2 font-medium"><span className="size-2.5 rounded-full" style={{ backgroundColor: g.color }} />{g.label}</div>
              <p className="text-xs text-muted-foreground mt-1">{g.definition}</p>
              <p className="text-xs text-muted-foreground">{g.investigationNote}</p>
            </div>
          ))}
        </div>
      </Section>

      <div className="grid sm:grid-cols-2 gap-4">
        <Section title="Kelompok Umur Pasien" source="dokumen">
          <div className="flex flex-wrap gap-2">{IKP_AGE_GROUPS.map((g) => <Badge key={g.id} variant="outline">{g.label}</Badge>)}</div>
        </Section>
        <Section title="Penanggung Biaya Pasien" source="dokumen">
          <div className="flex flex-wrap gap-2">{IKP_PAYER_TYPES.map((p) => <Badge key={p.id} variant="outline">{p.label}</Badge>)}</div>
        </Section>
        <Section title="Orang Pertama yang Melaporkan" source="dokumen">
          <div className="flex flex-wrap gap-2">{IKP_REPORTER_CATEGORIES.map((c) => <Badge key={c.id} variant="outline">{c.label}</Badge>)}</div>
        </Section>
        <Section title="Unit Pelayanan Pasien" source="dokumen">
          <div className="flex flex-wrap gap-2">{IKP_SERVICE_UNITS.map((u) => <Badge key={u} variant="outline">{u}</Badge>)}</div>
        </Section>
        <Section title="Metode Investigasi" source="perlu-konfirmasi">
          <div className="flex flex-wrap gap-2">{IKP_INVESTIGATION_METHODS.map((m) => <Badge key={m} variant="outline">{m}</Badge>)}</div>
        </Section>
        <Section title="Faktor Kontributor (RCA)" source="perlu-konfirmasi">
          <div className="flex flex-wrap gap-2">{IKP_CONTRIBUTING_FACTORS.map((f) => <Badge key={f.id} variant="outline">{f.label}</Badge>)}</div>
        </Section>
      </div>

      <Section title="Batas Waktu Pelaporan" source="dokumen">
        <p className="text-sm">Maksimal <b>{IKP_REPORTING_DEADLINE_HOURS} jam (2×24 jam)</b> sejak insiden/kondisi ditemukan.</p>
      </Section>
    </div>
  );
}
