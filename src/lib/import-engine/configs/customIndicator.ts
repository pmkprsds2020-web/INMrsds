/**
 * ImportConfig — Modul Master Indikator Mutu Custom
 * (public.custom_indicator_measurements — data pengukuran, generic untuk
 * semua indikator custom).
 *
 * indicator_version_id TIDAK ada di template (diresolve otomatis lewat
 * beforeImport dari Kode Indikator -> versi AKTIF saat ini, effective_to IS
 * NULL), supaya user tidak perlu tahu id versi internal.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { DuplicateCheckResult, ImportConfig, MappedRow } from '../types';
import { buildDedupeKey } from '../duplicates';

const UNIQUE_KEYS = ['indicator_id', 'unit_id', 'period'];

/**
 * Factory — dipakai untuk membuat config generik (semua kind) dan dua
 * varian yang dibedakan berdasarkan `custom_indicators.kind` ('unit' vs
 * 'priority_rs') supaya Template/Import/Export terpisah sesuai penamaan
 * MASTER PROMPT ("Template_IMUT_Unit.xlsx" / "Template_IMUT_Prioritas.xlsx"),
 * meski keduanya tetap memakai tabel & RPC yang sama
 * (custom_indicator_measurements / custom_indicator_import_batch) — hanya
 * kolom Kode Indikator yang dibatasi ke kind terkait lewat resolveReference.
 */
function buildCustomIndicatorImportConfig(opts: {
  moduleKey: string;
  moduleLabel: string;
  templateFileName: string;
  /** Jika diisi, Kode Indikator hanya diterima untuk indikator dengan kind ini. */
  kind?: 'unit' | 'priority_rs';
}): ImportConfig {
  return {
    moduleKey: opts.moduleKey,
    moduleLabel: opts.moduleLabel,
    table: 'custom_indicator_measurements',
    rpcName: 'custom_indicator_import_batch',
    templateFileName: opts.templateFileName,
    templateVersion: '1.0',
    maxRows: 10000,
    uniqueKeys: UNIQUE_KEYS,
    defaultDuplicateAction: 'update',
    instructions: [
      '11. Kode Indikator harus sesuai kode yang terdaftar di Master Indikator Mutu Custom dan berstatus Aktif.'
        + (opts.kind ? ` Khusus template ini hanya menerima indikator jenis "${opts.kind === 'unit' ? 'Indikator Mutu Unit' : 'Indikator Prioritas RS'}".` : ''),
      '12. Nilai (value) dihitung OTOMATIS oleh sistem dari Numerator/Denominator sesuai formula versi indikator saat ini — tidak perlu diisi manual.',
      '13. Kunci deteksi duplikasi: Kode Indikator + Unit + Periode. Data yang sudah ada untuk kombinasi yang sama akan DIPERBARUI.',
      '14. Format Periode mengikuti frekuensi indikator, contoh: "2026-01" (bulanan), "2026-Q1" (triwulanan), "2026" (tahunan).',
    ],
    columns: [
      { key: 'indicator_id', label: 'Kode Indikator', type: 'reference', required: true, example: 'IMP-001',
        resolveReference: async (supabase: SupabaseClient, raw: string) => {
          const { data } = await supabase.from('custom_indicators').select('id, status, indicator_type').eq('code', raw.trim()).maybeSingle();
          if (!data) return { ok: false, message: `Kode Indikator "${raw}" tidak ditemukan di Master Indikator Mutu Custom.` };
          if (data.status !== 'active') return { ok: false, message: `Indikator "${raw}" tidak berstatus Aktif — data tidak dapat diinput.` };
          if (opts.kind && data.indicator_type !== opts.kind) {
            return { ok: false, message: `Indikator "${raw}" bukan jenis "${opts.kind === 'unit' ? 'Indikator Mutu Unit' : 'Indikator Prioritas RS'}" — gunakan template yang sesuai.` };
          }
          return { ok: true, value: data.id };
        },
        reverseReference: async (supabase: SupabaseClient, storedValue: unknown) => {
          if (!storedValue) return '';
          const { data } = await supabase.from('custom_indicators').select('code').eq('id', storedValue as string).maybeSingle();
          return data?.code ?? '';
        },
      },
      { key: 'unit_id', label: 'Unit', type: 'text', required: true, example: 'IGD' },
      { key: 'measurement_date', label: 'Tanggal Pengukuran', type: 'date', required: true, example: '2026-01-31' },
      { key: 'period', label: 'Periode', type: 'text', required: true, example: '2026-01' },
      { key: 'numerator', label: 'Numerator', type: 'decimal', example: '85' },
      { key: 'denominator', label: 'Denominator', type: 'decimal', example: '100' },
      { key: 'notes', label: 'Catatan', type: 'text', example: '' },
    ],
    beforeImport: async (supabase: SupabaseClient, mapped: MappedRow) => {
      const indicatorId = mapped.indicator_id as string | null;
      if (!indicatorId) {
        return { mapped, errors: [{ column: 'Kode Indikator', message: 'Kode Indikator wajib diisi.' }] };
      }
      const { data: version } = await supabase
        .from('custom_indicator_versions')
        .select('id')
        .eq('indicator_id', indicatorId)
        .is('effective_to', null)
        .order('version_number', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!version) {
        return { mapped, errors: [{ column: 'Kode Indikator', message: 'Indikator ini belum memiliki versi definisi aktif.' }] };
      }
      return { mapped: { ...mapped, indicator_version_id: version.id }, errors: [] };
    },
    fetchExisting: async (supabase: SupabaseClient, mappedRows: MappedRow[]): Promise<DuplicateCheckResult> => {
      const indicatorIds = Array.from(new Set(mappedRows.map((r) => r.indicator_id).filter(Boolean)));
      if (indicatorIds.length === 0) return { existingKeys: new Set(), existingIds: new Map() };
      const { data } = await supabase
        .from('custom_indicator_measurements')
        .select('id, indicator_id, unit_id, period')
        .in('indicator_id', indicatorIds as string[]);
      const existingKeys = new Set<string>();
      const existingIds = new Map<string, string>();
      for (const row of data ?? []) {
        const key = buildDedupeKey(row as unknown as MappedRow, UNIQUE_KEYS);
        existingKeys.add(key);
        existingIds.set(key, (row as { id: string }).id);
      }
      return { existingKeys, existingIds };
    },
  };
}

/** Generik (semua kind) — dipakai di CustomIndicatorDetail.tsx sebagai fallback jika kind indikator tidak diketahui. */
export const customIndicatorImportConfig: ImportConfig = buildCustomIndicatorImportConfig({
  moduleKey: 'custom_indicator',
  moduleLabel: 'Master Indikator Mutu Custom',
  templateFileName: 'Template_Indikator_Mutu_Custom.xlsx',
});

export function buildCustomIndicatorImportConfigForKind(kind: 'unit' | 'priority_rs'): ImportConfig {
  return kind === 'unit'
    ? buildCustomIndicatorImportConfig({
        moduleKey: 'custom_indicator_unit',
        moduleLabel: 'Indikator Mutu Unit (IMUT Unit)',
        templateFileName: 'Template_IMUT_Unit.xlsx',
        kind: 'unit',
      })
    : buildCustomIndicatorImportConfig({
        moduleKey: 'custom_indicator_priority',
        moduleLabel: 'Indikator Prioritas RS (IMUT Prioritas)',
        templateFileName: 'Template_IMUT_Prioritas.xlsx',
        kind: 'priority_rs',
      });
}
