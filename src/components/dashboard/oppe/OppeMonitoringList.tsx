'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Activity, ClipboardList, Plus, Search, MoreHorizontal, Eye, Pencil, Copy, Printer, FileDown, Trash2, ArrowUpDown, Loader2 } from 'lucide-react';
import {
  OPPE_STATUS_LABEL, OPPE_PERIOD_LABEL, periodLabel,
  type OppeEvaluation, type OppeEvaluationStatus, type OppePeriodType, type OppeEvaluationFilters,
} from '@/types/oppe';
import {
  getOppeEvaluations, getOppeEvaluationById, getOppeFppeList, deleteOppeEvaluation, duplicateOppeEvaluation, subscribeToOppe, friendlyOppeError, logOppeAudit,
} from '@/lib/oppeData';
import { fmtNum } from '@/lib/oppeScoring';
import { exportOppeExcel, exportOppeCsv, evaluationExportRow, printOppeSheets } from '@/lib/oppeExport';
import { toastSuccess, toastError } from '@/lib/toast-helpers';
import {
  OppeLoading, OppeEmpty, OppeErrorState, OppePageHeader, OppePagination, OppeStatusBadge, OppeCategoryBadge, useDebounced, ALL, YEAR_OPTIONS,
  type OppeMasters,
} from './OppeShared';

const PAGE_SIZE = 15;

interface Props {
  mode: 'evaluations' | 'monitoring';
  masters: OppeMasters;
  actor: { id: string; name: string };
  isAdmin: boolean;
  isCommittee: boolean;
  onOpen: (id: string) => void;
  onCreateNew: () => void;
}

export function OppeMonitoringList({ mode, masters, actor, isAdmin, isCommittee, onOpen, onCreateNew }: Props) {
  const [rows, setRows] = useState<OppeEvaluation[]>([]);
  const [total, setTotal] = useState(0);
  const [fppeEvalIds, setFppeEvalIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [year, setYear] = useState(ALL);
  const [period, setPeriod] = useState(ALL);
  const [ksmId, setKsmId] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [category, setCategory] = useState(ALL);
  const [mineOnly, setMineOnly] = useState(mode === 'evaluations' && !isCommittee);
  const [sortBy, setSortBy] = useState<NonNullable<OppeEvaluationFilters['sortBy']>>('updated_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<OppeEvaluation | null>(null);
  const [dup, setDup] = useState<OppeEvaluation | null>(null);
  const [dupPeriod, setDupPeriod] = useState<OppePeriodType>('semester_2');
  const [dupYear, setDupYear] = useState(new Date().getFullYear());
  const [busy, setBusy] = useState(false);
  const q = useDebounced(search);

  const filters = (): OppeEvaluationFilters => ({
    search: q || undefined,
    year: year === ALL ? undefined : Number(year),
    periodType: period === ALL ? undefined : (period as OppePeriodType),
    ksmId: ksmId === ALL ? undefined : ksmId,
    status: status === ALL ? undefined : (status as OppeEvaluationStatus),
    finalCategory: category === ALL ? undefined : category,
    sortBy, sortDir,
  });

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const f = filters();
      // "Evaluasi saya" = evaluasi yang ditugaskan ke saya (evaluator biasa sudah dibatasi RLS).
      const r = await getOppeEvaluations({ ...f, evaluatorId: mineOnly ? actor.id : undefined, page, pageSize: PAGE_SIZE });
      setRows(r.rows);
      setTotal(r.total);
      const fp = await getOppeFppeList().catch(() => []);
      setFppeEvalIds(new Set(fp.map((x) => x.evaluationId).filter(Boolean) as string[]));
    } catch (e) {
      setError(friendlyOppeError(e, 'Data evaluasi gagal dimuat.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { setPage(0); }, [q, year, period, ksmId, status, category, mineOnly, sortBy, sortDir]);
  useEffect(() => {
    load();
    const unsub = subscribeToOppe(() => load());
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, year, period, ksmId, status, category, mineOnly, sortBy, sortDir, page]);

  const toggleSort = (k: NonNullable<OppeEvaluationFilters['sortBy']>) => {
    if (sortBy === k) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortBy(k); setSortDir('desc'); }
  };

  async function exportAll(kind: 'xlsx' | 'csv') {
    setBusy(true);
    try {
      const all = (await getOppeEvaluations(filters())).rows;
      if (all.length === 0) { toastError('Tidak ada data untuk diexport.'); return; }
      if (kind === 'csv') exportOppeCsv(all.map(evaluationExportRow));
      else await exportOppeExcel({ evaluations: all });
      await logOppeAudit({ action: 'export', userId: actor.id, userName: actor.name, entityType: 'oppe_evaluations', newData: { format: kind, count: all.length, filters: filters() } });
    } catch (e) {
      toastError(friendlyOppeError(e, 'Export gagal.'));
    } finally {
      setBusy(false);
    }
  }

  async function printOne(e: OppeEvaluation) {
    const r = await getOppeEvaluationById(e.id);
    if (!r) return;
    const f = await getOppeFppeList({ evaluationId: e.id }).catch(() => []);
    if (!printOppeSheets([{ evaluation: r.evaluation, items: r.items, fppe: f }], masters.settings, masters.settings.hospitalName)) toastError('Pop-up diblokir browser.');
  }

  async function exportOne(e: OppeEvaluation) {
    const r = await getOppeEvaluationById(e.id);
    if (!r) return;
    await exportOppeExcel({ evaluations: [r.evaluation], itemsByEvaluation: new Map([[e.id, r.items]]), fileName: `OPPE_${(e.doctorName ?? 'dokter').replace(/\W+/g, '_')}_${e.year}.xlsx` });
  }


  return (
    <div className="p-4 space-y-4">
      <OppePageHeader
        icon={mode === 'monitoring' ? Activity : ClipboardList}
        title={mode === 'monitoring' ? 'Monitoring OPPE' : 'Evaluasi OPPE'}
        description={mode === 'monitoring' ? 'Pantau seluruh evaluasi OPPE — skor, kategori, trigger, FPPE, dan status workflow.' : 'Daftar evaluasi yang sedang dikerjakan. Buat evaluasi baru dari template KSM.'}
        actions={
          <>
            <Button size="sm" variant="outline" className="gap-1.5" disabled={busy} onClick={() => exportAll('xlsx')}>{busy ? <Loader2 className="size-4 animate-spin" /> : <FileDown className="size-4" />}Excel</Button>
            <Button size="sm" variant="outline" className="gap-1.5" disabled={busy} onClick={() => exportAll('csv')}><FileDown className="size-4" />CSV</Button>
            <Button size="sm" className="gap-1.5" onClick={onCreateNew}><Plus className="size-4" />Evaluasi Baru</Button>
          </>
        }
      />
      <Card>
        <CardContent className="pt-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nama dokter / nomor evaluasi…" className="pl-8 h-9" />
            </div>
            <Select value={year} onValueChange={setYear}><SelectTrigger className="w-[110px] h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value={ALL}>Semua tahun</SelectItem>{YEAR_OPTIONS.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent></Select>
            <Select value={period} onValueChange={setPeriod}><SelectTrigger className="w-[140px] h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value={ALL}>Semua periode</SelectItem>{(Object.keys(OPPE_PERIOD_LABEL) as OppePeriodType[]).map((p) => <SelectItem key={p} value={p}>{OPPE_PERIOD_LABEL[p]}</SelectItem>)}</SelectContent></Select>
            <Select value={ksmId} onValueChange={setKsmId}><SelectTrigger className="w-[190px] h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value={ALL}>Semua KSM</SelectItem>{masters.ksm.map((k) => <SelectItem key={k.id} value={k.id}>{k.name}</SelectItem>)}</SelectContent></Select>
            <Select value={status} onValueChange={setStatus}><SelectTrigger className="w-[140px] h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value={ALL}>Semua status</SelectItem>{(Object.keys(OPPE_STATUS_LABEL) as OppeEvaluationStatus[]).map((s) => <SelectItem key={s} value={s}>{OPPE_STATUS_LABEL[s]}</SelectItem>)}</SelectContent></Select>
            <Select value={category} onValueChange={setCategory}><SelectTrigger className="w-[160px] h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value={ALL}>Semua kategori</SelectItem>{masters.settings.resultCategories.map((c) => <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>)}</SelectContent></Select>
            {mode === 'evaluations' && isCommittee && (
              <Button size="sm" variant={mineOnly ? 'secondary' : 'outline'} className="h-9" onClick={() => setMineOnly((m) => !m)}>{mineOnly ? 'Evaluasi saya' : 'Semua evaluasi'}</Button>
            )}
          </div>

          {loading ? <OppeLoading /> : error ? <OppeErrorState message={error} onRetry={load} /> : rows.length === 0 ? (
            <OppeEmpty title="Belum ada evaluasi" description="Buat evaluasi OPPE baru atau ubah filter." action={<Button size="sm" onClick={onCreateNew} className="mt-2 gap-1.5"><Plus className="size-4" />Evaluasi Baru</Button>} />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dokter</TableHead>
                    <TableHead>KSM</TableHead>
                    <SortHead sortBy={sortBy} onToggle={toggleSort} k="year">Periode</SortHead>
                    <SortHead sortBy={sortBy} onToggle={toggleSort} k="final_score" className="text-right">Skor</SortHead>
                    <TableHead>Kategori</TableHead>
                    <SortHead sortBy={sortBy} onToggle={toggleSort} k="trigger_count" className="text-right">Trigger</SortHead>
                    <TableHead>FPPE</TableHead>
                    <SortHead sortBy={sortBy} onToggle={toggleSort} k="updated_at">Status</SortHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((e) => {
                    const editable = e.status !== 'finalized' && (isCommittee || (e.evaluatorId === actor.id && ['draft', 'in_progress'].includes(e.status)));
                    return (
                      <TableRow key={e.id} className="cursor-pointer hover:bg-muted/40" onClick={() => onOpen(e.id)}>
                        <TableCell className="font-medium">{e.doctorName}<span className="block text-[10px] font-mono text-muted-foreground">{e.evaluationNumber}</span></TableCell>
                        <TableCell className="text-xs">{e.ksmName ?? '—'}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">{periodLabel(e)}</TableCell>
                        <TableCell className="text-right font-semibold">{fmtNum(e.finalScore)}</TableCell>
                        <TableCell><OppeCategoryBadge code={e.finalCategory} label={e.finalCategoryLabel} categories={masters.settings.resultCategories} /></TableCell>
                        <TableCell className="text-right">
                          {e.triggerCount > 0 ? <span className="font-semibold text-red-500">{e.triggerCount}</span> : 0}
                          {e.criticalTriggerCount > 0 && <Badge variant="destructive" className="ml-1 text-[9px]">kritis</Badge>}
                        </TableCell>
                        <TableCell>
                          {fppeEvalIds.has(e.id) ? <Badge variant="secondary" className="text-[10px]">Dibuat</Badge> : e.requiresFppe ? <Badge variant="outline" className="text-[10px] border-red-500 text-red-500">Direkomendasikan</Badge> : <span className="text-xs text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell><OppeStatusBadge status={e.status} /></TableCell>
                        <TableCell className="text-right" onClick={(ev) => ev.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" className="size-8" aria-label="Aksi"><MoreHorizontal className="size-4" /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => onOpen(e.id)}><Eye className="size-4 mr-2" />Detail</DropdownMenuItem>
                              {editable && <DropdownMenuItem onClick={() => onOpen(e.id)}><Pencil className="size-4 mr-2" />Edit / isi realisasi</DropdownMenuItem>}
                              <DropdownMenuItem onClick={() => { setDup(e); setDupYear(e.periodType === 'semester_2' ? e.year + 1 : e.year); setDupPeriod(e.periodType === 'semester_1' ? 'semester_2' : 'semester_1'); }}><Copy className="size-4 mr-2" />Duplikat</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => printOne(e)}><Printer className="size-4 mr-2" />Cetak / PDF</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => exportOne(e)}><FileDown className="size-4 mr-2" />Export Excel</DropdownMenuItem>
                              {(isAdmin || (isCommittee && e.status !== 'finalized')) && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem className="text-red-500" onClick={() => setDeleting(e)}><Trash2 className="size-4 mr-2" />Hapus</DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
          {<OppePagination page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} />}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus evaluasi OPPE?</AlertDialogTitle>
            <AlertDialogDescription>{deleting?.evaluationNumber} — {deleting?.doctorName} ({deleting ? periodLabel(deleting) : ''}). Data dihapus permanen; jejaknya tetap di audit trail.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={async () => {
              if (!deleting) return;
              try { await deleteOppeEvaluation(deleting.id, actor); toastSuccess('Evaluasi dihapus'); load(); }
              catch (err) { toastError(friendlyOppeError(err, 'Evaluasi gagal dihapus.')); }
              finally { setDeleting(null); }
            }}>Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!dup} onOpenChange={(o) => !o && setDup(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Duplikat Evaluasi</DialogTitle>
            <DialogDescription>{dup?.doctorName} — indikator & target disalin ke periode baru, realisasi dikosongkan.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <Select value={dupPeriod} onValueChange={(v) => setDupPeriod(v as OppePeriodType)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{(['semester_1', 'semester_2', 'tahunan'] as OppePeriodType[]).map((p) => <SelectItem key={p} value={p}>{OPPE_PERIOD_LABEL[p]}</SelectItem>)}</SelectContent></Select>
            <Select value={String(dupYear)} onValueChange={(v) => setDupYear(Number(v))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{YEAR_OPTIONS.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent></Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDup(null)}>Batal</Button>
            <Button disabled={busy} onClick={async () => {
              if (!dup) return;
              setBusy(true);
              try { const id = await duplicateOppeEvaluation({ sourceId: dup.id, periodType: dupPeriod, year: dupYear, actor }); toastSuccess('Evaluasi diduplikat'); setDup(null); onOpen(id); }
              catch (err) { toastError(friendlyOppeError(err)); } finally { setBusy(false); }
            }}>Duplikat</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type SortKey = NonNullable<OppeEvaluationFilters['sortBy']>;
function SortHead({ k, sortBy, onToggle, children, className = '' }: { k: SortKey; sortBy: SortKey; onToggle: (k: SortKey) => void; children: React.ReactNode; className?: string }) {
  return (
    <TableHead className={className}>
      <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => onToggle(k)}>{children}<ArrowUpDown className={`size-3 ${sortBy === k ? 'text-foreground' : 'opacity-40'}`} /></button>
    </TableHead>
  );
}
