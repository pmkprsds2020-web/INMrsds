/**
 * ImportConfig — Modul Manajemen Risiko (public.risks + risk_assessments).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { RISK_CATEGORIES, RISK_STATUS_LABEL, RISK_UNITS, RISK_YEARS } from '@/types/risk';
import type { DuplicateCheckResult, ImportConfig, MappedRow } from '../types';
import { buildDedupeKey } from '../duplicates';

const STATUS_OPTIONS = Object.entries(RISK_STATUS_LABEL).map(([value, label]) => ({ value, label }));
const CATEGORY_OPTIONS = RISK_CATEGORIES.map((c) => ({ value: c.id, label: c.label }));
const UNIT_OPTIONS = RISK_UNITS.map((u) => ({ value: u, label: u }));

const UNIQUE_KEYS = ['unit_lokasi', 'risiko', 'risk_year'];

export const riskImportConfig: ImportConfig = {
  moduleKey: 'risk',
  moduleLabel: 'Manajemen Risiko',
  table: 'risks',
  rpcName: 'risk_import_batch',
  templateFileName: 'Template_Manajemen_Risiko.xlsx',
  templateVersion: '1.0',
  maxRows: 10000,
  uniqueKeys: UNIQUE_KEYS,
  defaultDuplicateAction: 'skip',
  instructions: [
    '11. Kunci deteksi duplikasi untuk modul ini: Unit/Lokasi + Risiko + Tahun Risk Register.',
    '12. Kode Risiko (RSK-YYYY-000001) dibuat OTOMATIS oleh sistem — tidak perlu diisi di Excel.',
    '13. Kolom Probabilitas/Dampak/Controllability opsional — bila diisi ketiganya, skor risiko dihitung otomatis oleh sistem.',
  ],
  columns: [
    { key: 'risk_year', label: 'Tahun', type: 'enum', required: true, enumValues: RISK_YEARS.map((y) => ({ value: String(y), label: String(y) })), example: '2026' },
    { key: 'unit_lokasi', label: 'Unit/Lokasi', type: 'enum', required: true, enumValues: UNIT_OPTIONS, example: 'IGD' },
    { key: 'category', label: 'Kategori Risiko', type: 'enum', required: true, enumValues: CATEGORY_OPTIONS, example: 'igd' },
    { key: 'subcategory', label: 'Subkategori', type: 'text', example: '' },
    { key: 'risiko', label: 'Risiko', type: 'text', required: true, example: 'Gagal melakukan pemasangan infus' },
    { key: 'sebab_insiden', label: 'Sebab Insiden/Kejadian', type: 'text', required: true, example: 'Kurangnya keterampilan petugas' },
    { key: 'efek_dampak', label: 'Efek/Dampak', type: 'text', required: true, example: 'Komplain pasien' },
    { key: 'proses_terdampak', label: 'Proses Terdampak', type: 'text', example: '' },
    { key: 'dokumen_spo_terkait', label: 'Dokumen/SPO Terkait', type: 'text', example: '' },
    { key: 'kontrol_existing', label: 'Kontrol Existing', type: 'text', example: '' },
    { key: 'bukti_pendukung', label: 'Bukti Pendukung', type: 'text', example: '' },
    { key: 'status', label: 'Status', type: 'enum', enumValues: STATUS_OPTIONS, example: 'identifikasi', note: 'Kosongkan untuk default "Identifikasi".' },
    { key: 'risk_owner_name', label: 'Risk Owner/PIC', type: 'text', example: 'Kepala Keperawatan' },
    { key: 'probabilitas', label: 'Probabilitas (1-5)', type: 'integer', min: 1, max: 5, example: '3' },
    { key: 'dampak', label: 'Dampak (1-5)', type: 'integer', min: 1, max: 5, example: '3' },
    { key: 'controllability', label: 'Controllability (1-5)', type: 'integer', min: 1, max: 5, example: '2' },
  ],
  fetchExisting: async (supabase: SupabaseClient, mappedRows: MappedRow[]): Promise<DuplicateCheckResult> => {
    const years = Array.from(new Set(mappedRows.map((r) => r.risk_year).filter(Boolean)));
    if (years.length === 0) return { existingKeys: new Set(), existingIds: new Map() };
    const { data } = await supabase.from('risks').select('id, unit_lokasi, risiko, risk_year').in('risk_year', years as number[]);
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
