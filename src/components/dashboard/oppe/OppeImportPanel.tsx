'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, Loader2, RefreshCw, FileDown, ListChecks } from 'lucide-react';
import { ImportButton } from '@/components/import/ImportButton';
import { TemplateDownloadButton } from '@/components/import/TemplateDownloadButton';
import { ImportHistoryPanel } from '@/components/import/ImportHistoryPanel';
import { buildOppeImportConfig } from '@/lib/import-engine/configs/oppe';
import {
  getOppeIndicators, getAllActiveOppeDoctors, recalculatePendingOppeEvaluations, getOppeEvaluations, getOppeItemsForEvaluations, friendlyOppeError, logOppeAudit,
} from '@/lib/oppeData';
import { exportOppeImportFormat } from '@/lib/oppeExport';
import { toastSuccess, toastError } from '@/lib/toast-helpers';
import { OppeLoading, OppePageHeader, YEAR_OPTIONS, CURRENT_YEAR, type OppeMasters } from './OppeShared';
import type { ImportConfig } from '@/lib/import-engine/types';
import type { OppePeriodType } from '@/types/oppe';

export function OppeImportPanel({ masters, actor }: { masters: OppeMasters; actor: { id: string; name: string } }) {
  const [config, setConfig] = useState<ImportConfig | null>(null);
  const [recalcBusy, setRecalcBusy] = useState(false);
  const [historyKey, setHistoryKey] = useState(0);
  const [year, setYear] = useState(String(CURRENT_YEAR));
  const [period, setPeriod] = useState<OppePeriodType>('semester_1');
  const [exportBusy, setExportBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [inds, docs] = await Promise.all([getOppeIndicators({ active: true }), getAllActiveOppeDoctors(true)]);
        setConfig(buildOppeImportConfig({
          indicators: inds.map((i) => ({ code: i.code, name: i.name })),
          doctors: docs.map((d) => ({ name: d.name })),
          ksm: masters.ksm.filter((k) => k.isActive).map((k) => ({ name: k.name })),
        }));
      } catch (e) {
        toastError(friendlyOppeError(e, 'Referensi import gagal dimuat.'));
        setConfig(buildOppeImportConfig());
      }
    })();
  }, [masters.ksm]);

  const columns = useMemo(() => config?.columns ?? [], [config]);

  async function recalc(silent = false) {
    setRecalcBusy(true);
    try {
      const n = await recalculatePendingOppeEvaluations();
      if (!silent || n > 0) toastSuccess(`${n} evaluasi dihitung ulang`, { description: 'Skor, status trigger, kategori, dan rekomendasi diperbarui.' });
    } catch (e) {
      toastError(friendlyOppeError(e, 'Hitung ulang gagal.'));
    } finally {
      setRecalcBusy(false);
    }
  }

  async function exportCurrent() {
    setExportBusy(true);
    try {
      const ev = (await getOppeEvaluations({ year: Number(year), periodType: period })).rows;
      if (ev.length === 0) { toastError('Tidak ada evaluasi pada periode ini.'); return; }
      const items = await getOppeItemsForEvaluations(ev.map((e) => e.id));
      const n = await exportOppeImportFormat(columns, ev, items);
      await logOppeAudit({ action: 'export', userId: actor.id, userName: actor.name, entityType: 'oppe_import_format', newData: { year, period, rows: n } });
      toastSuccess(`${n} baris realisasi diexport`, { description: 'File dapat diedit lalu diimport kembali.' });
    } catch (e) {
      toastError(friendlyOppeError(e, 'Export gagal.'));
    } finally {
      setExportBusy(false);
    }
  }

  return (
    <div className="p-4 space-y-4 max-w-5xl">
      <OppePageHeader icon={Upload} title="Import Data OPPE" description="Impor realisasi indikator OPPE dari Excel memakai template aplikasi. File divalidasi per baris sebelum disimpan." />

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Langkah import</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <ol className="list-decimal pl-5 space-y-1 text-muted-foreground">
            <li><b className="text-foreground">Download Template OPPE</b> — kolom: Nama Dokter, Profesi, KSM, Periode, Tahun, Semester, Kode Indikator, Kategori, Parameter, Target, Realisasi, Satuan, Trigger, Sumber Data, Catatan. Sheet REFERENSI berisi daftar kode indikator, dokter, dan KSM.</li>
            <li>Isi satu baris per indikator per dokter per periode. Hapus baris contoh (miring).</li>
            <li><b className="text-foreground">Import</b> → sistem memvalidasi kolom wajib, dokter, KSM, kode indikator, periode, tipe data realisasi, target, dan duplikasi. Kesalahan ditampilkan per baris & kolom beserta solusinya.</li>
            <li>Setelah import berhasil, skor/trigger/kategori/rekomendasi dihitung otomatis.</li>
          </ol>
          {!config ? <OppeLoading /> : (
            <div className="flex flex-wrap gap-2 pt-1">
              <TemplateDownloadButton config={config} size="default" />
              <ImportButton config={config} userId={actor.id} size="default" onImported={async () => { setHistoryKey((k) => k + 1); await recalc(true); }} />
              <Button variant="outline" onClick={() => recalc(false)} disabled={recalcBusy} className="gap-1.5">{recalcBusy ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}Hitung ulang hasil import</Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-1.5"><ListChecks className="size-4" />Export realisasi (format import)</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          <p className="text-xs text-muted-foreground w-full">Unduh realisasi yang sudah ada dalam format template — edit di Excel lalu import kembali tanpa mengubah struktur kolom.</p>
          <Select value={period} onValueChange={(v) => setPeriod(v as OppePeriodType)}><SelectTrigger className="w-[150px] h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="semester_1">Semester I</SelectItem><SelectItem value="semester_2">Semester II</SelectItem><SelectItem value="tahunan">Tahunan</SelectItem></SelectContent></Select>
          <Select value={year} onValueChange={setYear}><SelectTrigger className="w-[110px] h-9"><SelectValue /></SelectTrigger><SelectContent>{YEAR_OPTIONS.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent></Select>
          <Button variant="outline" onClick={exportCurrent} disabled={exportBusy || !config} className="gap-1.5">{exportBusy ? <Loader2 className="size-4 animate-spin" /> : <FileDown className="size-4" />}Export</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Riwayat Import OPPE</CardTitle></CardHeader>
        <CardContent><ImportHistoryPanel key={historyKey} module="oppe" /></CardContent>
      </Card>
    </div>
  );
}
