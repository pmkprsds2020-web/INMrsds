// ============================================================================
// Modul Usulan Indikator Mutu Unit (UIMU) — tipe & konstanta.
// Mengikuti pola src/types/ikp.ts: interface TS di boundary camelCase
// (row<->model mapping ada di src/lib/uimuData.ts), daftar pilihan tetap
// (dropdown/checklist) disimpan sebagai konstanta di sini, BUKAN tabel
// master terpisah — kecuali Master Unit (uimu_units), yang memang diminta
// dinamis/dikelola admin (lihat supabase/migration_usulan_indikator.sql §1).
// ============================================================================

export type UimuStatus =
  | 'draft'
  | 'diajukan'
  | 'review_unit'
  | 'dikembalikan'
  | 'telaah_mutu'
  | 'revisi'
  | 'disetujui'
  | 'ditetapkan'
  | 'aktif'
  | 'tidak_disetujui'
  | 'tidak_aktif';

export const UIMU_STATUS_LABEL: Record<UimuStatus, string> = {
  draft: 'Draft',
  diajukan: 'Diajukan',
  review_unit: 'Review Unit',
  dikembalikan: 'Dikembalikan',
  telaah_mutu: 'Telaah Mutu',
  revisi: 'Revisi',
  disetujui: 'Disetujui',
  ditetapkan: 'Ditetapkan',
  aktif: 'Aktif',
  tidak_disetujui: 'Tidak Disetujui',
  tidak_aktif: 'Tidak Aktif',
};

/** Warna badge per status (dipakai StatusBadge di semua komponen UIMU), format sama seperti IKP_STATUS_COLOR. */
export const UIMU_STATUS_COLOR: Record<UimuStatus, string> = {
  draft: '#94a3b8',
  diajukan: '#38bdf8',
  review_unit: '#f59e0b',
  dikembalikan: '#fb7185',
  telaah_mutu: '#a78bfa',
  revisi: '#f87171',
  disetujui: '#4ade80',
  ditetapkan: '#22c55e',
  aktif: '#16a34a',
  tidak_disetujui: '#ef4444',
  tidak_aktif: '#64748b',
};

/** Urutan progress workflow yang ditampilkan sebagai stepper (poin 24). */
export const UIMU_WORKFLOW_STEPS: { status: UimuStatus; label: string }[] = [
  { status: 'draft', label: 'Draft' },
  { status: 'review_unit', label: 'Review Unit' },
  { status: 'telaah_mutu', label: 'Telaah Mutu' },
  { status: 'disetujui', label: 'Persetujuan' },
  { status: 'ditetapkan', label: 'Penetapan' },
  { status: 'aktif', label: 'Aktif' },
];

export type UimuReviewStage = 'review_unit' | 'telaah_mutu' | 'approval';
export type UimuRevisionDecision = 'dikembalikan' | 'revisi' | 'disetujui' | 'ditolak';
export type UimuApprovalStage = 'pengusul' | 'kepala_unit' | 'komite_mutu' | 'manajemen';
export type UimuApprovalDecision = 'mengirim' | 'menyetujui' | 'menolak' | 'meminta_revisi';

export const INDICATOR_CATEGORY_OPTIONS = [
  { value: 'inm', label: 'INM (Indikator Nasional Mutu)' },
  { value: 'imp_rs', label: 'IMP-RS (Indikator Mutu Prioritas Rumah Sakit)' },
  { value: 'imp_unit', label: 'IMP-Unit (Indikator Mutu Prioritas Unit)' },
  { value: 'lainnya', label: 'Indikator mutu lainnya' },
] as const;

export const QUALITY_DIMENSION_OPTIONS = [
  { value: 'keselamatan', label: 'Keselamatan' },
  { value: 'efektivitas', label: 'Efektivitas' },
  { value: 'efisiensi', label: 'Efisiensi' },
  { value: 'aksesibilitas', label: 'Aksesibilitas' },
  { value: 'berorientasi_pasien', label: 'Berorientasi pada pasien' },
  { value: 'ketepatan_waktu', label: 'Ketepatan waktu' },
  { value: 'keadilan', label: 'Keadilan' },
  { value: 'integrasi_pelayanan', label: 'Integrasi pelayanan' },
  { value: 'lainnya', label: 'Lainnya' },
] as const;

/** 21 aspek pelayanan/manajerial sesuai SPO Penetapan Indikator Mutu. */
export const ASPECT_AREA_OPTIONS = [
  { value: 'pengkajian_pasien', label: 'Aspek pengkajian pasien' },
  { value: 'laboratorium', label: 'Aspek pelayanan laboratorium' },
  { value: 'radiologi', label: 'Aspek pelayanan radiologi' },
  { value: 'prosedur_pembedahan', label: 'Aspek prosedur pembedahan' },
  { value: 'penggunaan_antibiotika', label: 'Aspek penggunaan antibiotika' },
  { value: 'kesalahan_pengobatan_knc', label: 'Aspek pemantauan kesalahan pengobatan dan KNC' },
  { value: 'anestesi_sedasi', label: 'Aspek anestesi dan sedasi' },
  { value: 'penggunaan_produk_darah', label: 'Aspek penggunaan produk darah' },
  { value: 'rekam_medis', label: 'Aspek kelengkapan penggunaan rekam medis pasien' },
  { value: 'pengendalian_infeksi', label: 'Aspek pengendalian infeksi' },
  { value: 'penelitian_klinis', label: 'Aspek penelitian klinis' },
  { value: 'pengadaan_obat_bhp', label: 'Aspek pengadaan obat-obatan dan BHP' },
  { value: 'manajerial', label: 'Aspek manajerial' },
  { value: 'manajemen_risiko', label: 'Aspek manajemen risiko' },
  { value: 'manajemen_peralatan', label: 'Aspek manajemen penggunaan peralatan' },
  { value: 'kepuasan_pelanggan', label: 'Aspek kepuasan pelanggan' },
  { value: 'kepuasan_karyawan', label: 'Aspek harapan dan kepuasan karyawan' },
  { value: 'demografi_diagnosa', label: 'Aspek demografi pasien dan diagnosa klinis' },
  { value: 'manajemen_keuangan', label: 'Aspek manajemen keuangan' },
  { value: 'keselamatan_pasien', label: 'Aspek pencegahan & pengendalian kejadian yang mengancam keselamatan (termasuk IPSG)' },
  { value: 'facility_management_safety', label: 'Aspek Facility Management and Safety' },
  { value: 'lainnya', label: 'Lainnya' },
] as const;

/** Checklist "Alasan/Dasar Pemilihan Indikator" (poin 6). */
export const REASON_CHECKLIST_OPTIONS = [
  { value: 'keselamatan_pasien', label: 'Berdampak terhadap keselamatan pasien' },
  { value: 'variasi_pelayanan', label: 'Terdapat variasi dalam pelayanan' },
  { value: 'masalah_gap', label: 'Terdapat masalah/gap pelayanan' },
  { value: 'risiko_tinggi', label: 'Berhubungan dengan risiko tinggi' },
  { value: 'morbiditas_mortalitas', label: 'Berhubungan dengan morbiditas/mortalitas' },
  { value: 'utilisasi_tinggi', label: 'Berhubungan dengan utilisasi tinggi' },
  { value: 'biaya_tinggi', label: 'Membutuhkan biaya tinggi' },
  { value: 'kepuasan_pasien', label: 'Berhubungan dengan kepuasan pasien' },
  { value: 'efisiensi', label: 'Berhubungan dengan efisiensi' },
  { value: 'inm', label: 'Merupakan INM' },
  { value: 'imp_rs', label: 'Merupakan IMP-RS' },
  { value: 'imp_unit', label: 'Merupakan IMP-Unit' },
  { value: 'rekomendasi_audit', label: 'Rekomendasi hasil audit' },
  { value: 'rekomendasi_manajemen', label: 'Rekomendasi manajemen' },
  { value: 'rekomendasi_komite_mutu', label: 'Rekomendasi Komite Mutu' },
  { value: 'lainnya', label: 'Lainnya' },
] as const;

export const INDICATOR_KIND_OPTIONS = [
  { value: 'struktur', label: 'Struktur' },
  { value: 'proses', label: 'Proses' },
  { value: 'outcome', label: 'Outcome' },
] as const;

export const TARGET_OPERATOR_OPTIONS = [
  { value: 'gte', label: 'Target \u2265 (lebih besar/sama dengan)' },
  { value: 'lte', label: 'Target \u2264 (lebih kecil/sama dengan)' },
  { value: 'eq', label: 'Target = (sama dengan)' },
  { value: 'range', label: 'Rentang nilai (min\u2013maks)' },
] as const;

export const TARGET_SOURCE_OPTIONS = [
  { value: 'data_internal', label: 'Data internal rumah sakit' },
  { value: 'data_rs_lain', label: 'Data rumah sakit lain' },
  { value: 'standar_nasional', label: 'Standar nasional' },
  { value: 'standar_internasional', label: 'Standar internasional' },
  { value: 'evidence_praktik_terbaik', label: 'Evidence / praktik terbaik' },
  { value: 'kesepakatan_internal', label: 'Kesepakatan internal' },
] as const;

/** Skor 1–5, poin 10. Digunakan seragam untuk 8 kriteria skoring. */
export const PRIORITY_SCORE_CRITERIA: { key: PriorityScoreKey; label: string }[] = [
  { key: 'scorePatientSafetyRisk', label: 'Risiko keselamatan pasien' },
  { key: 'scoreGap', label: 'Besarnya gap' },
  { key: 'scoreFrequency', label: 'Frekuensi kejadian' },
  { key: 'scorePatientImpact', label: 'Dampak terhadap pasien' },
  { key: 'scoreHospitalImpact', label: 'Dampak terhadap rumah sakit' },
  { key: 'scoreCostUtilization', label: 'Biaya/utilisasi' },
  { key: 'scoreControllability', label: 'Kemampuan dikendalikan unit' },
  { key: 'scoreStrategicImportance', label: 'Kepentingan strategis' },
];

export type PriorityScoreKey =
  | 'scorePatientSafetyRisk'
  | 'scoreGap'
  | 'scoreFrequency'
  | 'scorePatientImpact'
  | 'scoreHospitalImpact'
  | 'scoreCostUtilization'
  | 'scoreControllability'
  | 'scoreStrategicImportance';

export type PriorityCategory = 'rendah' | 'sedang' | 'tinggi' | 'prioritas';

/** Total skor 8–40 (8 kriteria x 1–5). Ambang batas mudah disesuaikan di sini. */
export function computeUimuPriority(totalScore: number | null | undefined): PriorityCategory {
  const s = totalScore ?? 0;
  if (s >= 33) return 'prioritas';
  if (s >= 25) return 'tinggi';
  if (s >= 17) return 'sedang';
  return 'rendah';
}

export const PRIORITY_CATEGORY_LABEL: Record<PriorityCategory, string> = {
  rendah: 'Rendah',
  sedang: 'Sedang',
  tinggi: 'Tinggi',
  prioritas: 'Prioritas',
};

export const PRIORITY_CATEGORY_COLOR: Record<PriorityCategory, string> = {
  rendah: '#94a3b8',
  sedang: '#38bdf8',
  tinggi: '#f59e0b',
  prioritas: '#ef4444',
};

// ────────────────────────────────────────────────────────────────
// Model utama
// ────────────────────────────────────────────────────────────────

export interface UimuUnit {
  id: string;
  code: string;
  name: string;
  category: string | null;
  isActive: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UimuProposal {
  id: string;
  proposalNumber: string;
  periodYear: number;
  version: number;
  parentProposalId: string | null;
  status: UimuStatus;

  unitId: string | null;
  unitNameSnapshot: string | null;
  subunit: string | null;
  proposerId: string | null;
  proposerName: string | null;
  proposerPosition: string | null;
  proposerEmail: string | null;
  proposerUnitIdHint: string | null;

  indicatorName: string | null;
  indicatorCategory: string | null;
  qualityDimension: string | null;
  qualityDimensionOther: string | null;
  aspectArea: string | null;
  aspectAreaOther: string | null;

  reasonChecklist: string[];
  reasonOther: string | null;
  gapDescription: string | null;

  eligibilityVisiMisi: boolean | null;
  eligibilityEvidenceGap: boolean | null;
  eligibilityImportant: boolean | null;
  eligibilityControllable: boolean | null;
  eligibilityValidated: 'ya' | 'tidak' | 'belum' | null;
  eligibilityQualityPrinciple: 'ya' | 'tidak' | null;
  eligibilityPatientSafety: boolean | null;
  eligibilityRecommendation: 'layak' | 'tidak_layak' | 'perlu_kajian' | null;

  operationalDefinition: string | null;
  indicatorGoal: string | null;
  indicatorKind: 'struktur' | 'proses' | 'outcome' | null;
  numerator: string | null;
  denominator: string | null;
  formula: string | null;
  unitOfMeasure: string | null;
  inclusionCriteria: string | null;
  exclusionCriteria: string | null;
  population: string | null;
  dataSource: string | null;
  collectionMethod: string | null;
  collectionInstrument: string | null;
  picId: string | null;
  picName: string | null;
  collectionFrequency: string | null;
  analysisPeriod: string | null;
  reportingPeriod: string | null;
  notes: string | null;

  targetValue: string | null;
  targetUnit: string | null;
  targetMin: number | null;
  targetMax: number | null;
  targetOperator: 'gte' | 'lte' | 'eq' | 'range' | null;
  nationalStandard: string | null;
  hospitalStandard: string | null;
  unitStandard: string | null;
  targetSource: string | null;
  targetReference: string | null;
  targetYear: number | null;

  scorePatientSafetyRisk: number | null;
  scoreGap: number | null;
  scoreFrequency: number | null;
  scorePatientImpact: number | null;
  scoreHospitalImpact: number | null;
  scoreCostUtilization: number | null;
  scoreControllability: number | null;
  scoreStrategicImportance: number | null;
  totalScore: number | null;

  decreeNumber: string | null;
  establishedDate: string | null;
  establishedBy: string | null;
  rejectionReason: string | null;

  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
}

export interface UimuRevision {
  id: string;
  proposalId: string;
  version: number;
  stage: UimuReviewStage;
  reviewerId: string | null;
  reviewerName: string | null;
  reviewerRole: string | null;
  decision: UimuRevisionDecision;
  comment: string | null;
  fieldsToFix: string[] | null;
  createdAt: string;
}

export interface UimuApproval {
  id: string;
  proposalId: string;
  stage: UimuApprovalStage;
  approverId: string | null;
  approverName: string | null;
  approverPosition: string | null;
  decision: UimuApprovalDecision;
  notes: string | null;
  decidedAt: string;
}

export interface UimuAuditEntry {
  id: string;
  type: 'uimu';
  msg: string;
  badge: string | null;
  ts: string | null;
  userId?: string;
  unitId?: string;
  entityType?: string;
  entityId?: string;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  createdAt: string;
}

export interface UimuFilters {
  periodYear?: number;
  unitId?: string;
  indicatorCategory?: string;
  qualityDimension?: string;
  status?: UimuStatus;
  priority?: PriorityCategory;
  search?: string;
}

export interface UimuDashboardStats {
  total: number;
  byStatus: Record<UimuStatus, number>;
  byUnit: { unitId: string; unitName: string; total: number; disetujui: number; revisi: number; ditolak: number; ditetapkan: number }[];
  byIndicatorCategory: Record<string, number>;
  byQualityDimension: Record<string, number>;
  priorityCount: Record<PriorityCategory, number>;
}
