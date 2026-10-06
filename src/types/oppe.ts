/**
 * Tipe & konstanta modul OPPE (Ongoing Professional Practice Evaluation /
 * Evaluasi Praktik Profesional Berkelanjutan).
 *
 * Mengikuti pola src/types/uimu.ts: camelCase di aplikasi, snake_case di
 * database (mapping ada di src/lib/oppeData.ts). Semua nilai yang sifatnya
 * KONFIGURASI (bobot kategori, skor, rentang kategori hasil, teks
 * rekomendasi, KSM, profesi, indikator, target, trigger) TIDAK di-hard-code
 * di sini — disimpan di tabel oppe_* dan bisa diubah admin dari menu
 * Pengaturan OPPE / Master. Yang ada di file ini hanya:
 *   - enum teknis (status workflow, operator, tipe data) yang dipakai engine,
 *   - nilai DEFAULT yang dipakai bila tabel oppe_settings belum terisi.
 */

// ────────────────────────────────────────────────────────────────
// Enum teknis
// ────────────────────────────────────────────────────────────────

/** Jenis nilai realisasi yang bisa diinput per indikator. */
export type OppeDataType =
  | 'percent'   // angka persen 0-100
  | 'number'    // angka bebas
  | 'count'     // jumlah kasus/kejadian/kali
  | 'skp'       // poin SKP
  | 'boolean'   // Ya / Tidak
  | 'grade'     // Baik / Cukup / Kurang
  | 'pass'      // Lulus / Belum
  | 'category'; // pilihan kategori bebas (mis. Aktif / Mati)

/**
 * Operator target. Sesuai poin 9 master prompt: ≥, ≤, =, 0 kasus, 100%,
 * minimal, maksimal, skor, kategori. Engine menormalkan:
 *   pct100 -> gte 100 · min -> gte · max -> lte · score -> gte
 */
export type OppeTargetOperator =
  | 'gte' | 'lte' | 'eq' | 'zero' | 'pct100' | 'min' | 'max' | 'score' | 'category';

/**
 * Operator trigger (ambang batas yang memicu evaluasi lebih lanjut).
 *   lt/lte/gt/gte/eq/neq   -> dibandingkan dengan trigger_value
 *   lt_target / gt_target  -> dibandingkan dengan nilai TARGET (mis. SKP "< Target",
 *                             NDR "Melampaui standar RS")
 *   not_pass               -> untuk tipe kategori: setiap nilai di luar pass/attention
 *   none                   -> tidak ada trigger terpisah (gagal target = trigger)
 */
export type OppeTriggerOperator =
  | 'lt' | 'lte' | 'gt' | 'gte' | 'eq' | 'neq' | 'lt_target' | 'gt_target' | 'not_pass' | 'none';

export type OppeItemStatus = 'met' | 'attention' | 'trigger' | 'no_data';

export type OppeEvaluationStatus =
  | 'draft' | 'in_progress' | 'submitted' | 'reviewed' | 'approved' | 'finalized';

export type OppePeriodType = 'semester_1' | 'semester_2' | 'tahunan' | 'custom';

export type OppeFppeStatus = 'draft' | 'direncanakan' | 'berjalan' | 'selesai' | 'tidak_dilanjutkan';

export type OppeTrend = 'naik' | 'stabil' | 'turun';

export type OppeAuditAction =
  | 'create' | 'update' | 'delete' | 'import' | 'export' | 'submit' | 'review'
  | 'approve' | 'finalize' | 'reopen' | 'fppe_created' | 'fppe_updated' | 'settings_updated';

export type OppeMasterKind = 'profession' | 'specialty' | 'service_type';

// ────────────────────────────────────────────────────────────────
// Label & pilihan UI
// ────────────────────────────────────────────────────────────────

export const OPPE_DATA_TYPE_OPTIONS: { value: OppeDataType; label: string; unit: string }[] = [
  { value: 'percent', label: 'Persen (%)', unit: '%' },
  { value: 'number', label: 'Angka', unit: '' },
  { value: 'count', label: 'Jumlah kasus / kejadian', unit: 'kasus' },
  { value: 'skp', label: 'Poin SKP', unit: 'SKP' },
  { value: 'boolean', label: 'Ya / Tidak', unit: '' },
  { value: 'grade', label: 'Baik / Cukup / Kurang', unit: '' },
  { value: 'pass', label: 'Lulus / Belum', unit: '' },
  { value: 'category', label: 'Kategori (pilihan bebas)', unit: '' },
];

export const OPPE_TARGET_OPERATOR_OPTIONS: { value: OppeTargetOperator; label: string; symbol: string }[] = [
  { value: 'gte', label: '≥ (lebih dari / sama dengan)', symbol: '≥' },
  { value: 'lte', label: '≤ (kurang dari / sama dengan)', symbol: '≤' },
  { value: 'eq', label: '= (sama dengan)', symbol: '=' },
  { value: 'zero', label: '0 kasus (zero tolerance)', symbol: '0' },
  { value: 'pct100', label: '100%', symbol: '100%' },
  { value: 'min', label: 'Minimal', symbol: 'min' },
  { value: 'max', label: 'Maksimal', symbol: 'maks' },
  { value: 'score', label: 'Skor (≥ nilai skor)', symbol: 'skor ≥' },
  { value: 'category', label: 'Kategori (nilai lulus tertentu)', symbol: '∈' },
];

export const OPPE_TRIGGER_OPERATOR_OPTIONS: { value: OppeTriggerOperator; label: string }[] = [
  { value: 'lt', label: '< nilai' },
  { value: 'lte', label: '≤ nilai' },
  { value: 'gt', label: '> nilai' },
  { value: 'gte', label: '≥ nilai (mis. ≥ 1 insiden)' },
  { value: 'eq', label: '= nilai' },
  { value: 'neq', label: '≠ nilai' },
  { value: 'lt_target', label: '< target' },
  { value: 'gt_target', label: '> target / melampaui standar' },
  { value: 'not_pass', label: 'Nilai kategori di luar nilai lulus' },
  { value: 'none', label: 'Tidak ada trigger terpisah (gagal target = trigger)' },
];

export const OPPE_ITEM_STATUS_LABEL: Record<OppeItemStatus, string> = {
  met: 'Memenuhi',
  attention: 'Perlu Perhatian',
  trigger: 'Trigger',
  no_data: 'Belum Ada Data',
};

/** Warna status indikator — memakai palet yang sama dengan modul lain (hex, dipakai via style inline seperti UIMU/IKP). */
export const OPPE_ITEM_STATUS_COLOR: Record<OppeItemStatus, string> = {
  met: '#22c55e',
  attention: '#f59e0b',
  trigger: '#ef4444',
  no_data: '#94a3b8',
};

export const OPPE_STATUS_LABEL: Record<OppeEvaluationStatus, string> = {
  draft: 'Draft',
  in_progress: 'Dalam Proses',
  submitted: 'Diajukan',
  reviewed: 'Direview',
  approved: 'Disetujui',
  finalized: 'Final',
};

export const OPPE_STATUS_COLOR: Record<OppeEvaluationStatus, string> = {
  draft: '#94a3b8',
  in_progress: '#38bdf8',
  submitted: '#f59e0b',
  reviewed: '#a78bfa',
  approved: '#4f8ef7',
  finalized: '#22c55e',
};

export const OPPE_STATUS_FLOW: OppeEvaluationStatus[] = ['draft', 'in_progress', 'submitted', 'reviewed', 'approved', 'finalized'];

export const OPPE_PERIOD_LABEL: Record<OppePeriodType, string> = {
  semester_1: 'Semester I',
  semester_2: 'Semester II',
  tahunan: 'Tahunan',
  custom: 'Custom',
};

export const OPPE_FPPE_STATUS_LABEL: Record<OppeFppeStatus, string> = {
  draft: 'Draft',
  direncanakan: 'Direncanakan',
  berjalan: 'Berjalan',
  selesai: 'Selesai',
  tidak_dilanjutkan: 'Tidak Dilanjutkan',
};

export const OPPE_FPPE_STATUS_COLOR: Record<OppeFppeStatus, string> = {
  draft: '#94a3b8',
  direncanakan: '#38bdf8',
  berjalan: '#f59e0b',
  selesai: '#22c55e',
  tidak_dilanjutkan: '#64748b',
};

export const OPPE_TREND_LABEL: Record<OppeTrend, string> = { naik: 'Naik', stabil: 'Stabil', turun: 'Turun' };

export const OPPE_AUDIT_ACTION_LABEL: Record<OppeAuditAction, string> = {
  create: 'Dibuat',
  update: 'Diubah',
  delete: 'Dihapus',
  import: 'Import',
  export: 'Export',
  submit: 'Diajukan',
  review: 'Direview',
  approve: 'Disetujui',
  finalize: 'Difinalisasi',
  reopen: 'Dibuka Kembali',
  fppe_created: 'FPPE Dibuat',
  fppe_updated: 'FPPE Diubah',
  settings_updated: 'Pengaturan Diubah',
};

export const OPPE_MASTER_KIND_LABEL: Record<OppeMasterKind, string> = {
  profession: 'Profesi',
  specialty: 'Spesialisasi',
  service_type: 'Jenis Layanan',
};

/** Pilihan nilai default per tipe data kategori (bisa ditimpa per indikator). */
export const OPPE_DEFAULT_OPTIONS: Partial<Record<OppeDataType, { options: string[]; pass: string[]; attention: string[] }>> = {
  boolean: { options: ['Ya', 'Tidak'], pass: ['Ya'], attention: [] },
  grade: { options: ['Baik', 'Cukup', 'Kurang'], pass: ['Baik'], attention: ['Cukup'] },
  pass: { options: ['Lulus', 'Belum'], pass: ['Lulus'], attention: [] },
  category: { options: ['Aktif', 'Mati'], pass: ['Aktif'], attention: [] },
};

export function isCategoricalType(t: OppeDataType): boolean {
  return t === 'boolean' || t === 'grade' || t === 'pass' || t === 'category';
}

// ────────────────────────────────────────────────────────────────
// Pengaturan (oppe_settings) + default
// ────────────────────────────────────────────────────────────────

export interface OppeResultCategory {
  /** kode singkat stabil, mis. 'sangat_baik' */
  code: string;
  label: string;
  /** batas bawah inklusif */
  min: number;
  /** batas atas eksklusif; null = tak terbatas */
  max: number | null;
  color: string;
  recommendation: string;
}

export interface OppeSettings {
  scoreMet: number;
  scoreAttention: number;
  scoreTrigger: number;
  resultCategories: OppeResultCategory[];
  /** Teks rekomendasi khusus. */
  recommendationCriticalTrigger: string;
  recommendationMultipleTrigger: string;
  recommendationDecline: string;
  /** Penurunan skor (poin) yang dianggap "turun signifikan". */
  significantDrop: number;
  /** Selisih (poin) yang masih dianggap "stabil". */
  stableBand: number;
  /** Jumlah trigger (non-kritis) yang otomatis menyarankan FPPE. 0 = nonaktif. */
  fppeTriggerCountThreshold: number;
  /** Hari sebelum due_date untuk notifikasi "jatuh tempo". */
  dueReminderDays: number;
  /** Item tanpa data wajib diisi sebelum evaluasi diajukan. */
  requireCompleteBeforeSubmit: boolean;
  /** Nama RS untuk kop lembar cetak/PDF. */
  hospitalName: string;
  updatedAt?: string | null;
  updatedBy?: string | null;
}

export const OPPE_DEFAULT_SETTINGS: OppeSettings = {
  scoreMet: 100,
  scoreAttention: 70,
  scoreTrigger: 0,
  resultCategories: [
    { code: 'sangat_baik', label: 'Sangat Baik', min: 90, max: null, color: '#22c55e', recommendation: 'Direkomendasikan mempertahankan kewenangan klinis dan melanjutkan monitoring OPPE rutin.' },
    { code: 'baik', label: 'Baik', min: 80, max: 90, color: '#4f8ef7', recommendation: 'Direkomendasikan melanjutkan kewenangan klinis dengan monitoring rutin.' },
    { code: 'perlu_perbaikan', label: 'Perlu Perbaikan', min: 70, max: 80, color: '#f59e0b', recommendation: 'Direkomendasikan rencana perbaikan dan pemantauan pada indikator yang belum mencapai target.' },
    { code: 'tidak_memenuhi', label: 'Tidak Memenuhi', min: 0, max: 70, color: '#ef4444', recommendation: 'Direkomendasikan evaluasi lebih lanjut oleh Komite Medik/Subkomite Mutu Profesi.' },
  ],
  recommendationCriticalTrigger: 'Direkomendasikan evaluasi terfokus/FPPE berdasarkan hasil indikator kritis.',
  recommendationMultipleTrigger: 'Terdapat beberapa indikator yang terkena trigger — dipertimbangkan evaluasi terfokus/FPPE sesuai keputusan Komite Medik.',
  recommendationDecline: 'Skor menurun signifikan dibanding periode sebelumnya — perlu ditelusuri penyebabnya bersama Ketua KSM.',
  significantDrop: 10,
  stableBand: 2,
  fppeTriggerCountThreshold: 3,
  dueReminderDays: 14,
  requireCompleteBeforeSubmit: true,
  hospitalName: 'Rumah Sakit',
};

/**
 * Preset alternatif yang mengikuti lembar Excel "OPPE BARU By dr.Sri RSASM"
 * (bagian II): skor = jumlah indikator terpenuhi / jumlah indikator × 100,
 * kategori BAIK 85–100, CUKUP 75–<85, KURANG <75. Bisa diterapkan dari menu
 * Pengaturan OPPE dengan satu klik.
 */
export const OPPE_EXCEL_PRESET: Pick<OppeSettings, 'scoreMet' | 'scoreAttention' | 'scoreTrigger' | 'resultCategories'> = {
  scoreMet: 100,
  scoreAttention: 0,
  scoreTrigger: 0,
  resultCategories: [
    { code: 'baik', label: 'Baik', min: 85, max: null, color: '#22c55e', recommendation: 'Kewenangan Klinis (Clinical Privileges) dilanjutkan penuh untuk 1 tahun ke depan.' },
    { code: 'cukup', label: 'Cukup', min: 75, max: 85, color: '#f59e0b', recommendation: 'Kewenangan Klinis dilanjutkan dengan catatan/supervisi pada area yang kurang.' },
    { code: 'kurang', label: 'Kurang', min: 0, max: 75, color: '#ef4444', recommendation: 'Direkomendasikan evaluasi lebih lanjut oleh Komite Medik/Subkomite Mutu Profesi.' },
  ],
};

// ────────────────────────────────────────────────────────────────
// Model data
// ────────────────────────────────────────────────────────────────

export interface OppeKsm {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface OppeMasterOption {
  id: string;
  kind: OppeMasterKind;
  code: string | null;
  name: string;
  sortOrder: number;
  isActive: boolean;
}

export interface OppeUnitRef {
  id: string;
  code: string;
  name: string;
}

export interface OppeDoctor {
  id: string;
  userId: string | null;
  name: string;
  nikNip: string | null;
  strNumber: string | null;
  strExpiry: string | null;
  sipNumber: string | null;
  sipExpiry: string | null;
  title: string | null;
  profession: string | null;
  specialty: string | null;
  ksmId: string | null;
  ksmName?: string | null;
  unitId: string | null;
  unitName: string | null;
  status: 'aktif' | 'nonaktif';
  practiceStartDate: string | null;
  email: string | null;
  phone: string | null;
  credentials: string | null;
  notes: string | null;
  isDemo: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface OppeIndicatorCategory {
  id: string;
  code: string;
  name: string;
  weight: number;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
}

/** Bagian aturan penilaian yang disalin (snapshot) dari master ke item evaluasi. */
export interface OppeRule {
  dataType: OppeDataType;
  targetOperator: OppeTargetOperator;
  targetValue: number | null;
  triggerOperator: OppeTriggerOperator;
  triggerValue: number | null;
  options: string[];
  passValues: string[];
  attentionValues: string[];
  isCritical: boolean;
  weight: number;
  scoreMet: number | null;
  scoreAttention: number | null;
  scoreTrigger: number | null;
}

export interface OppeIndicator extends OppeRule {
  id: string;
  code: string;
  categoryId: string;
  categoryCode?: string;
  ksmId: string | null;
  profession: string | null;
  unitId: string | null;
  name: string;
  description: string | null;
  indicatorType: string | null;
  operationalDefinition: string | null;
  numerator: string | null;
  denominator: string | null;
  unitLabel: string | null;
  targetText: string | null;
  minValue: number | null;
  maxValue: number | null;
  triggerText: string | null;
  sourceData: string | null;
  measurementMethod: string | null;
  frequency: string | null;
  evaluationPeriod: string | null;
  qualityIndicatorId: string | null;
  qualityIndicatorName: string | null;
  referenceNote: string | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface OppeTemplate {
  id: string;
  code: string;
  name: string;
  profession: string | null;
  ksmId: string | null;
  description: string | null;
  isActive: boolean;
  indicatorCount?: number;
}

export interface OppeTemplateIndicator {
  id: string;
  templateId: string;
  indicatorId: string;
  sequence: number;
  isActive: boolean;
}

export interface OppeEvaluationItem extends OppeRule {
  id: string;
  evaluationId: string;
  indicatorId: string | null;
  sequence: number;
  categoryId: string | null;
  categoryCode: string;
  code: string | null;
  name: string;
  unitLabel: string | null;
  targetText: string | null;
  triggerText: string | null;
  realizationText: string | null;
  realizationNumber: number | null;
  achievement: number | null;
  score: number | null;
  weightedScore: number | null;
  status: OppeItemStatus;
  isTrigger: boolean;
  statusReason: string | null;
  notes: string | null;
  sourceData: string | null;
  evidenceUrl: string | null;
  evidencePath: string | null;
  qualityIndicatorId: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface OppeCategoryScore {
  categoryId: string | null;
  code: string;
  name: string;
  weight: number;
  score: number | null;
  weighted: number | null;
  itemCount: number;
  metCount: number;
}

export interface OppeEvaluation {
  id: string;
  evaluationNumber: string | null;
  doctorId: string;
  doctorName?: string | null;
  ksmId: string | null;
  ksmName?: string | null;
  unitId: string | null;
  unitName: string | null;
  profession: string | null;
  specialty: string | null;
  templateId: string | null;
  periodType: OppePeriodType;
  year: number;
  semester: number | null;
  periodStart: string | null;
  periodEnd: string | null;
  evaluatorId: string | null;
  evaluatorName: string | null;
  evaluationDate: string | null;
  dueDate: string | null;
  status: OppeEvaluationStatus;
  scoreProfessional: number | null;
  scoreDevelopment: number | null;
  scoreClinical: number | null;
  weightedScore: number | null;
  finalScore: number | null;
  categoryScores: OppeCategoryScore[];
  finalCategory: string | null;
  finalCategoryLabel: string | null;
  metCount: number;
  attentionCount: number;
  triggerCount: number;
  noDataCount: number;
  criticalTriggerCount: number;
  criticalIndicators: string | null;
  requiresFppe: boolean;
  trend: OppeTrend | null;
  previousScore: number | null;
  conclusion: string | null;
  recommendation: string | null;
  recommendationOverride: string | null;
  notes: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  finalizedBy: string | null;
  finalizedAt: string | null;
  reopenReason: string | null;
  reopenedBy: string | null;
  reopenedAt: string | null;
  needsRecalc: boolean;
  isDemo: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OppeFppe {
  id: string;
  fppeNumber: string | null;
  evaluationId: string | null;
  doctorId: string;
  doctorName?: string | null;
  ksmId: string | null;
  ksmName?: string | null;
  triggerIndicatorId: string | null;
  triggerItemId: string | null;
  triggerIndicatorName: string | null;
  reason: string | null;
  area: string | null;
  startDate: string | null;
  endDate: string | null;
  evaluatorId: string | null;
  evaluatorName: string | null;
  plan: string | null;
  result: string | null;
  recommendation: string | null;
  status: OppeFppeStatus;
  isDemo: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OppeAuditEntry {
  id: string;
  userId: string | null;
  userName: string | null;
  evaluationId: string | null;
  entityType: string;
  entityId: string | null;
  action: OppeAuditAction;
  oldData: Record<string, unknown> | null;
  newData: Record<string, unknown> | null;
  reason: string | null;
  createdAt: string;
}

export interface OppeEvaluationFilters {
  year?: number;
  periodType?: OppePeriodType;
  semester?: number;
  ksmId?: string;
  doctorId?: string;
  evaluatorId?: string;
  profession?: string;
  unitId?: string;
  status?: OppeEvaluationStatus;
  finalCategory?: string;
  search?: string;
  requiresFppe?: boolean;
  /** pagination server-side */
  page?: number;
  pageSize?: number;
  sortBy?: 'updated_at' | 'final_score' | 'year' | 'trigger_count';
  sortDir?: 'asc' | 'desc';
}

/** Hak akses yang sudah diturunkan dari role existing + profiles.oppe_roles. */
export interface OppeAccess {
  isAdmin: boolean;
  /** Komite Medik / Mutu (termasuk admin): lihat semua, review, approve, finalisasi, FPPE, kelola master. */
  isCommittee: boolean;
  /** Evaluator: isi evaluasi yang ditugaskan. */
  isEvaluator: boolean;
  /** Dokter: lihat hasil OPPE miliknya. */
  isDoctor: boolean;
  /** Ada akses apa pun ke modul. */
  hasAccess: boolean;
}

export function deriveOppeAccess(role: string | null, oppeRoles: string[]): OppeAccess {
  const isAdmin = role === 'admin';
  const isCommittee = isAdmin || oppeRoles.includes('komite_medik');
  const isEvaluator = isCommittee || oppeRoles.includes('evaluator');
  const isDoctor = oppeRoles.includes('dokter');
  return { isAdmin, isCommittee, isEvaluator, isDoctor, hasAccess: isEvaluator || isDoctor };
}

export function periodLabel(e: Pick<OppeEvaluation, 'periodType' | 'year' | 'periodStart' | 'periodEnd'>): string {
  if (e.periodType === 'custom') {
    return `Custom ${e.periodStart ?? '?'} s/d ${e.periodEnd ?? '?'}`;
  }
  return `${OPPE_PERIOD_LABEL[e.periodType]} ${e.year}`;
}

/** Urutan kronologis periode (untuk tren). */
export function periodSortKey(e: Pick<OppeEvaluation, 'periodType' | 'year' | 'periodStart'>): number {
  const sub = e.periodType === 'semester_1' ? 1 : e.periodType === 'semester_2' ? 2 : e.periodType === 'tahunan' ? 3 : 0;
  if (e.periodType === 'custom' && e.periodStart) {
    const d = new Date(e.periodStart);
    return e.year * 100 + (d.getMonth() < 6 ? 1 : 2);
  }
  return e.year * 100 + sub;
}
