// ============================================================================
// Modul Survey Budaya Keselamatan Pasien
//
// Instrumen: AHRQ Hospital Survey on Patient Safety Culture (HSOPSC) v1.0,
// terjemahan Indonesia — 42 item berskor dikelompokkan ke 12 dimensi
// (crosswalk resmi AHRQ). Bank pertanyaan & dimensi disimpan sebagai DATA
// (tabel budaya_questions/budaya_dimensions, lihat migration_budaya.sql),
// BUKAN konstanta hard-code di sini, karena instruksi sumber mewajibkan
// unit/pertanyaan/dimensi dikonfigurasi via Master Data — konstanta di file
// ini hanya untuk hal yang benar-benar tetap (status workflow, kategori
// skor, dsb.), sesuai pola IKP_STATUS_LABEL/RISK_STATUS_LABEL yang sudah ada.
// ============================================================================

/* ── Instrumen ─────────────────────────────────────────────────────────── */

export type BudayaSection = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I';

export type BudayaScaleType =
  | 'likert_agree'      // Sangat Tidak Setuju .. Sangat Setuju (1-5)
  | 'likert_frequency'  // Tidak Pernah .. Selalu (1-5)
  | 'grade'             // A-E (Bagian E)
  | 'category'          // pilihan kategori non-Likert (Bagian G)
  | 'background'        // latar belakang responden (Bagian H)
  | 'free_text';        // komentar bebas (Bagian I)

export const BUDAYA_LIKERT_AGREE_LABEL: Record<number, string> = {
  1: 'Sangat Tidak Setuju',
  2: 'Tidak Setuju',
  3: 'Kadang-kadang Setuju',
  4: 'Setuju',
  5: 'Sangat Setuju',
};

export const BUDAYA_LIKERT_FREQUENCY_LABEL: Record<number, string> = {
  1: 'Tidak Pernah',
  2: 'Jarang',
  3: 'Kadang-kadang',
  4: 'Sering',
  5: 'Selalu',
};

export interface BudayaDimension {
  id: string;
  code: string;          // 'D01'..'D12'
  name: string;
  description: string;
  sortOrder: number;
}

export interface BudayaUnit {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
}

export interface BudayaQuestionOption {
  id: string;
  optionCode: string;
  optionLabel: string;
  sortOrder: number;
}

export interface BudayaQuestion {
  id: string;
  instrumentVersion: string;
  section: BudayaSection;
  itemCode: string;       // 'A1'..'A18', 'B1'..'B4', ..., 'I1'
  itemNo: number | null;
  questionText: string;
  scaleType: BudayaScaleType;
  isReverse: boolean;
  dimensionId: string | null; // null untuk item non-skor (E/G/H/I)
  isScored: boolean;
  isRequired: boolean;
  sortOrder: number;
  options?: BudayaQuestionOption[];
}

/* ── Survei ────────────────────────────────────────────────────────────── */

export type BudayaSurveyPeriod = 'semester_1' | 'semester_2' | 'tahunan' | 'custom';
export type BudayaSurveyStatus = 'draft' | 'aktif' | 'ditutup' | 'final' | 'arsip';
export type BudayaAnonymityMode = 'anonymous' | 'identified';

export const BUDAYA_SURVEY_STATUS_LABEL: Record<BudayaSurveyStatus, string> = {
  draft: 'Draft',
  aktif: 'Aktif',
  ditutup: 'Ditutup',
  final: 'Final',
  arsip: 'Arsip',
};

export interface BudayaSurvey {
  id: string;
  name: string;
  year: number;
  period: BudayaSurveyPeriod;
  startDate: string;
  endDate: string;
  targetRespondents: number;
  includedUnitIds: string[];
  status: BudayaSurveyStatus;
  instrumentVersion: string;
  anonymityMode: BudayaAnonymityMode;
  minRespondentThreshold: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

/* ── Responden & jawaban ──────────────────────────────────────────────── */

export type BudayaRespondentStatus = 'not_started' | 'in_progress' | 'completed';

export interface BudayaRespondent {
  id: string;
  surveyId: string;
  unitId: string | null;
  token: string;
  status: BudayaRespondentStatus;
  consented: boolean;
  profession: string | null;
  positionOther: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

export interface BudayaAnswer {
  id: string;
  respondentId: string;
  questionId: string;
  rawAnswer: number | null;
  rawAnswerText: string | null;
  scoredAnswer: number | null;
}

export interface BudayaComment {
  id: string;
  surveyId: string;
  respondentId: string;
  commentText: string;
  theme: string | null;
  createdAt: string;
}

/* ── Hasil agregat ─────────────────────────────────────────────────────── */

export type BudayaCategory = 'kuat' | 'sedang' | 'lemah';

export const BUDAYA_CATEGORY_LABEL: Record<BudayaCategory, string> = {
  kuat: 'Budaya Kuat',
  sedang: 'Budaya Sedang',
  lemah: 'Budaya Lemah',
};

// Warna mengikuti konvensi contoh laporan (hijau/kuning/merah).
export const BUDAYA_CATEGORY_COLOR: Record<BudayaCategory, string> = {
  kuat: '#22c55e',
  sedang: '#eab308',
  lemah: '#ef4444',
};

/**
 * Ambang kategori — DEFAULT mengikuti contoh laporan (poin V):
 * >75% Kuat, 51-<75% Sedang, <50% Lemah. Nilai tepat 50% ditangani eksplisit
 * sebagai batas bawah "Sedang" (bukan Lemah, bukan Kuat) — lihat
 * categorizeBudayaScore() di budayaData.ts. Configurable oleh admin di masa
 * depan lewat tabel master threshold (belum diimplementasikan di Fase 2 ini).
 */
export const BUDAYA_DEFAULT_THRESHOLDS = { strong: 75, moderateFloor: 50 } as const;

export interface BudayaDimensionResult {
  id: string;
  surveyId: string;
  dimensionId: string;
  positiveCount: number;
  negativeCount: number;
  neutralCount: number;
  totalResponses: number;
  positivePercentage: number | null;
  category: BudayaCategory | null;
  computedAt: string;
}

export interface BudayaUnitResult {
  id: string;
  surveyId: string;
  unitId: string;
  dimensionId: string;
  positiveCount: number;
  negativeCount: number;
  neutralCount: number;
  totalResponses: number;
  positivePercentage: number | null;
  category: BudayaCategory | null;
  computedAt: string;
}

export interface BudayaPeriodResult {
  id: string;
  surveyId: string;
  overallScore: number | null;
  overallCategory: BudayaCategory | null;
  totalRespondents: number;
  responseRate: number | null;
  source: 'system' | 'imported';
  computedAt: string;
}

/* ── Tindak lanjut & monitoring ───────────────────────────────────────── */

export type BudayaFollowupStatus = 'belum_dimulai' | 'dalam_proses' | 'selesai' | 'ditunda' | 'tidak_efektif';

export const BUDAYA_FOLLOWUP_STATUS_LABEL: Record<BudayaFollowupStatus, string> = {
  belum_dimulai: 'Belum Dimulai',
  dalam_proses: 'Dalam Proses',
  selesai: 'Selesai',
  ditunda: 'Ditunda',
  tidak_efektif: 'Tidak Efektif',
};

export interface BudayaFollowup {
  id: string;
  surveyId: string;
  dimensionId: string;
  unitId: string | null;
  problemDescription: string | null;
  rootCause: string | null;
  actionPlan: string | null;
  picId: string | null;
  targetDate: string | null;
  startDate: string | null;
  deadline: string | null;
  successIndicator: string | null;
  status: BudayaFollowupStatus;
  progressPercentage: number;
  evidenceUrl: string | null;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BudayaFollowupMonitoring {
  id: string;
  followupId: string;
  monitoringDate: string;
  activity: string | null;
  picId: string | null;
  progressPercentage: number | null;
  notes: string | null;
  evidenceUrl: string | null;
  createdBy: string | null;
  createdAt: string;
}

/* ── Laporan & approval ───────────────────────────────────────────────── */

export type BudayaReportType = 'survey' | 'dimensi' | 'unit' | 'periode' | 'trend' | 'tindak_lanjut';
export type BudayaReportStatus = 'draft' | 'diperiksa_komite' | 'disetujui_manajemen' | 'final';

export const BUDAYA_REPORT_STATUS_LABEL: Record<BudayaReportStatus, string> = {
  draft: 'Draft',
  diperiksa_komite: 'Diperiksa Komite Mutu',
  disetujui_manajemen: 'Disetujui Manajemen',
  final: 'Final',
};

export interface BudayaReport {
  id: string;
  surveyId: string;
  reportType: BudayaReportType;
  status: BudayaReportStatus;
  contentSummary: string | null;
  fileUrl: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BudayaApproval {
  id: string;
  reportId: string;
  reviewerId: string | null;
  reviewerName: string | null;
  reviewerPosition: string | null;
  approvedAt: string | null;
  notes: string | null;
  createdAt: string;
}

/* ── Distribusi ───────────────────────────────────────────────────────── */

export type BudayaTokenKind = 'public_link' | 'qr' | 'unique_invitation' | 'access_code';

export interface BudayaSurveyToken {
  id: string;
  surveyId: string;
  token: string;
  kind: BudayaTokenKind;
  unitId: string | null;
  maxUses: number | null;
  usedCount: number;
  expiresAt: string | null;
  createdAt: string;
}

/* ── Peran modul (profiles.budaya_roles) ─────────────────────────────── */
// Sumber: poin BE dokumen instruksi. 'admin' (role dasar) otomatis punya
// semua hak modul ini — lihat has_budaya_role()/is_budaya_reviewer() di SQL.
export type BudayaRole = 'komite_mutu' | 'manajemen' | 'kepala_unit' | 'staff';

export const BUDAYA_ROLE_LABEL: Record<BudayaRole, string> = {
  komite_mutu: 'Komite Mutu',
  manajemen: 'Manajemen',
  kepala_unit: 'Kepala Unit',
  staff: 'Staff',
};

/* ── Quality check (poin BN — blok finalisasi bila ada masalah) ─────────── */

export interface BudayaQualityIssue {
  code: string;
  message: string;
}

export interface BudayaQualityCheckResult {
  passed: boolean;
  issues: BudayaQualityIssue[];
}

/* ── Filter untuk query ──────────────────────────────────────────────── */

export interface BudayaSurveyFilters {
  status?: BudayaSurveyStatus;
  year?: number;
  search?: string;
}
