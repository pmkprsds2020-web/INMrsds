/**
 * ImportConfig — Modul Usulan Indikator Mutu Unit (public.uimu_proposals).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { INDICATOR_CATEGORY_OPTIONS, QUALITY_DIMENSION_OPTIONS, TARGET_OPERATOR_OPTIONS, UIMU_STATUS_LABEL } from '@/types/uimu';
import type { DuplicateCheckResult, ImportConfig, MappedRow } from '../types';
import { buildDedupeKey } from '../duplicates';

const STATUS_OPTIONS = Object.entries(UIMU_STATUS_LABEL).map(([value, label]) => ({ value, label }));
const UNIQUE_KEYS = ['unit_id', 'period_year', 'indicator_name'];

export const uimuImportConfig: ImportConfig = {
  moduleKey: 'uimu',
  moduleLabel: 'Usulan Indikator Mutu Unit (UIMU)',
  table: 'uimu_proposals',
  rpcName: 'uimu_import_batch',
  templateFileName: 'Template_UIMU.xlsx',
  templateVersion: '1.0',
  maxRows: 5000,
  uniqueKeys: UNIQUE_KEYS,
  defaultDuplicateAction: 'skip',
  instructions: [
    '11. Nomor Usulan (UIMU/{UNIT}/{TAHUN}/000001) dibuat OTOMATIS oleh sistem — tidak perlu diisi.',
    '12. Kolom Unit harus sesuai Master Unit UIMU (lihat menu Master Indikator > Master Unit).',
    '13. Kosongkan Status untuk default "Draft". Untuk data usulan lama yang sudah ditetapkan, isi Status = "Ditetapkan" dan lengkapi Nomor Penetapan.',
    '14. Kunci deteksi duplikasi: Unit + Tahun Periode + Nama Indikator.',
  ],
  columns: [
    {
      key: 'unit_id', label: 'Unit', type: 'reference', required: true, example: 'Perawatan Umum',
      resolveReference: async (supabase: SupabaseClient, raw: string) => {
        const { data } = await supabase.from('uimu_units').select('id, name, code').or(`name.ilike.${raw.trim()},code.ilike.${raw.trim()}`);
        if (!data || data.length === 0) return { ok: false, message: `Unit "${raw}" tidak ditemukan di Master Unit UIMU.` };
        return { ok: true, value: data[0].id };
      },
      reverseReference: async (supabase: SupabaseClient, storedValue: unknown) => {
        if (!storedValue) return '';
        const { data } = await supabase.from('uimu_units').select('name').eq('id', storedValue as string).maybeSingle();
        return data?.name ?? '';
      },
    },
    { key: 'period_year', label: 'Tahun Periode', type: 'integer', required: true, example: '2026', min: 2000, max: 2100 },
    { key: 'status', label: 'Status', type: 'enum', enumValues: STATUS_OPTIONS, example: 'draft' },
    { key: 'indicator_name', label: 'Nama Indikator', type: 'text', required: true, example: 'Kepatuhan Identifikasi Pasien' },
    { key: 'indicator_category', label: 'Kategori Indikator', type: 'enum', enumValues: INDICATOR_CATEGORY_OPTIONS as unknown as { value: string; label: string }[], example: 'imp_unit' },
    { key: 'quality_dimension', label: 'Dimensi Mutu', type: 'enum', enumValues: QUALITY_DIMENSION_OPTIONS as unknown as { value: string; label: string }[], example: 'keselamatan' },
    { key: 'operational_definition', label: 'Definisi Operasional', type: 'text', example: '' },
    { key: 'numerator', label: 'Numerator', type: 'text', example: '' },
    { key: 'denominator', label: 'Denominator', type: 'text', example: '' },
    { key: 'formula', label: 'Formula', type: 'text', example: '' },
    { key: 'unit_of_measure', label: 'Satuan', type: 'text', example: '%' },
    { key: 'target_value', label: 'Target', type: 'text', example: '100' },
    { key: 'target_operator', label: 'Operator Target', type: 'enum', enumValues: TARGET_OPERATOR_OPTIONS as unknown as { value: string; label: string }[], example: 'gte' },
    { key: 'pic_name', label: 'PIC', type: 'text', example: '' },
    { key: 'decree_number', label: 'Nomor Penetapan', type: 'text', example: '' },
    { key: 'established_date', label: 'Tanggal Ditetapkan', type: 'date', example: '' },
  ],
  fetchExisting: async (supabase: SupabaseClient, mappedRows: MappedRow[]): Promise<DuplicateCheckResult> => {
    const units = Array.from(new Set(mappedRows.map((r) => r.unit_id).filter(Boolean)));
    if (units.length === 0) return { existingKeys: new Set(), existingIds: new Map() };
    const { data } = await supabase.from('uimu_proposals').select('id, unit_id, period_year, indicator_name').in('unit_id', units as string[]);
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
