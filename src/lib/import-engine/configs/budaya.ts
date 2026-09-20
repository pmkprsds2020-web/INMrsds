/**
 * ImportConfig — Modul Survei Budaya Keselamatan Pasien.
 * Target: public.budaya_period_results (hasil AGREGAT per periode/unit),
 * bukan jawaban mentah individual — kolom `source` tabel ini SUDAH
 * didesain untuk "imported" (lihat migration_budaya.sql bagian 4), sesuai
 * kebutuhan "Import Hasil Survey Lama" (data lama umumnya berupa rekap
 * skor per dimensi/unit dari periode sebelumnya, bukan kuesioner mentah).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { DuplicateCheckResult, ImportConfig, MappedRow } from '../types';
import { buildDedupeKey } from '../duplicates';

const CATEGORY_OPTIONS = [
  { value: 'kuat', label: 'Kuat' },
  { value: 'sedang', label: 'Sedang' },
  { value: 'lemah', label: 'Lemah' },
];

const UNIQUE_KEYS = ['survey_id', 'unit_id'];

export const budayaImportConfig: ImportConfig = {
  moduleKey: 'budaya',
  moduleLabel: 'Survei Budaya Keselamatan Pasien',
  table: 'budaya_period_results',
  rpcName: 'budaya_import_batch',
  templateFileName: 'Template_Survey_Budaya_Keselamatan.xlsx',
  templateVersion: '1.0',
  maxRows: 2000,
  uniqueKeys: UNIQUE_KEYS,
  defaultDuplicateAction: 'update',
  instructions: [
    '11. Fitur ini untuk mengimpor HASIL AGREGAT survei periode lama (rekap skor), bukan jawaban kuesioner mentah per responden.',
    '12. Nama Survei harus PERSIS sama dengan nama survei yang sudah dibuat di menu Survei Budaya > Buat Survei Baru — buat survei periode tersebut terlebih dahulu bila belum ada.',
    '13. Kosongkan Unit untuk mengisi ringkasan keseluruhan (semua unit) pada periode tersebut.',
    '14. Data yang sudah ada untuk kombinasi Survei + Unit yang sama akan DIPERBARUI (update), bukan digandakan.',
  ],
  columns: [
    {
      key: 'survey_id', label: 'Nama Survei', type: 'reference', required: true, example: 'Survei Budaya Keselamatan Semester II 2024',
      resolveReference: async (supabase: SupabaseClient, raw: string) => {
        const { data } = await supabase.from('budaya_surveys').select('id, name').ilike('name', raw.trim());
        if (!data || data.length === 0) return { ok: false, message: `Survei "${raw}" tidak ditemukan. Buat survei ini terlebih dahulu di menu Survei Budaya.` };
        if (data.length > 1) return { ok: false, message: `Nama survei "${raw}" cocok dengan lebih dari satu survei — gunakan nama yang lebih spesifik.` };
        return { ok: true, value: data[0].id };
      },
      reverseReference: async (supabase: SupabaseClient, storedValue: unknown) => {
        if (!storedValue) return '';
        const { data } = await supabase.from('budaya_surveys').select('name').eq('id', storedValue as string).maybeSingle();
        return data?.name ?? String(storedValue);
      },
    },
    {
      key: 'unit_id', label: 'Unit', type: 'reference', example: '',
      note: 'Kosongkan untuk ringkasan keseluruhan (semua unit).',
      resolveReference: async (supabase: SupabaseClient, raw: string) => {
        if (!raw.trim()) return { ok: true, value: '__overall__' };
        const { data } = await supabase.from('budaya_units').select('id, name').ilike('name', raw.trim());
        if (!data || data.length === 0) return { ok: false, message: `Unit "${raw}" tidak ditemukan di Master Unit Survei Budaya.` };
        return { ok: true, value: data[0].id };
      },
      transform: (value) => (value ? value : '__overall__'),
      reverseReference: async (supabase: SupabaseClient, storedValue: unknown) => {
        if (!storedValue || storedValue === '__overall__') return '';
        const { data } = await supabase.from('budaya_units').select('name').eq('id', storedValue as string).maybeSingle();
        return data?.name ?? '';
      },
    },
    { key: 'total_respondents', label: 'Total Responden', type: 'integer', required: true, min: 0, example: '42' },
    { key: 'overall_score', label: 'Overall Score (0-100)', type: 'percentage', required: true, example: '76.5' },
    { key: 'overall_category', label: 'Kategori', type: 'enum', enumValues: CATEGORY_OPTIONS, example: 'sedang' },
    { key: 'response_rate', label: 'Response Rate (%)', type: 'percentage', example: '84' },
  ],
  fetchExisting: async (supabase: SupabaseClient, mappedRows: MappedRow[]): Promise<DuplicateCheckResult> => {
    const surveyIds = Array.from(new Set(mappedRows.map((r) => r.survey_id).filter(Boolean)));
    if (surveyIds.length === 0) return { existingKeys: new Set(), existingIds: new Map() };
    const { data } = await supabase.from('budaya_period_results').select('id, survey_id, unit_id').in('survey_id', surveyIds as string[]);
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
