/**
 * ImportConfig — Modul Indikator Mutu Nasional (INM), 11 indikator legacy
 * (tangan, visite, identitas, apd, jatuh, sc, wtrj, op, lab, fornas, cp)
 * yang hidup di satu tabel public.indicator_entries (kolom `indicator_type`
 * + `data` jsonb, karena field berbeda-beda per indikator).
 *
 * Berbeda dari 6 modul lain: satu tabel dipakai oleh 11 "bentuk form" yang
 * berbeda, jadi Import Engine (yang butuh satu daftar kolom tetap per
 * ImportConfig) dibuatkan SATU config PER indikator lewat
 * `buildInmImportConfig(type, activeUnit)` — dipanggil dari IndicatorPanel
 * yang memang sudah menampilkan satu indikator per tab. Template & tombol
 * Import/Export karena itu juga per-indikator (Template_INM_<kode>.xlsx),
 * bukan satu file gabungan — supaya validasi tipe per kolom tetap presisi
 * (angka vs Ya/Tidak vs jam vs teks) alih-alih satu sheet raksasa dengan
 * banyak kolom kosong tergantung baris.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { DuplicateCheckResult, ImportColumnDef, ImportConfig, ImportEnumOption, MappedRow } from '../types';
import { buildDedupeKey } from '../duplicates';
import { type IndicatorType, type IndicatorEntry, INDICATORS, UNIT_MAP, IDENTITAS_SERVICE_OPTIONS } from '@/types';
import { timeDiffMinutes } from '@/lib/calculations';

const YA_TIDAK: ImportEnumOption[] = [
  { value: 'Ya', label: 'Ya' },
  { value: 'Tidak', label: 'Tidak' },
];
const YA_TIDAK_LOWER: ImportEnumOption[] = [
  { value: 'ya', label: 'Ya' },
  { value: 'tidak', label: 'Tidak' },
];

/** Unit yang mengaktifkan indikator ini (UNIT_MAP.inds), sekaligus mengunci akses sesuai ACCESS_RULES existing. */
function allowedUnitsFor(type: IndicatorType): ImportEnumOption[] {
  return Object.entries(UNIT_MAP)
    .filter(([key, meta]) => key !== 'all' && meta.inds.includes(type))
    .map(([key, meta]) => ({ value: key, label: meta.label }));
}

/** Kunci deteksi duplikasi per indikator — tidak ada id alami di Excel, jadi dipilih kombinasi field yang paling menjelaskan satu observasi. */
const UNIQUE_KEYS: Record<IndicatorType, string[]> = {
  tangan: ['entry_date', 'unit_id', 'staff', 'room'],
  visite: ['entry_date', 'unit_id', 'rm'],
  identitas: ['entry_date', 'unit_id', 'rm', 'service'],
  apd: ['entry_date', 'unit_id', 'room', 'staff'],
  jatuh: ['entry_date', 'unit_id', 'rm'],
  sc: ['entry_date', 'unit_id', 'rm'],
  wtrj: ['entry_date', 'unit_id', 'rm'],
  op: ['entry_date', 'unit_id', 'rm'],
  lab: ['entry_date', 'unit_id', 'rm', 'exam'],
  fornas: ['entry_date', 'unit_id'],
  cp: ['entry_date', 'unit_id', 'rm'],
};

/** Kolom spesifik per indikator (di luar unit_id/entry_date yang sama untuk semua). */
function specificColumns(type: IndicatorType): ImportColumnDef[] {
  switch (type) {
    case 'tangan':
      return [
        { key: 'staff', label: 'Petugas', type: 'text', required: true, example: 'Suster Ani' },
        { key: 'observer', label: 'Observer', type: 'text', required: true, example: 'dr. Budi' },
        { key: 'room', label: 'Ruangan', type: 'text', required: true, example: 'Kamar 3' },
        { key: 'm1', label: 'Momen 1', type: 'boolean', required: true, example: 'Ya', note: 'Sebelum kontak pasien' },
        { key: 'm2', label: 'Momen 2', type: 'boolean', required: true, example: 'Ya', note: 'Sebelum tindakan aseptik' },
        { key: 'm3', label: 'Momen 3', type: 'boolean', required: true, example: 'Ya', note: 'Setelah terkena cairan tubuh' },
        { key: 'm4', label: 'Momen 4', type: 'boolean', required: true, example: 'Ya', note: 'Setelah kontak pasien' },
        { key: 'm5', label: 'Momen 5', type: 'boolean', required: true, example: 'Ya', note: 'Setelah kontak lingkungan pasien' },
        { key: 'method', label: 'Metode', type: 'text', required: false, example: 'Handrub', transform: (v) => v ?? 'Direct' },
        { key: 'patuh', label: 'Patuh', type: 'boolean', required: false, note: 'Kosongkan jika belum dinilai — sistem akan menampilkan "—".' },
      ];
    case 'visite':
      return [
        { key: 'rm', label: 'No RM', type: 'text', required: true, example: '00123456' },
        { key: 'doctor', label: 'Dokter', type: 'text', required: true, example: 'dr. Citra' },
        { key: 'time', label: 'Waktu Visite', type: 'time', required: true, example: '09:30' },
      ];
    case 'identitas':
      return [
        { key: 'staff', label: 'Petugas', type: 'text', required: true, example: 'Suster Dewi' },
        { key: 'observer', label: 'Observer', type: 'text', required: true, example: 'dr. Eka' },
        { key: 'room', label: 'Ruangan', type: 'text', required: true, example: 'IGD' },
        { key: 'name', label: 'Nama Pasien', type: 'text', required: true, example: 'Fajar Nugroho' },
        { key: 'rm', label: 'No RM', type: 'text', required: true, example: '00123456' },
        { key: 'service', label: 'Pelayanan', type: 'enum', required: true, enumValues: IDENTITAS_SERVICE_OPTIONS.map((v) => ({ value: v, label: v })) },
        { key: 'nama', label: 'Cek Nama', type: 'boolean', required: true, example: 'Ya' },
        { key: 'tgl', label: 'Cek Tgl Lahir', type: 'boolean', required: true, example: 'Ya' },
      ];
    case 'apd':
      return [
        { key: 'room', label: 'Ruangan', type: 'text', required: true, example: 'ICU' },
        { key: 'staff', label: 'Petugas', type: 'text', required: true, example: 'Gilang Ramadhan' },
        { key: 'comp', label: 'Kepatuhan APD', type: 'enum', required: true, enumValues: YA_TIDAK_LOWER },
      ];
    case 'jatuh':
      return [
        { key: 'rm', label: 'No RM', type: 'text', required: true, example: '00123456' },
        { key: 'awal', label: 'Assessment Awal', type: 'boolean', required: true, example: 'Ya' },
        { key: 're', label: 'Reassessment', type: 'boolean', required: true, example: 'Ya' },
        { key: 'inv', label: 'Intervensi', type: 'boolean', required: true, example: 'Ya' },
        { key: 'cedera', label: 'Pencegahan Cedera', type: 'boolean', required: true, example: 'Ya' },
      ];
    case 'sc':
      return [
        { key: 'rm', label: 'No RM', type: 'text', required: true, example: '00123456' },
        { key: 'diag', label: 'Diagnosis', type: 'text', required: true, example: 'Gawat Janin' },
        { key: 'ok', label: '≤30 Menit Emergensi', type: 'boolean', required: true, example: 'Ya' },
      ];
    case 'wtrj':
      return [
        { key: 'rm', label: 'No RM', type: 'text', required: true, example: '00123456' },
        { key: 'doc', label: 'Dokter/Poli', type: 'text', required: true, example: 'Poli Umum' },
        { key: 't1', label: 'Jam Pendaftaran', type: 'time', required: true, example: '08:00' },
        { key: 't2', label: 'Jam Dilayani', type: 'time', required: true, example: '08:45' },
        {
          key: 'st_checked', label: 'Waktu Tunggu >60 Menit', type: 'boolean', required: false,
          note: 'Kosongkan untuk dihitung otomatis dari selisih Jam Pendaftaran & Jam Dilayani.',
          transform: (v, row) => (v !== null ? v : timeDiffMinutes(String(row.t1 ?? ''), String(row.t2 ?? '')) > 60),
        },
      ];
    case 'op':
      return [
        { key: 'rm', label: 'No RM/Nama', type: 'text', required: true, example: '00123456' },
        { key: 't1', label: 'Jadwal', type: 'time', required: true, example: '08:00' },
        { key: 't2', label: 'Aktual', type: 'time', required: true, example: '09:15' },
        {
          key: 'tertunda', label: 'Tertunda', type: 'boolean', required: false,
          note: 'Kosongkan untuk dihitung otomatis (>60 menit dari jadwal = Ya).',
          transform: (v, row) => (v !== null ? v : timeDiffMinutes(String(row.t1 ?? ''), String(row.t2 ?? '')) > 60),
        },
        { key: 'r', label: 'Alasan', type: 'text', required: false, example: '' },
      ];
    case 'lab':
      return [
        { key: 'rm', label: 'No RM', type: 'text', required: true, example: '00123456' },
        { key: 'exam', label: 'Pemeriksaan', type: 'text', required: true, example: 'Troponin' },
        { key: 't1', label: 'Jam Keluar Hasil', type: 'time', required: true, example: '10:00' },
        { key: 't2', label: 'Jam Diterima', type: 'time', required: true, example: '10:20' },
        { key: 'num', label: '≤30 Menit', type: 'boolean', required: true, example: 'Ya' },
      ];
    case 'fornas':
      return [
        { key: 'num', label: 'R/ Sesuai Fornas', type: 'integer', required: true, min: 0, example: '18' },
        { key: 'non', label: 'R/ Tidak Sesuai Fornas', type: 'integer', required: true, min: 0, example: '2' },
        { key: 'note', label: 'Keterangan', type: 'text', required: false, example: '' },
      ];
    case 'cp':
      return [
        { key: 'name', label: 'Nama Pasien', type: 'text', required: true, example: 'Gita Permata' },
        { key: 'rm', label: 'No RM', type: 'text', required: true, example: '00123456' },
        { key: 'diag', label: 'Diagnosis', type: 'text', required: true, example: 'Pneumonia' },
        { key: 'vTerapi', label: 'Variansi Terapi', type: 'integer', required: true, min: 0, example: '0' },
        { key: 'vLab', label: 'Variansi Lab', type: 'integer', required: true, min: 0, example: '0' },
        { key: 'vRad', label: 'Variansi Radiologi', type: 'integer', required: true, min: 0, example: '0' },
        { key: 'vLain', label: 'Variansi Lain', type: 'integer', required: true, min: 0, example: '0' },
        { key: 'vLainKet', label: 'Keterangan Variansi Lain', type: 'text', required: false, example: '' },
        { key: 'perawat', label: 'PPA Perawat', type: 'enum', required: true, enumValues: YA_TIDAK },
        { key: 'farmasi', label: 'PPA Farmasi', type: 'enum', required: true, enumValues: YA_TIDAK },
        { key: 'gizi', label: 'PPA Gizi', type: 'enum', required: true, enumValues: YA_TIDAK },
        { key: 'los', label: 'Length of Stay (hari)', type: 'integer', required: true, min: 0, example: '4' },
        { key: 'ket', label: 'Keterangan', type: 'text', required: false, example: '' },
      ];
  }
}

export function buildInmImportConfig(type: IndicatorType, activeUnit?: string): ImportConfig {
  const meta = INDICATORS.find((i) => i.id === type)!;
  const unitOptions = allowedUnitsFor(type);
  const uniqueKeys = UNIQUE_KEYS[type];

  const columns: ImportColumnDef[] = [
    {
      key: 'unit_id', label: 'Unit', type: 'enum', required: true, enumValues: unitOptions,
      example: unitOptions.find((u) => u.value === activeUnit)?.value ?? unitOptions[0]?.value,
    },
    { key: 'entry_date', label: 'Tanggal', type: 'date', required: true, example: '2026-01-15' },
    ...specificColumns(type),
  ];

  return {
    moduleKey: `inm_${type}`,
    moduleLabel: `INM — ${meta.label}`,
    table: 'indicator_entries',
    rpcName: `inm_import_batch_${type}`,
    templateFileName: `Template_INM_${type.toUpperCase()}.xlsx`,
    templateVersion: '1.0',
    maxRows: 5000,
    uniqueKeys,
    defaultDuplicateAction: 'skip',
    instructions: [
      `11. Kolom Unit hanya menerima unit yang mengaktifkan indikator ${meta.label} (lihat sheet REFERENSI).`,
      '12. Kunci deteksi duplikasi: Tanggal + Unit + kolom identitas record (No RM/Petugas/Ruangan sesuai indikator). Data yang sama akan DILEWATI kecuali Anda pilih "Perbarui" saat preview.',
      '13. Kolom Ya/Tidak hanya menerima: Ya, Tidak, TRUE, FALSE.',
    ],
    columns,
    fetchExisting: async (supabase: SupabaseClient, mappedRows: MappedRow[]): Promise<DuplicateCheckResult> => {
      const unitIds = Array.from(new Set(mappedRows.map((r) => r.unit_id).filter(Boolean)));
      if (unitIds.length === 0) return { existingKeys: new Set(), existingIds: new Map() };
      const { data } = await supabase
        .from('indicator_entries')
        .select('id, unit_id, entry_date, data')
        .eq('indicator_type', type)
        .in('unit_id', unitIds as string[]);
      const existingKeys = new Set<string>();
      const existingIds = new Map<string, string>();
      for (const row of (data ?? []) as { id: string; unit_id: string; entry_date: string; data: Record<string, unknown> }[]) {
        const flat: MappedRow = { unit_id: row.unit_id, entry_date: row.entry_date, ...row.data };
        const key = buildDedupeKey(flat, uniqueKeys);
        existingKeys.add(key);
        existingIds.set(key, row.id);
      }
      return { existingKeys, existingIds };
    },
  };
}

/** Baris tabel INM (IndicatorEntry) -> baris export siap-import-ulang (key kolom, bukan label). */
export function inmEntryToExportRow(entry: IndicatorEntry): Record<string, unknown> {
  const { unitId, date, indicatorType: _it, id: _id, createdBy: _cb, createdAt: _ca, updatedAt: _ua, ...rest } =
    entry as unknown as Record<string, unknown>;
  return { unit_id: unitId, entry_date: date, ...rest };
}
