// Indicator types
export type IndicatorType = 'tangan' | 'visite' | 'identitas' | 'apd' | 'jatuh' | 'sc' | 'wtrj' | 'op' | 'lab' | 'fornas' | 'cp';

// Unit IDs matching Firestore collection names
export type UnitId = 'IGD' | 'Rawat Jalan' | 'Rawat Inap' | 'ICU' | 'Kamar Operasi' | 'VK' | 'Laboratorium' | 'Radiologi' | 'Farmasi';

// Firestore collection name map (unit ID → collection name)
export const UNIT_COLLECTION_MAP: Record<UnitId, string> = {
  'IGD': 'IGD',
  'Rawat Jalan': 'Rawat Jalan',
  'Rawat Inap': 'Rawat Inap',
  'ICU': 'ICU',
  'Kamar Operasi': 'Kamar Operasi',
  'Laboratorium': 'Laboratorium',
  'Radiologi': 'Radiologi',
  'Farmasi': 'Farmasi',
  'VK': 'VK',
};

// Unit metadata
export interface UnitMeta {
  id: UnitId;
  label: string;
  color: string;
  inds: IndicatorType[];
  abbr: string;
}

export const UNIT_MAP: Record<string, UnitMeta> = {
  'all': { id: 'IGD' as UnitId, label: 'Semua Unit', color: '#4f8ef7', inds: ['tangan','visite','identitas','apd','jatuh','sc','wtrj','op','lab','fornas','cp'], abbr: 'ALL' },
  'IGD': { id: 'IGD', label: 'IGD', color: '#f87171', inds: ['tangan','apd','identitas','jatuh'], abbr: 'IG' },
  'Rawat Inap': { id: 'Rawat Inap', label: 'Rawat Inap', color: '#6ee7b7', inds: ['tangan','apd','identitas','visite','jatuh','cp'], abbr: 'RI' },
  'ICU': { id: 'ICU', label: 'ICU', color: '#a78bfa', inds: ['tangan','apd','identitas','jatuh'], abbr: 'IC' },
  'Rawat Jalan': { id: 'Rawat Jalan', label: 'Rawat Jalan', color: '#38bdf8', inds: ['tangan','apd','identitas','wtrj','cp'], abbr: 'RJ' },
  'Kamar Operasi': { id: 'Kamar Operasi', label: 'Kamar Operasi', color: '#fb923c', inds: ['tangan','apd','sc','op'], abbr: 'OK' },
  'VK': { id: 'VK', label: 'VK / Kebidanan', color: '#f472b6', inds: ['tangan','apd','identitas'], abbr: 'VK' },
  'Laboratorium': { id: 'Laboratorium', label: 'Laboratorium', color: '#c084fc', inds: ['tangan','apd','identitas','lab'], abbr: 'LB' },
  'Radiologi': { id: 'Radiologi', label: 'Radiologi', color: '#67e8f9', inds: ['tangan','apd','identitas'], abbr: 'RD' },
  'Farmasi': { id: 'Farmasi', label: 'Farmasi', color: '#4ade80', inds: ['tangan','identitas','fornas'], abbr: 'FM' },
};

// Indicator metadata
export interface IndicatorMeta {
  id: IndicatorType;
  label: string;
  target: number;
  targetLabel: string;
  color: string;
  isLowerBetter: boolean;
  icon: string;
}

export const INDICATORS: IndicatorMeta[] = [
  { id: 'tangan', label: 'Kebersihan Tangan', target: 85, targetLabel: '≥ 85%', color: '#4f8ef7', isLowerBetter: false, icon: 'hand' },
  { id: 'visite', label: 'Kepatuhan Visite', target: 80, targetLabel: '≥ 80%', color: '#6ee7b7', isLowerBetter: false, icon: 'stethoscope' },
  { id: 'identitas', label: 'Identifikasi Pasien', target: 80, targetLabel: '≥ 80%', color: '#a78bfa', isLowerBetter: false, icon: 'scan-line' },
  { id: 'apd', label: 'Kepatuhan APD', target: 100, targetLabel: '100%', color: '#f59e0b', isLowerBetter: false, icon: 'shield' },
  { id: 'jatuh', label: 'Risiko Jatuh', target: 80, targetLabel: '≥ 80%', color: '#34d399', isLowerBetter: false, icon: 'triangle-alert' },
  { id: 'sc', label: 'SC Emergensi', target: 80, targetLabel: '> 80%', color: '#fb923c', isLowerBetter: false, icon: 'clock' },
  { id: 'wtrj', label: 'Waktu Tunggu RJ', target: 80, targetLabel: '≥ 80%', color: '#38bdf8', isLowerBetter: false, icon: 'monitor' },
  { id: 'op', label: 'Penundaan Operasi', target: 5, targetLabel: '≤ 5%', color: '#f87171', isLowerBetter: true, icon: 'scissors' },
  { id: 'lab', label: 'Hasil Kritis Lab', target: 100, targetLabel: '100%', color: '#c084fc', isLowerBetter: false, icon: 'flask-conical' },
  { id: 'fornas', label: 'Kepatuhan Fornas', target: 80, targetLabel: '≥ 80%', color: '#4ade80', isLowerBetter: false, icon: 'pill' },
  { id: 'cp', label: 'Clinical Pathway', target: 80, targetLabel: '≥ 80%', color: '#e879f9', isLowerBetter: false, icon: 'file-text' },
];

// Access rules
export const ACCESS_RULES: Record<string, { owners: string[]; label: string; reason: string }> = {
  'sc': { owners: ['Kamar Operasi'], label: 'SC Emergensi', reason: 'Hanya menjadi tanggung jawab Kamar Operasi.' },
  'fornas': { owners: ['Farmasi'], label: 'Kepatuhan Fornas', reason: 'Hanya menjadi tanggung jawab Farmasi.' },
  'op': { owners: ['Kamar Operasi'], label: 'Penundaan Operasi', reason: 'Hanya menjadi tanggung jawab Kamar Operasi.' },
  'visite': { owners: ['Rawat Inap'], label: 'Kepatuhan Visite', reason: 'Hanya menjadi tanggung jawab Rawat Inap.' },
  'wtrj': { owners: ['Rawat Jalan'], label: 'Waktu Tunggu RJ', reason: 'Hanya menjadi tanggung jawab Rawat Jalan.' },
  'lab': { owners: ['Laboratorium'], label: 'Hasil Kritis Lab', reason: 'Hanya menjadi tanggung jawab Laboratorium.' },
};

// Base data interface for all indicator entries
export interface BaseEntry {
  id: string;
  indicatorType: IndicatorType;
  unitId: string;
  date: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// Specific indicator entry types
export interface TanganEntry extends BaseEntry {
  indicatorType: 'tangan';
  staff: string;
  observer: string;
  room: string;
  m1: boolean; m2: boolean; m3: boolean; m4: boolean; m5: boolean;
  method: string;
  patuh: boolean | null;
}

export interface VisiteEntry extends BaseEntry {
  indicatorType: 'visite';
  rm: string;
  doctor: string;
  time: string;
}

export interface IdentitasEntry extends BaseEntry {
  indicatorType: 'identitas';
  staff: string;
  observer: string;
  room: string;
  name: string;
  rm: string;
  service: string;
  nama: boolean;
  tgl: boolean;
}

export interface ApdEntry extends BaseEntry {
  indicatorType: 'apd';
  room: string;
  staff: string;
  comp: string;
}

export interface JatuhEntry extends BaseEntry {
  indicatorType: 'jatuh';
  rm: string;
  awal: boolean;
  re: boolean;
  inv: boolean;
  cedera: boolean;
}

export interface ScEntry extends BaseEntry {
  indicatorType: 'sc';
  rm: string;
  diag: string;
  ok: boolean;
}

export interface WtrjEntry extends BaseEntry {
  indicatorType: 'wtrj';
  rm: string;
  doc: string;
  t1: string;
  t2: string;
  st_checked: boolean;
}

export interface OpEntry extends BaseEntry {
  indicatorType: 'op';
  rm: string;
  t1: string;
  t2: string;
  tertunda: boolean;
  r: string;
}

export interface LabEntry extends BaseEntry {
  indicatorType: 'lab';
  rm: string;
  exam: string;
  t1: string;
  t2: string;
  num: boolean;
}

export interface FornasEntry extends BaseEntry {
  indicatorType: 'fornas';
  num: number;
  non: number;
  note: string;
}

export interface CpEntry extends BaseEntry {
  indicatorType: 'cp';
  name: string;
  rm: string;
  diag: string;
  vTerapi: number;
  vLab: number;
  vRad: number;
  vLain: number;
  vLainKet: string;
  perawat: string;
  farmasi: string;
  gizi: string;
  los: number;
  ket: string;
}

export type IndicatorEntry = TanganEntry | VisiteEntry | IdentitasEntry | ApdEntry | JatuhEntry | ScEntry | WtrjEntry | OpEntry | LabEntry | FornasEntry | CpEntry;

// Jenis pelayanan untuk indikator Identifikasi Pasien
export const IDENTITAS_SERVICE_OPTIONS = [
  'PEMBERIAN OBAT',
  'PEMBERIAN CAIRAN INTRAVENA',
  'PENCABUTAN GIGI',
  'IMUNISASI',
  'PEMASANGAN ALAT KONTRASEPSI',
  'PERSALINAN',
  'TINDAKAN KEGAWATDARURATAN',
  'PENGAMBILAN SAMPEL',
  'DLL',
] as const;

export type IdentitasService = (typeof IDENTITAS_SERVICE_OPTIONS)[number];

// Audit log entry
export interface AuditLogEntry {
  id: string;
  // 'ikp' ditambahkan untuk modul Pelaporan Insiden Keselamatan Pasien —
  // lihat src/components/dashboard/ikp/. Tidak mengubah entri lama.
  type: 'block' | 'login' | 'input' | 'mapping' | 'ikp';
  msg: string;
  badge: string;
  ts: string;
  userId?: string;
  unitId?: string;
}
