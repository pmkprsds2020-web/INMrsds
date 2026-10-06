'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { FileBarChart, Printer, FileDown, Loader2, FileSpreadsheet, FileText, Download } from 'lucide-react';
import { OPPE_PERIOD_LABEL, OPPE_STATUS_LABEL, periodLabel, type OppeEvaluation, type OppeFppe, type OppeEvaluationStatus, type OppePeriodType } from '@/types/oppe';
import { getOppeEvaluations, getOppeFppeList, getOppeItemsForEvaluations, friendlyOppeError, logOppeAudit } from '@/lib/oppeData';
import { fmtNum, round2 } from '@/lib/oppeScoring';
import { exportOppeExcel, exportOppeCsv, exportOppeItemsCsv, evaluationExportRow, printOppeSheets } from '@/lib/oppeExport';
import { toastError, toastSuccess } from '@/lib/toast-helpers';
import { OppeLoading, OppeErrorState, OppePageHeader, OppeCategoryBadge, OppeStatusBadge, ALL, YEAR_OPTIONS, CURRENT_YEAR, type OppeMasters } from './OppeShared';

interface Filters { year: string; period: string; ksmId: string; status: string }

function useReportData(f: Filters) {
  const [rows, setRows] = useState<OppeEvaluation[]>([]);
  const [fppe, setFppe] = useState<OppeFppe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [ev, fp] = await Promise.all([
        getOppeEvaluations({
          year: f.year === ALL ? undefined : Number(f.year),
          periodType: f.period === ALL ? undefined : (f.period as OppePeriodType),
          ksmId: f.ksmId === ALL ? undefined : f.ksmId,
          status: f.status === ALL ? undefined : (f.status as OppeEvaluationStatus),
          sortBy: 'final_score', sortDir: 'desc',
        }),
        getOppeFppeList({ ksmId: f.ksmId === ALL ? undefined : f.ksmId }),
      ]);
      setRows(ev.rows);
      const ids = new Set(ev.rows.map((r) => r.id));
      setFppe(fp.filter((x) => !x.evaluationId || ids.has(x.evaluationId)));
    } catch (e) {
      setError(friendlyOppeError(e, 'Laporan gagal dimuat.'));
    } finally {
      setLoading(false);
    }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [f.year, f.period, f.ksmId, f.status]);
  return { rows, fppe, loading, error, reload: load };
}

function FilterBar({ masters, f, setF }: { masters: OppeMasters; f: Filters; setF: (f: Filters) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Select value={f.year} onValueChange={(v) => setF({ ...f, year: v })}><SelectTrigger className="w-[120px] h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value={ALL}>Semua tahun</SelectItem>{YEAR_OPTIONS.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent></Select>
      <Select value={f.period} onValueChange={(v) => setF({ ...f, period: v })}><SelectTrigger className="w-[150px] h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value={ALL}>Semua periode</SelectItem>{(Object.keys(OPPE_PERIOD_LABEL) as OppePeriodType[]).map((p) => <SelectItem key={p} value={p}>{OPPE_PERIOD_LABEL[p]}</SelectItem>)}</SelectContent></Select>
      <Select value={f.ksmId} onValueChange={(v) => setF({ ...f, ksmId: v })}><SelectTrigger className="w-[220px] h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value={ALL}>Semua KSM</SelectItem>{masters.ksm.map((k) => <SelectItem key={k.id} value={k.id}>{k.name}</SelectItem>)}</SelectContent></Select>
      <Select value={f.status} onValueChange={(v) => setF({ ...f, status: v })}><SelectTrigger className="w-[150px] h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value={ALL}>Semua status</SelectItem>{(Object.keys(OPPE_STATUS_LABEL) as OppeEvaluationStatus[]).map((s) => <SelectItem key={s} value={s}>{OPPE_STATUS_LABEL[s]}</SelectItem>)}</SelectContent></Select>
    </div>
  );
}

/** Laporan OPPE (rekap per KSM, per dokter, trigger, FPPE) + cetak/ekspor. */
export function OppeReportPanel({ masters, actor }: { masters: OppeMasters; actor: { id: string; name: string } }) {
  const [f, setF] = useState<Filters>({ year: String(CURRENT_YEAR), period: ALL, ksmId: ALL, status: ALL });
  const { rows, fppe, loading, error, reload } = useReportData(f);
  const [busy, setBusy] = useState(false);

  const scored = rows.filter((r) => r.finalScore !== null);
  const avg = scored.length ? round2(scored.reduce((s, r) => s + (r.finalScore ?? 0), 0) / scored.length) : null;
  const byKsm = useMemo(() => {
    const m = new Map<string, OppeEvaluation[]>();
    for (const r of rows) { const k = r.ksmName ?? 'Tanpa KSM'; if (!m.has(k)) m.set(k, []); m.get(k)!.push(r); }
    return Array.from(m.entries()).map(([k, list]) => {
      const s = list.filter((x) => x.finalScore !== null);
      const items = list.reduce((a, x) => a + x.metCount + x.attentionCount + x.triggerCount, 0);
      return {
        k, n: list.length, doctors: new Set(list.map((x) => x.doctorId)).size,
        avg: s.length ? round2(s.reduce((a, x) => a + (x.finalScore ?? 0), 0) / s.length) : null,
        trig: list.reduce((a, x) => a + x.triggerCount, 0), fppe: list.filter((x) => x.requiresFppe).length,
        pct: items ? round2((list.reduce((a, x) => a + x.metCount, 0) / items) * 100) : null,
        cats: masters.settings.resultCategories.map((c) => list.filter((x) => x.finalCategory === c.code).length),
      };
    });
  }, [rows, masters.settings.resultCategories]);

  async function printAll() {
    if (rows.length === 0) return;
    setBusy(true);
    try {
      const items = await getOppeItemsForEvaluations(rows.map((r) => r.id));
      const ok = printOppeSheets(rows.map((r) => ({ evaluation: r, items: items.get(r.id) ?? [], fppe: fppe.filter((x) => x.evaluationId === r.id) })), masters.settings, masters.settings.hospitalName);
      if (!ok) toastError('Pop-up diblokir browser. Izinkan pop-up untuk mencetak/menyimpan PDF.');
      await logOppeAudit({ action: 'export', userId: actor.id, userName: actor.name, entityType: 'oppe_report', newData: { format: 'pdf', count: rows.length, filters: f } });
    } catch (e) { toastError(friendlyOppeError(e, 'Cetak gagal.')); } finally { setBusy(false); }
  }

  async function excel() {
    setBusy(true);
    try {
      const items = await getOppeItemsForEvaluations(rows.map((r) => r.id));
      await exportOppeExcel({ evaluations: rows, itemsByEvaluation: items, fppe, fileName: `Laporan_OPPE_${f.year}_${new Date().toISOString().slice(0, 10)}.xlsx` });
      await logOppeAudit({ action: 'export', userId: actor.id, userName: actor.name, entityType: 'oppe_report', newData: { format: 'xlsx', count: rows.length, filters: f } });
    } catch (e) { toastError(friendlyOppeError(e, 'Export gagal.')); } finally { setBusy(false); }
  }

  return (
    <div className="p-4 space-y-4">
      <OppePageHeader
        icon={FileBarChart}
        title="Laporan OPPE"
        description="Rekapitulasi hasil OPPE per periode — siap dicetak untuk rapat Komite Medik."
        actions={
          <>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => window.print()}><Printer className="size-4" />Cetak laporan</Button>
            <Button size="sm" variant="outline" className="gap-1.5" disabled={busy || rows.length === 0} onClick={printAll}>{busy ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}PDF lembar evaluasi</Button>
            <Button size="sm" className="gap-1.5" disabled={busy || rows.length === 0} onClick={excel}><FileDown className="size-4" />Excel lengkap</Button>
          </>
        }
      />
      <FilterBar masters={masters} f={f} setF={setF} />

      {loading ? <OppeLoading /> : error ? <OppeErrorState message={error} onRetry={reload} /> : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Stat label="Evaluasi" value={rows.length} />
            <Stat label="Dokter dievaluasi" value={new Set(rows.map((r) => r.doctorId)).size} />
            <Stat label="Rata-rata skor" value={fmtNum(avg)} />
            <Stat label="Indikator trigger" value={rows.reduce((s, r) => s + r.triggerCount, 0)} />
            <Stat label="Rekomendasi FPPE" value={rows.filter((r) => r.requiresFppe).length} />
          </div>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Rekapitulasi per KSM</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>KSM</TableHead><TableHead className="text-right">Evaluasi</TableHead><TableHead className="text-right">Dokter</TableHead><TableHead className="text-right">Rata-rata</TableHead>
                  {masters.settings.resultCategories.map((c) => <TableHead key={c.code} className="text-right">{c.label}</TableHead>)}
                  <TableHead className="text-right">Trigger</TableHead><TableHead className="text-right">FPPE</TableHead><TableHead className="text-right">% Memenuhi</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {byKsm.map((r) => (
                    <TableRow key={r.k}>
                      <TableCell className="font-medium">{r.k}</TableCell><TableCell className="text-right">{r.n}</TableCell><TableCell className="text-right">{r.doctors}</TableCell><TableCell className="text-right">{fmtNum(r.avg)}</TableCell>
                      {r.cats.map((c, i) => <TableCell key={i} className="text-right">{c}</TableCell>)}
                      <TableCell className="text-right">{r.trig}</TableCell><TableCell className="text-right">{r.fppe}</TableCell><TableCell className="text-right">{r.pct === null ? '—' : `${fmtNum(r.pct)}%`}</TableCell>
                    </TableRow>
                  ))}
                  {byKsm.length === 0 && <TableRow><TableCell colSpan={8 + masters.settings.resultCategories.length} className="text-center text-muted-foreground py-6">Tidak ada data.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Hasil per Dokter</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Dokter</TableHead><TableHead>KSM</TableHead><TableHead>Periode</TableHead><TableHead className="text-right">A</TableHead><TableHead className="text-right">B</TableHead><TableHead className="text-right">C</TableHead><TableHead className="text-right">Skor</TableHead><TableHead>Kategori</TableHead><TableHead>Indikator kritis trigger</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.doctorName}</TableCell><TableCell className="text-xs">{r.ksmName}</TableCell><TableCell className="text-xs">{periodLabel(r)}</TableCell>
                      <TableCell className="text-right">{fmtNum(r.scoreProfessional)}</TableCell><TableCell className="text-right">{fmtNum(r.scoreDevelopment)}</TableCell><TableCell className="text-right">{fmtNum(r.scoreClinical)}</TableCell>
                      <TableCell className="text-right font-semibold">{fmtNum(r.finalScore)}</TableCell>
                      <TableCell><OppeCategoryBadge code={r.finalCategory} label={r.finalCategoryLabel} categories={masters.settings.resultCategories} /></TableCell>
                      <TableCell className="text-xs text-red-600">{r.criticalIndicators ?? '—'}</TableCell>
                      <TableCell><OppeStatusBadge status={r.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return <Card><CardContent className="pt-4 pb-3"><p className="text-xl font-bold">{value}</p><p className="text-xs text-muted-foreground">{label}</p></CardContent></Card>;
}

/** Export Data (poin 30): Excel / PDF / CSV berdasarkan filter. */
export function OppeExportPanel({ masters, actor }: { masters: OppeMasters; actor: { id: string; name: string } }) {
  const [f, setF] = useState<Filters>({ year: String(CURRENT_YEAR), period: ALL, ksmId: ALL, status: ALL });
  const { rows, fppe, loading, error, reload } = useReportData(f);
  const [withItems, setWithItems] = useState(true);
  const [withFppe, setWithFppe] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  async function run(kind: 'xlsx' | 'csv' | 'csv_items' | 'pdf') {
    if (rows.length === 0) { toastError('Tidak ada data sesuai filter.'); return; }
    setBusy(kind);
    try {
      const items = kind === 'csv' || (kind === 'xlsx' && !withItems) ? undefined : await getOppeItemsForEvaluations(rows.map((r) => r.id));
      if (kind === 'xlsx') await exportOppeExcel({ evaluations: rows, itemsByEvaluation: items, fppe: withFppe ? fppe : undefined });
      if (kind === 'csv') exportOppeCsv(rows.map(evaluationExportRow));
      if (kind === 'csv_items') exportOppeItemsCsv(rows, items!);
      if (kind === 'pdf') {
        const ok = printOppeSheets(rows.map((r) => ({ evaluation: r, items: items!.get(r.id) ?? [], fppe: fppe.filter((x) => x.evaluationId === r.id) })), masters.settings, masters.settings.hospitalName);
        if (!ok) { toastError('Pop-up diblokir browser.'); return; }
      }
      await logOppeAudit({ action: 'export', userId: actor.id, userName: actor.name, entityType: 'oppe_export', newData: { format: kind, count: rows.length, filters: f } });
      toastSuccess(`Export ${rows.length} evaluasi selesai`);
    } catch (e) {
      toastError(friendlyOppeError(e, 'Export gagal. Silakan coba kembali.'));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="p-4 space-y-4 max-w-4xl">
      <OppePageHeader icon={Download} title="Export Data OPPE" description="Unduh data sesuai filter dalam format Excel, CSV, atau PDF (lembar evaluasi)." />
      <Card>
        <CardContent className="pt-4 space-y-4">
          <FilterBar masters={masters} f={f} setF={setF} />
          {loading ? <OppeLoading /> : error ? <OppeErrorState message={error} onRetry={reload} /> : (
            <p className="text-sm"><b>{rows.length}</b> evaluasi sesuai filter · {fppe.length} FPPE terkait.</p>
          )}
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={withItems} onCheckedChange={(v) => setWithItems(!!v)} /><Label>Sertakan detail indikator (Excel)</Label></label>
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={withFppe} onCheckedChange={(v) => setWithFppe(!!v)} /><Label>Sertakan FPPE (Excel)</Label></label>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <ExportTile icon={FileSpreadsheet} title="Excel (.xlsx)" desc="Rekap + detail indikator + FPPE dalam beberapa sheet." busy={busy === 'xlsx'} onClick={() => run('xlsx')} />
            <ExportTile icon={FileText} title="PDF — Lembar Evaluasi OPPE" desc="Format resmi per dokter (cetak / simpan sebagai PDF)." busy={busy === 'pdf'} onClick={() => run('pdf')} />
            <ExportTile icon={FileDown} title="CSV — Rekap" desc="Satu baris per evaluasi." busy={busy === 'csv'} onClick={() => run('csv')} />
            <ExportTile icon={FileDown} title="CSV — Detail indikator" desc="Satu baris per indikator per evaluasi." busy={busy === 'csv_items'} onClick={() => run('csv_items')} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ExportTile({ icon: Icon, title, desc, busy, onClick }: { icon: any; title: string; desc: string; busy: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} disabled={busy} className="flex items-start gap-3 rounded-lg border p-3 text-left hover:bg-muted/40 disabled:opacity-60">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted">{busy ? <Loader2 className="size-4 animate-spin" /> : <Icon className="size-4" />}</span>
      <span><span className="block text-sm font-medium">{title}</span><span className="block text-xs text-muted-foreground">{desc}</span></span>
    </button>
  );
}
