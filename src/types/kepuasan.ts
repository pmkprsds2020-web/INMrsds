// ============================================================================
// Modul Survey Kepuasan Pasien
//
// Instrumen: 9 unsur pelayanan Permenpan RB No. 14/2017 (SKM/IKM), skala
// 1 (Tidak baik) - 4 (Sangat baik), identik dengan "INM 2025 MONEV FORM
// BARU.xlsx" yang dilampirkan. Urutan/label unsur bersifat TETAP (bukan
// data dinamis seperti bank pertanyaan Budaya Keselamatan), karena
// instrumen ini adalah standar nasional baku — perubahan struktural butuh
// instrument_version baru (kepuasan_surveys.instrument_version), bukan
// diedit bebas lewat UI.
//
// Reuse pola dari src/types/budaya.ts (camelCase di boundary aplikasi,
// snake_case di DB) dan diintegrasikan ke src/types/customIndicators.ts
// lewat kepuasan_surveys.linked_indicator_id (bagian 26-28 dokumen acuan).
// ============================================================================

/* ── Instrumen (baku, 9 unsur) ───────────────────────────────────────────── */

export const KEPUASAN_UNSUR_FIELDS = [
  'u1_persyaratan',
  'u2_prosedur',
  'u3_waktu',
  'u4_biaya',
  'u5_produk_layanan',
  'u6_kompetensi_pelaksana',
  'u7_perilaku_pelaksana',
  'u8_penanganan_pengaduan',
  'u9_sarana_prasarana',
] as const;

export type KepuasanUnsurField = (typeof KEPUASAN_UNSUR_FIELDS)[number];

export const KEPUASAN_UNSUR_LABEL: Record<KepuasanUnsurField, string> = {
  u1_persyaratan: 'Persyaratan',
  u2_prosedur: 'Sistem, mekanisme, dan prosedur',
  u3_waktu: 'Waktu penyelesaian',
  u4_biaya: 'Biaya/tarif',
  u5_produk_layanan: 'Produk/spesifikasi jenis pelayanan',
  u6_kompetensi_pelaksana: 'Kompetensi pelaksana',
  u7_perilaku_pelaksana: 'Perilaku pelaksana',
  u8_penanganan_pengaduan: 'Penanganan pengaduan, saran, dan masukan',
  u9_sarana_prasarana: 'Sarana dan prasarana',
};

export const KEPUASAN_UNSUR_QUESTION: Record<KepuasanUnsurField, string> = {
  u1_persyaratan: 'Bagaimana penilaian Anda terhadap persyaratan pelayanan yang harus dipenuhi?',
  u2_prosedur: 'Bagaimana penilaian Anda terhadap kemudahan alur/sistem, mekanisme, dan prosedur pelayanan?',
  u3_waktu: 'Bagaimana penilaian Anda terhadap kecepatan waktu penyelesaian pelayanan?',
  u4_biaya: 'Bagaimana penilaian Anda terhadap kewajaran biaya/tarif pelayanan?',
  u5_produk_layanan: 'Bagaimana penilaian Anda terhadap kesesuaian hasil/produk pelayanan yang diberikan?',
  u6_kompetensi_pelaksana: 'Bagaimana penilaian Anda terhadap kemampuan dan keterampilan petugas dalam memberikan pelayanan?',
  u7_perilaku_pelaksana: 'Bagaimana penilaian Anda terhadap sikap dan perilaku petugas dalam memberikan pelayanan?',
  u8_penanganan_pengaduan: 'Bagaimana penilaian Anda terhadap penanganan pengaduan, saran, dan masukan oleh rumah sakit?',
  u9_sarana_prasarana: 'Bagaimana penilaian Anda terhadap kualitas sarana dan prasarana pelayanan?',
};

export const KEPUASAN_SCALE_LABEL: Record<1 | 2 | 3 | 4, string> = {
  1: 'Tidak Baik',
  2: 'Kurang Baik',
  3: 'Baik',
  4: 'Sangat Baik',
};

/** Bobot tiap unsur = 1/9, sesuai Permenpan RB 14/2017 (jumlah unsur = 9). */
export const KEPUASAN_UNSUR_WEIGHT = 1 / KEPUASAN_UNSUR_FIELDS.length;

/** Faktor konversi Nilai Indeks (NI, skala 1-4) menjadi IKM/NIK (skala 25-100). */
export const KEPUASAN_NIK_MULTIPLIER = 25;

/* ── Survei ───────────────────────────────────────────────────────────── */

export type KepuasanSurveyMode = 'online' | 'kiosk' | 'both';
export type KepuasanSurveyStatus = 'draft' | 'aktif' | 'ditutup' | 'arsip';
export type KepuasanTargetOperator = 'gt' | 'gte' | 'lt' | 'lte' | 'eq';

export const KEPUASAN_STATUS_LABEL: Record<KepuasanSurveyStatus, string> = {
  draft: 'Draft',
  aktif: 'Aktif',
  ditutup: 'Ditutup',
  arsip: 'Arsip',
};

export interface KepuasanClassificationBand {
  grade: 'A' | 'B' | 'C' | 'D';
  label: string;
  min: number;
  max: number;
}

export const KEPUASAN_DEFAULT_THRESHOLDS: KepuasanClassificationBand[] = [
  { grade: 'D', label: 'Tidak baik', min: 25.0, max: 64.99 },
  { grade: 'C', label: 'Kurang baik', min: 65.0, max: 76.6 },
  { grade: 'B', label: 'Baik', min: 76.61, max: 88.3 },
  { grade: 'A', label: 'Sangat baik', min: 88.31, max: 100.0 },
];

export interface KepuasanSurvey {
  id: string;
  name: string;
  description: string | null;
  /** Kode UnitId existing aplikasi (IGD/Rawat Jalan/dst.) atau 'all'. */
  unitId: string;
  startDate: string;
  endDate: string;
  targetRespondents: number | null;
  surveyMode: KepuasanSurveyMode;
  status: KepuasanSurveyStatus;
  instrumentVersion: string;
  targetValue: number;
  targetOperator: KepuasanTargetOperator;
  classificationThresholds: KepuasanClassificationBand[];
  kioskResetSeconds: number;
  linkedIndicatorId: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface KepuasanSurveyFilters {
  status?: KepuasanSurveyStatus | KepuasanSurveyStatus[];
  unitId?: string;
  search?: string;
}

/* ── Distribusi ───────────────────────────────────────────────────────── */

export type KepuasanTokenKind = 'public_link' | 'qr' | 'access_code';

export interface KepuasanSurveyToken {
  id: string;
  surveyId: string;
  token: string;
  kind: KepuasanTokenKind;
  unitId: string | null;
  maxUses: number | null;
  usedCount: number;
  expiresAt: string | null;
  createdAt: string;
}

/* ── Response ─────────────────────────────────────────────────────────── */

export type KepuasanFollowupStatus = 'belum_ditindaklanjuti' | 'dalam_proses' | 'selesai';
export type KepuasanResponseSource = 'online' | 'kiosk' | 'import';

export const KEPUASAN_FOLLOWUP_STATUS_LABEL: Record<KepuasanFollowupStatus, string> = {
  belum_ditindaklanjuti: 'Belum ditindaklanjuti',
  dalam_proses: 'Dalam proses',
  selesai: 'Selesai',
};

export interface KepuasanResponse {
  id: string;
  responseCode: string;
  surveyId: string;
  tokenId: string | null;
  unitId: string;
  respondentName: string | null;
  scores: Record<KepuasanUnsurField, 1 | 2 | 3 | 4>;
  kritikSaran: string | null;
  willingToContact: boolean;
  contactPhone: string | null;
  followupStatus: KepuasanFollowupStatus;
  followupPic: string | null;
  followupNote: string | null;
  followupDate: string | null;
  source: KepuasanResponseSource;
  isValid: boolean;
  submittedAt: string;
}

/** Payload dikirim dari form publik (satu kali panggilan, lihat bagian 9 SQL). */
export interface KepuasanSubmitPayload {
  token: string;
  unitId?: string;
  respondentName?: string;
  scores: Record<KepuasanUnsurField, 1 | 2 | 3 | 4>;
  kritikSaran?: string;
  willingToContact?: boolean;
  contactPhone?: string;
  source?: KepuasanResponseSource;
}

/* ── Hasil agregat per periode ────────────────────────────────────────── */

export interface KepuasanPeriodResult {
  id: string;
  surveyId: string;
  unitId: string | null;
  totalRespondents: number;
  unsurAverages: Partial<Record<KepuasanUnsurField, number>>;
  nilaiIndeks: number | null;
  ikm: number | null;
  grade: string | null;
  gradeLabel: string | null;
  statusCapaian: 'tercapai' | 'tidak_tercapai' | null;
  computedAt: string;
}

/** Info survei publik (sebelum pasien mulai mengisi) — dari RPC kepuasan_get_public_survey. */
export interface KepuasanPublicSurveyInfo {
  surveyId: string;
  name: string;
  description: string | null;
  unitId: string;
  surveyMode: KepuasanSurveyMode;
  kioskResetSeconds: number;
}

/* ── Peran modul (profiles.kepuasan_roles) ───────────────────────────── */

export type KepuasanRole = 'admin_mutu' | 'unit';

export const KEPUASAN_ROLE_LABEL: Record<KepuasanRole, string> = {
  admin_mutu: 'Admin Mutu',
  unit: 'Unit',
};

/* ── Helper murni (tidak menyentuh DB) ──────────────────────────────── */

/** Klasifikasi grade/label dari nilai IKM (0-100) memakai threshold survei (atau default). */
export function classifyKepuasanScore(
  ikm: number,
  thresholds: KepuasanClassificationBand[] = KEPUASAN_DEFAULT_THRESHOLDS
): { grade: string; label: string } {
  const band = thresholds.find((b) => ikm >= b.min && ikm <= b.max);
  if (band) return { grade: band.grade, label: band.label };
  // Fallback bila nilai di luar rentang yang dikonfigurasi (mis. pembulatan).
  if (ikm < thresholds[0]?.min) return { grade: thresholds[0]?.grade ?? 'D', label: thresholds[0]?.label ?? 'Tidak baik' };
  const last = thresholds[thresholds.length - 1];
  return { grade: last?.grade ?? 'A', label: last?.label ?? 'Sangat baik' };
}

export function evaluateKepuasanTarget(ikm: number, target: number, operator: KepuasanTargetOperator): boolean {
  switch (operator) {
    case 'gt': return ikm > target;
    case 'gte': return ikm >= target;
    case 'lt': return ikm < target;
    case 'lte': return ikm <= target;
    case 'eq': return ikm === target;
    default: return false;
  }
}

const TARGET_OPERATOR_SYMBOL: Record<KepuasanTargetOperator, string> = {
  gt: '>', gte: '\u2265', lt: '<', lte: '\u2264', eq: '=',
};

export function formatKepuasanTarget(target: number, operator: KepuasanTargetOperator): string {
  return `${TARGET_OPERATOR_SYMBOL[operator]}${target.toFixed(2)}`;
}
