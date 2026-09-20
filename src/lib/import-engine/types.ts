/**
 * Reusable Import/Export Engine — kontrak tipe bersama.
 *
 * Dipakai oleh seluruh modul mutu (Risiko, IKP, Survei Budaya, Survei
 * Kepuasan, UIMU, Custom Indicators) supaya import/export tidak
 * diimplementasikan berulang per modul (lihat MASTER PROMPT — FITUR IMPORT
 * & DOWNLOAD TEMPLATE DATA INMrsds, bagian 41-42: "Reusable Import Engine").
 *
 * Alur: parseFile -> autoMapColumns -> validateRows -> checkDuplicates ->
 *       preview -> user confirm -> commitImport (RPC transaksional) -> hasil.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export type ImportColumnType =
  | 'text'
  | 'integer'
  | 'decimal'
  | 'percentage'
  | 'date'
  | 'time'
  | 'boolean'
  | 'enum'
  | 'reference'
  | 'array_text';

export interface ImportEnumOption {
  value: string;
  label: string;
}

export interface RawRow {
  [excelHeader: string]: unknown;
}

export interface MappedRow {
  [columnKey: string]: unknown;
}

/** Definisi satu kolom template/import untuk satu modul. */
export interface ImportColumnDef {
  /** Nama field pada baris hasil mapping & pada payload RPC. */
  key: string;
  /** Label kolom di Excel (header sheet DATA & PETUNJUK). */
  label: string;
  required?: boolean;
  type: ImportColumnType;
  /** Untuk type 'enum' — sumber sheet REFERENSI + validasi nilai. */
  enumValues?: ImportEnumOption[];
  /** Untuk type 'reference' — resolusi async ke id/kode database (mis. cari unit_id dari nama unit). */
  resolveReference?: (
    supabase: SupabaseClient,
    rawValue: string
  ) => Promise<{ ok: true; value: string } | { ok: false; message: string }>;
  /** Kebalikan dari resolveReference — untuk Export, ubah id/kode tersimpan kembali ke label yang bisa diimport ulang. */
  reverseReference?: (supabase: SupabaseClient, storedValue: unknown) => Promise<string>;
  /** Alias header tambahan (di luar normalisasi otomatis dari label/key). */
  aliases?: string[];
  min?: number;
  max?: number;
  /** Contoh nilai untuk baris contoh di sheet DATA. */
  example?: string;
  /** Catatan singkat untuk sheet PETUNJUK. */
  note?: string;
  /** Transformasi akhir sebelum dikirim ke RPC (mis. gabungkan field). */
  transform?: (value: unknown, row: MappedRow) => unknown;
}

export type ImportRowStatus = 'valid' | 'error' | 'duplicate';

export interface ImportRowError {
  column: string;
  message: string;
}

export interface ImportRowResult {
  /** Nomor baris Excel (1-based, sudah termasuk header sehingga baris data pertama = 2). */
  excelRow: number;
  raw: RawRow;
  mapped: MappedRow;
  status: ImportRowStatus;
  errors: ImportRowError[];
  /** Kunci komposit untuk deteksi duplikasi, mis. "RISK|IGD|2026". */
  dedupeKey?: string;
  /** Tindakan yang dipilih user untuk baris duplikat. */
  duplicateAction?: 'skip' | 'update' | 'insert_new';
}

export interface DuplicateCheckResult {
  /** Set kunci komposit yang SUDAH ADA di database (lower-cased). */
  existingKeys: Set<string>;
  /** Map kunci komposit -> id baris existing (untuk mode update). */
  existingIds: Map<string, string>;
}

export interface ImportConfig {
  moduleKey: string;
  moduleLabel: string;
  /** Tabel utama tujuan import (dipakai untuk cek duplikasi & export). */
  table: string;
  /** Nama fungsi RPC Postgres yang melakukan insert transaksional. */
  rpcName: string;
  columns: ImportColumnDef[];
  /** Kolom (key) yang dipakai sebagai kunci duplikasi, mis. ['risk_code'] atau ['unit_id','period','year']. */
  uniqueKeys: string[];
  templateFileName: string;
  /** Baris petunjuk pengisian tambahan (di luar petunjuk umum). */
  instructions?: string[];
  /** Sheet referensi tambahan: { judulSheet: [{code,label}] }. */
  referenceSheets?: Record<string, ImportEnumOption[]>;
  /** Ambil kunci-kunci yang sudah ada di database untuk deteksi duplikasi. */
  fetchExisting: (supabase: SupabaseClient, mappedRows: MappedRow[]) => Promise<DuplicateCheckResult>;
  /** Default aksi untuk baris duplikat (mengikuti master prompt bagian 13: default = lewati). */
  defaultDuplicateAction?: 'skip' | 'update' | 'insert_new';
  templateVersion: string;
  maxRows?: number;
  /**
   * Hook opsional (bagian 41: ImportConfig.beforeImport) — dijalankan setelah
   * validasi per-kolom, sebelum deteksi duplikasi. Dipakai untuk resolusi
   * lanjutan yang butuh field lain yang sudah dimapping (mis. modul Custom
   * Indicators: dari indicator_id menemukan indicator_version_id aktif).
   */
  beforeImport?: (
    supabase: SupabaseClient,
    mapped: MappedRow
  ) => Promise<{ mapped: MappedRow; errors: ImportRowError[] }>;
}

export interface ImportBatchSummary {
  total: number;
  valid: number;
  error: number;
  duplicate: number;
}

export interface CommitImportResult {
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
  successRows: number;
  errorRows: number;
  historyId?: string;
  message?: string;
}
