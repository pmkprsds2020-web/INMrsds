'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  ArrowLeft, Save, Send, ClipboardCheck, ShieldCheck, Lock, Unlock, Copy, Printer, FileDown, Trash2, Loader2, Microscope,
  Paperclip, Link2, Download, ChevronDown, ChevronRight, Undo2, RefreshCw, Sparkles, History, Lightbulb,
} from 'lucide-react';
import {
  OPPE_STATUS_FLOW, OPPE_STATUS_LABEL, OPPE_PERIOD_LABEL, OPPE_AUDIT_ACTION_LABEL, isCategoricalType, periodLabel,
  type OppeEvaluation, type OppeEvaluationItem, type OppeFppe, type OppeAuditEntry, type OppePeriodType,
} from '@/types/oppe';
import {
  getOppeEvaluationById, saveOppeEvaluationItems, transitionOppeEvaluation, deleteOppeEvaluation, duplicateOppeEvaluation,
  getDoctorEvaluationHistory, getOppeFppeList, getOppeAuditTrail, uploadOppeEvidence, getOppeEvidenceUrl, friendlyOppeError,
  pullQualityIndicatorValue, evaluationPeriodRange, recalculateOppeEvaluation, logOppeAudit,
} from '@/lib/oppeData';
import { evaluateItem, computeEvaluation, describeTarget, fmtNum, parseNumeric } from '@/lib/oppeScoring';
import { exportOppeExcel, printOppeSheets } from '@/lib/oppeExport';
import { toastSuccess, toastError, toastWarning } from '@/lib/toast-helpers';
import { OppeLoading, OppeErrorState, OppeStatusBadge, OppeItemStatusBadge, OppeFppeStatusBadge, OppeCategoryBadge, fmtDate, fmtDateTime, YEAR_OPTIONS, type OppeMasters } from './OppeShared';
import { OppeScoreSummary } from './OppeScoreSummary';
import { OppeTrendCard } from './OppeResultsPanel';
import { OppeFppeForm } from './OppeFppePanel';
import { OppeAiPanel } from './OppeAiPanel';

interface Props {
  evaluationId: string;
  masters: OppeMasters;
  actor: { id: string; name: string };
  isAdmin: boolean;
  isCommittee: boolean;
  onBack: () => void;
  onOpenEvaluation: (id: string) => void;
}

type Dlg = null | 'reopen' | 'return' | 'review' | 'delete' | 'duplicate' | 'fppe';

export function OppeEvaluationDetail({ evaluationId, masters, actor, isAdmin, isCommittee, onBack, onOpenEvaluation }: Props) {
  const [ev, setEv] = useState<OppeEvaluation | null>(null);
  const [items, setItems] = useState<OppeEvaluationItem[]>([]);
  const [history, setHistory] = useState<OppeEvaluation[]>([]);
  const [fppe, setFppe] = useState<OppeFppe[]>([]);
  const [audit, setAudit] = useState<OppeAuditEntry[]>([]);
  const [notes, setNotes] = useState('');
  const [recOverride, setRecOverride] = useState('');
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [dlg, setDlg] = useState<Dlg>(null);
  const [reason, setReason] = useState('');
  const [dupPeriod, setDupPeriod] = useState<OppePeriodType>('semester_2');
  const [dupYear, setDupYear] = useState<number>(new Date().getFullYear());
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [fppeDraft, setFppeDraft] = useState<Partial<OppeFppe> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let r = await getOppeEvaluationById(evaluationId);
      if (!r) { setError('Evaluasi tidak ditemukan atau Anda tidak memiliki akses.'); return; }
      if (r.evaluation.needsRecalc && r.evaluation.status !== 'finalized') {
        try { r = await recalculateOppeEvaluation(evaluationId); } catch (e) { console.warn('[OPPE] hitung ulang otomatis gagal', e); }
      }
      setEv(r.evaluation);
      setItems(r.items);
      setNotes(r.evaluation.notes ?? '');
      setRecOverride(r.evaluation.recommendationOverride ?? '');
      setDirty(false);
      const [h, f, a] = await Promise.all([
        getDoctorEvaluationHistory(r.evaluation.doctorId).catch(() => []),
        getOppeFppeList({ evaluationId }).catch(() => []),
        getOppeAuditTrail({ evaluationId, pageSize: 100 }).then((x) => x.rows).catch(() => []),
      ]);
      setHistory(h);
      setFppe(f);
      setAudit(a);
    } catch (e) {
      setError(friendlyOppeError(e, 'Evaluasi OPPE gagal dimuat.'));
    } finally {
      setLoading(false);
    }
  }, [evaluationId]);

  useEffect(() => { load(); }, [load]);

  const isEvaluator = ev?.evaluatorId === actor.id;
  const finalized = ev?.status === 'finalized';
  const canEdit = !!ev && !finalized && (isCommittee || (isEvaluator && ['draft', 'in_progress'].includes(ev.status)));
  const canDelete = !!ev && (isAdmin || (isCommittee && !finalized));

  // Pratinjau real-time memakai engine yang sama dengan proses simpan.
  const live = useMemo(() => {
    const evaluated = items.map((it) => ({ it, r: evaluateItem({ ...it, realizationNumber: isCategoricalType(it.dataType) ? null : parseNumeric(it.realizationText, it.dataType) }, masters.settings) }));
    const prevScored = history.filter((h) => h.id !== evaluationId && h.finalScore !== null && ev && periodKey(h) < periodKey(ev)).sort((a, b) => periodKey(b) - periodKey(a))[0];
    const comp = computeEvaluation({
      items: evaluated.map(({ it, r }) => ({ id: it.id, name: it.name, code: it.code, categoryId: it.categoryId, categoryCode: it.categoryCode, weight: it.weight, isCritical: it.isCritical, status: r.status, score: r.score })),
      categories: masters.categories,
      settings: masters.settings,
      previousScore: prevScored?.finalScore ?? null,
    });
    return { evaluated, comp, prev: prevScored };
  }, [items, masters, history, ev, evaluationId]);
  const resultMap = useMemo(() => new Map(live.evaluated.map(({ it, r }) => [it.id, r])), [live]);

  function updateItem(id: string, patch: Partial<OppeEvaluationItem>) {
    setItems((s) => s.map((i) => (i.id === id ? { ...i, ...patch } : i)));
    setDirty(true);
  }

  async function save(silent = false): Promise<boolean> {
    if (!ev) return false;
    setBusy('save');
    try {
      const r = await saveOppeEvaluationItems(ev.id, items, actor, { notes: notes || null, recommendationOverride: isCommittee ? (recOverride || null) : undefined });
      setEv(r.evaluation);
      setItems(r.items);
      setDirty(false);
      if (!silent) toastSuccess('Evaluasi disimpan', { description: `Skor ${fmtNum(r.evaluation.finalScore)} — ${r.evaluation.finalCategoryLabel ?? 'belum ada kategori'}` });
      getOppeAuditTrail({ evaluationId: ev.id, pageSize: 100 }).then((x) => setAudit(x.rows)).catch(() => {});
      return true;
    } catch (e) {
      toastError(friendlyOppeError(e));
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function transition(t: 'submit' | 'return' | 'review' | 'approve' | 'finalize' | 'reopen', notesText?: string) {
    if (!ev) return;
    if (dirty && canEdit && t !== 'reopen') { const ok = await save(true); if (!ok) return; }
    setBusy(t);
    try {
      await transitionOppeEvaluation({ evaluationId: ev.id, transition: t, actor, isCommittee, notes: notesText });
      const msg: Record<string, string> = { submit: 'Evaluasi diajukan untuk review', return: 'Evaluasi dikembalikan ke evaluator', review: 'Evaluasi direview', approve: 'Evaluasi disetujui', finalize: 'Evaluasi difinalisasi — data terkunci', reopen: 'Evaluasi dibuka kembali' };
      toastSuccess(msg[t]);
      setDlg(null);
      setReason('');
      await load();
    } catch (e) {
      toastError(friendlyOppeError(e, 'Status evaluasi gagal diubah.'));
    } finally {
      setBusy(null);
    }
  }

  async function pullQuality(it: OppeEvaluationItem) {
    if (!ev || !it.qualityIndicatorId) return;
    const range = evaluationPeriodRange(ev);
    try {
      const r = await pullQualityIndicatorValue(it.qualityIndicatorId, range.start, range.end);
      if (r.value === null) { toastWarning('Belum ada data pengukuran indikator mutu pada periode ini.'); return; }
      updateItem(it.id, { realizationText: String(r.value), notes: [it.notes, `Ditarik dari Indikator Mutu (${r.n} pengukuran, ${range.start} s/d ${range.end}) — data tingkat unit.`].filter(Boolean).join(' ') });
      toastSuccess(`Nilai ${fmtNum(r.value)} ditarik dari Indikator Mutu`);
    } catch (e) {
      toastError(friendlyOppeError(e, 'Gagal menarik data Indikator Mutu.'));
    }
  }

  async function onUpload(it: OppeEvaluationItem, file: File | undefined) {
    if (!file || !ev) return;
    setBusy('upload-' + it.id);
    try {
      const path = await uploadOppeEvidence(ev.id, it.id, file);
      updateItem(it.id, { evidencePath: path });
      toastSuccess('Bukti diunggah', { description: 'Klik Simpan untuk menyimpan perubahan.' });
    } catch (e) {
      toastError(friendlyOppeError(e, 'Bukti gagal diunggah.'));
    } finally {
      setBusy(null);
    }
  }

  async function printPdf() {
    if (!ev) return;
    const ok = printOppeSheets([{ evaluation: ev, items, fppe }], masters.settings, masters.settings.hospitalName);
    if (!ok) toastError('Pop-up diblokir browser. Izinkan pop-up untuk mencetak/menyimpan PDF.');
    else logOppeAudit({ action: 'export', userId: actor.id, userName: actor.name, evaluationId: ev.id, newData: { format: 'pdf' } });
  }

  async function exportExcel() {
    if (!ev) return;
    await exportOppeExcel({ evaluations: [ev], itemsByEvaluation: new Map([[ev.id, items]]), fppe, fileName: `OPPE_${(ev.doctorName ?? 'dokter').replace(/\W+/g, '_')}_${ev.year}_${ev.periodType}.xlsx` });
    logOppeAudit({ action: 'export', userId: actor.id, userName: actor.name, evaluationId: ev.id, newData: { format: 'xlsx' } });
  }

  if (loading) return <OppeLoading />;
  if (error || !ev) return <div className="p-4"><Button variant="outline" size="sm" onClick={onBack} className="gap-1.5 mb-4"><ArrowLeft className="size-4" />Kembali</Button><OppeErrorState message={error ?? 'Tidak ditemukan'} onRetry={load} /></div>;

  const comp = live.comp;
  const shownCat = dirty ? comp.finalCategory : masters.settings.resultCategories.find((c) => c.code === ev.finalCategory) ?? comp.finalCategory;
  const statusIdx = OPPE_STATUS_FLOW.indexOf(ev.status);
  const groups = masters.categories.filter((c) => c.isActive || items.some((i) => i.categoryId === c.id)).map((c) => ({ cat: c, rows: items.filter((i) => i.categoryId === c.id || (!masters.categories.some((x) => x.id === i.categoryId) && i.categoryCode === c.code)) }));
  const triggerItems = items.filter((i) => resultMap.get(i.id)?.status === 'trigger');
  const recommendationShown = (dirty ? comp.recommendation : ev.recommendation) ?? '';

  let rowNo = 0;

  return (
    <div className="p-4 space-y-4">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <Button variant="outline" size="icon" onClick={onBack} aria-label="Kembali"><ArrowLeft className="size-4" /></Button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold">{ev.doctorName}</h2>
              <OppeStatusBadge status={ev.status} />
              {ev.isDemo && <Badge variant="outline" className="text-[9px]">DEMO</Badge>}
              {finalized && <Badge variant="secondary" className="gap-1 text-[10px]"><Lock className="size-3" />Terkunci</Badge>}
            </div>
            <p className="text-xs text-muted-foreground">
              {ev.evaluationNumber} · {[ev.profession, ev.specialty].filter(Boolean).join(' / ')} · {ev.ksmName ?? '—'}{ev.unitName ? ` · ${ev.unitName}` : ''}
            </p>
            <p className="text-xs text-muted-foreground">Periode: <b className="text-foreground">{periodLabel(ev)}</b> · Evaluator: {ev.evaluatorName ?? '—'} · Tgl evaluasi {fmtDate(ev.evaluationDate)} · Jatuh tempo {fmtDate(ev.dueDate)}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit && <Button size="sm" onClick={() => save()} disabled={!!busy} className="gap-1.5">{busy === 'save' ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}Simpan{dirty ? ' *' : ''}</Button>}
          {canEdit && !dirty && <Button size="sm" variant="outline" onClick={() => save()} disabled={!!busy} className="gap-1.5" title="Hitung ulang skor dengan pengaturan terbaru"><RefreshCw className="size-4" />Hitung ulang</Button>}
          {['draft', 'in_progress'].includes(ev.status) && (isEvaluator || isCommittee) && <Button size="sm" variant="secondary" onClick={() => transition('submit')} disabled={!!busy} className="gap-1.5"><Send className="size-4" />Ajukan</Button>}
          {isCommittee && ev.status === 'submitted' && <Button size="sm" variant="secondary" onClick={() => setDlg('review')} disabled={!!busy} className="gap-1.5"><ClipboardCheck className="size-4" />Review</Button>}
          {isCommittee && ev.status === 'reviewed' && <Button size="sm" variant="secondary" onClick={() => transition('approve')} disabled={!!busy} className="gap-1.5"><ShieldCheck className="size-4" />Setujui</Button>}
          {isCommittee && ev.status === 'approved' && <Button size="sm" onClick={() => transition('finalize')} disabled={!!busy} className="gap-1.5"><Lock className="size-4" />Finalisasi</Button>}
          {isCommittee && ['submitted', 'reviewed', 'approved'].includes(ev.status) && <Button size="sm" variant="outline" onClick={() => setDlg('return')} disabled={!!busy} className="gap-1.5"><Undo2 className="size-4" />Kembalikan</Button>}
          {isCommittee && finalized && <Button size="sm" variant="outline" onClick={() => setDlg('reopen')} disabled={!!busy} className="gap-1.5"><Unlock className="size-4" />Buka Kembali</Button>}
          {isCommittee && (ev.requiresFppe || comp.requiresFppe) && <Button size="sm" variant="destructive" onClick={() => setFppeDraft({
            evaluationId: ev.id, doctorId: ev.doctorId, ksmId: ev.ksmId, status: 'draft',
            triggerIndicatorId: comp.criticalTriggers[0] ? items.find((i) => i.id === comp.criticalTriggers[0].id)?.indicatorId ?? null : null,
            triggerItemId: comp.criticalTriggers[0]?.id ?? null,
            triggerIndicatorName: comp.criticalTriggers.map((i) => i.name).join('; ') || comp.triggerItems.map((i) => i.name).join('; ') || null,
            reason: comp.criticalTriggers.length ? `Indikator kritis terkena trigger pada OPPE ${periodLabel(ev)}.` : `${comp.triggerCount} indikator terkena trigger pada OPPE ${periodLabel(ev)}.`,
          })} className="gap-1.5"><Microscope className="size-4" />Buat FPPE</Button>}
          <Button size="sm" variant="outline" onClick={printPdf} className="gap-1.5"><Printer className="size-4" />PDF</Button>
          <Button size="sm" variant="outline" onClick={exportExcel} className="gap-1.5"><FileDown className="size-4" />Excel</Button>
          {(isCommittee || isEvaluator) && <Button size="sm" variant="outline" onClick={() => { setDupYear(ev.periodType === 'semester_2' ? ev.year + 1 : ev.year); setDupPeriod(ev.periodType === 'semester_1' ? 'semester_2' : 'semester_1'); setDlg('duplicate'); }} className="gap-1.5"><Copy className="size-4" />Duplikat</Button>}
          {canDelete && <Button size="sm" variant="ghost" onClick={() => setDlg('delete')} className="gap-1.5 text-red-500"><Trash2 className="size-4" /></Button>}
        </div>
      </div>

      {/* ── Lifecycle ── */}
      <div className="flex flex-wrap items-center gap-1 text-[11px]">
        {OPPE_STATUS_FLOW.map((s, i) => (
          <Fragment key={s}>
            <span className={`rounded-full px-2 py-0.5 border ${i <= statusIdx ? 'bg-primary/10 border-primary/40 text-foreground font-medium' : 'text-muted-foreground'}`}>{OPPE_STATUS_LABEL[s]}</span>
            {i < OPPE_STATUS_FLOW.length - 1 && <ChevronRight className="size-3 text-muted-foreground" />}
          </Fragment>
        ))}
        {ev.reopenReason && <span className="ml-2 text-amber-600">Dibuka kembali {fmtDateTime(ev.reopenedAt)}: {ev.reopenReason}</span>}
        {ev.reviewNotes && <span className="ml-2 text-muted-foreground">Catatan review: {ev.reviewNotes}</span>}
      </div>

      <OppeScoreSummary
        categoryScores={dirty ? comp.categoryScores : (ev.categoryScores.length ? ev.categoryScores : comp.categoryScores)}
        finalScore={dirty ? comp.finalScore : ev.finalScore ?? comp.finalScore}
        finalCategory={shownCat}
        metCount={comp.metCount}
        attentionCount={comp.attentionCount}
        triggerCount={comp.triggerCount}
        noDataCount={comp.noDataCount}
        criticalTriggerNames={comp.criticalTriggers.map((i) => i.name)}
        trend={dirty ? comp.trend : ev.trend}
        previousScore={live.prev?.finalScore ?? ev.previousScore}
        live={dirty}
      />

      <Tabs defaultValue="items">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="items">Indikator ({items.length})</TabsTrigger>
          <TabsTrigger value="trigger">Trigger ({triggerItems.length})</TabsTrigger>
          <TabsTrigger value="conclusion">Kesimpulan & Rekomendasi</TabsTrigger>
          <TabsTrigger value="fppe">FPPE ({fppe.length})</TabsTrigger>
          <TabsTrigger value="trend">Trend</TabsTrigger>
          <TabsTrigger value="ai" className="gap-1"><Sparkles className="size-3.5" />AI</TabsTrigger>
          <TabsTrigger value="audit" className="gap-1"><History className="size-3.5" />Audit</TabsTrigger>
        </TabsList>

        {/* ── Tabel evaluasi ── */}
        <TabsContent value="items">
          <Card>
            <CardContent className="pt-4 overflow-x-auto">
              {!canEdit && !finalized && <p className="text-xs text-muted-foreground pb-2">Mode baca — evaluasi ini tidak dapat diubah oleh Anda pada status {OPPE_STATUS_LABEL[ev.status]}.</p>}
              {finalized && <p className="text-xs text-muted-foreground pb-2 flex items-center gap-1"><Lock className="size-3" />Evaluasi FINAL — perubahan hanya melalui "Buka Kembali" oleh Komite Medik dengan alasan.</p>}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">No</TableHead>
                    <TableHead className="min-w-[240px]">Parameter</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead className="min-w-[150px]">Realisasi</TableHead>
                    <TableHead className="text-right">Pencapaian</TableHead>
                    <TableHead>Trigger</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Sumber Data</TableHead>
                    <TableHead className="w-8" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groups.map(({ cat, rows }) => rows.length === 0 ? null : (
                    <Fragment key={cat.id}>
                      <TableRow className="bg-muted/40 hover:bg-muted/40">
                        <TableCell className="font-semibold text-xs">{cat.code}</TableCell>
                        <TableCell colSpan={8} className="font-semibold text-xs uppercase">
                          {cat.name} (Bobot {fmtNum(cat.weight)}%) — skor {fmtNum(comp.categoryScores.find((c) => c.code === cat.code)?.score)}
                        </TableCell>
                      </TableRow>
                      {rows.map((it) => {
                        rowNo++;
                        const r = resultMap.get(it.id)!;
                        const categorical = isCategoricalType(it.dataType) || it.targetOperator === 'category';
                        const needsTarget = !categorical && it.targetValue === null && it.targetOperator !== 'zero' && it.targetOperator !== 'pct100';
                        const open = !!expanded[it.id];
                        return (
                          <Fragment key={it.id}>
                            <TableRow className={r.status === 'trigger' ? 'bg-red-500/5' : ''}>
                              <TableCell className="text-xs">{rowNo}</TableCell>
                              <TableCell className="text-sm">
                                {it.name}
                                {it.isCritical && <Badge variant="destructive" className="ml-1 text-[9px]">KRITIS</Badge>}
                                <span className="block text-[10px] font-mono text-muted-foreground">{it.code}</span>
                              </TableCell>
                              <TableCell className="text-xs whitespace-nowrap">
                                {it.targetText || describeTarget(it, it.unitLabel)}
                                {(needsTarget || (isCommittee && canEdit && !categorical && (it.triggerOperator === 'lt_target' || it.triggerOperator === 'gt_target'))) && canEdit && (
                                  <Input
                                    className="h-7 mt-1 w-24 text-xs"
                                    inputMode="decimal"
                                    placeholder="nilai target"
                                    value={it.targetValue ?? ''}
                                    onChange={(e) => updateItem(it.id, { targetValue: e.target.value.trim() === '' ? null : Number(e.target.value.replace(',', '.')) })}
                                  />
                                )}
                                {!canEdit && it.targetValue !== null && (it.triggerOperator === 'lt_target' || it.triggerOperator === 'gt_target') && <span className="block text-[10px] text-muted-foreground">nilai: {fmtNum(it.targetValue)}</span>}
                              </TableCell>
                              <TableCell>
                                {categorical ? (
                                  <Select value={it.realizationText ?? '__none'} onValueChange={(v) => updateItem(it.id, { realizationText: v === '__none' ? null : v })} disabled={!canEdit}>
                                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Pilih" /></SelectTrigger>
                                    <SelectContent><SelectItem value="__none">— belum diisi —</SelectItem>{it.options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                                  </Select>
                                ) : (
                                  <div className="flex items-center gap-1">
                                    <Input
                                      className="h-8 text-xs w-24"
                                      inputMode="decimal"
                                      value={it.realizationText ?? ''}
                                      disabled={!canEdit}
                                      onChange={(e) => updateItem(it.id, { realizationText: e.target.value })}
                                      aria-invalid={!!it.realizationText && parseNumeric(it.realizationText, it.dataType) === null}
                                    />
                                    <span className="text-[11px] text-muted-foreground">{it.unitLabel}</span>
                                  </div>
                                )}
                                {!!it.realizationText && !categorical && parseNumeric(it.realizationText, it.dataType) === null && <p className="text-[10px] text-red-500">Realisasi harus berupa angka</p>}
                                {it.qualityIndicatorId && canEdit && (
                                  <Button size="sm" variant="link" className="h-auto p-0 text-[10px]" onClick={() => pullQuality(it)}>Tarik dari Indikator Mutu</Button>
                                )}
                              </TableCell>
                              <TableCell className="text-right text-xs">{r.achievement === null ? '—' : `${fmtNum(r.achievement, 1)}%`}</TableCell>
                              <TableCell className="text-xs">{it.triggerText ?? '—'}</TableCell>
                              <TableCell>
                                <Tooltip><TooltipTrigger asChild><span><OppeItemStatusBadge status={r.status} /></span></TooltipTrigger><TooltipContent className="text-xs max-w-xs">{r.reason}{r.score !== null ? ` · skor ${r.score}` : ''}</TooltipContent></Tooltip>
                              </TableCell>
                              <TableCell className="text-xs">{it.sourceData ?? '—'}</TableCell>
                              <TableCell>
                                <Button size="icon" variant="ghost" className="size-7 relative" onClick={() => setExpanded((s) => ({ ...s, [it.id]: !s[it.id] }))} aria-label="Catatan & bukti">
                                  {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                                  {(it.notes || it.evidenceUrl || it.evidencePath) && !open && <span className="absolute size-1.5 rounded-full bg-primary translate-x-2 -translate-y-2" />}
                                </Button>
                              </TableCell>
                            </TableRow>
                            {open && (
                              <TableRow className="bg-muted/20 hover:bg-muted/20">
                                <TableCell />
                                <TableCell colSpan={8}>
                                  <div className="grid md:grid-cols-3 gap-3 py-1">
                                    <div className="space-y-1">
                                      <Label className="text-[11px]">Catatan</Label>
                                      <Textarea rows={2} className="text-xs" value={it.notes ?? ''} disabled={!canEdit} onChange={(e) => updateItem(it.id, { notes: e.target.value })} />
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-[11px] flex items-center gap-1"><Link2 className="size-3" />Link bukti (rekam medis / laporan audit)</Label>
                                      <Input className="h-8 text-xs" placeholder="https://…" value={it.evidenceUrl ?? ''} disabled={!canEdit} onChange={(e) => updateItem(it.id, { evidenceUrl: e.target.value || null })} />
                                      {it.evidenceUrl && /^https?:\/\//.test(it.evidenceUrl) && <a href={it.evidenceUrl} target="_blank" rel="noreferrer" className="text-[11px] text-primary underline">Buka link</a>}
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-[11px] flex items-center gap-1"><Paperclip className="size-3" />File bukti (PDF/Excel/gambar/dokumen, maks 10 MB)</Label>
                                      {canEdit && <Input type="file" className="h-8 text-xs" accept=".pdf,.xls,.xlsx,.csv,.doc,.docx,.png,.jpg,.jpeg" disabled={busy === 'upload-' + it.id} onChange={(e) => onUpload(it, e.target.files?.[0])} />}
                                      {it.evidencePath && (
                                        <Button size="sm" variant="link" className="h-auto p-0 text-[11px] gap-1" onClick={async () => { const u = await getOppeEvidenceUrl(it.evidencePath!); if (u) window.open(u, '_blank'); else toastError('File bukti tidak dapat dibuka.'); }}>
                                          <Download className="size-3" />{it.evidencePath.split('/').pop()}
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </Fragment>
                        );
                      })}
                    </Fragment>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Trigger ── */}
        <TabsContent value="trigger">
          <Card>
            <CardContent className="pt-4 space-y-2">
              {triggerItems.length === 0 ? <p className="text-sm text-muted-foreground">Tidak ada indikator yang menyentuh batas trigger.</p> : triggerItems.map((it) => (
                <div key={it.id} className={`rounded-md border p-3 ${it.isCritical ? 'border-red-500/50 bg-red-500/5' : ''}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{it.name}</p>
                    {it.isCritical && <Badge variant="destructive" className="text-[9px]">KRITIS</Badge>}
                    <span className="text-[10px] font-mono text-muted-foreground">{it.code}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">Target {it.targetText} · Realisasi <b className="text-foreground">{it.realizationText} {it.unitLabel !== 'kategori' ? it.unitLabel : ''}</b> · Trigger {it.triggerText} · Sumber: {it.sourceData ?? '—'}</p>
                  {it.notes && <p className="text-xs mt-1">Catatan: {it.notes}</p>}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Kesimpulan ── */}
        <TabsContent value="conclusion">
          <div className="grid lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Kesimpulan</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <Info label="Skor akhir" value={fmtNum(dirty ? comp.finalScore : ev.finalScore)} />
                  <Info label="Kategori" value={<OppeCategoryBadge code={shownCat?.code ?? null} label={shownCat?.label ?? null} categories={masters.settings.resultCategories} />} />
                  <Info label="Indikator memenuhi" value={comp.metCount} />
                  <Info label="Perlu perhatian" value={comp.attentionCount} />
                  <Info label="Trigger" value={comp.triggerCount} />
                  <Info label="Indikator kritis" value={comp.criticalTriggers.length ? comp.criticalTriggers.map((i) => i.name).join('; ') : 'Tidak ada'} />
                </div>
                <p className="text-sm">{dirty ? comp.conclusion : ev.conclusion ?? comp.conclusion}</p>
                {comp.warnings.length > 0 && <ul className="text-xs text-amber-600 list-disc pl-4">{comp.warnings.map((w) => <li key={w}>{w}</li>)}</ul>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-1.5"><Lightbulb className="size-4" />Rekomendasi</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <p className="text-[11px] uppercase text-muted-foreground mb-1">Rekomendasi otomatis sistem</p>
                  <p className="whitespace-pre-line">{recommendationShown || '—'}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] uppercase text-muted-foreground">Rekomendasi final Komite Medik {!isCommittee && '(diisi Komite)'}</Label>
                  <Textarea rows={3} value={recOverride} disabled={!isCommittee || finalized} onChange={(e) => { setRecOverride(e.target.value); setDirty(true); }} placeholder="Kosongkan bila sama dengan rekomendasi otomatis." />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] uppercase text-muted-foreground">Catatan pembinaan / rencana tindak lanjut</Label>
                  <Textarea rows={3} value={notes} disabled={!canEdit} onChange={(e) => { setNotes(e.target.value); setDirty(true); }} />
                </div>
                {(canEdit || (isCommittee && !finalized)) && <Button size="sm" onClick={() => save()} disabled={!!busy} className="gap-1.5"><Save className="size-4" />Simpan</Button>}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── FPPE ── */}
        <TabsContent value="fppe">
          <Card>
            <CardContent className="pt-4 space-y-2">
              {(ev.requiresFppe || comp.requiresFppe) && fppe.length === 0 && (
                <p className="text-sm text-red-600">Sistem merekomendasikan FPPE untuk evaluasi ini (keputusan oleh Komite Medik).</p>
              )}
              {fppe.length === 0 ? <p className="text-sm text-muted-foreground">Belum ada FPPE terkait evaluasi ini.</p> : fppe.map((f) => (
                <div key={f.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3">
                  <div className="text-sm">
                    <p className="font-medium"><span className="font-mono text-xs text-muted-foreground mr-2">{f.fppeNumber}</span>{f.triggerIndicatorName ?? f.reason}</p>
                    <p className="text-xs text-muted-foreground">{fmtDate(f.startDate)} – {fmtDate(f.endDate)} · {f.evaluatorName ?? '—'}{f.area ? ` · ${f.area}` : ''}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <OppeFppeStatusBadge status={f.status} />
                    {isCommittee && <Button size="sm" variant="outline" onClick={() => setFppeDraft(f)}>Ubah</Button>}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trend">
          <Card>
            <CardContent className="pt-4">
              <OppeTrendCard history={history} masters={masters} currentId={ev.id} />
              {history.length > 1 && (
                <div className="flex flex-wrap gap-2 pt-3">
                  {history.filter((h) => h.id !== ev.id).map((h) => (
                    <Button key={h.id} size="sm" variant="outline" className="text-xs" onClick={() => onOpenEvaluation(h.id)}>{periodLabel(h)} · {fmtNum(h.finalScore)}</Button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai">
          <Card><CardContent className="pt-4">
            <OppeAiPanel evaluationId={ev.id} onUseAsDraft={isCommittee && !finalized ? (t) => { setRecOverride(t); setDirty(true); toastSuccess('Draf rekomendasi AI dimasukkan', { description: 'Tinjau lalu simpan. Keputusan tetap oleh Komite Medik.' }); } : undefined} />
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="audit">
          <Card>
            <CardContent className="pt-4 space-y-2">
              {audit.length === 0 ? <p className="text-sm text-muted-foreground">Belum ada aktivitas tercatat.</p> : audit.map((a) => (
                <div key={a.id} className="flex items-start justify-between gap-3 border-b pb-2 last:border-0 text-sm">
                  <div>
                    <p><Badge variant="outline" className="text-[10px] mr-2">{OPPE_AUDIT_ACTION_LABEL[a.action] ?? a.action}</Badge>{a.userName ?? 'Pengguna'}{a.reason ? ` — ${a.reason}` : ''}</p>
                    {a.newData && <p className="text-[11px] text-muted-foreground line-clamp-2">{summarizeData(a.oldData, a.newData)}</p>}
                  </div>
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap">{fmtDateTime(a.createdAt)}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Dialog ── */}
      <Dialog open={dlg === 'reopen' || dlg === 'return' || dlg === 'review'} onOpenChange={(o) => !o && setDlg(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dlg === 'reopen' ? 'Buka Kembali Evaluasi FINAL' : dlg === 'return' ? 'Kembalikan ke Evaluator' : 'Review Evaluasi'}</DialogTitle>
            <DialogDescription>{dlg === 'reopen' ? 'Alasan wajib diisi dan tercatat permanen di audit trail.' : dlg === 'return' ? 'Jelaskan bagian yang perlu diperbaiki evaluator.' : 'Catatan review (opsional).'}</DialogDescription>
          </DialogHeader>
          <Textarea rows={4} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Tulis alasan / catatan…" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDlg(null)}>Batal</Button>
            <Button
              disabled={!!busy || ((dlg === 'reopen' || dlg === 'return') && !reason.trim())}
              onClick={() => transition(dlg === 'reopen' ? 'reopen' : dlg === 'return' ? 'return' : 'review', reason)}
            >{busy ? <Loader2 className="size-4 animate-spin" /> : 'Konfirmasi'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dlg === 'duplicate'} onOpenChange={(o) => !o && setDlg(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Duplikat ke Periode Lain</DialogTitle>
            <DialogDescription>Indikator & target disalin; realisasi dikosongkan. Anda menjadi evaluator.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <Select value={dupPeriod} onValueChange={(v) => setDupPeriod(v as OppePeriodType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{(['semester_1', 'semester_2', 'tahunan'] as OppePeriodType[]).map((p) => <SelectItem key={p} value={p}>{OPPE_PERIOD_LABEL[p]}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={String(dupYear)} onValueChange={(v) => setDupYear(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{YEAR_OPTIONS.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDlg(null)}>Batal</Button>
            <Button disabled={!!busy} onClick={async () => {
              setBusy('dup');
              try {
                const id = await duplicateOppeEvaluation({ sourceId: ev.id, periodType: dupPeriod, year: dupYear, actor });
                toastSuccess('Evaluasi diduplikat');
                setDlg(null);
                onOpenEvaluation(id);
              } catch (e) { toastError(friendlyOppeError(e)); } finally { setBusy(null); }
            }}>Duplikat</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={dlg === 'delete'} onOpenChange={(o) => !o && setDlg(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus evaluasi OPPE?</AlertDialogTitle>
            <AlertDialogDescription>Evaluasi {ev.evaluationNumber} ({ev.doctorName}, {periodLabel(ev)}) beserta seluruh item akan dihapus. Jejaknya tetap tersimpan di audit trail.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={async () => {
              try { await deleteOppeEvaluation(ev.id, actor); toastSuccess('Evaluasi dihapus'); onBack(); }
              catch (e) { toastError(friendlyOppeError(e, 'Evaluasi gagal dihapus.')); }
            }}>Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {fppeDraft && <OppeFppeForm masters={masters} initial={fppeDraft} actor={actor} onClose={() => setFppeDraft(null)} onSaved={() => { setFppeDraft(null); load(); }} />}
    </div>
  );
}

function periodKey(e: Pick<OppeEvaluation, 'year' | 'periodType'>) {
  return e.year * 100 + (e.periodType === 'semester_1' ? 1 : e.periodType === 'semester_2' ? 2 : e.periodType === 'tahunan' ? 3 : 0);
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return <div><p className="text-[10px] uppercase text-muted-foreground">{label}</p><div className="font-medium">{value}</div></div>;
}

function summarizeData(oldData: Record<string, unknown> | null, newData: Record<string, unknown> | null): string {
  const parts: string[] = [];
  if (oldData && 'status' in oldData && newData && 'status' in newData) parts.push(`status ${String(oldData.status)} → ${String(newData.status)}`);
  if (oldData && 'finalScore' in oldData && newData && 'finalScore' in newData) parts.push(`skor ${String(oldData.finalScore ?? '—')} → ${String(newData.finalScore ?? '—')}`);
  const changes = (newData?.changes as { code?: string; realisasi?: unknown }[] | undefined) ?? [];
  if (changes.length) parts.push(`${changes.length} indikator diubah: ${changes.slice(0, 4).map((c) => `${c.code}=${c.realisasi ?? '—'}`).join(', ')}${changes.length > 4 ? '…' : ''}`);
  if (!parts.length && newData) parts.push(JSON.stringify(newData).slice(0, 160));
  return parts.join(' · ');
}
