// ============================================================================
// Modul MANAJEMEN RISIKO
//
// Master data & tipe di file ini diambil LANGSUNG dari dokumen acuan
// "RISK REGISTER .pdf" (RS Ali Sibroh Malisi, tahun 2022-2025) dan dari
// instruksi modul (kategori, skala Probabilitas/Dampak/Controllability,
// batas Risk Matrix). Istilah & urutan dijaga sama persis dengan dokumen —
// lihat komentar "Sumber:" pada tiap konstanta. Mengikuti pola
// src/types/ikp.ts persis (konstanta TS, bukan tabel master bebas-edit).
// ============================================================================

/* ── Tahun Risk Register (poin 25) ───────────────────────────────────────── */
export const RISK_YEARS = [2022, 2023, 2024, 2025, 2026, 2027] as const;

/* ── Status workflow (poin 16, 35) ───────────────────────────────────────── */
export type RiskStatus =
  | 'draft'
  | 'identifikasi'
  | 'dianalisis'
  | 'dievaluasi'
  | 'dalam_mitigasi'
  | 'monitoring'
  | 'review'
  | 'selesai'
  | 'ditutup';

export const RISK_STATUS_FLOW: RiskStatus[] = [
  'draft', 'identifikasi', 'dianalisis', 'dievaluasi', 'dalam_mitigasi',
  'monitoring', 'review', 'selesai', 'ditutup',
];

export const RISK_STATUS_LABEL: Record<RiskStatus, string> = {
  draft: 'Draft',
  identifikasi: 'Identifikasi',
  dianalisis: 'Dianalisis',
  dievaluasi: 'Dievaluasi',
  dalam_mitigasi: 'Dalam Mitigasi',
  monitoring: 'Monitoring',
  review: 'Review',
  selesai: 'Selesai',
  ditutup: 'Ditutup',
};

export const RISK_STATUS_COLOR: Record<RiskStatus, string> = {
  draft: '#94a3b8',
  identifikasi: '#38bdf8',
  dianalisis: '#818cf8',
  dievaluasi: '#c084fc',
  dalam_mitigasi: '#f59e0b',
  monitoring: '#fb923c',
  review: '#f472b6',
  selesai: '#4ade80',
  ditutup: '#22c55e',
};

/* ── Kategori Risiko — Sumber: instruksi modul poin 6 (25 kategori) ─────── */
export type RiskCategory =
  | 'pelayanan_klinis' | 'keselamatan_pasien' | 'ppi' | 'farmasi' | 'laboratorium'
  | 'radiologi' | 'keperawatan' | 'igd' | 'rawat_jalan' | 'rawat_inap' | 'ok_cssd'
  | 'gizi' | 'laundry_linen' | 'kesling' | 'k3rs' | 'ipsrs' | 'it' | 'keuangan'
  | 'rekam_medis' | 'sdm' | 'keamanan' | 'sarana_prasarana' | 'ambulance'
  | 'administrasi' | 'lainnya';

export const RISK_CATEGORIES: { id: RiskCategory; label: string }[] = [
  { id: 'pelayanan_klinis', label: 'Pelayanan Klinis' },
  { id: 'keselamatan_pasien', label: 'Keselamatan Pasien' },
  { id: 'ppi', label: 'PPI' },
  { id: 'farmasi', label: 'Farmasi' },
  { id: 'laboratorium', label: 'Laboratorium' },
  { id: 'radiologi', label: 'Radiologi' },
  { id: 'keperawatan', label: 'Keperawatan' },
  { id: 'igd', label: 'IGD' },
  { id: 'rawat_jalan', label: 'Rawat Jalan' },
  { id: 'rawat_inap', label: 'Rawat Inap' },
  { id: 'ok_cssd', label: 'OK/CSSD' },
  { id: 'gizi', label: 'Gizi' },
  { id: 'laundry_linen', label: 'Laundry/Linen' },
  { id: 'kesling', label: 'Kesling' },
  { id: 'k3rs', label: 'K3RS' },
  { id: 'ipsrs', label: 'IPSRS' },
  { id: 'it', label: 'IT' },
  { id: 'keuangan', label: 'Keuangan' },
  { id: 'rekam_medis', label: 'Rekam Medis' },
  { id: 'sdm', label: 'SDM' },
  { id: 'keamanan', label: 'Keamanan' },
  { id: 'sarana_prasarana', label: 'Sarana Prasarana' },
  { id: 'ambulance', label: 'Ambulance' },
  { id: 'administrasi', label: 'Administrasi' },
  { id: 'lainnya', label: 'Lainnya' },
];

/* ── Unit/Lokasi — Sumber: dokumen Risk Register (lebih luas dari UNIT_MAP
   indikator INM, karena mencakup seluruh area operasional RS) ───────────── */
export const RISK_UNITS: string[] = [
  'IGD', 'Rawat Jalan', 'Rawat Inap', 'ICU', 'VK', 'Perinatologi', 'OK/CSSD',
  'Fisioterapi', 'Laboratorium', 'Radiologi', 'Farmasi', 'PPI', 'Gizi',
  'Laundry/Linen', 'Kesling', 'Keamanan', 'IT', 'Keuangan', 'Rekam Medis',
  'SDM', 'Marketing', 'Ambulance', 'Area Parkir', 'Lift', 'Sarana Umum',
  'Nurse Station', 'Semua Ruang Kerja', 'Lainnya',
];

/* ── PROBABILITAS — Sumber: dokumen, skala 1-5 (poin 8) ──────────────────── */
export type RiskProbabilitas = 1 | 2 | 3 | 4 | 5;

export const RISK_PROBABILITAS_SCALE: { value: RiskProbabilitas; label: string; description: string; percentage: string }[] = [
  { value: 1, label: 'Hampir Tidak Terjadi', description: 'Peristiwa hanya akan timbul pada kondisi yang luar biasa', percentage: '0–10%' },
  { value: 2, label: 'Jarang Terjadi', description: 'Peristiwa diharapkan tidak terjadi', percentage: '>10–30%' },
  { value: 3, label: 'Mungkin/Kadang Terjadi', description: 'Peristiwa kadang-kadang bisa terjadi', percentage: '>30–50%' },
  { value: 4, label: 'Sering Terjadi', description: 'Peristiwa sangat mungkin terjadi pada sebagian kondisi', percentage: '>50–90%' },
  { value: 5, label: 'Hampir Pasti Terjadi', description: 'Peristiwa selalu terjadi/hampir pada setiap kondisi', percentage: '>90%' },
];

/* ── DAMPAK — Sumber: dokumen, skala 1-5 (poin 9) ────────────────────────── */
export type RiskDampak = 1 | 2 | 3 | 4 | 5;

export const RISK_DAMPAK_SCALE: { value: RiskDampak; label: string; description: string[] }[] = [
  {
    value: 1, label: 'Sangat Rendah',
    description: [
      'Tidak berdampak pada pencapaian tujuan secara umum',
      'Agak mengganggu pelayanan',
      'Dampak dapat ditangani dalam kegiatan rutin',
      'Kerugian kurang material',
    ],
  },
  {
    value: 2, label: 'Rendah',
    description: [
      'Mengganggu pencapaian tujuan meskipun signifikan',
      'Cukup mengganggu pelayanan',
      'Mengancam efisiensi beberapa aspek program',
    ],
  },
  {
    value: 3, label: 'Sedang',
    description: [
      'Mengganggu pencapaian tujuan secara signifikan',
      'Mengganggu kegiatan pelayanan secara signifikan',
      'Mengganggu administrasi program',
      'Kerugian keuangan cukup besar',
    ],
  },
  {
    value: 4, label: 'Tinggi',
    description: [
      'Sebagian tujuan gagal dilaksanakan',
      'Pelayanan terganggu lebih dari 2 hari tetapi kurang dari 1 minggu',
      'Mengancam fungsi program',
      'Kerugian besar',
    ],
  },
  {
    value: 5, label: 'Sangat Tinggi',
    description: [
      'Sebagian besar tujuan gagal dilaksanakan',
      'Pelayanan terganggu lebih dari 1 minggu',
      'Mengancam program, organisasi, dan stakeholders',
      'Kerugian sangat besar',
    ],
  },
];

/* ── CONTROLLABILITY — Sumber: dokumen, skala 1-5 (poin 10) ──────────────── */
export type RiskControllability = 1 | 2 | 3 | 4 | 5;

export const RISK_CONTROLLABILITY_SCALE: { value: RiskControllability; label: string; definition: string; detection: string }[] = [
  { value: 1, label: 'Almost Always Detected Immediately', definition: 'Certain to Detect', detection: '10 out of 10' },
  { value: 2, label: 'Likely to be Detected', definition: 'High Likelihood', detection: '7 out of 10' },
  { value: 3, label: 'Moderate Likelihood of Detection', definition: 'Moderate Likelihood', detection: '5 out of 10' },
  { value: 4, label: 'Unlikely to be Detected', definition: 'Low Likelihood', detection: '2 out of 10' },
  { value: 5, label: 'Almost Certain Not to Detect', definition: 'Detection Not Possible at Any Point', detection: '0 out of 10' },
];

/* ── Level Risiko (dipakai baik untuk SKOR RISIKO maupun Risk Matrix,
   labelnya sama; batas angkanya BERBEDA — lihat matrix vs skor di bawah) ── */
export type RiskLevel = 'sangat_rendah' | 'rendah' | 'sedang' | 'tinggi' | 'sangat_tinggi';

export const RISK_LEVEL_LABEL: Record<RiskLevel, string> = {
  sangat_rendah: 'Sangat Rendah',
  rendah: 'Rendah',
  sedang: 'Sedang',
  tinggi: 'Tinggi',
  sangat_tinggi: 'Sangat Tinggi',
};

export const RISK_LEVEL_COLOR: Record<RiskLevel, string> = {
  sangat_rendah: '#4ade80',
  rendah: '#a3e635',
  sedang: '#facc15',
  tinggi: '#fb923c',
  sangat_tinggi: '#ef4444',
};

/** Batas level Risk Matrix (Probabilitas x Dampak SAJA) — Sumber: dokumen, poin 12.
 *  Sangat Tinggi: >15 | Tinggi: 10-14 | Sedang: 5-9 | Rendah: 3-4 | Sangat Rendah: 1-2 */
export function matrixLevelFromScore(score: number): RiskLevel {
  if (score > 15) return 'sangat_tinggi';
  if (score >= 10) return 'tinggi';
  if (score >= 5) return 'sedang';
  if (score >= 3) return 'rendah';
  return 'sangat_rendah';
}

/** Level SKOR RISIKO (Dampak x Probabilitas x Controllability, rentang 1-125).
 *  TERPISAH dari Risk Matrix (poin 12) — ambang disusun proporsional terhadap
 *  rentang efektif skor gabungan tiga faktor ("Perlu konfirmasi" bila RS
 *  memiliki kebijakan ambang skor final tersendiri). */
export function skorLevelFromScore(score: number): RiskLevel {
  if (score >= 60) return 'sangat_tinggi';
  if (score >= 30) return 'tinggi';
  if (score >= 12) return 'sedang';
  if (score >= 4) return 'rendah';
  return 'sangat_rendah';
}

/* ── Evaluasi Risiko — Sumber: instruksi modul poin 14 ───────────────────── */
export type RiskEvaluationDecision =
  | 'diterima' | 'perlu_mitigasi' | 'prioritas_tinggi'
  | 'perlu_eskalasi' | 'perlu_investigasi' | 'perlu_monitoring';

export const RISK_EVALUATION_LABEL: Record<RiskEvaluationDecision, string> = {
  diterima: 'Diterima',
  perlu_mitigasi: 'Perlu Mitigasi',
  prioritas_tinggi: 'Prioritas Tinggi',
  perlu_eskalasi: 'Perlu Eskalasi',
  perlu_investigasi: 'Perlu Investigasi',
  perlu_monitoring: 'Perlu Monitoring',
};

/* ── Status Mitigasi — Sumber: instruksi modul poin 15-16 ────────────────── */
export type RiskMitigationStatus = 'belum_dimulai' | 'berjalan' | 'menunggu_verifikasi' | 'selesai' | 'terlambat';

export const RISK_MITIGATION_STATUS_LABEL: Record<RiskMitigationStatus, string> = {
  belum_dimulai: 'Belum Dimulai',
  berjalan: 'Berjalan',
  menunggu_verifikasi: 'Menunggu Verifikasi',
  selesai: 'Selesai',
  terlambat: 'Terlambat',
};

export const RISK_MITIGATION_STATUS_COLOR: Record<RiskMitigationStatus, string> = {
  belum_dimulai: '#94a3b8',
  berjalan: '#38bdf8',
  menunggu_verifikasi: '#c084fc',
  selesai: '#22c55e',
  terlambat: '#ef4444',
};

/* ── Keputusan Review — Sumber: instruksi modul poin 18 ──────────────────── */
export type RiskReviewDecision =
  | 'risiko_menurun' | 'risiko_tetap' | 'risiko_meningkat'
  | 'risiko_dapat_ditutup' | 'mitigasi_dilanjutkan' | 'mitigasi_diperbaiki';

export const RISK_REVIEW_DECISION_LABEL: Record<RiskReviewDecision, string> = {
  risiko_menurun: 'Risiko Menurun',
  risiko_tetap: 'Risiko Tetap',
  risiko_meningkat: 'Risiko Meningkat',
  risiko_dapat_ditutup: 'Risiko Dapat Ditutup',
  mitigasi_dilanjutkan: 'Mitigasi Dilanjutkan',
  mitigasi_diperbaiki: 'Mitigasi Diperbaiki',
};

/* ── Peran RBAC khusus modul Risiko — Sumber: instruksi modul poin 29 ────── */
export type RiskRole = 'manajemen' | 'pj_mutu' | 'risk_owner' | 'staff_unit' | 'direktur';

export const RISK_ROLE_LABEL: Record<RiskRole, string> = {
  manajemen: 'Manajemen',
  pj_mutu: 'PJ Mutu',
  risk_owner: 'Risk Owner / PIC',
  staff_unit: 'Staff Unit',
  direktur: 'Direktur/Kepala Klinik',
};

/* ── Model data ───────────────────────────────────────────────────────────── */

export interface RiskAssessment {
  id: string;
  riskId: string;
  probabilitas: RiskProbabilitas;
  dampak: RiskDampak;
  controllability: RiskControllability;
  skorRisiko: number;          // generated: dampak x probabilitas x controllability
  levelSkor: RiskLevel;        // generated
  matrixScore: number;         // generated: dampak x probabilitas
  matrixLevel: RiskLevel;      // generated
  evaluationDecision?: RiskEvaluationDecision | null;
  evaluatedBy?: string | null;
  evaluatedAt?: string | null;
  analyzedBy?: string | null;
  analyzedAt: string;
  updatedAt: string;
}

export interface RiskMitigation {
  id: string;
  riskId: string;
  strategi?: string | null;
  rencanaTindakan: string;
  tujuanTindakan?: string | null;
  picId?: string | null;
  picName?: string | null;
  tanggalMulai?: string | null;
  targetPenyelesaian?: string | null;
  indikatorKeberhasilan?: string | null;
  targetCapaian?: string | null;
  sumberDaya?: string | null;
  anggaran?: number | null;
  status: RiskMitigationStatus;
  progressPercent: number;
  buktiTindakLanjut?: string | null;
  catatan?: string | null;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RiskMonitoring {
  id: string;
  riskId: string;
  mitigationId?: string | null;
  tanggal: string;
  aktivitas: string;
  picName?: string | null;
  catatan?: string | null;
  progressPercent?: number | null;
  bukti?: string | null;
  createdBy?: string | null;
  createdAt: string;
}

export interface RiskReview {
  id: string;
  riskId: string;
  reviewDate: string;
  kondisiSaatIni?: string | null;
  masihTerjadi?: boolean | null;
  mitigasiDilakukan?: boolean | null;
  mitigasiEfektif?: boolean | null;
  probabilitasBaru?: RiskProbabilitas | null;
  dampakBaru?: RiskDampak | null;
  controllabilityBaru?: RiskControllability | null;
  skorResidual?: number | null;
  levelResidual?: RiskLevel | null;
  keputusan?: RiskReviewDecision | null;
  reviewedBy?: string | null;
  createdAt: string;
}

export interface RiskAttachment {
  id: string;
  riskId: string;
  filename: string;
  storageKey: string;
  mimeType?: string | null;
  sizeBytes?: number | null;
  uploadedBy?: string | null;
  createdAt: string;
}

export interface RiskHistoryEntry {
  id: string;
  riskId: string;
  fromStatus?: string | null;
  toStatus: string;
  changedBy?: string | null;
  note?: string | null;
  createdAt: string;
}

export interface Risk {
  id: string;
  riskCode: string;
  riskYear: number;
  identifiedDate: string;
  unitLokasi: string;
  category: RiskCategory;
  subcategory?: string | null;
  risiko: string;
  sebabInsiden: string;
  efekDampak: string;
  prosesTerdampak?: string | null;
  dokumenSpoTerkait?: string | null;
  kontrolExisting?: string | null;
  buktiPendukung?: string | null;
  sourceIkpIncidentId?: string | null;
  sourceAuditRef?: string | null;
  status: RiskStatus;
  riskOwnerId?: string | null;
  riskOwnerName?: string | null;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
  closedAt?: string | null;
  // Joined (opsional, tergantung query):
  assessment?: RiskAssessment | null;
}

export interface RiskFilters {
  year?: number;
  unit?: string;
  category?: RiskCategory;
  level?: RiskLevel;
  status?: RiskStatus;
  ownerId?: string;
  search?: string;
}

export interface RiskAuditEntry {
  id: string;
  type: 'risk';
  msg: string;
  badge: string;
  ts: string;
  userId?: string;
  unitId?: string;
  entityType?: string;
  entityId?: string;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  createdAt: string;
}
