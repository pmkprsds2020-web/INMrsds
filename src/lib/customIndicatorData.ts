import { supabase } from '@/lib/supabase/client';
import type {
  CustomIndicator, CustomIndicatorVersion, CustomIndicatorField, CustomIndicatorUnitAssignment,
  CustomIndicatorMeasurement, CustomIndicatorCategory, CustomIndicatorBundle, CustomIndicatorFilters,
  CustomIndicatorDashboardStats, CustomIndicatorAuditEntry, CustomIndicatorStatus,
  FormulaType, TargetOperator, MeasurementFrequency,
} from '@/types/customIndicators';
import { computeIndicatorValue, computeAchievementStatus, computePeriodKey } from '@/types/customIndicators';

// Mengikuti pola src/lib/uimuData.ts / ikpData.ts: akses langsung dari
// client, snake_case <-> camelCase di boundary, audit trail lewat audit_logs
// existing (type = 'custom_indicator').

const INDICATORS_TABLE = 'custom_indicators';
const VERSIONS_TABLE = 'custom_indicator_versions';
const FIELDS_TABLE = 'custom_indicator_fields';
const UNITS_TABLE = 'custom_indicator_units';
const MEASUREMENTS_TABLE = 'custom_indicator_measurements';
const CATEGORIES_TABLE = 'custom_indicator_categories';
const AUDIT_TABLE = 'audit_logs';

type Unsubscribe = () => void;

// ────────────────────────────────────────────────────────────────
// Row <-> model mapping
// ────────────────────────────────────────────────────────────────

function rowToIndicator(row: Record<string, any>): CustomIndicator {
  return {
    id: row.id, code: row.code, name: row.name, description: row.description, purpose: row.purpose,
    indicatorType: row.indicator_type, category: row.category, status: row.status,
    isAllUnits: !!row.is_all_units, isComparableAcrossUnits: !!row.is_comparable_across_units,
    picUserId: row.pic_user_id, picName: row.pic_name, reviewerName: row.reviewer_name, approverName: row.approver_name,
    startDate: row.start_date, endDate: row.end_date, isPermanent: !!row.is_permanent,
    priorityNumber: row.priority_number, priorityReason: row.priority_reason, priorityBasis: row.priority_basis, priorityPeriod: row.priority_period,
    relatedIndicatorId: row.related_indicator_id,
    deactivatedAt: row.deactivated_at, deactivatedBy: row.deactivated_by, deactivationReason: row.deactivation_reason, deactivationNote: row.deactivation_note,
    createdBy: row.created_by, createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function indicatorToRow(entry: Partial<CustomIndicator>): Record<string, any> {
  const map: Record<string, string> = {
    code: 'code', name: 'name', description: 'description', purpose: 'purpose', indicatorType: 'indicator_type',
    category: 'category', status: 'status', isAllUnits: 'is_all_units', isComparableAcrossUnits: 'is_comparable_across_units',
    picUserId: 'pic_user_id', picName: 'pic_name', reviewerName: 'reviewer_name', approverName: 'approver_name',
    startDate: 'start_date', endDate: 'end_date', isPermanent: 'is_permanent',
    priorityNumber: 'priority_number', priorityReason: 'priority_reason', priorityBasis: 'priority_basis', priorityPeriod: 'priority_period',
    relatedIndicatorId: 'related_indicator_id',
    deactivatedAt: 'deactivated_at', deactivatedBy: 'deactivated_by', deactivationReason: 'deactivation_reason', deactivationNote: 'deactivation_note',
    createdBy: 'created_by',
  };
  const row: Record<string, any> = {};
  for (const [key, col] of Object.entries(map)) {
    if ((entry as any)[key] !== undefined) row[col] = (entry as any)[key];
  }
  return row;
}

function rowToVersion(row: Record<string, any>): CustomIndicatorVersion {
  return {
    id: row.id, indicatorId: row.indicator_id, versionNumber: row.version_number,
    effectiveFrom: row.effective_from, effectiveTo: row.effective_to,
    operationalDefinition: row.operational_definition, numeratorLabel: row.numerator_label, denominatorLabel: row.denominator_label,
    inclusionCriteria: row.inclusion_criteria, exclusionCriteria: row.exclusion_criteria,
    sourceOfData: row.source_of_data, collectionMethod: row.collection_method,
    formulaType: row.formula_type, formulaMultiplier: Number(row.formula_multiplier ?? 100), formulaExpression: row.formula_expression,
    targetValue: row.target_value === null ? null : Number(row.target_value), targetOperator: row.target_operator, targetDirection: row.target_direction,
    unitOfMeasure: row.unit_of_measure, unitOfMeasureCustom: row.unit_of_measure_custom,
    frequency: row.frequency, frequencyCustom: row.frequency_custom,
    allowMultiplePerPeriod: !!row.allow_multiple_per_period, allowNumeratorGtDenominator: !!row.allow_numerator_gt_denominator,
    createdBy: row.created_by, createdAt: row.created_at,
  };
}

function versionToRow(entry: Partial<CustomIndicatorVersion> & { indicatorId?: string }): Record<string, any> {
  const map: Record<string, string> = {
    indicatorId: 'indicator_id', versionNumber: 'version_number', effectiveFrom: 'effective_from', effectiveTo: 'effective_to',
    operationalDefinition: 'operational_definition', numeratorLabel: 'numerator_label', denominatorLabel: 'denominator_label',
    inclusionCriteria: 'inclusion_criteria', exclusionCriteria: 'exclusion_criteria', sourceOfData: 'source_of_data', collectionMethod: 'collection_method',
    formulaType: 'formula_type', formulaMultiplier: 'formula_multiplier', formulaExpression: 'formula_expression',
    targetValue: 'target_value', targetOperator: 'target_operator', targetDirection: 'target_direction',
    unitOfMeasure: 'unit_of_measure', unitOfMeasureCustom: 'unit_of_measure_custom',
    frequency: 'frequency', frequencyCustom: 'frequency_custom',
    allowMultiplePerPeriod: 'allow_multiple_per_period', allowNumeratorGtDenominator: 'allow_numerator_gt_denominator',
    createdBy: 'created_by',
  };
  const row: Record<string, any> = {};
  for (const [key, col] of Object.entries(map)) {
    if ((entry as any)[key] !== undefined) row[col] = (entry as any)[key];
  }
  return row;
}

function rowToField(row: Record<string, any>): CustomIndicatorField {
  return {
    id: row.id, indicatorVersionId: row.indicator_version_id, fieldCode: row.field_code, fieldLabel: row.field_label,
    fieldType: row.field_type, isRequired: !!row.is_required, minValue: row.min_value, maxValue: row.max_value,
    options: row.options, sortOrder: row.sort_order ?? 0, roleInFormula: row.role_in_formula,
  };
}

function fieldToRow(entry: Partial<CustomIndicatorField> & { indicatorVersionId?: string }): Record<string, any> {
  const row: Record<string, any> = {};
  if (entry.indicatorVersionId !== undefined) row.indicator_version_id = entry.indicatorVersionId;
  if (entry.fieldCode !== undefined) row.field_code = entry.fieldCode;
  if (entry.fieldLabel !== undefined) row.field_label = entry.fieldLabel;
  if (entry.fieldType !== undefined) row.field_type = entry.fieldType;
  if (entry.isRequired !== undefined) row.is_required = entry.isRequired;
  if (entry.minValue !== undefined) row.min_value = entry.minValue;
  if (entry.maxValue !== undefined) row.max_value = entry.maxValue;
  if (entry.options !== undefined) row.options = entry.options;
  if (entry.sortOrder !== undefined) row.sort_order = entry.sortOrder;
  if (entry.roleInFormula !== undefined) row.role_in_formula = entry.roleInFormula;
  return row;
}

function rowToUnitAssignment(row: Record<string, any>): CustomIndicatorUnitAssignment {
  return { id: row.id, indicatorId: row.indicator_id, unitId: row.unit_id, isActive: !!row.is_active };
}

function rowToMeasurement(row: Record<string, any>): CustomIndicatorMeasurement {
  return {
    id: row.id, indicatorId: row.indicator_id, indicatorVersionId: row.indicator_version_id, unitId: row.unit_id,
    measurementDate: row.measurement_date, period: row.period, observationSeq: row.observation_seq ?? 1,
    numerator: row.numerator === null ? null : Number(row.numerator), denominator: row.denominator === null ? null : Number(row.denominator),
    value: row.value === null ? null : Number(row.value), targetValue: row.target_value === null ? null : Number(row.target_value),
    targetOperator: row.target_operator, achievementStatus: row.achievement_status,
    measurementData: row.measurement_data ?? {}, notes: row.notes,
    createdBy: row.created_by, createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function rowToCategory(row: Record<string, any>): CustomIndicatorCategory {
  return { id: row.id, name: row.name, createdBy: row.created_by, createdAt: row.created_at };
}

function rowToAudit(row: Record<string, any>): CustomIndicatorAuditEntry {
  return {
    id: row.id, type: 'custom_indicator', msg: row.msg, badge: row.badge, ts: row.ts,
    userId: row.user_id ?? undefined, unitId: row.unit_id ?? undefined,
    entityType: row.entity_type ?? undefined, entityId: row.entity_id ?? undefined,
    oldValue: row.old_value ?? null, newValue: row.new_value ?? null, createdAt: row.created_at,
  };
}

// ────────────────────────────────────────────────────────────────
// Audit trail
// ────────────────────────────────────────────────────────────────

export async function logCustomIndicatorAudit(params: {
  msg: string; badge: string; userId?: string; unitId?: string; entityId?: string;
  oldValue?: Record<string, unknown> | null; newValue?: Record<string, unknown> | null;
}): Promise<void> {
  const { error } = await supabase.from(AUDIT_TABLE).insert({
    type: 'custom_indicator', msg: params.msg, badge: params.badge, ts: new Date().toLocaleString('id-ID'),
    user_id: params.userId || null, unit_id: params.unitId || null,
    entity_type: 'custom_indicators', entity_id: params.entityId || null,
    old_value: params.oldValue ?? null, new_value: params.newValue ?? null,
  });
  if (error) console.error('[logCustomIndicatorAudit] gagal menulis audit log:', error);
}

export async function getCustomIndicatorAuditTrail(entityId?: string, limitCount = 300): Promise<CustomIndicatorAuditEntry[]> {
  let query = supabase.from(AUDIT_TABLE).select('*').eq('type', 'custom_indicator');
  if (entityId) query = query.eq('entity_id', entityId);
  const { data, error } = await query.order('created_at', { ascending: false }).limit(limitCount);
  if (error) throw error;
  return (data as any[]).map(rowToAudit);
}

// ────────────────────────────────────────────────────────────────
// Kategori
// ────────────────────────────────────────────────────────────────

export async function getCustomIndicatorCategories(): Promise<CustomIndicatorCategory[]> {
  const { data, error } = await supabase.from(CATEGORIES_TABLE).select('*').order('name', { ascending: true });
  if (error) throw error;
  return (data as any[]).map(rowToCategory);
}

export async function createCustomIndicatorCategory(name: string, createdBy: string): Promise<CustomIndicatorCategory> {
  const { data, error } = await supabase.from(CATEGORIES_TABLE).insert({ name, created_by: createdBy }).select('*').single();
  if (error) throw error;
  return rowToCategory(data);
}

// ────────────────────────────────────────────────────────────────
// Indikator — CRUD identitas (bagian 3, 11)
// ────────────────────────────────────────────────────────────────

export async function getCustomIndicators(filters: CustomIndicatorFilters = {}): Promise<CustomIndicator[]> {
  let query = supabase.from(INDICATORS_TABLE).select('*');
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.indicatorType) query = query.eq('indicator_type', filters.indicatorType);
  if (filters.category) query = query.eq('category', filters.category);
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw error;
  let rows = (data as any[]).map(rowToIndicator);

  if (filters.unitId) {
    const { data: unitRows } = await supabase.from(UNITS_TABLE).select('indicator_id').eq('unit_id', filters.unitId).eq('is_active', true);
    const ids = new Set((unitRows ?? []).map((r: any) => r.indicator_id));
    rows = rows.filter((r) => r.isAllUnits || ids.has(r.id));
  }
  if (filters.search) {
    const q = filters.search.toLowerCase();
    rows = rows.filter((r) => r.code.toLowerCase().includes(q) || r.name.toLowerCase().includes(q) || (r.picName ?? '').toLowerCase().includes(q));
  }
  return rows;
}

/**
 * Indikator mutu unit yang AKTIF dan terlihat oleh unit tertentu — dipakai
 * modul "Indikator Mutu Unit" (PIC data entry) dan sidebar. Otomatis
 * mengikuti status: begitu indikator dinonaktifkan di Master Indikator Mutu,
 * baris ini tidak lagi dikembalikan (hilang dari modul PIC tanpa perlu
 * langkah tambahan apa pun).
 */
export async function getActiveUnitIndicatorsForUnit(unitId: string): Promise<CustomIndicator[]> {
  return getCustomIndicators({ status: 'active', indicatorType: 'unit', unitId });
}

/**
 * Indikator Prioritas RS yang AKTIF dan terlihat oleh unit tertentu — dipakai
 * modul "Indikator Mutu Prioritas" (PIC data entry) dan sidebar, sama seperti
 * getActiveUnitIndicatorsForUnit tapi untuk indicatorType = 'priority_rs'.
 * Mayoritas indikator prioritas RS berstatus is_all_units = true (default
 * saat dibuat lewat wizard), jadi biasanya muncul untuk semua unit; unit yang
 * "berpartisipasi" tetap bisa dibatasi lewat custom_indicator_units seperti
 * indikator unit biasa. Otomatis ikut hilang begitu dinonaktifkan di Master
 * Indikator Mutu (sama seperti indikator unit).
 */
export async function getActivePriorityIndicatorsForUnit(unitId: string): Promise<CustomIndicator[]> {
  return getCustomIndicators({ status: 'active', indicatorType: 'priority_rs', unitId });
}


export async function getCustomIndicatorById(id: string): Promise<CustomIndicator | null> {
  const { data, error } = await supabase.from(INDICATORS_TABLE).select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? rowToIndicator(data) : null;
}


function nextCode(existingCodes: string[], prefix: string): string {
  const nums = existingCodes
    .filter((c) => c.startsWith(prefix + '-'))
    .map((c) => parseInt(c.split('-')[1], 10))
    .filter((n) => !isNaN(n));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `${prefix}-${String(next).padStart(3, '0')}`;
}

/** Membuat indikator identitas + versi 1 sekaligus (form "Buat Indikator Baru" bersifat satu alur). */
export async function createCustomIndicator(params: {
  identity: Partial<CustomIndicator> & { name: string; indicatorType: 'unit' | 'priority_rs'; createdBy: string };
  version: Partial<CustomIndicatorVersion>;
  fields: Partial<CustomIndicatorField>[];
  unitIds: string[];
}): Promise<CustomIndicatorBundle> {
  const { data: existing } = await supabase.from(INDICATORS_TABLE).select('code');
  const prefix = params.identity.indicatorType === 'priority_rs' ? 'IMRS' : 'IMU';
  const code = params.identity.code || nextCode((existing ?? []).map((r: any) => r.code), prefix);

  const indicatorRow = indicatorToRow({ ...params.identity, code });
  const { data: indData, error: indErr } = await supabase.from(INDICATORS_TABLE).insert(indicatorRow).select('*').single();
  if (indErr) throw indErr;
  const indicator = rowToIndicator(indData);

  const versionRow = versionToRow({ ...params.version, indicatorId: indicator.id, versionNumber: 1, createdBy: params.identity.createdBy });
  const { data: verData, error: verErr } = await supabase.from(VERSIONS_TABLE).insert(versionRow).select('*').single();
  if (verErr) throw verErr;
  const version = rowToVersion(verData);

  let fields: CustomIndicatorField[] = [];
  if (params.fields.length > 0) {
    const fieldRows = params.fields.map((f, i) => fieldToRow({ ...f, indicatorVersionId: version.id, sortOrder: f.sortOrder ?? i }));
    const { data: fieldsData, error: fieldsErr } = await supabase.from(FIELDS_TABLE).insert(fieldRows).select('*');
    if (fieldsErr) throw fieldsErr;
    fields = (fieldsData as any[]).map(rowToField);
  }

  const unitIds = indicator.isAllUnits ? ['all'] : params.unitIds;
  let units: CustomIndicatorUnitAssignment[] = [];
  if (unitIds.length > 0) {
    const { data: unitsData, error: unitsErr } = await supabase.from(UNITS_TABLE)
      .insert(unitIds.map((u) => ({ indicator_id: indicator.id, unit_id: u })))
      .select('*');
    if (unitsErr) throw unitsErr;
    units = (unitsData as any[]).map(rowToUnitAssignment);
  }

  await logCustomIndicatorAudit({
    msg: `Indikator ${indicator.code} — ${indicator.name} dibuat`, badge: 'CREATE_INDICATOR',
    userId: params.identity.createdBy, entityId: indicator.id, newValue: { code: indicator.code, name: indicator.name },
  });

  return { indicator, currentVersion: version, allVersions: [version], fields, units };
}

export async function updateCustomIndicatorIdentity(id: string, patch: Partial<CustomIndicator>, actorId?: string): Promise<CustomIndicator> {
  const row = indicatorToRow(patch);
  const { data, error } = await supabase.from(INDICATORS_TABLE).update(row).eq('id', id).select('*').single();
  if (error) throw error;
  const updated = rowToIndicator(data);
  await logCustomIndicatorAudit({ msg: `Identitas indikator ${updated.code} diperbarui`, badge: 'UPDATE_INDICATOR', userId: actorId, entityId: id, newValue: row });
  return updated;
}

export async function getCustomIndicatorBundle(id: string): Promise<CustomIndicatorBundle | null> {
  const indicator = await getCustomIndicatorById(id);
  if (!indicator) return null;
  const allVersions = await getCustomIndicatorVersions(id);
  const currentVersion = allVersions.find((v) => !v.effectiveTo) ?? allVersions[allVersions.length - 1] ?? null;
  const fields = currentVersion ? await getCustomIndicatorFields(currentVersion.id) : [];
  const units = await getCustomIndicatorUnits(id);
  return { indicator, currentVersion, allVersions, fields, units };
}

// ────────────────────────────────────────────────────────────────
// Versi (bagian 16)
// ────────────────────────────────────────────────────────────────

export async function getCustomIndicatorVersions(indicatorId: string): Promise<CustomIndicatorVersion[]> {
  const { data, error } = await supabase.from(VERSIONS_TABLE).select('*').eq('indicator_id', indicatorId).order('version_number', { ascending: true });
  if (error) throw error;
  return (data as any[]).map(rowToVersion);
}

/** Membuat versi baru: menutup versi lama (effective_to) lalu menyalin field ke versi baru. TIDAK menghapus versi lama. */
export async function createNewCustomIndicatorVersion(params: {
  indicatorId: string;
  version: Partial<CustomIndicatorVersion>;
  fields: Partial<CustomIndicatorField>[];
  actorId: string;
}): Promise<{ version: CustomIndicatorVersion; fields: CustomIndicatorField[] }> {
  const existing = await getCustomIndicatorVersions(params.indicatorId);
  const current = existing.find((v) => !v.effectiveTo);
  const nextNumber = (existing.reduce((max, v) => Math.max(max, v.versionNumber), 0)) + 1;
  const effectiveFrom = params.version.effectiveFrom ?? new Date().toISOString().slice(0, 10);

  if (current) {
    const { error: closeErr } = await supabase.from(VERSIONS_TABLE).update({ effective_to: effectiveFrom }).eq('id', current.id);
    if (closeErr) throw closeErr;
  }

  const versionRow = versionToRow({ ...params.version, indicatorId: params.indicatorId, versionNumber: nextNumber, effectiveFrom, createdBy: params.actorId });
  const { data: verData, error: verErr } = await supabase.from(VERSIONS_TABLE).insert(versionRow).select('*').single();
  if (verErr) throw verErr;
  const version = rowToVersion(verData);

  let fields: CustomIndicatorField[] = [];
  if (params.fields.length > 0) {
    const fieldRows = params.fields.map((f, i) => fieldToRow({ ...f, indicatorVersionId: version.id, sortOrder: f.sortOrder ?? i }));
    const { data: fieldsData, error: fieldsErr } = await supabase.from(FIELDS_TABLE).insert(fieldRows).select('*');
    if (fieldsErr) throw fieldsErr;
    fields = (fieldsData as any[]).map(rowToField);
  }

  const indicator = await getCustomIndicatorById(params.indicatorId);
  await logCustomIndicatorAudit({
    msg: `Versi ${nextNumber} dibuat untuk indikator ${indicator?.code ?? params.indicatorId} (target/definisi berubah)`,
    badge: 'CREATE_VERSION', userId: params.actorId, entityId: params.indicatorId, newValue: { versionNumber: nextNumber },
  });

  return { version, fields };
}

export async function getCustomIndicatorFields(versionId: string): Promise<CustomIndicatorField[]> {
  const { data, error } = await supabase.from(FIELDS_TABLE).select('*').eq('indicator_version_id', versionId).order('sort_order', { ascending: true });
  if (error) throw error;
  return (data as any[]).map(rowToField);
}

// ────────────────────────────────────────────────────────────────
// Unit assignment (bagian 4)
// ────────────────────────────────────────────────────────────────

export async function getCustomIndicatorUnits(indicatorId: string): Promise<CustomIndicatorUnitAssignment[]> {
  const { data, error } = await supabase.from(UNITS_TABLE).select('*').eq('indicator_id', indicatorId);
  if (error) throw error;
  return (data as any[]).map(rowToUnitAssignment);
}

export async function setCustomIndicatorUnits(indicatorId: string, unitIds: string[], actorId?: string): Promise<void> {
  const { error: delErr } = await supabase.from(UNITS_TABLE).delete().eq('indicator_id', indicatorId);
  if (delErr) throw delErr;
  if (unitIds.length > 0) {
    const { error: insErr } = await supabase.from(UNITS_TABLE).insert(unitIds.map((u) => ({ indicator_id: indicatorId, unit_id: u })));
    if (insErr) throw insErr;
  }
  await logCustomIndicatorAudit({ msg: `Unit indikator diperbarui (${unitIds.join(', ') || 'tidak ada'})`, badge: 'UPDATE_INDICATOR', userId: actorId, entityId: indicatorId });
}

// ────────────────────────────────────────────────────────────────
// Lifecycle (bagian 11–15)
// ────────────────────────────────────────────────────────────────

export async function activateCustomIndicator(id: string, actorId: string): Promise<CustomIndicator> {
  const updated = await updateCustomIndicatorIdentity(id, { status: 'active', deactivatedAt: null, deactivatedBy: null, deactivationReason: null, deactivationNote: null }, actorId);
  await logCustomIndicatorAudit({ msg: `Indikator ${updated.code} diaktifkan`, badge: 'ACTIVATE_INDICATOR', userId: actorId, entityId: id });
  return updated;
}

export async function deactivateCustomIndicator(params: {
  id: string; reason: CustomIndicator['deactivationReason']; note?: string; actorId: string;
}): Promise<CustomIndicator> {
  const updated = await updateCustomIndicatorIdentity(params.id, {
    status: 'inactive', deactivatedAt: new Date().toISOString(), deactivatedBy: params.actorId,
    deactivationReason: params.reason, deactivationNote: params.note ?? null,
  }, params.actorId);
  await logCustomIndicatorAudit({ msg: `Indikator ${updated.code} dinonaktifkan (${params.reason})`, badge: 'DEACTIVATE_INDICATOR', userId: params.actorId, entityId: params.id, newValue: { reason: params.reason, note: params.note } });
  return updated;
}

export async function archiveCustomIndicator(id: string, actorId: string): Promise<CustomIndicator> {
  return updateCustomIndicatorIdentity(id, { status: 'archived' }, actorId);
}

/** Duplikasi/Clone (bagian 32): identitas+definisi+field+unit disalin, histori TIDAK, status jadi draft, kode baru. */
export async function cloneCustomIndicator(sourceId: string, actorId: string, nameOverride?: string): Promise<CustomIndicatorBundle> {
  const bundle = await getCustomIndicatorBundle(sourceId);
  if (!bundle || !bundle.currentVersion) throw new Error('Indikator sumber tidak ditemukan atau belum punya versi');

  const created = await createCustomIndicator({
    identity: {
      name: nameOverride ?? `${bundle.indicator.name} (Salinan)`,
      description: bundle.indicator.description ?? undefined,
      purpose: bundle.indicator.purpose ?? undefined,
      indicatorType: bundle.indicator.indicatorType,
      category: bundle.indicator.category,
      status: 'draft',
      isAllUnits: bundle.indicator.isAllUnits,
      isComparableAcrossUnits: bundle.indicator.isComparableAcrossUnits,
      picUserId: bundle.indicator.picUserId ?? undefined,
      picName: bundle.indicator.picName ?? undefined,
      isPermanent: bundle.indicator.isPermanent,
      createdBy: actorId,
    },
    version: {
      operationalDefinition: bundle.currentVersion.operationalDefinition ?? undefined,
      numeratorLabel: bundle.currentVersion.numeratorLabel ?? undefined,
      denominatorLabel: bundle.currentVersion.denominatorLabel ?? undefined,
      inclusionCriteria: bundle.currentVersion.inclusionCriteria ?? undefined,
      exclusionCriteria: bundle.currentVersion.exclusionCriteria ?? undefined,
      sourceOfData: bundle.currentVersion.sourceOfData ?? undefined,
      collectionMethod: bundle.currentVersion.collectionMethod ?? undefined,
      formulaType: bundle.currentVersion.formulaType,
      formulaMultiplier: bundle.currentVersion.formulaMultiplier,
      targetValue: bundle.currentVersion.targetValue ?? undefined,
      targetOperator: bundle.currentVersion.targetOperator ?? undefined,
      targetDirection: bundle.currentVersion.targetDirection ?? undefined,
      unitOfMeasure: bundle.currentVersion.unitOfMeasure ?? undefined,
      frequency: bundle.currentVersion.frequency,
      allowMultiplePerPeriod: bundle.currentVersion.allowMultiplePerPeriod,
      allowNumeratorGtDenominator: bundle.currentVersion.allowNumeratorGtDenominator,
    },
    fields: bundle.fields.map((f) => ({ fieldCode: f.fieldCode, fieldLabel: f.fieldLabel, fieldType: f.fieldType, isRequired: f.isRequired, minValue: f.minValue ?? undefined, maxValue: f.maxValue ?? undefined, options: f.options ?? undefined, roleInFormula: f.roleInFormula ?? undefined })),
    unitIds: bundle.units.map((u) => u.unitId),
  });

  await logCustomIndicatorAudit({ msg: `Indikator ${created.indicator.code} dibuat dari duplikasi ${bundle.indicator.code}`, badge: 'CLONE_INDICATOR', userId: actorId, entityId: created.indicator.id });
  return created;
}

// ────────────────────────────────────────────────────────────────
// Pengukuran (bagian 17–20, 25, 28, 29)
// ────────────────────────────────────────────────────────────────

export async function getCustomIndicatorMeasurements(filters: { indicatorId: string; unitId?: string; periodStart?: string; periodEnd?: string }): Promise<CustomIndicatorMeasurement[]> {
  let query = supabase.from(MEASUREMENTS_TABLE).select('*').eq('indicator_id', filters.indicatorId);
  if (filters.unitId) query = query.eq('unit_id', filters.unitId);
  const { data, error } = await query.order('measurement_date', { ascending: true });
  if (error) throw error;
  return (data as any[]).map(rowToMeasurement);
}

/** Menyimpan hasil pengukuran: hitung nilai, snapshot target, cegah duplikat periode (kecuali allowMultiplePerPeriod). */
export async function recordCustomIndicatorMeasurement(params: {
  indicatorId: string; version: CustomIndicatorVersion; unitId: string; measurementDate: string;
  numerator: number | null; denominator: number | null; measurementData?: Record<string, unknown>; notes?: string; actorId: string;
}): Promise<CustomIndicatorMeasurement> {
  const indicator = await getCustomIndicatorById(params.indicatorId);
  if (!indicator) throw new Error('Indikator tidak ditemukan');
  if (indicator.status !== 'active') throw new Error('Indikator tidak aktif — tidak dapat menerima data baru.');

  const { value, error: calcError } = computeIndicatorValue({
    formulaType: params.version.formulaType, multiplier: params.version.formulaMultiplier,
    numerator: params.numerator, denominator: params.denominator,
  });
  if (calcError) throw new Error(calcError);

  if (
    !params.version.allowNumeratorGtDenominator &&
    params.numerator !== null && params.denominator !== null &&
    ['percentage', 'rate', 'ratio'].includes(params.version.formulaType) &&
    params.numerator > params.denominator
  ) {
    throw new Error('Numerator tidak boleh lebih besar dari denominator.');
  }

  const period = computePeriodKey(params.measurementDate, params.version.frequency);
  const achievementStatus = computeAchievementStatus(value, params.version.targetValue, params.version.targetOperator);

  let observationSeq = 1;
  if (params.version.allowMultiplePerPeriod) {
    const { count } = await supabase.from(MEASUREMENTS_TABLE).select('id', { count: 'exact', head: true })
      .eq('indicator_id', params.indicatorId).eq('unit_id', params.unitId).eq('period', period);
    observationSeq = (count ?? 0) + 1;
  }

  const row = {
    indicator_id: params.indicatorId, indicator_version_id: params.version.id, unit_id: params.unitId,
    measurement_date: params.measurementDate, period, observation_seq: observationSeq,
    numerator: params.numerator, denominator: params.denominator, value,
    target_value: params.version.targetValue, target_operator: params.version.targetOperator, achievement_status: achievementStatus,
    measurement_data: params.measurementData ?? {}, notes: params.notes ?? null, created_by: params.actorId,
  };

  const { data, error } = await supabase.from(MEASUREMENTS_TABLE).insert(row).select('*').single();
  if (error) {
    if (error.code === '23505') throw new Error('Data untuk unit dan periode ini sudah pernah diinput. Aktifkan "izinkan multiple measurements per periode" bila memang dibutuhkan lebih dari satu observasi.');
    throw error;
  }
  const created = rowToMeasurement(data);
  await logCustomIndicatorAudit({
    msg: `Data ${indicator.code} periode ${period} (${params.unitId}) diinput: ${value ?? '-'}`, badge: 'INPUT_MEASUREMENT',
    userId: params.actorId, unitId: params.unitId, entityId: params.indicatorId, newValue: { period, value, achievementStatus },
  });
  return created;
}

export async function deleteCustomIndicatorMeasurement(id: string): Promise<void> {
  const { error } = await supabase.from(MEASUREMENTS_TABLE).delete().eq('id', id);
  if (error) throw error;
}

// ────────────────────────────────────────────────────────────────
// Realtime
// ────────────────────────────────────────────────────────────────

// Setiap panggilan subscribeTo* di bawah ini butuh topic channel yang UNIK.
// Sidebar (section "Indikator Mutu Unit"/"Master Indikator Mutu") dan panel
// yang sedang aktif (Dashboard/List/Detail) sama-sama memanggil fungsi ini
// SECARA BERSAMAAN pada halaman yang sama. Kalau topic-nya sama persis,
// Supabase Realtime mendeteksi channel dengan topic itu sudah ter-subscribe
// dan panggilan .on() berikutnya pada instance channel baru gagal dengan
// "cannot add 'postgres_changes' callbacks ... after 'subscribe()'" —
// meng-crash seluruh halaman. Penomoran counter di bawah menjamin setiap
// caller dapat topic channel-nya sendiri.
let subscriptionCounter = 0;

export function subscribeToCustomIndicators(onChange: () => void): Unsubscribe {
  const channel = supabase.channel(`custom_indicators_changes_${++subscriptionCounter}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: INDICATORS_TABLE }, onChange)
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

export function subscribeToCustomIndicatorMeasurements(indicatorId: string, onChange: () => void): Unsubscribe {
  const channel = supabase.channel(`custom_indicator_measurements_${indicatorId}_${++subscriptionCounter}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: MEASUREMENTS_TABLE, filter: `indicator_id=eq.${indicatorId}` }, onChange)
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

// ────────────────────────────────────────────────────────────────
// Dashboard (bagian 21, 26, 27)
// ────────────────────────────────────────────────────────────────

export function computeCustomIndicatorDashboardStats(indicators: CustomIndicator[], latestMeasurementByIndicator: Map<string, CustomIndicatorMeasurement | undefined>): CustomIndicatorDashboardStats {
  const byCategory: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  let achievedCount = 0;
  let needsImprovementCount = 0;

  for (const ind of indicators) {
    byCategory[ind.category] = (byCategory[ind.category] ?? 0) + 1;
    byStatus[ind.status] = (byStatus[ind.status] ?? 0) + 1;
    const latest = latestMeasurementByIndicator.get(ind.id);
    if (latest?.achievementStatus === 'tercapai') achievedCount++;
    if (latest?.achievementStatus === 'tidak_tercapai') needsImprovementCount++;
  }

  return {
    total: indicators.length,
    active: indicators.filter((i) => i.status === 'active').length,
    unitCount: indicators.filter((i) => i.indicatorType === 'unit').length,
    priorityCount: indicators.filter((i) => i.indicatorType === 'priority_rs').length,
    achievedCount, needsImprovementCount,
    byCategory, byStatus: byStatus as Record<CustomIndicatorStatus, number>,
  };
}

/** Ambil pengukuran terbaru per indikator (untuk KPI dashboard) — satu query ringan per indikator, dipanggil terbatas (mis. daftar indikator aktif saja). */
export async function getLatestMeasurementsForIndicators(indicatorIds: string[]): Promise<Map<string, CustomIndicatorMeasurement | undefined>> {
  const map = new Map<string, CustomIndicatorMeasurement | undefined>();
  if (indicatorIds.length === 0) return map;
  const { data, error } = await supabase.from(MEASUREMENTS_TABLE).select('*').in('indicator_id', indicatorIds).order('measurement_date', { ascending: false });
  if (error) throw error;
  for (const row of (data as any[])) {
    const m = rowToMeasurement(row);
    if (!map.has(m.indicatorId)) map.set(m.indicatorId, m);
  }
  return map;
}
