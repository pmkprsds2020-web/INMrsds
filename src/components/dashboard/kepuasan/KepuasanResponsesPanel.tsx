'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2 } from 'lucide-react';
import { getKepuasanSurveys, getKepuasanResponses } from '@/lib/kepuasanData';
import { type KepuasanSurvey, type KepuasanResponse } from '@/types/kepuasan';
import { ImportButton } from '@/components/import/ImportButton';
import { TemplateDownloadButton } from '@/components/import/TemplateDownloadButton';
import { ExportButton } from '@/components/import/ExportButton';
import { kepuasanImportConfig } from '@/lib/import-engine/configs/kepuasan';

export function KepuasanResponsesPanel({ surveyId: initialSurveyId, userId, onSelectSurvey }: { surveyId?: string; userId: string; onSelectSurvey: (id: string, tab?: string) => void }) {
  void onSelectSurvey;
  const [surveys, setSurveys] = useState<KepuasanSurvey[]>([]);
  const [selected, setSelected] = useState<string | undefined>(initialSurveyId);
  const [responses, setResponses] = useState<KepuasanResponse[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getKepuasanSurveys().then((all) => {
      setSurveys(all);
      if (!selected && all.length > 0) setSelected(initialSurveyId ?? all[0].id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reload = async (id: string) => {
    setLoading(true);
    try {
      setResponses(await getKepuasanResponses(id));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selected) reload(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  const exportRows = responses.map((r) => ({
    survey_id: selected,
    unit_id: r.unitId,
    respondent_name: r.respondentName ?? '',
    u1_persyaratan: r.scores.u1_persyaratan,
    u2_prosedur: r.scores.u2_prosedur,
    u3_waktu: r.scores.u3_waktu,
    u4_biaya: r.scores.u4_biaya,
    u5_produk_layanan: r.scores.u5_produk_layanan,
    u6_kompetensi_pelaksana: r.scores.u6_kompetensi_pelaksana,
    u7_perilaku_pelaksana: r.scores.u7_perilaku_pelaksana,
    u8_penanganan_pengaduan: r.scores.u8_penanganan_pengaduan,
    u9_sarana_prasarana: r.scores.u9_sarana_prasarana,
    kritik_saran: r.kritikSaran ?? '',
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-xl font-semibold">Responses</h2>
        <div className="flex items-center gap-2">
          {surveys.length > 0 && (
            <Select value={selected} onValueChange={setSelected}>
              <SelectTrigger className="w-64"><SelectValue placeholder="Pilih survei" /></SelectTrigger>
              <SelectContent>{surveys.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          )}
          <TemplateDownloadButton config={kepuasanImportConfig} />
          <ExportButton config={kepuasanImportConfig} rows={exportRows} label="Export Excel" />
          <ImportButton config={kepuasanImportConfig} userId={userId} onImported={() => selected && reload(selected)} />
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Daftar Response ({responses.length})</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground"><Loader2 className="size-5 animate-spin mr-2" /> Memuat…</div>
          ) : responses.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Belum ada response untuk survei ini.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kode</TableHead>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Nama</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Sumber</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {responses.slice(0, 200).map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">{r.responseCode}</TableCell>
                      <TableCell>{new Date(r.submittedAt).toLocaleDateString('id-ID')}</TableCell>
                      <TableCell>{r.respondentName ?? <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell>{r.unitId}</TableCell>
                      <TableCell><Badge variant="outline">{r.source}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {responses.length > 200 && <p className="text-xs text-muted-foreground pt-2">Menampilkan 200 dari {responses.length} response. Gunakan Export Excel untuk melihat seluruh data.</p>}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
