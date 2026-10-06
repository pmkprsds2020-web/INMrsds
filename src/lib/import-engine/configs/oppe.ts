/**
 * ImportConfig — Modul OPPE (realisasi indikator per dokter per periode).
 *
 * Satu baris Excel = satu indikator untuk satu dokter pada satu periode.
 * RPC public.oppe_import_batch (migration_oppe.sql) membuat evaluasi bila
 * belum ada, meng-upsert item dari snapshot master indikator, lalu menandai
 * evaluasi needs_recalc. Skor dihitung ulang di aplikasi memakai engine yang
 * sama dengan form evaluasi (src/lib/oppeScoring.ts) — lihat OppeImportPanel.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { DuplicateCheckResult, ImportConfig, ImportRowError, MappedRow } from '../types';
import { buildDedupeKey } from '../duplicates';
import { normalizePeriodValue } from '../validators';
import { parseNumeric } from '@/lib/oppeScoring';

const UNIQUE_KEYS = ['doctor_id', 'year', 'period_type', 'indicator_id'];
const CATEGORICAL = new Set(['boolean', 'grade', 'pass', 'category']);

type IndicatorInfo = { id: string; code: string; ksm_id: string | null; data_type: string; options: string[]; target_value: number | null; category_code: string };
type DoctorInfo = { id: string; name: string; ksm_id: string | null; ksm_name: string | null };

const indicatorCache = new Map<string, IndicatorInfo>();
const doctorCache = new Map<string, DoctorInfo>();

const PERIOD_MAP: Record<string, string> = { 'Semester I': 'semester_1', 'Semester II': 'semester_2', Tahunan: 'tahunan' };

export function buildOppeImportConfig(reference?: { indicators?: { code: string; name: string }[]; doctors?: { name: string }[]; ksm?: { name: string }[] }): ImportConfig {
  indicatorCache.clear();
  doctorCache.clear();
  return {
    moduleKey: 'oppe',
    moduleLabel: 'OPPE — Realisasi Indikator Evaluasi Praktik Profesional',
    table: 'oppe_evaluation_items',
    rpcName: 'oppe_import_batch',
    templateFileName: 'Template_OPPE.xlsx',
    templateVersion: '1.0',
    maxRows: 5000,
    uniqueKeys: UNIQUE_KEYS,
    defaultDuplicateAction: 'update',
    instructions: [
      '11. Satu baris = satu indikator untuk satu dokter pada satu periode. Evaluasi OPPE dibuat otomatis bila belum ada (status "Dalam Proses").',
      '12. Nama Dokter harus sama persis dengan menu OPPE > Data Dokter. Kode Indikator harus ada di Master Indikator OPPE (lihat sheet REFERENSI).',
      '13. Periode diisi: Semester I, Semester II, atau Tahunan. Kolom Semester (1/2) opsional — bila diisi harus konsisten dengan Periode.',
      '14. Realisasi persen diisi angka 0–100 tanpa simbol %. Jumlah kasus/SKP/kali diisi angka bulat. Indikator kategori diisi sesuai pilihan (mis. Baik/Cukup/Kurang, Lulus/Belum, Aktif/Mati, Ya/Tidak).',
      '15. Kolom Target hanya dipakai untuk indikator yang targetnya ditetapkan per evaluasi (mis. SKP "Sesuai target", NDR "Sesuai standar RS"). Kolom Profesi, Kategori, Parameter, Satuan, dan Trigger bersifat informasi.',
      '16. Kunci duplikasi: Nama Dokter + Tahun + Periode + Kode Indikator. Baris duplikat default "Perbarui" (realisasi lama diganti).',
      '17. Evaluasi yang sudah FINAL tidak diubah oleh import. Skor, status, trigger, dan rekomendasi dihitung otomatis setelah import.',
    ],
    referenceSheets: reference ? {
      ...(reference.indicators ? { 'KODE INDIKATOR — PARAMETER': reference.indicators.map((i) => ({ value: i.code, label: `${i.code} — ${i.name}` })) } : {}),
      ...(reference.doctors ? { 'NAMA DOKTER': reference.doctors.map((d) => ({ value: d.name, label: d.name })) } : {}),
      ...(reference.ksm ? { KSM: reference.ksm.map((k) => ({ value: k.name, label: k.name })) } : {}),
    } : undefined,
    columns: [
      {
        key: 'doctor_id', label: 'Nama Dokter', type: 'reference', required: true, example: 'dr. Andi', aliases: ['Dokter', 'Nama'],
        resolveReference: async (supabase: SupabaseClient, raw: string) => {
          const name = raw.trim();
          const { data } = await supabase.from('oppe_doctors').select('id, name, ksm_id, oppe_ksm(name)').ilike('name', name).limit(2);
          if (!data || data.length === 0) return { ok: false, message: `Dokter "${name}" tidak ditemukan. Solusi: tambahkan di menu Data Dokter atau samakan penulisan nama.` };
          if (data.length > 1) return { ok: false, message: `Nama dokter "${name}" ganda di master. Solusi: bedakan nama dokter di menu Data Dokter.` };
          const d = data[0] as unknown as { id: string; name: string; ksm_id: string | null; oppe_ksm?: { name: string } | null };
          doctorCache.set(d.id, { id: d.id, name: d.name, ksm_id: d.ksm_id, ksm_name: d.oppe_ksm?.name ?? null });
          return { ok: true, value: d.id };
        },
        reverseReference: async (supabase: SupabaseClient, stored: unknown) => {
          if (!stored) return '';
          const { data } = await supabase.from('oppe_doctors').select('name').eq('id', stored as string).maybeSingle();
          return data?.name ?? '';
        },
      },
      { key: 'profession', label: 'Profesi', type: 'text', example: 'Dokter Spesialis' },
      { key: 'ksm_name', label: 'KSM', type: 'text', example: 'KSM Anestesiologi & Terapi Intensif' },
      { key: 'period_type', label: 'Periode', type: 'text', required: true, example: 'Semester I', note: 'Semester I / Semester II / Tahunan' },
      { key: 'year', label: 'Tahun', type: 'integer', required: true, example: '2026', min: 2000, max: 2100 },
      { key: 'semester', label: 'Semester', type: 'text', example: '1' },
      {
        key: 'indicator_id', label: 'Kode Indikator', type: 'reference', required: true, example: 'ANS-A1', aliases: ['Kode'],
        resolveReference: async (supabase: SupabaseClient, raw: string) => {
          const code = raw.trim().toUpperCase();
          const { data } = await supabase.from('oppe_indicators').select('id, code, ksm_id, data_type, options, target_value, is_active, oppe_indicator_categories(code)').eq('code', code).maybeSingle();
          if (!data) return { ok: false, message: `Kode indikator "${code}" tidak ada di Master Indikator OPPE. Solusi: lihat sheet REFERENSI.` };
          const d = data as unknown as { id: string; code: string; ksm_id: string | null; data_type: string; options: string[] | null; target_value: number | null; is_active: boolean; oppe_indicator_categories?: { code: string } | null };
          if (!d.is_active) return { ok: false, message: `Indikator "${code}" nonaktif. Solusi: aktifkan di Master Indikator atau gunakan kode lain.` };
          indicatorCache.set(d.id, { id: d.id, code: d.code, ksm_id: d.ksm_id, data_type: d.data_type, options: d.options ?? [], target_value: d.target_value, category_code: d.oppe_indicator_categories?.code ?? '' });
          return { ok: true, value: d.id };
        },
        reverseReference: async (supabase: SupabaseClient, stored: unknown) => {
          if (!stored) return '';
          const { data } = await supabase.from('oppe_indicators').select('code').eq('id', stored as string).maybeSingle();
          return data?.code ?? '';
        },
      },
      { key: 'category', label: 'Kategori', type: 'text', example: 'A' },
      { key: 'parameter', label: 'Parameter', type: 'text', example: 'Kepatuhan hadir tepat waktu di Kamar Operasi' },
      { key: 'target_raw', label: 'Target', type: 'text', example: '≥ 95%' },
      { key: 'realization_text', label: 'Realisasi', type: 'text', required: true, example: '97' },
      { key: 'unit', label: 'Satuan', type: 'text', example: '%' },
      { key: 'trigger', label: 'Trigger', type: 'text', example: '< 90%' },
      { key: 'source_data', label: 'Sumber Data', type: 'text', example: 'Logbook OK / SIMRS' },
      { key: 'notes', label: 'Catatan', type: 'text', example: '' },
    ],
    beforeImport: async (_supabase: SupabaseClient, mapped: MappedRow) => {
      const errors: ImportRowError[] = [];
      const out: MappedRow = { ...mapped };

      // Periode
      const p = normalizePeriodValue(String(mapped.period_type ?? ''));
      const periodType = PERIOD_MAP[p];
      if (!periodType) errors.push({ column: 'Periode', message: `Periode "${mapped.period_type}" tidak dikenali. Solusi: isi Semester I, Semester II, atau Tahunan.` });
      out.period_type = periodType ?? null;
      if (mapped.semester !== null && mapped.semester !== undefined && String(mapped.semester).trim() !== '') {
        const s = String(mapped.semester).trim().toUpperCase().replace('SEMESTER', '').trim();
        const sem = s === '1' || s === 'I' ? 1 : s === '2' || s === 'II' ? 2 : null;
        if (sem === null) errors.push({ column: 'Semester', message: 'Semester harus 1 atau 2 (atau dikosongkan).' });
        else if ((periodType === 'semester_1' && sem !== 1) || (periodType === 'semester_2' && sem !== 2) || periodType === 'tahunan') {
          errors.push({ column: 'Semester', message: `Semester ${sem} tidak konsisten dengan Periode "${p}". Solusi: samakan atau kosongkan kolom Semester.` });
        }
      }

      const ind = indicatorCache.get(String(mapped.indicator_id));
      const doc = doctorCache.get(String(mapped.doctor_id));

      // KSM: indikator spesifik KSM harus cocok dengan KSM dokter; kolom KSM (bila diisi) harus cocok dengan master
      if (ind && doc && ind.ksm_id && doc.ksm_id && ind.ksm_id !== doc.ksm_id) {
        errors.push({ column: 'Kode Indikator', message: `Indikator ${ind.code} khusus KSM lain, bukan KSM dokter ${doc.name}. Solusi: gunakan indikator template KSM dokter.` });
      }
      if (doc && mapped.ksm_name && String(mapped.ksm_name).trim() !== '' && doc.ksm_name && String(mapped.ksm_name).trim().toLowerCase() !== doc.ksm_name.toLowerCase()) {
        errors.push({ column: 'KSM', message: `KSM "${mapped.ksm_name}" berbeda dengan KSM dokter di master ("${doc.ksm_name}"). Solusi: perbaiki kolom KSM atau data dokter.` });
      }
      if (ind && mapped.category && String(mapped.category).trim() !== '' && ind.category_code && String(mapped.category).trim().toUpperCase() !== ind.category_code.toUpperCase()) {
        errors.push({ column: 'Kategori', message: `Kategori "${mapped.category}" tidak sesuai indikator ${ind.code} (kategori ${ind.category_code}).` });
      }

      // Realisasi sesuai tipe data
      const raw = String(mapped.realization_text ?? '').trim();
      if (ind) {
        if (CATEGORICAL.has(ind.data_type)) {
          const match = ind.options.find((o) => o.toLowerCase() === raw.toLowerCase());
          if (!match) errors.push({ column: 'Realisasi', message: `Realisasi "${raw}" tidak valid. Pilihan: ${ind.options.join(' / ')}.` });
          out.realization_text = match ?? raw;
          out.realization_number = null;
        } else {
          const n = parseNumeric(raw, ind.data_type);
          if (n === null) errors.push({ column: 'Realisasi', message: 'Realisasi harus berupa angka. Solusi: isi angka saja tanpa teks (persen tanpa simbol %).' });
          else if (n < 0) errors.push({ column: 'Realisasi', message: 'Realisasi tidak boleh negatif.' });
          else if (ind.data_type === 'percent' && n > 100) errors.push({ column: 'Realisasi', message: 'Realisasi persen harus 0–100.' });
          else if (ind.data_type === 'count' && !Number.isInteger(n)) errors.push({ column: 'Realisasi', message: 'Jumlah kasus/kali harus bilangan bulat.' });
          out.realization_text = n === null ? raw : String(n);
          out.realization_number = n;
        }
        // Target per evaluasi (hanya untuk indikator yang target master-nya kosong)
        const t = String(mapped.target_raw ?? '').trim();
        if (t && ind.target_value === null && !CATEGORICAL.has(ind.data_type)) {
          // teks non-angka (mis. "Sesuai target") diabaikan — target bisa diisi kemudian di form evaluasi
          const tv = /\d/.test(t) ? parseNumeric(t, ind.data_type) : null;
          if (tv !== null) out.target_value = tv;
        }
      }
      delete out.target_raw;
      return { mapped: out, errors };
    },
    fetchExisting: async (supabase: SupabaseClient, mappedRows: MappedRow[]): Promise<DuplicateCheckResult> => {
      const doctorIds = Array.from(new Set(mappedRows.map((r) => r.doctor_id).filter(Boolean))) as string[];
      const existingKeys = new Set<string>();
      const existingIds = new Map<string, string>();
      if (doctorIds.length === 0) return { existingKeys, existingIds };
      const { data } = await supabase
        .from('oppe_evaluations')
        .select('id, doctor_id, year, period_type, oppe_evaluation_items(id, indicator_id)')
        .in('doctor_id', doctorIds);
      for (const ev of (data ?? []) as unknown as { doctor_id: string; year: number; period_type: string; oppe_evaluation_items: { id: string; indicator_id: string | null }[] }[]) {
        for (const it of ev.oppe_evaluation_items ?? []) {
          if (!it.indicator_id) continue;
          const key = buildDedupeKey({ doctor_id: ev.doctor_id, year: ev.year, period_type: ev.period_type, indicator_id: it.indicator_id }, UNIQUE_KEYS);
          existingKeys.add(key);
          existingIds.set(key, it.id);
        }
      }
      return { existingKeys, existingIds };
    },
  };
}

export const oppeImportConfig = buildOppeImportConfig();
