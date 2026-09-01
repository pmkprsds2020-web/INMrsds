// ============================================================================
// Modul Master Indikator Mutu Custom — tipe & konstanta.
// Sengaja TIDAK menyentuh IndicatorType/INDICATORS/UNIT_MAP di
// src/types/index.ts (indikator legacy) — lihat IndicatorDefinition di
// src/lib/indicatorDefinitionAdapter.ts untuk titik penyatuan keduanya.
// ============================================================================

import type { UnitId } from '@/types';

export type CustomIndicatorKind = 'unit' | 'priority_rs';
export type CustomIndicatorStatus = 'draft' | 'active' | 'inactive' | 'archived';
export type FormulaType = 'percentage' | 'rate' | 'average' | 'sum' | 'count' | 'ratio' | 'custom';
export type TargetOperator = 'gte' | 'lte' | 'eq' | 'gt' | 'lt';
export type TargetDirection = 'higher_better' | 'lower_better' | 'exact';
export type MeasurementFrequency = 'harian' | 'mingguan' | 'bulanan' | 'triwulanan' | 'semesteran' | 'tahunan' | 'custom';
export type FieldType = 'number' | 'decimal' | 'text' | 'date' | 'select' | 'boolean';
export type FieldFormulaRole = 'numerator' | 'denominator' | 'value';
export type DeactivationReason =
  | 'target_tercapai_konsisten' | 'bukan_prioritas' | 'perubahan_kebijakan' | 'perubahan_sop'
  | 'digantikan_indikator_lain' | 'tidak_relevan' | 'perubahan_unit' | 'lainnya';
export type AchievementStatus = 'tercapai' | 'tidak_tercapai';

export const INDICATOR_KIND_LABEL: Record<CustomIndicatorKind, string> = {
  unit: 'Indikator Mutu Unit',
  priority_rs: 'Indikator Prioritas RS',
};

export const STATUS_LABEL: Record<CustomIndicatorStatus, string> = {
  draft: 'Draft',
  active: 'Aktif',
  inactive: 'Nonaktif',
  archived: 'Arsip',
};

export const STATUS_COLOR: Record<CustomIndicatorStatus, string> = {
  draft: '#94a3b8',
  active: '#22c55e',
  inactive: '#f59e0b',
  archived: '#64748b',
};

export const DEFAULT_CATEGORIES = [
  'Keselamatan Pasien', 'Klinis', 'Manajerial', 'Pelayanan', 'Efisiensi',
  'SDM', 'Farmasi', 'Laboratorium', 'K3', 'PPI', 'Kepuasan', 'Dokumentasi', 'Lainnya',
];

export const FORMULA_TYPE_OPTIONS: { value: FormulaType; label: string; description: string }[] = [
  { value: 'percentage', label: 'Persentase', description: 'numerator / denominator × 100' },
  { value: 'rate', label: 'Rate', description: 'numerator / denominator × multiplier' },
  { value: 'average', label: 'Rata-rata', description: 'total / count' },
  { value: 'sum', label: 'Jumlah (Sum)', description: 'total nilai' },
  { value: 'count', label: 'Jumlah Kejadian (Count)', description: 'jumlah kejadian tercatat' },
  { value: 'ratio', label: 'Rasio', description: 'numerator / denominator' },
  { value: 'custom', label: 'Custom', description: 'dihitung manual / dicatat sebagai nilai langsung' },
];

export const FORMULA_MULTIPLIER_OPTIONS = [1, 10, 100, 1000, 10000, 100000];

export const TARGET_OPERATOR_OPTIONS: { value: TargetOperator; label: string }[] = [
  { value: 'gte', label: '\u2265 (lebih besar/sama dengan)' },
  { value: 'lte', label: '\u2264 (lebih kecil/sama dengan)' },
  { value: 'eq', label: '= (sama dengan)' },
  { value: 'gt', label: '> (lebih besar dari)' },
  { value: 'lt', label: '< (lebih kecil dari)' },
];

export const TARGET_DIRECTION_OPTIONS: { value: TargetDirection; label: string }[] = [
  { value: 'higher_better', label: 'Semakin tinggi semakin baik' },
  { value: 'lower_better', label: 'Semakin rendah semakin baik' },
  { value: 'exact', label: 'Target exact (harus tepat sama)' },
];

export const UNIT_OF_MEASURE_OPTIONS = [
  '%', 'orang', 'pasien', 'kasus', 'hari', 'jam', 'menit', 'detik',
  'per 1.000', 'per 10.000', 'per 100.000', 'rasio', 'skor', 'nilai', 'lainnya',
];

export const FREQUENCY_OPTIONS: { value: MeasurementFrequency; label: string }[] = [
  { value: 'harian', label: 'Harian' },
  { value: 'mingguan', label: 'Mingguan' },
  { value: 'bulanan', label: 'Bulanan' },
  { value: 'triwulanan', label: 'Triwulanan' },
  { value: 'semesteran', label: 'Semesteran' },
  { value: 'tahunan', label: 'Tahunan' },
  { value: 'custom', label: 'Custom' },
];

export const FIELD_TYPE_OPTIONS: { value: FieldType; label: string }[] = [
  { value: 'number', label: 'Angka (bulat)' },
  { value: 'decimal', label: 'Angka (desimal)' },
  { value: 'text', label: 'Teks' },
  { value: 'date', label: 'Tanggal' },
  { value: 'select', label: 'Pilihan (select)' },
  { value: 'boolean', label: 'Ya/Tidak' },
];

export const DEACTIVATION_REASON_OPTIONS: { value: DeactivationReason; label: string }[] = [
  { value: 'target_tercapai_konsisten', label: 'Target sudah tercapai konsisten' },
  { value: 'bukan_prioritas', label: 'Tidak lagi menjadi prioritas' },
  { value: 'perubahan_kebijakan', label: 'Perubahan kebijakan' },
  { value: 'perubahan_sop', label: 'Perubahan SOP' },
  { value: 'digantikan_indikator_lain', label: 'Digantikan indikator lain' },
  { value: 'tidak_relevan', label: 'Tidak relevan' },
  { value: 'perubahan_unit', label: 'Perubahan unit' },
  { value: 'lainnya', label: 'Lainnya' },
];

/** Unit assignment memakai kode UnitId existing (src/types/index.ts) + 'all'. */
export const ASSIGNABLE_UNIT_IDS: (UnitId | 'all')[] = [
  'IGD', 'Rawat Jalan', 'Rawat Inap', 'ICU', 'Kamar Operasi', 'VK', 'Laboratorium', 'Radiologi', 'Farmasi',
];

// ────────────────────────────────────────────────────────────────
// Calculation engine (bagian 6, 19, 25, 28)
// ────────────────────────────────────────────────────────────────

export interface FormulaInput {
  formulaType: FormulaType;
  multiplier: number;
  numerator: number | null;
  denominator: number | null;
}

/** Menghitung nilai indikator. Mengembalikan null kalau data tidak cukup, dan
 *  pesan error kalau input tidak valid (bagian 28 — data quality). */
export function computeIndicatorValue(input: FormulaInput): { value: number | null; error: string | null } {
  const { formulaType, multiplier, numerator, denominator } = input;

  if (formulaType === 'sum' || formulaType === 'count') {
    if (numerator === null || numerator === undefined) return { value: null, error: null };
    if (numerator < 0) return { value: null, error: 'Nilai tidak boleh negatif.' };
    return { value: numerator, error: null };
  }

  if (numerator === null || numerator === undefined || denominator === null || denominator === undefined) {
    return { value: null, error: null };
  }
  if (numerator < 0) return { value: null, error: 'Numerator tidak boleh negatif.' };
  if (denominator < 0) return { value: null, error: 'Denominator tidak boleh negatif.' };
  if (denominator === 0) return { value: null, error: 'Denominator tidak boleh 0.' };

  switch (formulaType) {
    case 'percentage':
      return { value: (numerator / denominator) * 100, error: null };
    case 'rate':
      return { value: (numerator / denominator) * (multiplier || 1), error: null };
    case 'average':
      return { value: numerator / denominator, error: null };
    case 'ratio':
      return { value: numerator / denominator, error: null };
    case 'custom':
    default:
      return { value: numerator, error: null };
  }
}

/** Menentukan status capaian berdasarkan target_operator (bagian 25). */
export function computeAchievementStatus(value: number | null, targetValue: number | null, operator: TargetOperator | null): AchievementStatus | null {
  if (value === null || targetValue === null || !operator) return null;
  let met = false;
  switch (operator) {
    case 'gte': met = value >= targetValue; break;
    case 'lte': met = value <= targetValue; break;
    case 'eq': met = value === targetValue; break;
    case 'gt': met = value > targetValue; break;
    case 'lt': met = value < targetValue; break;
  }
  return met ? 'tercapai' : 'tidak_tercapai';
}

/** Bangun kunci periode dari tanggal + frekuensi, dipakai buat cegah input duplikat (bagian 29). */
export function computePeriodKey(date: string, frequency: MeasurementFrequency): string {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  switch (frequency) {
    case 'harian': return date;
    case 'mingguan': {
      const firstJan = new Date(y, 0, 1);
      const week = Math.ceil(((d.getTime() - firstJan.getTime()) / 86400000 + firstJan.getDay() + 1) / 7);
      return `${y}-W${String(week).padStart(2, '0')}`;
    }
    case 'bulanan': return `${y}-${String(m).padStart(2, '0')}`;
    case 'triwulanan': return `${y}-Q${Math.ceil(m / 3)}`;
    case 'semesteran': return `${y}-S${m <= 6 ? 1 : 2}`;
    case 'tahunan': return `${y}`;
    default: return `${y}-${String(m).padStart(2, '0')}`;
  }
}

// ────────────────────────────────────────────────────────────────
// Model utama
// ────────────────────────────────────────────────────────────────

export interface CustomIndicator {
  id: string;
  code: string;
  name: string;
  description: string | null;
  purpose: string | null;
  indicatorType: CustomIndicatorKind;
  category: string;
  status: CustomIndicatorStatus;
  isAllUnits: boolean;
  isComparableAcrossUnits: boolean;
  picUserId: string | null;
  picName: string | null;
  reviewerName: string | null;
  approverName: string | null;
  startDate: string | null;
  endDate: string | null;
  isPermanent: boolean;
  priorityNumber: number | null;
  priorityReason: string | null;
  priorityBasis: string | null;
  priorityPeriod: string | null;
  relatedIndicatorId: string | null;
  deactivatedAt: string | null;
  deactivatedBy: string | null;
  deactivationReason: DeactivationReason | null;
  deactivationNote: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CustomIndicatorVersion {
  id: string;
  indicatorId: string;
  versionNumber: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  operationalDefinition: string | null;
  numeratorLabel: string | null;
  denominatorLabel: string | null;
  inclusionCriteria: string | null;
  exclusionCriteria: string | null;
  sourceOfData: string | null;
  collectionMethod: string | null;
  formulaType: FormulaType;
  formulaMultiplier: number;
  formulaExpression: string | null;
  targetValue: number | null;
  targetOperator: TargetOperator | null;
  targetDirection: TargetDirection | null;
  unitOfMeasure: string | null;
  unitOfMeasureCustom: string | null;
  frequency: MeasurementFrequency;
  frequencyCustom: string | null;
  allowMultiplePerPeriod: boolean;
  allowNumeratorGtDenominator: boolean;
  createdBy: string | null;
  createdAt: string;
}

export interface CustomIndicatorField {
  id: string;
  indicatorVersionId: string;
  fieldCode: string;
  fieldLabel: string;
  fieldType: FieldType;
  isRequired: boolean;
  minValue: number | null;
  maxValue: number | null;
  options: string[] | null;
  sortOrder: number;
  roleInFormula: FieldFormulaRole | null;
}

export interface CustomIndicatorUnitAssignment {
  id: string;
  indicatorId: string;
  unitId: string;
  isActive: boolean;
}

export interface CustomIndicatorMeasurement {
  id: string;
  indicatorId: string;
  indicatorVersionId: string;
  unitId: string;
  measurementDate: string;
  period: string;
  observationSeq: number;
  numerator: number | null;
  denominator: number | null;
  value: number | null;
  targetValue: number | null;
  targetOperator: TargetOperator | null;
  achievementStatus: AchievementStatus | null;
  measurementData: Record<string, unknown>;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CustomIndicatorCategory {
  id: string;
  name: string;
  createdBy: string | null;
  createdAt: string;
}

/** Bundel yang lazim dibutuhkan UI: indikator + versi berlaku + field + unit yang di-assign. */
export interface CustomIndicatorBundle {
  indicator: CustomIndicator;
  currentVersion: CustomIndicatorVersion | null;
  allVersions: CustomIndicatorVersion[];
  fields: CustomIndicatorField[];
  units: CustomIndicatorUnitAssignment[];
}

export interface CustomIndicatorFilters {
  status?: CustomIndicatorStatus;
  indicatorType?: CustomIndicatorKind;
  category?: string;
  unitId?: string;
  search?: string;
}

export interface CustomIndicatorDashboardStats {
  total: number;
  active: number;
  unitCount: number;
  priorityCount: number;
  achievedCount: number;
  needsImprovementCount: number;
  byCategory: Record<string, number>;
  byStatus: Record<CustomIndicatorStatus, number>;
}

export interface CustomIndicatorAuditEntry {
  id: string;
  type: 'custom_indicator';
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
