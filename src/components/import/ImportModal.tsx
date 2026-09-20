'use client';

/**
 * Modal Import Data generik — dipakai oleh SEMUA modul mutu (bagian 41-42
 * MASTER PROMPT: Reusable Import Engine / ImportModal). Konfigurasi per
 * modul datang dari src/lib/import-engine/configs/*.
 *
 * Alur (bagian 6, 44): UPLOAD -> MAPPING (jika ada header ambigu) ->
 * PREVIEW (validasi + duplikasi) -> KONFIRMASI -> IMPORT -> HASIL.
 */
import { useCallback, useMemo, useState } from 'react';
import {
  Upload, FileSpreadsheet, Download, AlertCircle, CheckCircle2, Loader2, X, ArrowRight, History,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

import { supabase } from '@/lib/supabase/client';
import type { ImportConfig, ImportRowResult } from '@/lib/import-engine/types';
import { analyzeFile, buildPreview, commitImport, summarize, type AnalyzeResult } from '@/lib/import-engine/runImport';
import type { ColumnMappingEntry } from '@/lib/import-engine/normalize';
import { buildImportTemplate, triggerBlobDownload } from '@/lib/import-engine/templateBuilder';
import { downloadErrorReport } from '@/lib/import-engine/errorReport';

type Step = 'upload' | 'mapping' | 'preview' | 'importing' | 'result';

export interface ImportModalProps {
  open: boolean;
  onClose: () => void;
  config: ImportConfig;
  userId: string;
  onImported?: () => void;
}

export function ImportModal({ open, onClose, config, userId, onImported }: ImportModalProps) {
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [analyzed, setAnalyzed] = useState<AnalyzeResult | null>(null);
  const [mapping, setMapping] = useState<ColumnMappingEntry[]>([]);
  const [results, setResults] = useState<ImportRowResult[]>([]);
  const [progress, setProgress] = useState(0);
  const [isBusy, setIsBusy] = useState(false);
  const [commitStatus, setCommitStatus] = useState<{ status: string; successRows: number; errorRows: number; message?: string } | null>(null);

  const summary = useMemo(() => summarize(results), [results]);

  const reset = useCallback(() => {
    setStep('upload');
    setFile(null);
    setAnalyzed(null);
    setMapping([]);
    setResults([]);
    setProgress(0);
    setCommitStatus(null);
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  const handleDownloadTemplate = useCallback(async () => {
    const blob = await buildImportTemplate(config, { moduleLabel: config.moduleLabel });
    triggerBlobDownload(blob, config.templateFileName);
  }, [config]);

  const runAnalyze = useCallback(
    async (f: File) => {
      setIsBusy(true);
      try {
        const a = await analyzeFile(f, config);
        setFile(f);
        setAnalyzed(a);
        setMapping(a.autoMap.mapping);
        setStep('mapping'); // selalu tampilkan konfirmasi mapping dulu (bagian 9: mapping harus ditampilkan ke user sebelum import)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Gagal membaca file.');
      } finally {
        setIsBusy(false);
      }
    },
    [config]
  );

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) runAnalyze(f);
  }, [runAnalyze]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) runAnalyze(f);
  }, [runAnalyze]);

  const missingRequiredAfterMapping = useMemo(
    () => config.columns.filter((c) => c.required && !mapping.find((m) => m.columnKey === c.key)?.excelHeader),
    [config.columns, mapping]
  );

  const runValidation = useCallback(async () => {
    if (!analyzed) return;
    setIsBusy(true);
    setStep('preview');
    try {
      const res = await buildPreview(supabase, config, analyzed.rawRows, mapping, (done, total) => setProgress(Math.round((done / total) * 100)));
      setResults(res);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal memvalidasi data.');
      setStep('mapping');
    } finally {
      setIsBusy(false);
      setProgress(0);
    }
  }, [analyzed, mapping, config]);

  const setDuplicateAction = useCallback((idx: number, action: 'skip' | 'update' | 'insert_new') => {
    setResults((prev) => prev.map((r, i) => (i === idx ? { ...r, duplicateAction: action } : r)));
  }, []);

  const handleConfirmImport = useCallback(async () => {
    if (!file) return;
    setIsBusy(true);
    setStep('importing');
    try {
      const result = await commitImport(supabase, config, results, userId, { fileName: file.name, fileSizeBytes: file.size });
      setCommitStatus(result);
      setStep('result');
      if (result.status !== 'FAILED') {
        toast.success(`${result.successRows} data berhasil diimport.`);
        onImported?.();
      } else {
        toast.error(result.message ?? 'Import gagal.');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal melakukan import.');
      setStep('preview');
    } finally {
      setIsBusy(false);
    }
  }, [file, results, config, userId, onImported]);

  const handleDownloadErrorReport = useCallback(() => {
    downloadErrorReport(results, config.moduleKey);
  }, [results, config.moduleKey]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="size-5 text-[#4f8ef7]" />
            Import Data — {config.moduleLabel}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Upload file .xlsx, .xls, atau .csv sesuai template resmi modul ini.
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="flex-1 space-y-4">
            <div
              onDrop={onDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => document.getElementById('import-engine-file-input')?.click()}
              className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-white/20 py-12 px-4 transition-colors hover:border-[#4f8ef7]/50 hover:bg-muted/50 cursor-pointer"
            >
              {isBusy ? <Loader2 className="size-10 text-muted-foreground/40 mb-3 animate-spin" /> : <Upload className="size-10 text-muted-foreground/40 mb-3" />}
              <p className="text-sm text-muted-foreground mb-1">Drag &amp; drop file Excel di sini</p>
              <p className="text-xs text-muted-foreground/60 mb-3">atau klik untuk memilih file (.xlsx, .xls, .csv) — maksimal 10 MB</p>
              <Input id="import-engine-file-input" type="file" accept=".xlsx,.xls,.csv" onChange={onFileChange} className="hidden" />
              <Badge className="bg-muted/50 text-muted-foreground border-border text-[10px]">
                {config.maxRows ? `Maksimal ${config.maxRows.toLocaleString('id-ID')} baris` : 'Ukuran maksimal 10 MB'}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Belum punya template? Download format resmi modul ini:</p>
              <Button variant="outline" size="sm" onClick={handleDownloadTemplate} className="h-7 text-xs gap-1.5">
                <Download className="size-3" /> Download Template
              </Button>
            </div>
          </div>
        )}

        {step === 'mapping' && analyzed && (
          <div className="flex-1 space-y-4 min-h-0 overflow-hidden flex flex-col">
            <div className="flex items-center gap-2 text-xs text-foreground/80">
              <CheckCircle2 className="size-4 text-emerald-400" />
              {analyzed.fileName} — {analyzed.totalRows} baris terbaca
            </div>
            <p className="text-xs text-muted-foreground">Mapping Kolom — cocokkan header Excel dengan field database. Kolom bertanda * wajib dipetakan.</p>
            <ScrollArea className="flex-1 rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[10px]">Field Database</TableHead>
                    <TableHead className="text-[10px] w-8" />
                    <TableHead className="text-[10px]">Header Excel</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {config.columns.map((col) => {
                    const idx = mapping.findIndex((m) => m.columnKey === col.key);
                    const current = mapping[idx];
                    return (
                      <TableRow key={col.key}>
                        <TableCell className="text-xs">
                          {col.label} {col.required && <span className="text-red-400">*</span>}
                        </TableCell>
                        <TableCell><ArrowRight className="size-3 text-muted-foreground" /></TableCell>
                        <TableCell>
                          <Select
                            value={current?.excelHeader ?? '__none__'}
                            onValueChange={(val) => {
                              setMapping((prev) => prev.map((m, i) => (i === idx ? { ...m, excelHeader: val === '__none__' ? null : val, confident: true } : m)));
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs w-full"><SelectValue placeholder="Tidak dipetakan" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">— Tidak dipetakan —</SelectItem>
                              {analyzed.headers.map((h) => (
                                <SelectItem key={h} value={h}>{h}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
            {missingRequiredAfterMapping.length > 0 && (
              <div className="flex items-start gap-2 text-xs text-red-400 bg-red-500/10 rounded-md p-2">
                <AlertCircle className="size-4 shrink-0" />
                Kolom wajib belum dipetakan: {missingRequiredAfterMapping.map((c) => c.label).join(', ')}
              </div>
            )}
          </div>
        )}

        {step === 'preview' && (
          <div className="flex-1 space-y-3 min-h-0 flex flex-col">
            {isBusy ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Loader2 className="size-8 animate-spin text-[#4f8ef7]" />
                <p className="text-xs text-muted-foreground">Memvalidasi data... {progress}%</p>
                <Progress value={progress} className="w-64" />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-4 gap-2">
                  <StatCard label="Total data" value={summary.total} />
                  <StatCard label="Data valid" value={summary.valid} tone="emerald" />
                  <StatCard label="Duplikat" value={summary.duplicate} tone="amber" />
                  <StatCard label="Error" value={summary.error} tone="red" />
                </div>
                <ScrollArea className="flex-1 rounded-lg border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-[10px] w-14">Baris</TableHead>
                        <TableHead className="text-[10px] w-20">Status</TableHead>
                        <TableHead className="text-[10px]">Ringkasan</TableHead>
                        <TableHead className="text-[10px] w-40">Aksi Duplikat</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {results.map((r, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="text-xs">{r.excelRow}</TableCell>
                          <TableCell>
                            {r.status === 'valid' && <Badge className="bg-emerald-500/20 text-emerald-400 border-0 text-[10px]">✓ Valid</Badge>}
                            {r.status === 'error' && <Badge className="bg-red-500/20 text-red-400 border-0 text-[10px]">✗ Error</Badge>}
                            {r.status === 'duplicate' && <Badge className="bg-amber-500/20 text-amber-400 border-0 text-[10px]">⚠ Duplikat</Badge>}
                          </TableCell>
                          <TableCell className="text-xs text-foreground/70">
                            {r.status === 'error' ? r.errors.map((e) => e.message).join(' ') : Object.values(r.mapped).slice(0, 3).filter(Boolean).join(' • ')}
                          </TableCell>
                          <TableCell>
                            {r.status === 'duplicate' && (
                              <Select value={r.duplicateAction ?? 'skip'} onValueChange={(v) => setDuplicateAction(idx, v as 'skip' | 'update' | 'insert_new')}>
                                <SelectTrigger className="h-7 text-[10px]"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="skip">Lewati data duplikat</SelectItem>
                                  <SelectItem value="update">Update data yang sudah ada</SelectItem>
                                  <SelectItem value="insert_new">Import sebagai data baru</SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
                {summary.error > 0 && (
                  <div className="flex items-center justify-between text-xs bg-red-500/10 rounded-md p-2">
                    <span className="text-red-400">{summary.error} baris error tidak akan diimport.</span>
                    <Button variant="outline" size="sm" onClick={handleDownloadErrorReport} className="h-7 text-[10px] gap-1.5">
                      <Download className="size-3" /> Download Error Report
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {step === 'importing' && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="size-8 animate-spin text-[#4f8ef7]" />
            <p className="text-xs text-muted-foreground">Menyimpan data ke database...</p>
          </div>
        )}

        {step === 'result' && commitStatus && (
          <div className="flex-1 flex flex-col items-center justify-center py-10 gap-3 text-center">
            {commitStatus.status === 'FAILED' ? (
              <AlertCircle className="size-12 text-red-400" />
            ) : (
              <CheckCircle2 className="size-12 text-emerald-400" />
            )}
            <p className="text-sm font-medium text-foreground">
              {commitStatus.status === 'FAILED' ? 'Import Gagal' : 'Import Selesai'}
            </p>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>Total: {summary.total} · Berhasil: {commitStatus.successRows} · Duplikat: {summary.duplicate} · Error: {commitStatus.errorRows}</p>
              {commitStatus.message && <p className="text-red-400">{commitStatus.message}</p>}
            </div>
            {summary.error > 0 && (
              <Button variant="outline" size="sm" onClick={handleDownloadErrorReport} className="h-7 text-[10px] gap-1.5">
                <Download className="size-3" /> Download Error Report
              </Button>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={handleClose}>
            <X className="size-4 mr-1" /> {step === 'result' ? 'Tutup' : 'Batal'}
          </Button>
          {step === 'mapping' && (
            <Button onClick={runValidation} disabled={missingRequiredAfterMapping.length > 0 || isBusy}>
              Lanjut Validasi <ArrowRight className="size-4 ml-1" />
            </Button>
          )}
          {step === 'preview' && !isBusy && (
            <Button onClick={handleConfirmImport} disabled={summary.valid + summary.duplicate === 0}>
              Import {summary.valid + results.filter((r) => r.status === 'duplicate' && r.duplicateAction !== 'skip').length} Data
            </Button>
          )}
          {step === 'result' && (
            <Button variant="outline" onClick={reset}>
              <History className="size-4 mr-1" /> Import File Baru
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone?: 'emerald' | 'amber' | 'red' }) {
  const color = tone === 'emerald' ? 'text-emerald-400' : tone === 'amber' ? 'text-amber-400' : tone === 'red' ? 'text-red-400' : 'text-foreground';
  return (
    <div className="rounded-lg border border-border p-2.5">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className={`text-lg font-semibold ${color}`}>{value}</p>
    </div>
  );
}
