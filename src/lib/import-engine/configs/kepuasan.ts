/**
 * ImportConfig — Modul Survei Kepuasan Pasien (public.kepuasan_responses).
 * Kolom `source`/`is_valid` SUDAH didesain untuk fitur ini di
 * migration_kepuasan.sql (source in ('online','kiosk','import')).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { KEPUASAN_UNSUR_FIELDS, KEPUASAN_UNSUR_LABEL } from '@/types/kepuasan';
import type { DuplicateCheckResult, ImportConfig, ImportColumnDef, MappedRow } from '../types';

// response_code dibuat otomatis oleh sistem (kepuasan_next_response_code()) —
// tidak ada kolom sumber data alami untuk deteksi duplikasi antar baris lama,
// jadi setiap baris import SELALU dianggap data baru (bagian 30: baris yang
// gagal validasi tidak masuk, tapi tidak ada konsep "sudah ada" di sini).
const UNIQUE_KEYS: string[] = [];

const unsurColumns: ImportColumnDef[] = KEPUASAN_UNSUR_FIELDS.map((field) => ({
  key: field,
  label: KEPUASAN_UNSUR_LABEL[field],
  type: 'integer',
  required: true,
  min: 1,
  max: 4,
  example: '3',
  note: '1=Tidak Baik, 2=Kurang Baik, 3=Baik, 4=Sangat Baik',
}));

export const kepuasanImportConfig: ImportConfig = {
  moduleKey: 'kepuasan',
  moduleLabel: 'Survei Kepuasan Pasien',
  table: 'kepuasan_responses',
  rpcName: 'kepuasan_import_batch',
  templateFileName: 'Template_Survey_Kepuasan_Pasien.xlsx',
  templateVersion: '1.0',
  maxRows: 10000,
  uniqueKeys: UNIQUE_KEYS,
  defaultDuplicateAction: 'insert_new',
  instructions: [
    '11. Nama Survei harus PERSIS sama dengan survei yang sudah dibuat di menu Survei Kepuasan > Buat Survei Baru.',
    '12. Kolom 9 unsur (U1-U9) diisi skala 1-4 sesuai Permenpan RB 14/2017: 1=Tidak Baik, 2=Kurang Baik, 3=Baik, 4=Sangat Baik.',
    '13. Setiap baris import selalu ditambahkan sebagai response baru (kode response dibuat otomatis, tidak ada deteksi duplikasi antar baris).',
  ],
  columns: [
    {
      key: 'survey_id', label: 'Nama Survei', type: 'reference', required: true, example: 'Survei Kepuasan Rawat Jalan Januari 2026',
      resolveReference: async (supabase: SupabaseClient, raw: string) => {
        const { data } = await supabase.from('kepuasan_surveys').select('id, name').ilike('name', raw.trim());
        if (!data || data.length === 0) return { ok: false, message: `Survei "${raw}" tidak ditemukan. Buat survei ini terlebih dahulu.` };
        if (data.length > 1) return { ok: false, message: `Nama survei "${raw}" cocok dengan lebih dari satu survei — gunakan nama yang lebih spesifik.` };
        return { ok: true, value: data[0].id };
      },
      reverseReference: async (supabase: SupabaseClient, storedValue: unknown) => {
        if (!storedValue) return '';
        const { data } = await supabase.from('kepuasan_surveys').select('name').eq('id', storedValue as string).maybeSingle();
        return data?.name ?? String(storedValue);
      },
    },
    { key: 'unit_id', label: 'Unit', type: 'text', required: true, example: 'Rawat Jalan' },
    { key: 'respondent_name', label: 'Nama Responden', type: 'text', example: '' },
    ...unsurColumns,
    { key: 'kritik_saran', label: 'Kritik/Saran', type: 'text', example: '' },
  ],
  fetchExisting: async (_supabase: SupabaseClient, _mappedRows: MappedRow[]): Promise<DuplicateCheckResult> => ({
    existingKeys: new Set(),
    existingIds: new Map(),
  }),
};
