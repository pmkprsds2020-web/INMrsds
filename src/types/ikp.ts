// ============================================================================
// Modul Pelaporan Insiden Keselamatan Pasien (IKP)
//
// Master data & tipe di file ini diambil SELANGSUNG dari dokumen acuan
// "FORMAT LAPORAN INSIDEN ke Tim Keselamatan Pasien" (form Insiden
// KNC/KTC/KTD/Sentinel dan form KPC). Istilah & urutan pilihan dijaga sama
// persis dengan dokumen — lihat komentar "Sumber:" pada tiap konstanta.
//
// Bagian yang TIDAK ada di dokumen (mis. metode investigasi, faktor
// kontributor RCA) ditandai "Perlu konfirmasi" dan dibangun mengikuti
// praktik umum manajemen risiko RS, bukan aturan baku dari dokumen.
// ============================================================================

/* ── Jenis formulir ───────────────────────────────────────────────────── */
export type IkpReportKind = 'insiden' | 'kpc';

export const IKP_REPORT_KIND_LABEL: Record<IkpReportKind, string> = {
  insiden: 'Laporan Insiden (KNC / KTC / KTD / Sentinel)',
  kpc: 'Laporan Kondisi Potensial Cedera (KPC)',
};

/* ── Status workflow ──────────────────────────────────────────────────── */
export type IkpStatus =
  | 'draft'
  | 'dilaporkan'
  | 'diverifikasi'
  | 'investigasi'
  | 'analisis'
  | 'rencana_tindak_lanjut'
  | 'pelaksanaan'
  | 'verifikasi_penyelesaian'
  | 'selesai';

export const IKP_STATUS_FLOW: IkpStatus[] = [
  'draft',
  'dilaporkan',
  'diverifikasi',
  'investigasi',
  'analisis',
  'rencana_tindak_lanjut',
  'pelaksanaan',
  'verifikasi_penyelesaian',
  'selesai',
];

export const IKP_STATUS_LABEL: Record<IkpStatus, string> = {
  draft: 'Draft',
  dilaporkan: 'Dilaporkan',
  diverifikasi: 'Diverifikasi',
  investigasi: 'Investigasi',
  analisis: 'Analisis',
  rencana_tindak_lanjut: 'Rencana Tindak Lanjut',
  pelaksanaan: 'Pelaksanaan',
  verifikasi_penyelesaian: 'Verifikasi Penyelesaian',
  selesai: 'Selesai',
};

export const IKP_STATUS_COLOR: Record<IkpStatus, string> = {
  draft: '#94a3b8',
  dilaporkan: '#38bdf8',
  diverifikasi: '#818cf8',
  investigasi: '#f59e0b',
  analisis: '#fb923c',
  rencana_tindak_lanjut: '#c084fc',
  pelaksanaan: '#f472b6',
  verifikasi_penyelesaian: '#4ade80',
  selesai: '#22c55e',
};

/* ── Usia pasien — Sumber: dokumen, tabel kelompok umur ───────────────── */
export type IkpAgeGroup =
  | '0_1_bulan' | '1bulan_1tahun' | '1_5tahun' | '5_15tahun'
  | '15_30tahun' | '30_65tahun' | 'diatas_65tahun';

export const IKP_AGE_GROUPS: { id: IkpAgeGroup; label: string }[] = [
  { id: '0_1_bulan', label: '0 – 1 bulan' },
  { id: '1bulan_1tahun', label: '> 1 bulan – 1 tahun' },
  { id: '1_5tahun', label: '> 1 tahun – 5 tahun' },
  { id: '5_15tahun', label: '> 5 tahun – 15 tahun' },
  { id: '15_30tahun', label: '> 15 tahun – 30 tahun' },
  { id: '30_65tahun', label: '> 30 tahun – 65 tahun' },
  { id: 'diatas_65tahun', label: '> 65 tahun' },
];

/* ── Jenis kelamin — Sumber: dokumen ──────────────────────────────────── */
export type IkpGender = 'laki_laki' | 'perempuan';
export const IKP_GENDERS: { id: IkpGender; label: string }[] = [
  { id: 'laki_laki', label: 'Laki-laki' },
  { id: 'perempuan', label: 'Perempuan' },
];

/* ── Penanggung biaya pasien — Sumber: dokumen ────────────────────────── */
export type IkpPayerType =
  | 'umum' | 'asuransi_swasta' | 'bpjs_kesehatan' | 'perusahaan'
  | 'bpjs_pbi' | 'jaminan_kesehatan_daerah';

export const IKP_PAYER_TYPES: { id: IkpPayerType; label: string }[] = [
  { id: 'umum', label: 'Umum' },
  { id: 'asuransi_swasta', label: 'Asuransi Swasta' },
  { id: 'bpjs_kesehatan', label: 'BPJS Kesehatan' },
  { id: 'perusahaan', label: 'Perusahaan' },
  { id: 'bpjs_pbi', label: 'BPJS PBI' },
  { id: 'jaminan_kesehatan_daerah', label: 'Jaminan Kesehatan Daerah' },
];

/* ── Jenis insiden — Sumber: dokumen ──────────────────────────────────────
   PERLU KONFIRMASI: dokumen menuliskan KTD dan Kejadian Sentinel sebagai
   SATU baris pilihan ("KTD (Adverse Event) / Kejadian Sentinel"). Di sini
   keduanya digabung sebagai satu nilai `ktd_sentinel`, dengan sub-penanda
   `isSentinel` terpisah di form. Jika Tim Keselamatan Pasien RS menghendaki
   Kejadian Sentinel sebagai kategori TERPISAH (mis. karena butuh eskalasi/
   RCA wajib berbeda), skema & form perlu disesuaikan. ─────────────────── */
export type IkpIncidentType = 'knc' | 'ktc' | 'ktd_sentinel';

export const IKP_INCIDENT_TYPES: { id: IkpIncidentType; label: string; description: string }[] = [
  {
    id: 'knc',
    label: 'KNC — Kejadian Nyaris Cedera (Near miss)',
    description: 'Insiden yang belum sampai terpapar ke pasien / tidak menimbulkan cedera.',
  },
  {
    id: 'ktc',
    label: 'KTC — Kejadian Tidak Cedera (No harm)',
    description: 'Insiden sudah terpapar ke pasien, namun tidak menimbulkan cedera.',
  },
  {
    id: 'ktd_sentinel',
    label: 'KTD / Kejadian Sentinel — Kejadian Tidak Diharapkan (Adverse Event)',
    description: 'Insiden yang mengakibatkan cedera pada pasien; termasuk kejadian sentinel bila berdampak sangat serius (lihat isSentinel pada laporan).',
  },
];

/* ── Orang pertama yang melaporkan — Sumber: dokumen ──────────────────── */
export type IkpReporterCategory = 'karyawan' | 'pasien' | 'keluarga_pendamping' | 'pengunjung' | 'lain_lain';

export const IKP_REPORTER_CATEGORIES: { id: IkpReporterCategory; label: string }[] = [
  { id: 'karyawan', label: 'Karyawan: Dokter / Perawat / Petugas lainnya' },
  { id: 'pasien', label: 'Pasien' },
  { id: 'keluarga_pendamping', label: 'Keluarga / Pendamping Pasien' },
  { id: 'pengunjung', label: 'Pengunjung' },
  { id: 'lain_lain', label: 'Lain-lain (sebutkan)' },
];

/* ── Insiden terjadi pada — Sumber: dokumen ───────────────────────────────
   Catatan dokumen: bila BUKAN pasien (karyawan/pengunjung/pendamping/
   keluarga), pelaporan diarahkan ke K3 (Kesehatan & Keselamatan Kerja),
   bukan ke jalur keselamatan pasien. PERLU KONFIRMASI apakah aplikasi perlu
   membuat jalur/notifikasi terpisah ke unit K3 untuk kasus ini. ─────────── */
export type IkpIncidentSubject = 'pasien' | 'lain_lain';
export const IKP_INCIDENT_SUBJECTS: { id: IkpIncidentSubject; label: string }[] = [
  { id: 'pasien', label: 'Pasien' },
  { id: 'lain_lain', label: 'Lain-lain (sebutkan) — mis. karyawan/pengunjung/pendamping/keluarga, lapor ke K3' },
];

/* ── Insiden menyangkut pasien (jenis pelayanan) — Sumber: dokumen ────── */
export type IkpPatientServiceType = 'rawat_inap' | 'rawat_jalan' | 'igd' | 'lain_lain';
export const IKP_PATIENT_SERVICE_TYPES: { id: IkpPatientServiceType; label: string }[] = [
  { id: 'rawat_inap', label: 'Pasien Rawat Inap' },
  { id: 'rawat_jalan', label: 'Pasien Rawat Jalan' },
  { id: 'igd', label: 'Pasien IGD' },
  { id: 'lain_lain', label: 'Lain-lain (sebutkan)' },
];

/* ── Unit pelayanan tempat pasien dirawat — Sumber: dokumen ───────────── */
export const IKP_SERVICE_UNITS: string[] = [
  'IGD',
  'Poli Penyakit Dalam',
  'Poli Anak',
  'Poli Obsgyn',
  'Poli Paru',
  'Poli Mata',
  'Poli THT',
  'Poli Bedah',
  'Rawat Inap',
  'Lainnya',
];

/* ── Akibat insiden terhadap pasien — Sumber: dokumen ──────────────────── */
export type IkpPatientImpact =
  | 'kematian' | 'cedera_irreversibel_berat' | 'cedera_reversibel_sedang'
  | 'cedera_ringan' | 'tidak_ada_cedera';

export const IKP_PATIENT_IMPACTS: { id: IkpPatientImpact; label: string }[] = [
  { id: 'kematian', label: 'Kematian' },
  { id: 'cedera_irreversibel_berat', label: 'Cedera Irreversibel / Cedera Berat' },
  { id: 'cedera_reversibel_sedang', label: 'Cedera Reversibel / Cedera Sedang' },
  { id: 'cedera_ringan', label: 'Cedera Ringan' },
  { id: 'tidak_ada_cedera', label: 'Tidak Ada Cedera' },
];

/* ── Tindakan dilakukan oleh — Sumber: dokumen ─────────────────────────── */
export type IkpActionTakenBy = 'tim' | 'dokter' | 'perawat' | 'petugas_lain';
export const IKP_ACTION_TAKEN_BY: { id: IkpActionTakenBy; label: string }[] = [
  { id: 'tim', label: 'Tim (terdiri dari...)' },
  { id: 'dokter', label: 'Dokter' },
  { id: 'perawat', label: 'Perawat' },
  { id: 'petugas_lain', label: 'Petugas lainnya' },
];

/* ── Grading risiko — Sumber: dokumen (Biru/Hijau/Kuning/Merah) ─────────
   PERLU KONFIRMASI: dokumen tidak mencantumkan definisi/matriks probabilitas
   x dampak untuk tiap warna. Definisi & konsekuensi workflow di bawah ini
   memakai matriks grading risiko umum RS Indonesia (Panduan KKPRS/
   Permenkes 11/2017) sebagai default sementara — Tim Keselamatan Pasien RS
   perlu mengonfirmasi apakah matriks resmi RS ini sama. ────────────────── */
export type IkpSeverityGrade = 'biru' | 'hijau' | 'kuning' | 'merah';

export interface IkpSeverityMeta {
  id: IkpSeverityGrade;
  label: string;
  color: string;
  definition: string;
  investigationRequired: boolean;
  investigationNote: string;
}

export const IKP_SEVERITY_GRADES: IkpSeverityMeta[] = [
  {
    id: 'biru',
    label: 'Biru',
    color: '#3b82f6',
    definition: 'Risiko rendah — dampak minimal, kemungkinan terjadi jarang.',
    investigationRequired: false,
    investigationNote: 'Investigasi sederhana oleh atasan langsung / kepala unit.',
  },
  {
    id: 'hijau',
    label: 'Hijau',
    color: '#22c55e',
    definition: 'Risiko rendah–sedang — dampak ringan, kemungkinan terjadi cukup sering.',
    investigationRequired: false,
    investigationNote: 'Investigasi sederhana oleh atasan langsung / kepala unit.',
  },
  {
    id: 'kuning',
    label: 'Kuning',
    color: '#eab308',
    definition: 'Risiko tinggi — dampak sedang–berat, perlu perhatian manajemen.',
    investigationRequired: true,
    investigationNote: 'Investigasi komprehensif / RCA oleh Tim Keselamatan Pasien, maksimal 45 hari.',
  },
  {
    id: 'merah',
    label: 'Merah',
    color: '#ef4444',
    definition: 'Risiko ekstrem — dampak berat/kematian atau kejadian sentinel.',
    investigationRequired: true,
    investigationNote: 'Investigasi komprehensif / RCA wajib, dilaporkan ke pimpinan RS, maksimal 45 hari.',
  },
];

export function getSeverityMeta(grade: IkpSeverityGrade | null | undefined): IkpSeverityMeta | undefined {
  return IKP_SEVERITY_GRADES.find((g) => g.id === grade);
}

/* ── Metode investigasi — PERLU KONFIRMASI (tidak ada di dokumen) ─────── */
export const IKP_INVESTIGATION_METHODS: string[] = [
  'Investigasi Sederhana',
  'Root Cause Analysis (RCA)',
  '5 Why',
  'Fishbone / Ishikawa',
  'Lainnya',
];

/* ── Faktor kontributor — PERLU KONFIRMASI (tidak ada di dokumen) ─────── */
export type IkpContributingFactor = 'manusia' | 'sistem' | 'lingkungan' | 'komunikasi' | 'organisasi';
export const IKP_CONTRIBUTING_FACTORS: { id: IkpContributingFactor; label: string }[] = [
  { id: 'manusia', label: 'Faktor Manusia' },
  { id: 'sistem', label: 'Masalah Sistem' },
  { id: 'lingkungan', label: 'Faktor Lingkungan' },
  { id: 'komunikasi', label: 'Faktor Komunikasi' },
  { id: 'organisasi', label: 'Faktor Organisasi' },
];

/* ── Tindak lanjut ─────────────────────────────────────────────────────── */
export type IkpActionType = 'corrective' | 'preventive';
export type IkpActionPriority = 'rendah' | 'sedang' | 'tinggi';
export type IkpActionStatus = 'belum_dimulai' | 'berjalan' | 'menunggu_verifikasi' | 'selesai' | 'terlambat';

export const IKP_ACTION_STATUS_LABEL: Record<IkpActionStatus, string> = {
  belum_dimulai: 'Belum Dimulai',
  berjalan: 'Berjalan',
  menunggu_verifikasi: 'Menunggu Verifikasi',
  selesai: 'Selesai',
  terlambat: 'Terlambat',
};

export const IKP_ACTION_PRIORITY_LABEL: Record<IkpActionPriority, string> = {
  rendah: 'Rendah',
  sedang: 'Sedang',
  tinggi: 'Tinggi',
};

/* ── Peran modul IKP — tambahan di atas role dasar 'user'/'admin' ─────── */
export type IkpRole = 'verifikator' | 'tim_mutu' | 'pimpinan';
export const IKP_ROLE_LABEL: Record<IkpRole, string> = {
  verifikator: 'Verifikator',
  tim_mutu: 'Tim Mutu / Keselamatan Pasien',
  pimpinan: 'Pimpinan',
};

/* ── Batas waktu pelaporan — Sumber: dokumen ("maksimal 2x24 jam") ────── */
export const IKP_REPORTING_DEADLINE_HOURS = 48;

/* ============================================================================
 * Interfaces baris data
 * ========================================================================== */

export interface IkpIncident {
  id: string;
  reportNumber: string;
  reportKind: IkpReportKind;
  status: IkpStatus;

  reportDate: string;
  reportTime: string | null;
  reporterId: string | null;
  reporterName: string | null;
  reporterUnit: string | null;
  reporterProfession: string | null;
  reporterContact: string | null;
  isAnonymous: boolean;
  tempat: string | null;

  patientName: string | null;
  patientMrNumber: string | null;
  patientRoom: string | null;
  patientAgeGroup: IkpAgeGroup | null;
  patientGender: IkpGender | null;
  payerType: IkpPayerType | null;
  admissionDate: string | null;
  admissionTime: string | null;

  incidentDate: string | null;
  incidentTime: string | null;
  incidentSummary: string | null;
  chronology: string | null;
  incidentType: IkpIncidentType | null;
  isSentinel: boolean;
  reportedByCategory: IkpReporterCategory | null;
  reportedByDetail: string | null;
  incidentSubject: IkpIncidentSubject | null;
  incidentSubjectDetail: string | null;
  patientServiceType: IkpPatientServiceType | null;
  incidentLocation: string | null;
  patientServiceUnit: string | null;
  patientServiceUnitOther: string | null;
  causingUnit: string | null;
  patientImpact: IkpPatientImpact | null;
  immediateAction: string | null;
  immediateActionResult: string | null;
  actionTakenBy: IkpActionTakenBy | null;
  actionTakenByDetail: string | null;
  recurrenceElsewhere: boolean | null;
  recurrenceDetail: string | null;

  kpcDescription: string | null;
  kpcLocation: string | null;
  kpcRelatedUnit: string | null;

  severityGrade: IkpSeverityGrade | null;
  severitySetBy: string | null;
  severitySetAt: string | null;
  investigationRequired: boolean | null;

  reportMakerName: string | null;
  reportReceiverName: string | null;
  reportReceiverId: string | null;
  reportReceivedDate: string | null;

  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  verifiedAt: string | null;
  closedAt: string | null;
}

export interface IkpInvestigation {
  id: string;
  incidentId: string;
  investigatorId: string | null;
  investigatorName: string | null;
  method: string | null;
  startedAt: string | null;
  completedAt: string | null;
  findings: string | null;
  rootCause: string | null;
  contributingFactors: IkpContributingFactor[];
  contributingFactorsDetail: string | null;
  recommendation: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IkpAction {
  id: string;
  incidentId: string;
  action: string;
  actionType: IkpActionType | null;
  picId: string | null;
  picName: string | null;
  unit: string | null;
  priority: IkpActionPriority | null;
  dueDate: string | null;
  status: IkpActionStatus;
  completedAt: string | null;
  evidenceNote: string | null;
  verifierId: string | null;
  verificationResult: string | null;
  verifiedAt: string | null;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IkpAttachment {
  id: string;
  incidentId: string;
  actionId: string | null;
  filename: string;
  storageKey: string;
  mimeType: string | null;
  sizeBytes: number | null;
  uploadedBy: string | null;
  createdAt: string;
}

export interface IkpAuditEntry {
  id: string;
  type: 'ikp';
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

/** Filter yang dipakai bersama oleh Dashboard IKP, Daftar Insiden, dan Laporan IKP. */
export interface IkpFilters {
  startDate?: string;
  endDate?: string;
  dateField?: 'incident' | 'report';
  unit?: string;
  incidentType?: IkpIncidentType;
  severityGrade?: IkpSeverityGrade;
  status?: IkpStatus;
  reportKind?: IkpReportKind;
  search?: string;
}
