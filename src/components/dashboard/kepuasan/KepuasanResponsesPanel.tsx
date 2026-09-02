'use client';

import { useEffect, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Upload, Download, FileSpreadsheet } from 'lucide-react';
import { getKepuasanSurveys, getKepuasanResponses, importKepuasanResponses } from '@/lib/kepuasanData';
import { KEPUASAN_UNSUR_FIELDS, KEPUASAN_UNSUR_LABEL, type KepuasanSurvey, type KepuasanResponse, type KepuasanUnsurField } from '@/types/kepuasan';

const IMPORT_COLUMN_MAP: Record<string, KepuasanUnsurField | 'RESPONDEN' | 'TGL'> = {
  'RESPONDEN': 'RESPONDEN',
  'TGL': 'TGL',
  'PERSYARATAN': 'u1_persyaratan',
  'SISTEM, MEKANISME, DAN PROSEDUR': 'u2_prosedur',
  'WAKTU PENYELESAIAN': 'u3_waktu',
  'BIAYA/TARIF': 'u4_biaya',
  'PRODUK SPESIFIKASI JENIS PELAYANAN': 'u5_produk_layanan',
  'KOMPETENSI PELAKSANA': 'u6_kompetensi_pelaksana',
  'PERILAKU PELAKSANA': 'u7_perilaku_pelaksana',
  'PENANGANAN PENGADUAN, SARAN, DAN MASUKAN': 'u8_penanganan_pengaduan',
  'SARANA DAN PRASARANA': 'u9_sarana_prasarana',
};

export function KepuasanResponsesPanel({ surveyId: initialSurveyId, userId, onSelectSurvey }: { surveyId?: string; userId: string; onSelectSurvey: (id: string, tab?: string) => void }) {
  void userId; void onSelectSurvey;
  const [surveys, setSurveys] = useState<KepuasanSurvey[]>([]);
  const [selected, setSelected] = useState<string | undefined>(initialSurveyId);
  const [responses, setResponses] = useState<KepuasanResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [importPreview, setImportPreview] = useState<{ valid: number; failed: { row: number; reason: string }[] } | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleImportFile = (file: File) => {
    const survey = surveys.find((s) => s.id === selected);
    if (!selected || !survey) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

      const parsedRows = rawRows.map((row) => {
        const scores: Record<KepuasanUnsurField, number> = {} as any;
        let respondentName: string | undefined;
        let date: string | undefined;
        for (const [header, value] of Object.entries(row)) {
          const key = IMPORT_COLUMN_MAP[header.trim().toUpperCase()];
          if (!key) continue;
          if (key === 'RESPONDEN') respondentName = String(value).trim();
          else if (key === 'TGL') date = String(value).trim();
          else scores[key] = Number(value);
        }
        return { respondentName, date, scores };
      });

      const result = await importKepuasanResponses(selected, survey.unitId === 'all' ? 'all' : survey.unitId, parsedRows);
      setImportPreview({ valid: result.inserted, failed: result.failed });
      await reload(selected);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleExport = () => {
    const rows = responses.map((r) => ({
      'Kode': r.responseCode,
      'Tanggal': new Date(r.submittedAt).toLocaleDateString('id-ID'),
      'Nama': r.respondentName ?? '',
      'Unit': r.unitId,
      ...Object.fromEntries(KEPUASAN_UNSUR_FIELDS.map((f) => [KEPUASAN_UNSUR_LABEL[f], r.scores[f]])),
      'Kritik/Saran': r.kritikSaran ?? '',
      'Sumber': r.source,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Response');
    XLSX.writeFile(wb, `kepuasan-responses-${selected}.xlsx`);
  };

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
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setImporting(true); handleImportFile(f).then(() => setImporting(false)); } e.target.value = ''; }} />
          <Button size="sm" variant="outline" disabled={!selected || importing} onClick={() => fileInputRef.current?.click()}>
            {importing ? <Loader2 className="size-4 mr-1 animate-spin" /> : <Upload className="size-4 mr-1" />} Import Excel
          </Button>
          <Button size="sm" variant="outline" disabled={!selected || responses.length === 0} onClick={handleExport}>
            <Download className="size-4 mr-1" /> Export Excel
          </Button>
        </div>
      </div>

      {importPreview && (
        <Card>
          <CardContent className="pt-6 text-sm space-y-1">
            <p><FileSpreadsheet className="size-4 inline mr-1" /> {importPreview.valid} baris berhasil diimport.</p>
            {importPreview.failed.length > 0 && (
              <div className="text-destructive">
                <p>{importPreview.failed.length} baris gagal (tidak dimasukkan):</p>
                <ul className="list-disc list-inside">
                  {importPreview.failed.map((f) => <li key={f.row}>Baris {f.row}: {f.reason}</li>)}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

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
