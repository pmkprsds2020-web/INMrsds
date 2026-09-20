/**
 * Orkestrasi penuh: UPLOAD -> READ -> VALIDASI -> DEDUP -> PREVIEW ->
 * (user confirm) -> IMPORT DATABASE (RPC transaksional) -> LOG.
 * MASTER PROMPT bagian 6 (alur validasi) & 17 (transaction/rollback).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  ImportBatchSummary,
  ImportConfig,
  ImportRowResult,
  CommitImportResult,
} from './types';
import { parseWorkbookFile } from './parseFile';
import { autoMapColumns, applyMapping, type AutoMapResult } from './normalize';
import { validateAndCoerceRow } from './validators';
import { applyDuplicateStatus } from './duplicates';

export interface AnalyzeResult {
  fileName: string;
  fileSizeBytes: number;
  sheetCount: number;
  totalRows: number;
  headers: string[];
  autoMap: AutoMapResult;
  rawRows: Record<string, unknown>[];
}

export async function analyzeFile(file: File, config: ImportConfig): Promise<AnalyzeResult> {
  const parsed = await parseWorkbookFile(file);
  if (config.maxRows && parsed.rows.length > config.maxRows) {
    throw new Error(`File berisi ${parsed.rows.length} baris, melebihi batas maksimal ${config.maxRows} baris untuk modul ini.`);
  }
  const autoMap = autoMapColumns(parsed.headers, config.columns);
  return {
    fileName: parsed.fileName,
    fileSizeBytes: parsed.fileSizeBytes,
    sheetCount: parsed.sheetCount,
    totalRows: parsed.rows.length,
    headers: parsed.headers,
    autoMap,
    rawRows: parsed.rows,
  };
}

export async function buildPreview(
  supabase: SupabaseClient,
  config: ImportConfig,
  rawRows: Record<string, unknown>[],
  mapping: AutoMapResult['mapping'],
  onProgress?: (done: number, total: number) => void
): Promise<ImportRowResult[]> {
  const mappedRows = applyMapping(rawRows, mapping);
  const results: ImportRowResult[] = [];

  for (let i = 0; i < mappedRows.length; i++) {
    let { mapped, errors } = await validateAndCoerceRow(supabase, mappedRows[i], config.columns);
    if (errors.length === 0 && config.beforeImport) {
      const extra = await config.beforeImport(supabase, mapped);
      mapped = extra.mapped;
      errors = extra.errors;
    }
    results.push({
      excelRow: i + 2, // header di baris 1 (atau 5 utk template resmi — ditampilkan relatif)
      raw: rawRows[i],
      mapped,
      status: errors.length > 0 ? 'error' : 'valid',
      errors,
    });
    if (onProgress && (i % 25 === 0 || i === mappedRows.length - 1)) onProgress(i + 1, mappedRows.length);
  }

  const validMapped = results.filter((r) => r.status !== 'error').map((r) => r.mapped);
  if (validMapped.length > 0) {
    const dup = await config.fetchExisting(supabase, validMapped);
    applyDuplicateStatus(results, dup.existingKeys, config);
  }

  return results;
}

export function summarize(results: ImportRowResult[]): ImportBatchSummary {
  return {
    total: results.length,
    valid: results.filter((r) => r.status === 'valid').length,
    error: results.filter((r) => r.status === 'error').length,
    duplicate: results.filter((r) => r.status === 'duplicate').length,
  };
}

/** Baris yang benar-benar akan dikirim ke database, mengikuti keputusan user atas duplikat. */
export function rowsToCommit(results: ImportRowResult[]): ImportRowResult[] {
  return results.filter((r) => {
    if (r.status === 'valid') return true;
    if (r.status === 'duplicate') return r.duplicateAction && r.duplicateAction !== 'skip';
    return false;
  });
}

export async function commitImport(
  supabase: SupabaseClient,
  config: ImportConfig,
  results: ImportRowResult[],
  userId: string,
  fileMeta: { fileName: string; fileSizeBytes: number }
): Promise<CommitImportResult> {
  const toCommit = rowsToCommit(results);
  const summary = summarize(results);

  if (toCommit.length === 0) {
    await logImportHistory(supabase, config, userId, fileMeta, summary, 'FAILED', 0);
    return { status: 'FAILED', successRows: 0, errorRows: summary.error, message: 'Tidak ada baris valid untuk diimport.' };
  }

  const payload = toCommit.map((r) => ({
    action: r.status === 'duplicate' ? r.duplicateAction : 'insert',
    dedupe_key: r.dedupeKey ?? null,
    data: r.mapped,
  }));

  const { data, error } = await supabase.rpc(config.rpcName, {
    p_payload: payload,
    p_actor: userId,
  });

  if (error) {
    await logImportHistory(supabase, config, userId, fileMeta, summary, 'FAILED', 0, error.message);
    return { status: 'FAILED', successRows: 0, errorRows: toCommit.length, message: error.message };
  }

  const successRows: number = data?.[0]?.success_count ?? toCommit.length;
  const status: CommitImportResult['status'] = summary.error > 0 || summary.duplicate > 0 ? 'PARTIAL' : 'SUCCESS';

  const historyId = await logImportHistory(
    supabase,
    config,
    userId,
    fileMeta,
    summary,
    successRows === toCommit.length ? status : 'PARTIAL',
    successRows
  );

  if (historyId) await logErrorRows(supabase, historyId, config.moduleKey, results);

  return { status, successRows, errorRows: summary.error, historyId };
}

async function logImportHistory(
  supabase: SupabaseClient,
  config: ImportConfig,
  userId: string,
  fileMeta: { fileName: string; fileSizeBytes: number },
  summary: ImportBatchSummary,
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED' | 'CANCELLED',
  successRows: number,
  errorMessage?: string
): Promise<string | undefined> {
  const { data, error } = await supabase
    .from('import_history')
    .insert({
      user_id: userId,
      module: config.moduleKey,
      file_name: fileMeta.fileName,
      file_size: fileMeta.fileSizeBytes,
      total_rows: summary.total,
      success_rows: successRows,
      error_rows: summary.error,
      duplicate_rows: summary.duplicate,
      status,
      error_message: errorMessage ?? null,
    })
    .select('id')
    .single();
  if (error) return undefined;
  const historyId: string | undefined = data?.id;

  return historyId;
}

/** Simpan detail baris error ke import_error_log, ditautkan ke import_history (opsional, untuk audit & Riwayat Import). */
export async function logErrorRows(
  supabase: SupabaseClient,
  historyId: string,
  moduleKey: string,
  results: ImportRowResult[]
): Promise<void> {
  const errorRows = results.filter((r) => r.status === 'error');
  if (errorRows.length === 0) return;
  const payload = errorRows.flatMap((r) =>
    r.errors.map((e) => ({
      import_history_id: historyId,
      module: moduleKey,
      excel_row: r.excelRow,
      column_name: e.column,
      cell_value: String(r.raw[e.column] ?? ''),
      error_message: e.message,
    }))
  );
  await supabase.from('import_error_log').insert(payload);
}
