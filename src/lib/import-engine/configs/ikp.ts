/**
 * ImportConfig — Modul IKP (public.ikp_incidents).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  IKP_AGE_GROUPS, IKP_GENDERS, IKP_INCIDENT_TYPES, IKP_PATIENT_IMPACTS,
  IKP_PATIENT_SERVICE_TYPES, IKP_SERVICE_UNITS, IKP_SEVERITY_GRADES, IKP_STATUS_LABEL,
} from '@/types/ikp';
import type { DuplicateCheckResult, ImportConfig, MappedRow } from '../types';
import { buildDedupeKey } from '../duplicates';

const STATUS_OPTIONS = Object.entries(IKP_STATUS_LABEL).map(([value, label]) => ({ value, label }));
const REPORT_KIND_OPTIONS = [
  { value: 'insiden', label: 'Laporan Insiden (KNC/KTC/KTD/Sentinel)' },
  { value: 'kpc', label: 'Laporan KPC' },
];
const UNIQUE_KEYS = ['report_number'];

export const ikpImportConfig: ImportConfig = {
  moduleKey: 'ikp',
  moduleLabel: 'Insiden Keselamatan Pasien (IKP)',
  table: 'ikp_incidents',
  rpcName: 'ikp_import_batch',
  templateFileName: 'Template_IKP.xlsx',
  templateVersion: '1.0',
  maxRows: 10000,
  uniqueKeys: UNIQUE_KEYS,
  defaultDuplicateAction: 'skip',
  instructions: [
    '11. Nomor Laporan bersifat OPSIONAL — kosongkan untuk membuat nomor baru otomatis (format IKP-YYYY-000001).',
    '12. Bila diisi, Nomor Laporan dipakai sebagai kunci deteksi duplikasi terhadap data yang sudah ada.',
    '13. Jangan gunakan template modul lain (Indikator Mutu) untuk import IKP — struktur kolom berbeda.',
  ],
  columns: [
    { key: 'report_number', label: 'Nomor Laporan', type: 'text', example: '', note: 'Kosongkan untuk auto-generate.' },
    { key: 'report_kind', label: 'Jenis Laporan', type: 'enum', required: true, enumValues: REPORT_KIND_OPTIONS, example: 'insiden' },
    { key: 'status', label: 'Status', type: 'enum', enumValues: STATUS_OPTIONS, example: 'dilaporkan' },
    { key: 'report_date', label: 'Tanggal Laporan', type: 'date', required: true, example: '2026-01-15' },
    { key: 'reporter_name', label: 'Nama Pelapor', type: 'text', example: 'Ns. Ani' },
    { key: 'reporter_unit', label: 'Unit Pelapor', type: 'text', example: 'IGD' },
    { key: 'reporter_profession', label: 'Profesi Pelapor', type: 'text', example: 'Perawat' },
    { key: 'is_anonymous', label: 'Laporan Anonim', type: 'boolean', example: 'Tidak' },
    { key: 'patient_age_group', label: 'Kelompok Usia Pasien', type: 'enum', enumValues: IKP_AGE_GROUPS.map((a) => ({ value: a.id, label: a.label })), example: '' },
    { key: 'patient_gender', label: 'Jenis Kelamin Pasien', type: 'enum', enumValues: IKP_GENDERS.map((g) => ({ value: g.id, label: g.label })), example: '' },
    { key: 'incident_date', label: 'Tanggal Kejadian', type: 'date', example: '2026-01-14' },
    { key: 'incident_summary', label: 'Ringkasan Kejadian', type: 'text', example: '' },
    { key: 'chronology', label: 'Kronologi', type: 'text', example: '' },
    { key: 'incident_type', label: 'Jenis Insiden', type: 'enum', enumValues: IKP_INCIDENT_TYPES.map((t) => ({ value: t.id, label: t.label })), example: 'knc' },
    { key: 'incident_location', label: 'Lokasi Kejadian', type: 'text', example: '' },
    { key: 'patient_service_unit', label: 'Unit Pelayanan Pasien', type: 'enum', enumValues: IKP_SERVICE_UNITS.map((u) => ({ value: u, label: u })), example: 'IGD' },
    { key: 'causing_unit', label: 'Unit Penyebab', type: 'text', example: '' },
    { key: 'patient_impact', label: 'Dampak Pada Pasien', type: 'enum', enumValues: IKP_PATIENT_IMPACTS.map((p) => ({ value: p.id, label: p.label })), example: '' },
    { key: 'immediate_action', label: 'Tindakan Segera', type: 'text', example: '' },
    { key: 'severity_grade', label: 'Grading Risiko', type: 'enum', enumValues: IKP_SEVERITY_GRADES.map((s) => ({ value: s.id, label: s.label })), example: '' },
  ],
  fetchExisting: async (supabase: SupabaseClient, mappedRows: MappedRow[]): Promise<DuplicateCheckResult> => {
    const numbers = Array.from(new Set(mappedRows.map((r) => r.report_number).filter(Boolean)));
    if (numbers.length === 0) return { existingKeys: new Set(), existingIds: new Map() };
    const { data } = await supabase.from('ikp_incidents').select('id, report_number').in('report_number', numbers as string[]);
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
