/**
 * Normalisasi header & auto column-mapping (MASTER PROMPT bagian 9 & 32 —
 * TOLERANSI PERBEDAAN NAMA KOLOM / AUTO COLUMN MAPPING).
 */
import type { ImportColumnDef } from './types';

/** exact match -> lowercase -> hapus spasi/underscore/simbol, untuk perbandingan longgar. */
export function normalizeHeader(h: unknown): string {
  return String(h ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

export interface ColumnMappingEntry {
  columnKey: string;
  excelHeader: string | null;
  /** true jika dipilih otomatis dengan yakin (exact/alias match), false jika hasil tebakan mirip yang perlu dikonfirmasi user. */
  confident: boolean;
}

export interface AutoMapResult {
  mapping: ColumnMappingEntry[];
  /** Header Excel yang tidak dikenali sama sekali. */
  unknownHeaders: string[];
  /** Kolom wajib yang tidak ketemu pasangannya di Excel. */
  missingRequired: string[];
}

/**
 * Cocokkan header Excel yang diupload dengan definisi kolom modul.
 * Strategi (bagian 32): exact match -> normalisasi -> alias -> tidak ambigu.
 * Jika satu header Excel bisa cocok ke >1 kolom, TIDAK di-auto-mapping
 * (dibiarkan null) supaya user yang memutuskan (bagian 9: "jangan
 * melakukan mapping yang ambigu secara otomatis").
 */
export function autoMapColumns(excelHeaders: string[], columns: ImportColumnDef[]): AutoMapResult {
  const normalizedExcel = excelHeaders.map((h) => ({ original: h, norm: normalizeHeader(h) }));

  const mapping: ColumnMappingEntry[] = columns.map((col) => {
    const candidates = new Set<string>([normalizeHeader(col.label), normalizeHeader(col.key)]);
    for (const alias of col.aliases ?? []) candidates.add(normalizeHeader(alias));

    const matches = normalizedExcel.filter((e) => candidates.has(e.norm));
    if (matches.length === 1) {
      return { columnKey: col.key, excelHeader: matches[0].original, confident: true };
    }
    return { columnKey: col.key, excelHeader: null, confident: false };
  });

  const mappedExcelHeaders = new Set(mapping.filter((m) => m.excelHeader).map((m) => m.excelHeader));
  const unknownHeaders = excelHeaders.filter((h) => !mappedExcelHeaders.has(h));
  const missingRequired = columns
    .filter((c) => c.required)
    .filter((c) => !mapping.find((m) => m.columnKey === c.key)?.excelHeader)
    .map((c) => c.label);

  return { mapping, unknownHeaders, missingRequired };
}

export function applyMapping(rawRows: Record<string, unknown>[], mapping: ColumnMappingEntry[]): Record<string, unknown>[] {
  return rawRows.map((row) => {
    const out: Record<string, unknown> = {};
    for (const m of mapping) {
      if (m.excelHeader) out[m.columnKey] = row[m.excelHeader];
    }
    return out;
  });
}
