import { supabase } from '@/lib/supabase/client';
import type {
  OppeSettings,
  OppeKsm,
  OppeMasterOption,
  OppeMasterKind,
  OppeUnitRef,
  OppeDoctor,
  OppeIndicatorCategory,
  OppeIndicator,
  OppeTemplate,
  OppeTemplateIndicator,
  OppeEvaluation,
  OppeEvaluationItem,
  OppeEvaluationFilters,
  OppeEvaluationStatus,
  OppeFppe,
  OppeAuditEntry,
  OppeAuditAction,
  OppeResultCategory,
  OppePeriodType,
  OppeCategoryScore,
} from '@/types/oppe';
import { OPPE_DEFAULT_SETTINGS, OPPE_STATUS_LABEL, periodLabel, periodSortKey } from '@/types/oppe';
import { evaluateItem, computeEvaluation, parseNumeric, isCategorical, round2 } from '@/lib/oppeScoring';

// Mengikuti pola src/lib/uimuData.ts / ikpData.ts: akses langsung dari
// client (RLS Supabase yang menegakkan hak akses), snake_case <-> camelCase
// di boundary, audit trail ke tabel khusus oppe_audit_logs (append-only)
// + mirror ringkas ke audit_logs existing (type='oppe') supaya muncul di
// panel Notifikasi & Audit Trail aplikasi tanpa sistem notifikasi baru.

type Row = Record<string, any>;
type Unsubscribe = () => void;

const T = {
  ksm: 'oppe_ksm',
  options: 'oppe_master_options',
  categories: 'oppe_indicator_categories',
  indicators: 'oppe_indicators',
  templates: 'oppe_templates',
  templateIndicators: 'oppe_template_indicators',
  settings: 'oppe_settings',
  doctors: 'oppe_doctors',
  evaluations: 'oppe_evaluations',
  items: 'oppe_evaluation_items',
  fppe: 'oppe_fppe',
  audit: 'oppe_audit_logs',
  appAudit: 'audit_logs',
} as const;

export const OPPE_EVIDENCE_BUCKET = 'oppe-evidence';

/** Pesan ramah pengguna — detail teknis tetap di console (poin 48). */
export function friendlyOppeError(err: unknown, fallback = 'Data OPPE gagal disimpan. Silakan coba kembali.'): string {
  console.error('[OPPE]', err);
  const msg = (err as { message?: string })?.message ?? '';
  if (/FINAL/i.test(msg) || /Komite Medik/i.test(msg) || /ditugaskan/i.test(msg)) return msg;
  if (/uniq_oppe_evaluation_period|duplicate key/i.test(msg)) return 'Evaluasi untuk dokter dan periode ini sudah ada. Buka evaluasi yang sudah ada atau pilih periode lain.';
  if (/row-level security|permission denied|42501/i.test(msg)) return 'Anda tidak memiliki hak akses untuk tindakan ini.';
  if (/violates foreign key|23503/i.test(msg)) return 'Data masih dipakai oleh data lain (mis. evaluasi) sehingga tidak dapat dihapus. Nonaktifkan saja.';
  if (/relation .* does not exist|42P01/i.test(msg)) return 'Tabel OPPE belum tersedia. Jalankan supabase/migration_oppe.sql terlebih dahulu.';
  return fallback;
}

// ────────────────────────────────────────────────────────────────
// Mapping
// ────────────────────────────────────────────────────────────────

const num = (v: unknown): number | null => (v === null || v === undefined || v === '' ? null : Number(v));

function rowToSettings(row: Row | null): OppeSettings {
  if (!row) return { ...OPPE_DEFAULT_SETTINGS };
  const cats = Array.isArray(row.result_categories) && row.result_categories.length > 0
    ? (row.result_categories as OppeResultCategory[]).map((c) => ({ ...c, min: Number(c.min), max: c.max === null || c.max === undefined ? null : Number(c.max) }))
    : OPPE_DEFAULT_SETTINGS.resultCategories;
  return {
    scoreMet: Number(row.score_met ?? OPPE_DEFAULT_SETTINGS.scoreMet),
    scoreAttention: Number(row.score_attention ?? OPPE_DEFAULT_SETTINGS.scoreAttention),
    scoreTrigger: Number(row.score_trigger ?? OPPE_DEFAULT_SETTINGS.scoreTrigger),
    resultCategories: cats,
    recommendationCriticalTrigger: row.recommendation_critical_trigger || OPPE_DEFAULT_SETTINGS.recommendationCriticalTrigger,
    recommendationMultipleTrigger: row.recommendation_multiple_trigger || OPPE_DEFAULT_SETTINGS.recommendationMultipleTrigger,
    recommendationDecline: row.recommendation_decline || OPPE_DEFAULT_SETTINGS.recommendationDecline,
    significantDrop: Number(row.significant_drop ?? OPPE_DEFAULT_SETTINGS.significantDrop),
    stableBand: Number(row.stable_band ?? OPPE_DEFAULT_SETTINGS.stableBand),
    fppeTriggerCountThreshold: Number(row.fppe_trigger_count_threshold ?? OPPE_DEFAULT_SETTINGS.fppeTriggerCountThreshold),
    dueReminderDays: Number(row.due_reminder_days ?? OPPE_DEFAULT_SETTINGS.dueReminderDays),
    requireCompleteBeforeSubmit: row.require_complete_before_submit ?? OPPE_DEFAULT_SETTINGS.requireCompleteBeforeSubmit,
    hospitalName: row.hospital_name || OPPE_DEFAULT_SETTINGS.hospitalName,
    updatedAt: row.updated_at ?? null,
    updatedBy: row.updated_by ?? null,
  };
}

function settingsToRow(s: OppeSettings): Row {
  return {
    id: 'default',
    score_met: s.scoreMet,
    score_attention: s.scoreAttention,
    score_trigger: s.scoreTrigger,
    result_categories: s.resultCategories,
    recommendation_critical_trigger: s.recommendationCriticalTrigger,
    recommendation_multiple_trigger: s.recommendationMultipleTrigger,
    recommendation_decline: s.recommendationDecline,
    significant_drop: s.significantDrop,
    stable_band: s.stableBand,
    fppe_trigger_count_threshold: s.fppeTriggerCountThreshold,
    due_reminder_days: s.dueReminderDays,
    require_complete_before_submit: s.requireCompleteBeforeSubmit,
    hospital_name: s.hospitalName,
  };
}

const rowToKsm = (r: Row): OppeKsm => ({ id: r.id, code: r.code, name: r.name, description: r.description, isActive: !!r.is_active, createdAt: r.created_at, updatedAt: r.updated_at });
const rowToOption = (r: Row): OppeMasterOption => ({ id: r.id, kind: r.kind, code: r.code, name: r.name, sortOrder: r.sort_order ?? 0, isActive: !!r.is_active });
const rowToCategory = (r: Row): OppeIndicatorCategory => ({ id: r.id, code: r.code, name: r.name, weight: Number(r.weight), description: r.description, sortOrder: r.sort_order ?? 0, isActive: !!r.is_active });

function rowToDoctor(r: Row): OppeDoctor {
  return {
    id: r.id, userId: r.user_id, name: r.name, nikNip: r.nik_nip, strNumber: r.str_number, strExpiry: r.str_expiry,
    sipNumber: r.sip_number, sipExpiry: r.sip_expiry, title: r.title, profession: r.profession, specialty: r.specialty,
    ksmId: r.ksm_id, ksmName: r.oppe_ksm?.name ?? null, unitId: r.unit_id, unitName: r.unit_name, status: r.status,
    practiceStartDate: r.practice_start_date, email: r.email, phone: r.phone, credentials: r.credentials, notes: r.notes,
    isDemo: !!r.is_demo, createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

function doctorToRow(d: Partial<OppeDoctor>): Row {
  const map: Record<string, string> = {
    userId: 'user_id', name: 'name', nikNip: 'nik_nip', strNumber: 'str_number', strExpiry: 'str_expiry', sipNumber: 'sip_number',
    sipExpiry: 'sip_expiry', title: 'title', profession: 'profession', specialty: 'specialty', ksmId: 'ksm_id', unitId: 'unit_id',
    unitName: 'unit_name', status: 'status', practiceStartDate: 'practice_start_date', email: 'email', phone: 'phone',
    credentials: 'credentials', notes: 'notes',
  };
  const row: Row = {};
  for (const [k, col] of Object.entries(map)) {
    const v = (d as Row)[k];
    if (v !== undefined) row[col] = v === '' ? null : v;
  }
  return row;
}

function rowToRule(r: Row) {
  return {
    dataType: r.data_type,
    targetOperator: r.target_operator,
    targetValue: num(r.target_value),
    triggerOperator: r.trigger_operator,
    triggerValue: num(r.trigger_value),
    options: r.options ?? [],
    passValues: r.pass_values ?? [],
    attentionValues: r.attention_values ?? [],
    isCritical: !!r.is_critical,
    weight: Number(r.weight ?? 1),
    scoreMet: num(r.score_met),
    scoreAttention: num(r.score_attention),
    scoreTrigger: num(r.score_trigger),
  };
}

function rowToIndicator(r: Row): OppeIndicator {
  return {
    ...rowToRule(r),
    id: r.id, code: r.code, categoryId: r.category_id, categoryCode: r.oppe_indicator_categories?.code,
    ksmId: r.ksm_id, profession: r.profession, unitId: r.unit_id, name: r.name, description: r.description,
    indicatorType: r.indicator_type, operationalDefinition: r.operational_definition, numerator: r.numerator,
    denominator: r.denominator, unitLabel: r.unit_label, targetText: r.target_text, minValue: num(r.min_value),
    maxValue: num(r.max_value), triggerText: r.trigger_text, sourceData: r.source_data, measurementMethod: r.measurement_method,
    frequency: r.frequency, evaluationPeriod: r.evaluation_period, qualityIndicatorId: r.quality_indicator_id,
    qualityIndicatorName: r.quality_indicator_name, referenceNote: r.reference_note, isActive: !!r.is_active,
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

function indicatorToRow(i: Partial<OppeIndicator>): Row {
  const map: Record<string, string> = {
    code: 'code', categoryId: 'category_id', ksmId: 'ksm_id', profession: 'profession', unitId: 'unit_id', name: 'name',
    description: 'description', indicatorType: 'indicator_type', operationalDefinition: 'operational_definition',
    numerator: 'numerator', denominator: 'denominator', unitLabel: 'unit_label', dataType: 'data_type', targetText: 'target_text',
    targetOperator: 'target_operator', targetValue: 'target_value', minValue: 'min_value', maxValue: 'max_value',
    triggerText: 'trigger_text', triggerOperator: 'trigger_operator', triggerValue: 'trigger_value', options: 'options',
    passValues: 'pass_values', attentionValues: 'attention_values', isCritical: 'is_critical', sourceData: 'source_data',
    measurementMethod: 'measurement_method', frequency: 'frequency', evaluationPeriod: 'evaluation_period', weight: 'weight',
    scoreMet: 'score_met', scoreAttention: 'score_attention', scoreTrigger: 'score_trigger',
    qualityIndicatorId: 'quality_indicator_id', qualityIndicatorName: 'quality_indicator_name', referenceNote: 'reference_note',
    isActive: 'is_active',
  };
  const row: Row = {};
  for (const [k, col] of Object.entries(map)) {
    const v = (i as Row)[k];
    if (v !== undefined) row[col] = v === '' ? null : v;
  }
  return row;
}

const rowToTemplate = (r: Row): OppeTemplate => ({
  id: r.id, code: r.code, name: r.name, profession: r.profession, ksmId: r.ksm_id, description: r.description,
  isActive: !!r.is_active, indicatorCount: Array.isArray(r.oppe_template_indicators) ? r.oppe_template_indicators[0]?.count ?? r.oppe_template_indicators.length : undefined,
});

function rowToItem(r: Row): OppeEvaluationItem {
  return {
    ...rowToRule(r),
    id: r.id, evaluationId: r.evaluation_id, indicatorId: r.indicator_id, sequence: r.sequence ?? 0, categoryId: r.category_id,
    categoryCode: r.category_code, code: r.code, name: r.name, unitLabel: r.unit_label, targetText: r.target_text,
    triggerText: r.trigger_text, realizationText: r.realization_text, realizationNumber: num(r.realization_number),
    achievement: num(r.achievement), score: num(r.score), weightedScore: num(r.weighted_score), status: r.status,
    isTrigger: !!r.is_trigger, statusReason: r.status_reason, notes: r.notes, sourceData: r.source_data,
    evidenceUrl: r.evidence_url, evidencePath: r.evidence_path, qualityIndicatorId: r.quality_indicator_id,
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

function itemToRow(i: OppeEvaluationItem): Row {
  return {
    id: i.id, evaluation_id: i.evaluationId, indicator_id: i.indicatorId, sequence: i.sequence, category_id: i.categoryId,
    category_code: i.categoryCode, code: i.code, name: i.name, data_type: i.dataType, unit_label: i.unitLabel,
    target_text: i.targetText, target_operator: i.targetOperator, target_value: i.targetValue, trigger_text: i.triggerText,
    trigger_operator: i.triggerOperator, trigger_value: i.triggerValue, options: i.options, pass_values: i.passValues,
    attention_values: i.attentionValues, is_critical: i.isCritical, weight: i.weight, score_met: i.scoreMet,
    score_attention: i.scoreAttention, score_trigger: i.scoreTrigger, realization_text: i.realizationText,
    realization_number: i.realizationNumber, achievement: i.achievement, score: i.score, weighted_score: i.weightedScore,
    status: i.status, is_trigger: i.isTrigger, status_reason: i.statusReason, notes: i.notes, source_data: i.sourceData,
    evidence_url: i.evidenceUrl, evidence_path: i.evidencePath, quality_indicator_id: i.qualityIndicatorId,
  };
}

function rowToEvaluation(r: Row): OppeEvaluation {
  return {
    id: r.id, evaluationNumber: r.evaluation_number, doctorId: r.doctor_id, doctorName: r.oppe_doctors?.name ?? null,
    ksmId: r.ksm_id, ksmName: r.oppe_ksm?.name ?? null, unitId: r.unit_id, unitName: r.unit_name, profession: r.profession,
    specialty: r.specialty, templateId: r.template_id, periodType: r.period_type, year: r.year, semester: r.semester,
    periodStart: r.period_start, periodEnd: r.period_end, evaluatorId: r.evaluator_id, evaluatorName: r.evaluator_name,
    evaluationDate: r.evaluation_date, dueDate: r.due_date, status: r.status,
    scoreProfessional: num(r.score_professional), scoreDevelopment: num(r.score_development), scoreClinical: num(r.score_clinical),
    weightedScore: num(r.weighted_score), finalScore: num(r.final_score),
    categoryScores: (Array.isArray(r.category_scores) ? r.category_scores : []) as OppeCategoryScore[],
    finalCategory: r.final_category, finalCategoryLabel: r.final_category_label, metCount: r.met_count ?? 0,
    attentionCount: r.attention_count ?? 0, triggerCount: r.trigger_count ?? 0, noDataCount: r.no_data_count ?? 0,
    criticalTriggerCount: r.critical_trigger_count ?? 0, criticalIndicators: r.critical_indicators,
    requiresFppe: !!r.requires_fppe, trend: r.trend, previousScore: num(r.previous_score), conclusion: r.conclusion,
    recommendation: r.recommendation, recommendationOverride: r.recommendation_override, notes: r.notes,
    reviewedBy: r.reviewed_by, reviewedAt: r.reviewed_at, reviewNotes: r.review_notes, approvedBy: r.approved_by,
    approvedAt: r.approved_at, finalizedBy: r.finalized_by, finalizedAt: r.finalized_at, reopenReason: r.reopen_reason,
    reopenedBy: r.reopened_by, reopenedAt: r.reopened_at, needsRecalc: !!r.needs_recalc, isDemo: !!r.is_demo,
    createdBy: r.created_by, createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

function rowToFppe(r: Row): OppeFppe {
  return {
    id: r.id, fppeNumber: r.fppe_number, evaluationId: r.evaluation_id, doctorId: r.doctor_id, doctorName: r.oppe_doctors?.name ?? null,
    ksmId: r.ksm_id, ksmName: r.oppe_ksm?.name ?? null, triggerIndicatorId: r.trigger_indicator_id, triggerItemId: r.trigger_item_id,
    triggerIndicatorName: r.trigger_indicator_name, reason: r.reason, area: r.area, startDate: r.start_date, endDate: r.end_date,
    evaluatorId: r.evaluator_id, evaluatorName: r.evaluator_name, plan: r.plan, result: r.result, recommendation: r.recommendation,
    status: r.status, isDemo: !!r.is_demo, createdBy: r.created_by, createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

function fppeToRow(f: Partial<OppeFppe>): Row {
  const map: Record<string, string> = {
    evaluationId: 'evaluation_id', doctorId: 'doctor_id', ksmId: 'ksm_id', triggerIndicatorId: 'trigger_indicator_id',
    triggerItemId: 'trigger_item_id', triggerIndicatorName: 'trigger_indicator_name', reason: 'reason', area: 'area',
    startDate: 'start_date', endDate: 'end_date', evaluatorId: 'evaluator_id', evaluatorName: 'evaluator_name', plan: 'plan',
    result: 'result', recommendation: 'recommendation', status: 'status',
  };
  const row: Row = {};
  for (const [k, col] of Object.entries(map)) {
    const v = (f as Row)[k];
    if (v !== undefined) row[col] = v === '' ? null : v;
  }
  return row;
}

const rowToAudit = (r: Row): OppeAuditEntry => ({
  id: r.id, userId: r.user_id, userName: r.user_name, evaluationId: r.evaluation_id, entityType: r.entity_type,
  entityId: r.entity_id, action: r.action, oldData: r.old_data, newData: r.new_data, reason: r.reason, createdAt: r.created_at,
});

// ────────────────────────────────────────────────────────────────
// Cache master ringan (poin 49: cache master data, hindari query berulang)
// ────────────────────────────────────────────────────────────────
const cache = new Map<string, { at: number; value: unknown }>();
const CACHE_MS = 60_000;
async function cached<V>(key: string, loader: () => Promise<V>): Promise<V> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value as V;
  const value = await loader();
  cache.set(key, { at: Date.now(), value });
  return value;
}
export function invalidateOppeCache(prefix?: string) {
  for (const k of Array.from(cache.keys())) if (!prefix || k.startsWith(prefix)) cache.delete(k);
}

// ────────────────────────────────────────────────────────────────
// Audit trail
// ────────────────────────────────────────────────────────────────
const NOTIFY_ACTIONS: OppeAuditAction[] = ['submit', 'review', 'approve', 'finalize', 'reopen', 'fppe_created', 'import'];

export async function logOppeAudit(params: {
  action: OppeAuditAction;
  userId: string;
  userName?: string | null;
  evaluationId?: string | null;
  entityType?: string;
  entityId?: string | null;
  oldData?: Row | null;
  newData?: Row | null;
  reason?: string | null;
  /** Pesan ringkas untuk feed notifikasi aplikasi (audit_logs). */
  notifyMsg?: string;
}): Promise<void> {
  const { error } = await supabase.from(T.audit).insert({
    user_id: params.userId,
    user_name: params.userName ?? null,
    evaluation_id: params.evaluationId ?? null,
    entity_type: params.entityType ?? 'oppe_evaluations',
    entity_id: params.entityId ?? params.evaluationId ?? null,
    action: params.action,
    old_data: params.oldData ?? null,
    new_data: params.newData ?? null,
    reason: params.reason ?? null,
  });
  if (error) console.error('[OPPE audit] gagal menulis audit log:', error);

  if (params.notifyMsg || NOTIFY_ACTIONS.includes(params.action)) {
    const { error: e2 } = await supabase.from(T.appAudit).insert({
      type: 'oppe',
      msg: params.notifyMsg ?? `OPPE: ${params.action}`,
      badge: 'OPPE',
      ts: new Date().toLocaleString('id-ID'),
      user_id: params.userId,
      entity_type: params.entityType ?? 'oppe_evaluations',
      entity_id: params.entityId ?? params.evaluationId ?? null,
    });
    if (e2) console.warn('[OPPE notify] audit_logs belum menerima type=oppe (jalankan migration_oppe.sql):', e2.message);
  }
}

export async function getOppeAuditTrail(params: { evaluationId?: string; action?: OppeAuditAction; page?: number; pageSize?: number } = {}): Promise<{ rows: OppeAuditEntry[]; total: number }> {
  const page = params.page ?? 0;
  const pageSize = params.pageSize ?? 50;
  let q = supabase.from(T.audit).select('*', { count: 'exact' });
  if (params.evaluationId) q = q.eq('evaluation_id', params.evaluationId);
  if (params.action) q = q.eq('action', params.action);
  const { data, error, count } = await q.order('created_at', { ascending: false }).range(page * pageSize, page * pageSize + pageSize - 1);
  if (error) throw error;
  return { rows: (data ?? []).map(rowToAudit), total: count ?? 0 };
}

// ────────────────────────────────────────────────────────────────
// Pengaturan
// ────────────────────────────────────────────────────────────────
export async function getOppeSettings(force = false): Promise<OppeSettings> {
  if (force) invalidateOppeCache('settings');
  return cached('settings', async () => {
    const { data, error } = await supabase.from(T.settings).select('*').eq('id', 'default').maybeSingle();
    if (error) { console.warn('[OPPE] settings fallback ke default:', error.message); return { ...OPPE_DEFAULT_SETTINGS }; }
    return rowToSettings(data);
  });
}

export function validateResultCategories(cats: OppeResultCategory[]): string | null {
  if (cats.length === 0) return 'Minimal satu kategori hasil.';
  for (const c of cats) {
    if (!c.label.trim()) return 'Nama kategori wajib diisi.';
    if (c.max !== null && c.max <= c.min) return `Rentang kategori "${c.label}" tidak valid (maks harus > min).`;
  }
  const sorted = [...cats].sort((a, b) => a.min - b.min);
  if (sorted[0].min > 0) return 'Rentang kategori harus dimulai dari 0.';
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i].max !== sorted[i + 1].min) return `Rentang "${sorted[i].label}" dan "${sorted[i + 1].label}" tidak bersambung (maks ${sorted[i].max} ≠ min ${sorted[i + 1].min}).`;
  }
  if (sorted[sorted.length - 1].max !== null) return 'Kategori tertinggi harus tanpa batas atas (kosongkan "maks").';
  return null;
}

export async function saveOppeSettings(s: OppeSettings, actor: { id: string; name: string }): Promise<OppeSettings> {
  const invalid = validateResultCategories(s.resultCategories);
  if (invalid) throw new Error(invalid);
  const before = await getOppeSettings(true);
  const { data, error } = await supabase.from(T.settings).upsert({ ...settingsToRow(s), updated_by: actor.id, updated_at: new Date().toISOString() }).select('*').single();
  if (error) throw error;
  invalidateOppeCache('settings');
  await logOppeAudit({ action: 'settings_updated', userId: actor.id, userName: actor.name, entityType: 'oppe_settings', oldData: settingsToRow(before), newData: settingsToRow(s) });
  return rowToSettings(data);
}

// ────────────────────────────────────────────────────────────────
// Master: kategori, KSM, opsi, unit
// ────────────────────────────────────────────────────────────────
export async function getOppeCategories(force = false): Promise<OppeIndicatorCategory[]> {
  if (force) invalidateOppeCache('categories');
  return cached('categories', async () => {
    const { data, error } = await supabase.from(T.categories).select('*').order('sort_order');
    if (error) throw error;
    return (data ?? []).map(rowToCategory);
  });
}

export async function saveOppeCategories(cats: OppeIndicatorCategory[], actor: { id: string; name: string }): Promise<void> {
  const total = round2(cats.filter((c) => c.isActive).reduce((s, c) => s + Number(c.weight), 0));
  if (Math.abs(total - 100) > 0.001) throw new Error(`Total bobot kategori aktif harus 100% (saat ini ${total}%).`);
  const before = await getOppeCategories(true);
  for (const c of cats) {
    const payload = { code: c.code, name: c.name, weight: c.weight, description: c.description, sort_order: c.sortOrder, is_active: c.isActive };
    const { error } = c.id
      ? await supabase.from(T.categories).update(payload).eq('id', c.id)
      : await supabase.from(T.categories).insert(payload);
    if (error) throw error;
  }
  invalidateOppeCache('categories');
  await logOppeAudit({ action: 'settings_updated', userId: actor.id, userName: actor.name, entityType: 'oppe_indicator_categories', oldData: { categories: before }, newData: { categories: cats } });
}

export async function getOppeKsmList(includeInactive = true, force = false): Promise<OppeKsm[]> {
  if (force) invalidateOppeCache('ksm');
  const all = await cached('ksm', async () => {
    const { data, error } = await supabase.from(T.ksm).select('*').order('name');
    if (error) throw error;
    return (data ?? []).map(rowToKsm);
  });
  return includeInactive ? all : all.filter((k) => k.isActive);
}

export async function saveOppeKsm(k: Partial<OppeKsm> & { code: string; name: string }, actorId: string): Promise<OppeKsm> {
  const payload = { code: k.code.trim().toUpperCase(), name: k.name.trim(), description: k.description ?? null, is_active: k.isActive ?? true };
  const { data, error } = k.id
    ? await supabase.from(T.ksm).update(payload).eq('id', k.id).select('*').single()
    : await supabase.from(T.ksm).insert({ ...payload, created_by: actorId }).select('*').single();
  if (error) throw error;
  invalidateOppeCache('ksm');
  return rowToKsm(data);
}

export async function getOppeMasterOptions(kind?: OppeMasterKind, force = false): Promise<OppeMasterOption[]> {
  if (force) invalidateOppeCache('options');
  const all = await cached('options', async () => {
    const { data, error } = await supabase.from(T.options).select('*').order('kind').order('sort_order').order('name');
    if (error) throw error;
    return (data ?? []).map(rowToOption);
  });
  return kind ? all.filter((o) => o.kind === kind) : all;
}

export async function saveOppeMasterOption(o: Partial<OppeMasterOption> & { kind: OppeMasterKind; name: string }): Promise<void> {
  const payload = { kind: o.kind, code: o.code ?? null, name: o.name.trim(), sort_order: o.sortOrder ?? 0, is_active: o.isActive ?? true };
  const { error } = o.id ? await supabase.from(T.options).update(payload).eq('id', o.id) : await supabase.from(T.options).insert(payload);
  if (error) throw error;
  invalidateOppeCache('options');
}

/** Unit memakai master unit existing (uimu_units). Bila tabel belum ada, kembalikan daftar kosong. */
export async function getOppeUnits(): Promise<OppeUnitRef[]> {
  return cached('units', async () => {
    const { data, error } = await supabase.from('uimu_units').select('id, code, name').eq('is_active', true).order('name');
    if (error) { console.warn('[OPPE] master unit (uimu_units) tidak tersedia:', error.message); return []; }
    return (data ?? []) as OppeUnitRef[];
  });
}

// ────────────────────────────────────────────────────────────────
// Dokter
// ────────────────────────────────────────────────────────────────
export async function getOppeDoctors(filters: { search?: string; ksmId?: string; status?: string; profession?: string; page?: number; pageSize?: number } = {}): Promise<{ rows: OppeDoctor[]; total: number }> {
  let q = supabase.from(T.doctors).select('*, oppe_ksm(name)', { count: 'exact' });
  if (filters.search) q = q.or(`name.ilike.%${filters.search.replace(/[%,()]/g, '')}%,sip_number.ilike.%${filters.search.replace(/[%,()]/g, '')}%,str_number.ilike.%${filters.search.replace(/[%,()]/g, '')}%`);
  if (filters.ksmId) q = q.eq('ksm_id', filters.ksmId);
  if (filters.status) q = q.eq('status', filters.status);
  if (filters.profession) q = q.eq('profession', filters.profession);
  q = q.order('name');
  if (filters.pageSize) {
    const page = filters.page ?? 0;
    q = q.range(page * filters.pageSize, page * filters.pageSize + filters.pageSize - 1);
  }
  const { data, error, count } = await q;
  if (error) throw error;
  return { rows: (data ?? []).map(rowToDoctor), total: count ?? data?.length ?? 0 };
}

export async function getAllActiveOppeDoctors(force = false): Promise<OppeDoctor[]> {
  if (force) invalidateOppeCache('doctors');
  return cached('doctors', async () => (await getOppeDoctors({ status: 'aktif' })).rows);
}

export async function getMyOppeDoctor(userId: string): Promise<OppeDoctor | null> {
  const { data, error } = await supabase.from(T.doctors).select('*, oppe_ksm(name)').eq('user_id', userId).maybeSingle();
  if (error) return null;
  return data ? rowToDoctor(data) : null;
}

export async function saveOppeDoctor(d: Partial<OppeDoctor> & { name: string }, actor: { id: string; name: string }): Promise<OppeDoctor> {
  const row = doctorToRow(d);
  const { data, error } = d.id
    ? await supabase.from(T.doctors).update(row).eq('id', d.id).select('*, oppe_ksm(name)').single()
    : await supabase.from(T.doctors).insert({ ...row, created_by: actor.id }).select('*, oppe_ksm(name)').single();
  if (error) throw error;
  invalidateOppeCache('doctors');
  await logOppeAudit({ action: d.id ? 'update' : 'create', userId: actor.id, userName: actor.name, entityType: 'oppe_doctors', entityId: data.id, newData: row });
  return rowToDoctor(data);
}

export async function deleteOppeDoctor(id: string, actor: { id: string; name: string }): Promise<void> {
  const { error } = await supabase.from(T.doctors).delete().eq('id', id);
  if (error) throw error;
  invalidateOppeCache('doctors');
  await logOppeAudit({ action: 'delete', userId: actor.id, userName: actor.name, entityType: 'oppe_doctors', entityId: id });
}

// ────────────────────────────────────────────────────────────────
// Indikator & template
// ────────────────────────────────────────────────────────────────
export async function getOppeIndicators(filters: { categoryId?: string; ksmId?: string; active?: boolean; search?: string } = {}): Promise<OppeIndicator[]> {
  let q = supabase.from(T.indicators).select('*, oppe_indicator_categories(code)');
  if (filters.categoryId) q = q.eq('category_id', filters.categoryId);
  if (filters.ksmId) q = q.eq('ksm_id', filters.ksmId);
  if (filters.active !== undefined) q = q.eq('is_active', filters.active);
  if (filters.search) {
    const s = filters.search.replace(/[%,()]/g, '');
    q = q.or(`name.ilike.%${s}%,code.ilike.%${s}%`);
  }
  const { data, error } = await q.order('code');
  if (error) throw error;
  return (data ?? []).map(rowToIndicator);
}

export function validateIndicator(i: Partial<OppeIndicator>): string | null {
  if (!i.code?.trim()) return 'Kode indikator wajib diisi.';
  if (!i.name?.trim()) return 'Nama indikator wajib diisi.';
  if (!i.categoryId) return 'Kategori wajib dipilih.';
  if (!i.dataType) return 'Tipe data wajib dipilih.';
  const categorical = isCategorical(i.dataType) || i.targetOperator === 'category';
  if (categorical) {
    if (!i.options || i.options.length < 2) return 'Indikator kategori membutuhkan minimal 2 pilihan nilai.';
    if (!i.passValues || i.passValues.length === 0) return 'Tentukan minimal satu nilai yang dianggap memenuhi target.';
    if (i.passValues.some((p) => !i.options!.includes(p))) return 'Nilai lulus harus termasuk dalam daftar pilihan.';
  } else {
    const needsTarget = !['zero', 'pct100'].includes(String(i.targetOperator));
    const relativeTrigger = i.triggerOperator === 'lt_target' || i.triggerOperator === 'gt_target';
    if (needsTarget && (i.targetValue === null || i.targetValue === undefined) && !relativeTrigger) return 'Nilai target wajib diisi (atau gunakan trigger relatif "< target"/"> target" bila target ditetapkan per evaluasi).';
    if (['lt', 'lte', 'gt', 'gte', 'eq', 'neq'].includes(String(i.triggerOperator)) && (i.triggerValue === null || i.triggerValue === undefined)) return 'Nilai trigger wajib diisi untuk operator trigger yang dipilih.';
    if (i.targetOperator === 'gte' && i.triggerOperator === 'lt' && i.targetValue != null && i.triggerValue != null && i.triggerValue > i.targetValue) return 'Trigger tidak valid: batas trigger "<" lebih besar dari target "≥".';
    if (i.targetOperator === 'lte' && i.triggerOperator === 'gt' && i.targetValue != null && i.triggerValue != null && i.triggerValue < i.targetValue) return 'Trigger tidak valid: batas trigger ">" lebih kecil dari target "≤".';
    if (i.dataType === 'percent' && i.targetValue != null && (i.targetValue < 0 || i.targetValue > 100)) return 'Target persen harus 0–100.';
  }
  if (i.weight !== undefined && i.weight !== null && Number(i.weight) <= 0) return 'Bobot indikator harus > 0.';
  return null;
}

export async function saveOppeIndicator(i: Partial<OppeIndicator>, actor: { id: string; name: string }): Promise<OppeIndicator> {
  const invalid = validateIndicator(i);
  if (invalid) throw new Error(invalid);
  const row = indicatorToRow(i);
  const before = i.id ? (await supabase.from(T.indicators).select('*').eq('id', i.id).maybeSingle()).data : null;
  const { data, error } = i.id
    ? await supabase.from(T.indicators).update(row).eq('id', i.id).select('*, oppe_indicator_categories(code)').single()
    : await supabase.from(T.indicators).insert({ ...row, created_by: actor.id }).select('*, oppe_indicator_categories(code)').single();
  if (error) throw error;
  await logOppeAudit({ action: i.id ? 'update' : 'create', userId: actor.id, userName: actor.name, entityType: 'oppe_indicators', entityId: data.id, oldData: before, newData: row });
  return rowToIndicator(data);
}

export async function getOppeTemplates(): Promise<OppeTemplate[]> {
  const { data, error } = await supabase.from(T.templates).select('*, oppe_template_indicators(count)').order('name');
  if (error) throw error;
  return (data ?? []).map(rowToTemplate);
}

export async function getOppeTemplateIndicators(templateId: string): Promise<(OppeTemplateIndicator & { indicator: OppeIndicator })[]> {
  const { data, error } = await supabase
    .from(T.templateIndicators)
    .select('*, oppe_indicators(*, oppe_indicator_categories(code))')
    .eq('template_id', templateId)
    .order('sequence');
  if (error) throw error;
  return (data ?? []).map((r: Row) => ({
    id: r.id, templateId: r.template_id, indicatorId: r.indicator_id, sequence: r.sequence, isActive: !!r.is_active,
    indicator: rowToIndicator(r.oppe_indicators),
  }));
}

export async function saveOppeTemplate(t: Partial<OppeTemplate> & { code: string; name: string }, indicatorIds: string[] | null, actor: { id: string; name: string }): Promise<OppeTemplate> {
  const payload = { code: t.code.trim().toUpperCase(), name: t.name.trim(), profession: t.profession || null, ksm_id: t.ksmId || null, description: t.description ?? null, is_active: t.isActive ?? true };
  const { data, error } = t.id
    ? await supabase.from(T.templates).update(payload).eq('id', t.id).select('*').single()
    : await supabase.from(T.templates).insert({ ...payload, created_by: actor.id }).select('*').single();
  if (error) throw error;
  if (indicatorIds) {
    if (new Set(indicatorIds).size !== indicatorIds.length) throw new Error('Template tidak boleh berisi indikator duplikat.');
    const { error: delErr } = await supabase.from(T.templateIndicators).delete().eq('template_id', data.id);
    if (delErr) throw delErr;
    if (indicatorIds.length > 0) {
      const { error: insErr } = await supabase.from(T.templateIndicators).insert(indicatorIds.map((id, idx) => ({ template_id: data.id, indicator_id: id, sequence: idx + 1 })));
      if (insErr) throw insErr;
    }
  }
  await logOppeAudit({ action: t.id ? 'update' : 'create', userId: actor.id, userName: actor.name, entityType: 'oppe_templates', entityId: data.id, newData: { ...payload, indicatorIds } });
  return rowToTemplate(data);
}

/** Pilih template paling cocok: KSM + profesi -> KSM -> profesi. */
export function suggestTemplate(templates: OppeTemplate[], ksmId: string | null, profession: string | null): OppeTemplate | null {
  const active = templates.filter((t) => t.isActive);
  return (
    active.find((t) => t.ksmId === ksmId && (!profession || t.profession === profession)) ??
    active.find((t) => t.ksmId === ksmId) ??
    active.find((t) => !t.ksmId && t.profession === profession) ??
    null
  );
}

// ────────────────────────────────────────────────────────────────
// Evaluasi
// ────────────────────────────────────────────────────────────────
const EVAL_SELECT = '*, oppe_doctors(name), oppe_ksm(name)';

function applyEvalFilters<Q extends { eq: any; ilike: any; or: any }>(q: Q, f: OppeEvaluationFilters): Q {
  let query: any = q;
  if (f.year) query = query.eq('year', f.year);
  if (f.periodType) query = query.eq('period_type', f.periodType);
  if (f.semester) query = query.eq('semester', f.semester);
  if (f.ksmId) query = query.eq('ksm_id', f.ksmId);
  if (f.doctorId) query = query.eq('doctor_id', f.doctorId);
  if (f.evaluatorId) query = query.eq('evaluator_id', f.evaluatorId);
  if (f.profession) query = query.eq('profession', f.profession);
  if (f.unitId) query = query.eq('unit_id', f.unitId);
  if (f.status) query = query.eq('status', f.status);
  if (f.finalCategory) query = query.eq('final_category', f.finalCategory);
  if (f.requiresFppe !== undefined) query = query.eq('requires_fppe', f.requiresFppe);
  return query as Q;
}

export async function getOppeEvaluations(f: OppeEvaluationFilters = {}): Promise<{ rows: OppeEvaluation[]; total: number }> {
  let q = supabase.from(T.evaluations).select(EVAL_SELECT, { count: 'exact' });
  q = applyEvalFilters(q, f);
  if (f.search) {
    // cari berdasarkan nama dokter: ambil id dokter yang cocok dulu (server-side, dibatasi)
    const s = f.search.replace(/[%,()]/g, '');
    const { data: docs } = await supabase.from(T.doctors).select('id').ilike('name', `%${s}%`).limit(200);
    const ids = (docs ?? []).map((d: Row) => d.id);
    q = ids.length > 0 ? q.or(`evaluation_number.ilike.%${s}%,doctor_id.in.(${ids.join(',')})`) : q.ilike('evaluation_number', `%${s}%`);
  }
  q = q.order(f.sortBy ?? 'updated_at', { ascending: f.sortDir === 'asc', nullsFirst: false });
  if (f.pageSize) {
    const page = f.page ?? 0;
    q = q.range(page * f.pageSize, page * f.pageSize + f.pageSize - 1);
  } else {
    q = q.limit(2000);
  }
  const { data, error, count } = await q;
  if (error) throw error;
  return { rows: (data ?? []).map(rowToEvaluation), total: count ?? 0 };
}

export async function getOppeEvaluationById(id: string): Promise<{ evaluation: OppeEvaluation; items: OppeEvaluationItem[] } | null> {
  const { data, error } = await supabase.from(T.evaluations).select(EVAL_SELECT).eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { data: items, error: e2 } = await supabase.from(T.items).select('*').eq('evaluation_id', id).order('sequence');
  if (e2) throw e2;
  return { evaluation: rowToEvaluation(data), items: (items ?? []).map(rowToItem) };
}

export async function getDoctorEvaluationHistory(doctorId: string): Promise<OppeEvaluation[]> {
  const { data, error } = await supabase.from(T.evaluations).select(EVAL_SELECT).eq('doctor_id', doctorId).limit(200);
  if (error) throw error;
  return (data ?? []).map(rowToEvaluation).sort((a, b) => periodSortKey(a) - periodSortKey(b));
}

export interface NewEvaluationInput {
  doctor: OppeDoctor;
  templateId: string | null;
  /** indikator tambahan/pengganti: bila diisi dipakai sebagai daftar akhir (urutan = urutan array). */
  indicatorIds?: string[];
  periodType: OppePeriodType;
  year: number;
  periodStart?: string | null;
  periodEnd?: string | null;
  evaluatorId: string;
  evaluatorName: string;
  evaluationDate?: string | null;
  dueDate?: string | null;
  unitId?: string | null;
  unitName?: string | null;
  ksmId?: string | null;
}

export function validateNewEvaluation(input: Partial<NewEvaluationInput>): string | null {
  if (!input.doctor) return 'Dokter wajib dipilih.';
  if (!(input.ksmId ?? input.doctor.ksmId)) return 'KSM wajib diisi (lengkapi KSM pada data dokter atau pilih KSM).';
  if (!input.periodType) return 'Periode wajib dipilih.';
  if (!input.year || input.year < 2000 || input.year > 2100) return 'Tahun wajib diisi dengan benar.';
  if (input.periodType === 'custom' && (!input.periodStart || !input.periodEnd)) return 'Periode custom membutuhkan tanggal mulai dan selesai.';
  if (input.periodType === 'custom' && input.periodStart && input.periodEnd && input.periodEnd < input.periodStart) return 'Tanggal selesai periode harus setelah tanggal mulai.';
  if (!input.evaluatorId) return 'Evaluator wajib diisi.';
  if (!input.templateId && (!input.indicatorIds || input.indicatorIds.length === 0)) return 'Pilih template atau minimal satu indikator.';
  if (input.indicatorIds && new Set(input.indicatorIds).size !== input.indicatorIds.length) return 'Tidak boleh ada indikator duplikat.';
  return null;
}

export async function createOppeEvaluation(input: NewEvaluationInput, actor: { id: string; name: string }): Promise<string> {
  const invalid = validateNewEvaluation(input);
  if (invalid) throw new Error(invalid);

  let indicators: OppeIndicator[];
  if (input.indicatorIds && input.indicatorIds.length > 0) {
    const { data, error } = await supabase.from(T.indicators).select('*, oppe_indicator_categories(code)').in('id', input.indicatorIds);
    if (error) throw error;
    const byId = new Map((data ?? []).map((r: Row) => [r.id, rowToIndicator(r)]));
    indicators = input.indicatorIds.map((id) => byId.get(id)).filter(Boolean) as OppeIndicator[];
  } else {
    indicators = (await getOppeTemplateIndicators(input.templateId!)).filter((t) => t.isActive && t.indicator.isActive).map((t) => t.indicator);
  }
  if (indicators.length === 0) throw new Error('Template tidak memiliki indikator aktif.');

  const semester = input.periodType === 'semester_1' ? 1 : input.periodType === 'semester_2' ? 2 : null;
  const { data: ev, error } = await supabase.from(T.evaluations).insert({
    doctor_id: input.doctor.id,
    ksm_id: input.ksmId ?? input.doctor.ksmId,
    unit_id: input.unitId ?? input.doctor.unitId,
    unit_name: input.unitName ?? input.doctor.unitName,
    profession: input.doctor.profession,
    specialty: input.doctor.specialty,
    template_id: input.templateId,
    period_type: input.periodType,
    year: input.year,
    semester,
    period_start: input.periodType === 'custom' ? input.periodStart : null,
    period_end: input.periodType === 'custom' ? input.periodEnd : null,
    evaluator_id: input.evaluatorId,
    evaluator_name: input.evaluatorName,
    evaluation_date: input.evaluationDate || new Date().toISOString().slice(0, 10),
    due_date: input.dueDate || null,
    status: 'draft',
    created_by: actor.id,
  }).select('id').single();
  if (error) throw error;

  const cats = await getOppeCategories();
  const catCode = new Map(cats.map((c) => [c.id, c.code]));
  const itemRows = indicators.map((ind, idx) => ({
    evaluation_id: ev.id, indicator_id: ind.id, sequence: idx + 1, category_id: ind.categoryId,
    category_code: ind.categoryCode ?? catCode.get(ind.categoryId) ?? 'C', code: ind.code, name: ind.name,
    data_type: ind.dataType, unit_label: ind.unitLabel, target_text: ind.targetText, target_operator: ind.targetOperator,
    target_value: ind.targetValue, trigger_text: ind.triggerText, trigger_operator: ind.triggerOperator, trigger_value: ind.triggerValue,
    options: ind.options, pass_values: ind.passValues, attention_values: ind.attentionValues, is_critical: ind.isCritical,
    weight: ind.weight, score_met: ind.scoreMet, score_attention: ind.scoreAttention, score_trigger: ind.scoreTrigger,
    source_data: ind.sourceData, quality_indicator_id: ind.qualityIndicatorId, status: 'no_data',
  }));
  const { error: itemErr } = await supabase.from(T.items).insert(itemRows);
  if (itemErr) {
    await supabase.from(T.evaluations).delete().eq('id', ev.id);
    throw itemErr;
  }
  await logOppeAudit({
    action: 'create', userId: actor.id, userName: actor.name, evaluationId: ev.id,
    newData: { doctor: input.doctor.name, periodType: input.periodType, year: input.year, templateId: input.templateId, indicatorCount: indicators.length },
  });
  return ev.id;
}

/** Hitung ulang item + skor evaluasi memakai engine, lalu simpan. Evaluasi FINAL tidak disentuh. */
export async function recalculateOppeEvaluation(
  evaluationId: string,
  opts: { items?: OppeEvaluationItem[]; settings?: OppeSettings; categories?: OppeIndicatorCategory[]; extra?: Row } = {}
): Promise<{ evaluation: OppeEvaluation; items: OppeEvaluationItem[] }> {
  const loaded = await getOppeEvaluationById(evaluationId);
  if (!loaded) throw new Error('Evaluasi tidak ditemukan.');
  if (loaded.evaluation.status === 'finalized') return loaded;
  const settings = opts.settings ?? (await getOppeSettings());
  const categories = opts.categories ?? (await getOppeCategories());
  const items = (opts.items ?? loaded.items).map((it) => {
    const r = evaluateItem(it, settings);
    const catWeight = categories.find((c) => c.id === it.categoryId || c.code === it.categoryCode)?.weight ?? 0;
    return {
      ...it,
      realizationNumber: isCategorical(it.dataType) ? null : (it.realizationNumber ?? parseNumeric(it.realizationText, it.dataType)),
      status: r.status, isTrigger: r.isTrigger, achievement: r.achievement, score: r.score, statusReason: r.reason,
      weightedScore: r.score === null ? null : round2((r.score * catWeight) / 100),
    } as OppeEvaluationItem;
  });

  // periode sebelumnya (dokter sama) untuk trend
  const history = await getDoctorEvaluationHistory(loaded.evaluation.doctorId);
  const myKey = periodSortKey(loaded.evaluation);
  const previous = history
    .filter((h) => h.id !== evaluationId && periodSortKey(h) < myKey && h.finalScore !== null)
    .sort((a, b) => periodSortKey(b) - periodSortKey(a))[0];
  let previousHadFppe = false;
  if (previous) {
    const { count } = await supabase.from(T.fppe).select('id', { count: 'exact', head: true }).eq('evaluation_id', previous.id);
    previousHadFppe = (count ?? 0) > 0 || previous.requiresFppe;
  }

  const comp = computeEvaluation({
    items: items.map((i) => ({ id: i.id, name: i.name, code: i.code, categoryId: i.categoryId, categoryCode: i.categoryCode, weight: i.weight, isCritical: i.isCritical, status: i.status, score: i.score })),
    categories,
    settings,
    previousScore: previous?.finalScore ?? null,
    previousHadFppe,
  });

  if (items.length > 0) {
    const { error } = await supabase.from(T.items).upsert(items.map(itemToRow), { onConflict: 'id' });
    if (error) throw error;
  }

  const status: OppeEvaluationStatus =
    loaded.evaluation.status === 'draft' && items.some((i) => i.status !== 'no_data') ? 'in_progress' : loaded.evaluation.status;

  const patch: Row = {
    score_professional: comp.scoreProfessional,
    score_development: comp.scoreDevelopment,
    score_clinical: comp.scoreClinical,
    weighted_score: comp.weightedScore,
    final_score: comp.finalScore,
    category_scores: comp.categoryScores,
    final_category: comp.finalCategory?.code ?? null,
    final_category_label: comp.finalCategory?.label ?? null,
    met_count: comp.metCount,
    attention_count: comp.attentionCount,
    trigger_count: comp.triggerCount,
    no_data_count: comp.noDataCount,
    critical_trigger_count: comp.criticalTriggers.length,
    critical_indicators: comp.criticalTriggers.map((i) => i.name).join('; ') || null,
    requires_fppe: comp.requiresFppe,
    trend: comp.trend,
    previous_score: previous?.finalScore ?? null,
    conclusion: comp.conclusion,
    recommendation: comp.recommendation,
    needs_recalc: false,
    status,
    ...(opts.extra ?? {}),
  };
  const { error: e2 } = await supabase.from(T.evaluations).update(patch).eq('id', evaluationId);
  if (e2) throw e2;
  const fresh = await getOppeEvaluationById(evaluationId);
  return fresh!;
}

/** Simpan input realisasi/target/catatan/evidence dari form, lalu hitung ulang. */
export async function saveOppeEvaluationItems(
  evaluationId: string,
  items: OppeEvaluationItem[],
  actor: { id: string; name: string },
  extra?: { notes?: string | null; recommendationOverride?: string | null; evaluationDate?: string | null; dueDate?: string | null }
): Promise<{ evaluation: OppeEvaluation; items: OppeEvaluationItem[] }> {
  const before = await getOppeEvaluationById(evaluationId);
  if (!before) throw new Error('Evaluasi tidak ditemukan.');
  if (before.evaluation.status === 'finalized') throw new Error('Evaluasi OPPE sudah FINAL dan tidak dapat diubah. Gunakan "Buka Kembali" (Reopen) dengan alasan.');
  if (new Set(items.filter((i) => i.indicatorId).map((i) => i.indicatorId)).size !== items.filter((i) => i.indicatorId).length) throw new Error('Tidak boleh ada indikator duplikat dalam satu evaluasi.');

  for (const it of items) {
    if (!isCategorical(it.dataType) && it.realizationText && it.realizationText.trim() !== '' && parseNumeric(it.realizationText, it.dataType) === null) {
      throw new Error(`Realisasi "${it.name}" harus berupa angka.`);
    }
    if (isCategorical(it.dataType) && it.realizationText && it.options.length > 0 && !it.options.map((o) => o.toLowerCase()).includes(it.realizationText.trim().toLowerCase())) {
      throw new Error(`Realisasi "${it.name}" harus salah satu dari: ${it.options.join(', ')}.`);
    }
    if (it.dataType === 'percent') {
      const n = parseNumeric(it.realizationText, 'percent');
      if (n !== null && (n < 0 || n > 100)) throw new Error(`Realisasi persen "${it.name}" harus 0–100.`);
    }
    if (!isCategorical(it.dataType)) {
      const n = parseNumeric(it.realizationText, it.dataType);
      if (n !== null && n < 0) throw new Error(`Realisasi "${it.name}" tidak boleh negatif.`);
    }
  }

  const normalized = items.map((it) => ({
    ...it,
    realizationText: it.realizationText?.trim() ? it.realizationText.trim() : null,
    realizationNumber: isCategorical(it.dataType) ? null : parseNumeric(it.realizationText, it.dataType),
  }));

  const extraRow: Row = {};
  if (extra?.notes !== undefined) extraRow.notes = extra.notes;
  if (extra?.recommendationOverride !== undefined) extraRow.recommendation_override = extra.recommendationOverride;
  if (extra?.evaluationDate !== undefined) extraRow.evaluation_date = extra.evaluationDate;
  if (extra?.dueDate !== undefined) extraRow.due_date = extra.dueDate;

  const result = await recalculateOppeEvaluation(evaluationId, { items: normalized, extra: extraRow });

  const changed = normalized
    .filter((n) => {
      const old = before.items.find((o) => o.id === n.id);
      return !old || old.realizationText !== n.realizationText || old.targetValue !== n.targetValue || old.notes !== n.notes || old.evidenceUrl !== n.evidenceUrl;
    })
    .map((n) => {
      const old = before.items.find((o) => o.id === n.id);
      return { code: n.code, name: n.name, old: old ? { realisasi: old.realizationText, target: old.targetValue, status: old.status } : null, new: { realisasi: n.realizationText, target: n.targetValue } };
    });

  await logOppeAudit({
    action: 'update', userId: actor.id, userName: actor.name, evaluationId,
    oldData: { finalScore: before.evaluation.finalScore, status: before.evaluation.status, changes: changed.map((c) => ({ code: c.code, ...c.old })) },
    newData: { finalScore: result.evaluation.finalScore, category: result.evaluation.finalCategoryLabel, triggerCount: result.evaluation.triggerCount, changes: changed.map((c) => ({ code: c.code, ...c.new })) },
  });

  if (result.evaluation.triggerCount > before.evaluation.triggerCount || (result.evaluation.requiresFppe && !before.evaluation.requiresFppe)) {
    await supabase.from(T.appAudit).insert({
      type: 'oppe', badge: 'OPPE Trigger', ts: new Date().toLocaleString('id-ID'), user_id: actor.id,
      entity_type: 'oppe_evaluations', entity_id: evaluationId,
      msg: `OPPE ${result.evaluation.doctorName ?? ''} — ${result.evaluation.triggerCount} indikator trigger${result.evaluation.requiresFppe ? ', rekomendasi FPPE' : ''}`,
    });
  }
  return result;
}

/** Hitung ulang semua evaluasi yang ditandai needs_recalc (mis. setelah import). */
export async function recalculatePendingOppeEvaluations(): Promise<number> {
  const { data, error } = await supabase.from(T.evaluations).select('id').eq('needs_recalc', true).neq('status', 'finalized').limit(500);
  if (error) throw error;
  const settings = await getOppeSettings();
  const categories = await getOppeCategories();
  let n = 0;
  for (const r of data ?? []) {
    try {
      await recalculateOppeEvaluation(r.id, { settings, categories });
      n++;
    } catch (e) {
      console.error('[OPPE] gagal hitung ulang', r.id, e);
    }
  }
  return n;
}

// ── Workflow ────────────────────────────────────────────────────
type Transition = 'submit' | 'return' | 'review' | 'approve' | 'finalize' | 'reopen';

const TRANSITIONS: Record<Transition, { from: OppeEvaluationStatus[]; to: OppeEvaluationStatus; action: OppeAuditAction; committeeOnly: boolean }> = {
  submit: { from: ['draft', 'in_progress'], to: 'submitted', action: 'submit', committeeOnly: false },
  return: { from: ['submitted', 'reviewed', 'approved'], to: 'in_progress', action: 'update', committeeOnly: true },
  review: { from: ['submitted'], to: 'reviewed', action: 'review', committeeOnly: true },
  approve: { from: ['reviewed'], to: 'approved', action: 'approve', committeeOnly: true },
  finalize: { from: ['approved'], to: 'finalized', action: 'finalize', committeeOnly: true },
  reopen: { from: ['finalized'], to: 'in_progress', action: 'reopen', committeeOnly: true },
};

export async function transitionOppeEvaluation(params: {
  evaluationId: string;
  transition: Transition;
  actor: { id: string; name: string };
  isCommittee: boolean;
  notes?: string;
}): Promise<OppeEvaluation> {
  const t = TRANSITIONS[params.transition];
  const loaded = await getOppeEvaluationById(params.evaluationId);
  if (!loaded) throw new Error('Evaluasi tidak ditemukan.');
  const ev = loaded.evaluation;
  if (!t.from.includes(ev.status)) throw new Error(`Status saat ini "${OPPE_STATUS_LABEL[ev.status]}" tidak dapat diproses ke "${OPPE_STATUS_LABEL[t.to]}".`);
  if (t.committeeOnly && !params.isCommittee) throw new Error('Hanya Komite Medik/Mutu yang dapat melakukan tindakan ini.');
  if ((params.transition === 'reopen' || params.transition === 'return') && !params.notes?.trim()) throw new Error('Alasan wajib diisi.');

  if (params.transition === 'submit') {
    const settings = await getOppeSettings();
    const empty = loaded.items.filter((i) => i.status === 'no_data');
    if (settings.requireCompleteBeforeSubmit && empty.length > 0) {
      throw new Error(`${empty.length} indikator belum diisi realisasinya: ${empty.slice(0, 5).map((i) => i.code ?? i.name).join(', ')}${empty.length > 5 ? ', …' : ''}.`);
    }
    if (ev.needsRecalc) await recalculateOppeEvaluation(ev.id);
  }

  const now = new Date().toISOString();
  const patch: Row = { status: t.to };
  if (params.transition === 'review') { patch.reviewed_by = params.actor.id; patch.reviewed_at = now; patch.review_notes = params.notes ?? null; }
  if (params.transition === 'approve') { patch.approved_by = params.actor.id; patch.approved_at = now; }
  if (params.transition === 'finalize') { patch.finalized_by = params.actor.id; patch.finalized_at = now; }
  if (params.transition === 'reopen') { patch.reopen_reason = params.notes; patch.reopened_by = params.actor.id; patch.reopened_at = now; }
  if (params.transition === 'return') { patch.review_notes = params.notes; }

  const { error } = await supabase.from(T.evaluations).update(patch).eq('id', ev.id);
  if (error) throw error;

  const label = `${ev.doctorName ?? 'Dokter'} — ${periodLabel(ev)}`;
  const msgs: Record<Transition, string> = {
    submit: `OPPE diajukan, menunggu review: ${label}`,
    return: `OPPE dikembalikan ke evaluator: ${label}`,
    review: `OPPE direview, menunggu approval: ${label}`,
    approve: `OPPE disetujui: ${label}`,
    finalize: `OPPE difinalisasi: ${label}`,
    reopen: `OPPE dibuka kembali: ${label}`,
  };
  await logOppeAudit({
    action: t.action, userId: params.actor.id, userName: params.actor.name, evaluationId: ev.id,
    oldData: { status: ev.status }, newData: { status: t.to }, reason: params.notes ?? null, notifyMsg: msgs[params.transition],
  });
  const fresh = await getOppeEvaluationById(ev.id);
  return fresh!.evaluation;
}

export async function deleteOppeEvaluation(id: string, actor: { id: string; name: string }): Promise<void> {
  const loaded = await getOppeEvaluationById(id);
  const { error } = await supabase.from(T.evaluations).delete().eq('id', id);
  if (error) throw error;
  await logOppeAudit({
    action: 'delete', userId: actor.id, userName: actor.name, evaluationId: id,
    oldData: loaded ? { number: loaded.evaluation.evaluationNumber, doctor: loaded.evaluation.doctorName, period: periodLabel(loaded.evaluation), finalScore: loaded.evaluation.finalScore, items: loaded.items.map((i) => ({ code: i.code, realisasi: i.realizationText, status: i.status })) } : null,
  });
}

/** Duplikat evaluasi ke periode lain: indikator & target disalin, realisasi dikosongkan. */
export async function duplicateOppeEvaluation(params: { sourceId: string; periodType: OppePeriodType; year: number; periodStart?: string | null; periodEnd?: string | null; actor: { id: string; name: string } }): Promise<string> {
  const src = await getOppeEvaluationById(params.sourceId);
  if (!src) throw new Error('Evaluasi sumber tidak ditemukan.');
  const semester = params.periodType === 'semester_1' ? 1 : params.periodType === 'semester_2' ? 2 : null;
  const e = src.evaluation;
  const { data: ev, error } = await supabase.from(T.evaluations).insert({
    doctor_id: e.doctorId, ksm_id: e.ksmId, unit_id: e.unitId, unit_name: e.unitName, profession: e.profession, specialty: e.specialty,
    template_id: e.templateId, period_type: params.periodType, year: params.year, semester,
    period_start: params.periodType === 'custom' ? params.periodStart : null, period_end: params.periodType === 'custom' ? params.periodEnd : null,
    evaluator_id: params.actor.id, evaluator_name: params.actor.name, evaluation_date: new Date().toISOString().slice(0, 10),
    status: 'draft', created_by: params.actor.id,
  }).select('id').single();
  if (error) throw error;
  const rows = src.items.map((it) => {
    const r = itemToRow({ ...it, realizationText: null, realizationNumber: null, achievement: null, score: null, weightedScore: null, status: 'no_data', isTrigger: false, statusReason: null, notes: null, evidenceUrl: null, evidencePath: null });
    delete r.id;
    r.evaluation_id = ev.id;
    return r;
  });
  const { error: e2 } = await supabase.from(T.items).insert(rows);
  if (e2) { await supabase.from(T.evaluations).delete().eq('id', ev.id); throw e2; }
  await logOppeAudit({ action: 'create', userId: params.actor.id, userName: params.actor.name, evaluationId: ev.id, newData: { duplicatedFrom: e.evaluationNumber, periodType: params.periodType, year: params.year } });
  return ev.id;
}

// ── Evidence ──────────────────────────────────────────────────────
export async function uploadOppeEvidence(evaluationId: string, itemId: string, file: File): Promise<string> {
  if (file.size > 10 * 1024 * 1024) throw new Error('Ukuran file maksimal 10 MB.');
  const safe = file.name.replace(/[^\w.\-]+/g, '_');
  const path = `${evaluationId}/${itemId}/${Date.now()}_${safe}`;
  const { error } = await supabase.storage.from(OPPE_EVIDENCE_BUCKET).upload(path, file, { upsert: false, contentType: file.type || undefined });
  if (error) throw error;
  return path;
}

export async function getOppeEvidenceUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(OPPE_EVIDENCE_BUCKET).createSignedUrl(path, 3600);
  if (error) { console.error('[OPPE evidence]', error); return null; }
  return data?.signedUrl ?? null;
}

// ── Integrasi Indikator Mutu (poin 38) ────────────────────────────
export async function getQualityIndicatorOptions(): Promise<{ id: string; name: string; code: string | null }[]> {
  return cached('quality-indicators', async () => {
    const { data, error } = await supabase.from('custom_indicators').select('id, name, code').order('name').limit(500);
    if (error) { console.warn('[OPPE] modul Indikator Mutu belum tersedia:', error.message); return []; }
    return (data ?? []).map((r: Row) => ({ id: r.id, name: r.name, code: r.code ?? null }));
  });
}

/**
 * Tarik nilai realisasi dari modul Indikator Mutu (custom_indicator_measurements)
 * untuk rentang periode evaluasi: Σnumerator/Σdenominator×100 bila tersedia,
 * selain itu rata-rata `value`. Catatan: data indikator mutu bersifat per UNIT,
 * bukan per dokter — dipakai sebagai proksi/sumber data pendukung, evaluator
 * tetap dapat mengoreksi nilainya.
 */
export async function pullQualityIndicatorValue(indicatorId: string, start: string, end: string): Promise<{ value: number | null; n: number }> {
  const { data, error } = await supabase
    .from('custom_indicator_measurements')
    .select('numerator, denominator, value')
    .eq('indicator_id', indicatorId)
    .gte('measurement_date', start)
    .lte('measurement_date', end)
    .limit(5000);
  if (error) throw error;
  const rows = data ?? [];
  if (rows.length === 0) return { value: null, n: 0 };
  const withND = rows.filter((r: Row) => r.numerator !== null && r.denominator !== null && Number(r.denominator) > 0);
  if (withND.length > 0) {
    const nSum = withND.reduce((s: number, r: Row) => s + Number(r.numerator), 0);
    const dSum = withND.reduce((s: number, r: Row) => s + Number(r.denominator), 0);
    return { value: round2((nSum / dSum) * 100), n: rows.length };
  }
  const vals = rows.map((r: Row) => num(r.value)).filter((v): v is number => v !== null);
  return { value: vals.length ? round2(vals.reduce((a, b) => a + b, 0) / vals.length) : null, n: rows.length };
}

export function evaluationPeriodRange(e: Pick<OppeEvaluation, 'periodType' | 'year' | 'periodStart' | 'periodEnd'>): { start: string; end: string } {
  if (e.periodType === 'custom' && e.periodStart && e.periodEnd) return { start: e.periodStart, end: e.periodEnd };
  if (e.periodType === 'semester_1') return { start: `${e.year}-01-01`, end: `${e.year}-06-30` };
  if (e.periodType === 'semester_2') return { start: `${e.year}-07-01`, end: `${e.year}-12-31` };
  return { start: `${e.year}-01-01`, end: `${e.year}-12-31` };
}

// ────────────────────────────────────────────────────────────────
// FPPE
// ────────────────────────────────────────────────────────────────
export async function getOppeFppeList(filters: { doctorId?: string; status?: string; evaluationId?: string; ksmId?: string } = {}): Promise<OppeFppe[]> {
  let q = supabase.from(T.fppe).select('*, oppe_doctors(name), oppe_ksm(name)');
  if (filters.doctorId) q = q.eq('doctor_id', filters.doctorId);
  if (filters.status) q = q.eq('status', filters.status);
  if (filters.evaluationId) q = q.eq('evaluation_id', filters.evaluationId);
  if (filters.ksmId) q = q.eq('ksm_id', filters.ksmId);
  const { data, error } = await q.order('created_at', { ascending: false }).limit(1000);
  if (error) throw error;
  return (data ?? []).map(rowToFppe);
}

export function validateFppe(f: Partial<OppeFppe>): string | null {
  if (!f.doctorId) return 'Dokter wajib dipilih.';
  if (!f.reason?.trim()) return 'Alasan FPPE wajib diisi.';
  if (f.startDate && f.endDate && f.endDate < f.startDate) return 'Tanggal selesai harus setelah tanggal mulai.';
  if (f.status === 'selesai' && !f.result?.trim()) return 'Hasil FPPE wajib diisi sebelum status Selesai.';
  return null;
}

export async function saveOppeFppe(f: Partial<OppeFppe>, actor: { id: string; name: string }): Promise<OppeFppe> {
  const invalid = validateFppe(f);
  if (invalid) throw new Error(invalid);
  const row = fppeToRow(f);
  const before = f.id ? (await supabase.from(T.fppe).select('*').eq('id', f.id).maybeSingle()).data : null;
  const { data, error } = f.id
    ? await supabase.from(T.fppe).update(row).eq('id', f.id).select('*, oppe_doctors(name), oppe_ksm(name)').single()
    : await supabase.from(T.fppe).insert({ ...row, created_by: actor.id }).select('*, oppe_doctors(name), oppe_ksm(name)').single();
  if (error) throw error;
  const saved = rowToFppe(data);
  await logOppeAudit({
    action: f.id ? 'fppe_updated' : 'fppe_created', userId: actor.id, userName: actor.name, evaluationId: saved.evaluationId,
    entityType: 'oppe_fppe', entityId: saved.id, oldData: before, newData: row,
    notifyMsg: f.id ? undefined : `FPPE dibuat untuk ${saved.doctorName ?? 'dokter'}: ${saved.triggerIndicatorName ?? saved.reason ?? ''}`,
  });
  return saved;
}

// ────────────────────────────────────────────────────────────────
// Realtime
// ────────────────────────────────────────────────────────────────
export function subscribeToOppe(onChange: () => void): Unsubscribe {
  const channel = supabase
    .channel(`oppe-changes-${Math.random().toString(36).slice(2)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: T.evaluations }, () => onChange())
    .on('postgres_changes', { event: '*', schema: 'public', table: T.fppe }, () => onChange())
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

/** Item untuk banyak evaluasi sekaligus (export/laporan), dibagi per 100 id. */
export async function getOppeItemsForEvaluations(ids: string[]): Promise<Map<string, OppeEvaluationItem[]>> {
  const out = new Map<string, OppeEvaluationItem[]>();
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    const { data, error } = await supabase.from(T.items).select('*').in('evaluation_id', chunk).order('sequence');
    if (error) throw error;
    for (const r of data ?? []) {
      const it = rowToItem(r);
      if (!out.has(it.evaluationId)) out.set(it.evaluationId, []);
      out.get(it.evaluationId)!.push(it);
    }
  }
  return out;
}
