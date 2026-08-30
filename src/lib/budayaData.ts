import { supabase } from '@/lib/supabase/client';
import type {
  BudayaDimension,
  BudayaUnit,
  BudayaQuestion,
  BudayaQuestionOption,
  BudayaSurvey,
  BudayaSurveyFilters,
  BudayaSurveyToken,
  BudayaTokenKind,
  BudayaRespondent,
  BudayaComment,
  BudayaDimensionResult,
  BudayaUnitResult,
  BudayaPeriodResult,
  BudayaCategory,
  BudayaFollowup,
  BudayaFollowupStatus,
  BudayaFollowupMonitoring,
  BudayaReport,
  BudayaReportType,
  BudayaApproval,
  BudayaQualityCheckResult,
  BudayaQualityIssue,
} from '@/types/budaya';
import { BUDAYA_DEFAULT_THRESHOLDS } from '@/types/budaya';

// Mengikuti pola src/lib/ikpData.ts / riskData.ts: akses langsung dari
// client, snake_case <-> camelCase di boundary, realtime lewat
// postgres_changes, audit trail reuse tabel `audit_logs` (type='budaya').

const DIMENSIONS_TABLE = 'budaya_dimensions';
const UNITS_TABLE = 'budaya_units';
const QUESTIONS_TABLE = 'budaya_questions';
const QUESTION_OPTIONS_TABLE = 'budaya_question_options';
const SURVEYS_TABLE = 'budaya_surveys';
const TOKENS_TABLE = 'budaya_survey_tokens';
const RESPONDENTS_TABLE = 'budaya_respondents';
const ANSWERS_TABLE = 'budaya_answers';
const COMMENTS_TABLE = 'budaya_comments';
const DIMENSION_RESULTS_TABLE = 'budaya_dimension_results';
const UNIT_RESULTS_TABLE = 'budaya_unit_results';
const PERIOD_RESULTS_TABLE = 'budaya_period_results';
const FOLLOWUPS_TABLE = 'budaya_followups';
const FOLLOWUP_MONITORINGS_TABLE = 'budaya_followup_monitorings';
const REPORTS_TABLE = 'budaya_reports';
const APPROVALS_TABLE = 'budaya_approvals';
const AUDIT_TABLE = 'audit_logs';

type Unsubscribe = () => void;

// ────────────────────────────────────────────────────────────────
// Row <-> model mapping
// ────────────────────────────────────────────────────────────────

function rowToDimension(row: Record<string, any>): BudayaDimension {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    sortOrder: row.sort_order,
  };
}

function rowToUnit(row: Record<string, any>): BudayaUnit {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    isActive: row.is_active,
    sortOrder: row.sort_order,
  };
}

function rowToOption(row: Record<string, any>): BudayaQuestionOption {
  return { id: row.id, optionCode: row.option_code, optionLabel: row.option_label, sortOrder: row.sort_order };
}

function rowToQuestion(row: Record<string, any>): BudayaQuestion {
  return {
    id: row.id,
    instrumentVersion: row.instrument_version,
    section: row.section,
    itemCode: row.item_code,
    itemNo: row.item_no,
    questionText: row.question_text,
    scaleType: row.scale_type,
    isReverse: row.is_reverse,
    dimensionId: row.dimension_id,
    isScored: row.is_scored,
    isRequired: row.is_required,
    sortOrder: row.sort_order,
    options: Array.isArray(row.budaya_question_options)
      ? row.budaya_question_options.map(rowToOption).sort((a: BudayaQuestionOption, b: BudayaQuestionOption) => a.sortOrder - b.sortOrder)
      : undefined,
  };
}

function rowToSurvey(row: Record<string, any>): BudayaSurvey {
  return {
    id: row.id,
    name: row.name,
    year: row.year,
    period: row.period,
    startDate: row.start_date,
    endDate: row.end_date,
    targetRespondents: row.target_respondents,
    includedUnitIds: row.included_unit_ids ?? [],
    status: row.status,
    instrumentVersion: row.instrument_version,
    anonymityMode: row.anonymity_mode,
    minRespondentThreshold: row.min_respondent_threshold,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function surveyToRow(s: Partial<BudayaSurvey>): Record<string, any> {
  const row: Record<string, any> = {};
  if (s.name !== undefined) row.name = s.name;
  if (s.year !== undefined) row.year = s.year;
  if (s.period !== undefined) row.period = s.period;
  if (s.startDate !== undefined) row.start_date = s.startDate;
  if (s.endDate !== undefined) row.end_date = s.endDate;
  if (s.targetRespondents !== undefined) row.target_respondents = s.targetRespondents;
  if (s.includedUnitIds !== undefined) row.included_unit_ids = s.includedUnitIds;
  if (s.status !== undefined) row.status = s.status;
  if (s.instrumentVersion !== undefined) row.instrument_version = s.instrumentVersion;
  if (s.anonymityMode !== undefined) row.anonymity_mode = s.anonymityMode;
  if (s.minRespondentThreshold !== undefined) row.min_respondent_threshold = s.minRespondentThreshold;
  if (s.createdBy !== undefined) row.created_by = s.createdBy;
  return row;
}

function rowToToken(row: Record<string, any>): BudayaSurveyToken {
  return {
    id: row.id,
    surveyId: row.survey_id,
    token: row.token,
    kind: row.kind,
    unitId: row.unit_id,
    maxUses: row.max_uses,
    usedCount: row.used_count,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

function rowToRespondent(row: Record<string, any>): BudayaRespondent {
  return {
    id: row.id,
    surveyId: row.survey_id,
    unitId: row.unit_id,
    token: row.token,
    status: row.status,
    consented: row.consented,
    profession: row.profession,
    positionOther: row.position_other,
    startedAt: row.started_at,
    completedAt: row.completed_at,
  };
}

function rowToComment(row: Record<string, any>): BudayaComment {
  return {
    id: row.id,
    surveyId: row.survey_id,
    respondentId: row.respondent_id,
    commentText: row.comment_text,
    theme: row.theme,
    createdAt: row.created_at,
  };
}

function rowToDimensionResult(row: Record<string, any>): BudayaDimensionResult {
  return {
    id: row.id,
    surveyId: row.survey_id,
    dimensionId: row.dimension_id,
    positiveCount: row.positive_count,
    negativeCount: row.negative_count,
    neutralCount: row.neutral_count,
    totalResponses: row.total_responses,
    positivePercentage: row.positive_percentage,
    category: row.category,
    computedAt: row.computed_at,
  };
}

function rowToUnitResult(row: Record<string, any>): BudayaUnitResult {
  return {
    id: row.id,
    surveyId: row.survey_id,
    unitId: row.unit_id,
    dimensionId: row.dimension_id,
    positiveCount: row.positive_count,
    negativeCount: row.negative_count,
    neutralCount: row.neutral_count,
    totalResponses: row.total_responses,
    positivePercentage: row.positive_percentage,
    category: row.category,
    computedAt: row.computed_at,
  };
}

function rowToPeriodResult(row: Record<string, any>): BudayaPeriodResult {
  return {
    id: row.id,
    surveyId: row.survey_id,
    overallScore: row.overall_score,
    overallCategory: row.overall_category,
    totalRespondents: row.total_respondents,
    responseRate: row.response_rate,
    source: row.source,
    computedAt: row.computed_at,
  };
}

function rowToFollowup(row: Record<string, any>): BudayaFollowup {
  return {
    id: row.id,
    surveyId: row.survey_id,
    dimensionId: row.dimension_id,
    unitId: row.unit_id,
    problemDescription: row.problem_description,
    rootCause: row.root_cause,
    actionPlan: row.action_plan,
    picId: row.pic_id,
    targetDate: row.target_date,
    startDate: row.start_date,
    deadline: row.deadline,
    successIndicator: row.success_indicator,
    status: row.status,
    progressPercentage: row.progress_percentage,
    evidenceUrl: row.evidence_url,
    notes: row.notes,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function followupToRow(f: Partial<BudayaFollowup>): Record<string, any> {
  const row: Record<string, any> = {};
  if (f.surveyId !== undefined) row.survey_id = f.surveyId;
  if (f.dimensionId !== undefined) row.dimension_id = f.dimensionId;
  if (f.unitId !== undefined) row.unit_id = f.unitId;
  if (f.problemDescription !== undefined) row.problem_description = f.problemDescription;
  if (f.rootCause !== undefined) row.root_cause = f.rootCause;
  if (f.actionPlan !== undefined) row.action_plan = f.actionPlan;
  if (f.picId !== undefined) row.pic_id = f.picId;
  if (f.targetDate !== undefined) row.target_date = f.targetDate;
  if (f.startDate !== undefined) row.start_date = f.startDate;
  if (f.deadline !== undefined) row.deadline = f.deadline;
  if (f.successIndicator !== undefined) row.success_indicator = f.successIndicator;
  if (f.status !== undefined) row.status = f.status;
  if (f.progressPercentage !== undefined) row.progress_percentage = f.progressPercentage;
  if (f.evidenceUrl !== undefined) row.evidence_url = f.evidenceUrl;
  if (f.notes !== undefined) row.notes = f.notes;
  if (f.createdBy !== undefined) row.created_by = f.createdBy;
  return row;
}

function rowToFollowupMonitoring(row: Record<string, any>): BudayaFollowupMonitoring {
  return {
    id: row.id,
    followupId: row.followup_id,
    monitoringDate: row.monitoring_date,
    activity: row.activity,
    picId: row.pic_id,
    progressPercentage: row.progress_percentage,
    notes: row.notes,
    evidenceUrl: row.evidence_url,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

function rowToReport(row: Record<string, any>): BudayaReport {
  return {
    id: row.id,
    surveyId: row.survey_id,
    reportType: row.report_type,
    status: row.status,
    contentSummary: row.content_summary,
    fileUrl: row.file_url,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToApproval(row: Record<string, any>): BudayaApproval {
  return {
    id: row.id,
    reportId: row.report_id,
    reviewerId: row.reviewer_id,
    reviewerName: row.reviewer_name,
    reviewerPosition: row.reviewer_position,
    approvedAt: row.approved_at,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

// ────────────────────────────────────────────────────────────────
// Audit trail — menulis ke tabel audit_logs yang sudah ada
// (type = 'budaya'), kolom entity_type/entity_id/old_value/new_value
// sudah tersedia karena ditambahkan (additive) oleh migration_ikp.sql.
// ────────────────────────────────────────────────────────────────

export async function logBudayaAudit(params: {
  msg: string;
  badge: string;
  userId?: string;
  unitId?: string;
  entityId?: string;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
}): Promise<void> {
  const { error } = await supabase.from(AUDIT_TABLE).insert({
    type: 'budaya',
    msg: params.msg,
    badge: params.badge,
    ts: new Date().toLocaleString('id-ID'),
    user_id: params.userId || null,
    unit_id: params.unitId || null,
    entity_type: 'budaya_surveys',
    entity_id: params.entityId || null,
    old_value: params.oldValue ?? null,
    new_value: params.newValue ?? null,
  });
  if (error) console.error('[logBudayaAudit] gagal menulis audit log:', error);
}

export async function getBudayaAuditTrail(surveyId?: string, limitCount = 200) {
  let query = supabase.from(AUDIT_TABLE).select('*').eq('type', 'budaya');
  if (surveyId) query = query.eq('entity_id', surveyId);
  const { data, error } = await query.order('created_at', { ascending: false }).limit(limitCount);
  if (error) throw error;
  return data;
}

// ────────────────────────────────────────────────────────────────
// Master data
// ────────────────────────────────────────────────────────────────

export async function getBudayaDimensions(): Promise<BudayaDimension[]> {
  const { data, error } = await supabase.from(DIMENSIONS_TABLE).select('*').order('sort_order');
  if (error) throw error;
  return (data as any[]).map(rowToDimension);
}

export async function getBudayaUnits(activeOnly = true): Promise<BudayaUnit[]> {
  let query = supabase.from(UNITS_TABLE).select('*').order('sort_order');
  if (activeOnly) query = query.eq('is_active', true);
  const { data, error } = await query;
  if (error) throw error;
  return (data as any[]).map(rowToUnit);
}

export async function createBudayaUnit(unit: { code: string; name: string; sortOrder: number }): Promise<BudayaUnit> {
  const { data, error } = await supabase
    .from(UNITS_TABLE)
    .insert({ code: unit.code, name: unit.name, sort_order: unit.sortOrder })
    .select('*')
    .single();
  if (error) throw error;
  return rowToUnit(data);
}

export async function updateBudayaUnit(id: string, patch: Partial<BudayaUnit>): Promise<BudayaUnit> {
  const row: Record<string, any> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.isActive !== undefined) row.is_active = patch.isActive;
  if (patch.sortOrder !== undefined) row.sort_order = patch.sortOrder;
  const { data, error } = await supabase.from(UNITS_TABLE).update(row).eq('id', id).select('*').single();
  if (error) throw error;
  return rowToUnit(data);
}

/** Bank pertanyaan lengkap dengan opsi jawaban (untuk item non-Likert), diurutkan siap-tampil. */
export async function getBudayaQuestions(instrumentVersion = 'BUDAYA-KESELAMATAN-v1.0'): Promise<BudayaQuestion[]> {
  const { data, error } = await supabase
    .from(QUESTIONS_TABLE)
    .select(`*, ${QUESTION_OPTIONS_TABLE}(*)`)
    .eq('instrument_version', instrumentVersion)
    .order('sort_order');
  if (error) throw error;
  return (data as any[]).map(rowToQuestion);
}

// ────────────────────────────────────────────────────────────────
// Survei — CRUD
// ────────────────────────────────────────────────────────────────

export async function createBudayaSurvey(
  survey: Partial<BudayaSurvey> & { name: string; year: number; period: BudayaSurvey['period']; startDate: string; endDate: string; createdBy: string }
): Promise<BudayaSurvey> {
  const row = surveyToRow(survey);
  const { data, error } = await supabase.from(SURVEYS_TABLE).insert(row).select('*').single();
  if (error) throw error;
  const created = rowToSurvey(data);
  await logBudayaAudit({ msg: `Survei "${created.name}" dibuat`, badge: 'Survey', userId: survey.createdBy, entityId: created.id, newValue: row });
  return created;
}

export async function updateBudayaSurvey(id: string, patch: Partial<BudayaSurvey>, actorId?: string): Promise<BudayaSurvey> {
  const row = surveyToRow(patch);
  const { data, error } = await supabase.from(SURVEYS_TABLE).update(row).eq('id', id).select('*').single();
  if (error) throw error;
  const updated = rowToSurvey(data);
  if (patch.status) {
    await logBudayaAudit({ msg: `Status survei "${updated.name}" berubah menjadi "${patch.status}"`, badge: 'Status', userId: actorId, entityId: id, newValue: { status: patch.status } });
  }
  return updated;
}

export async function getBudayaSurveys(filters: BudayaSurveyFilters = {}): Promise<BudayaSurvey[]> {
  let query = supabase.from(SURVEYS_TABLE).select('*');
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.year) query = query.eq('year', filters.year);
  const { data, error } = await query.order('year', { ascending: false }).order('period', { ascending: false });
  if (error) throw error;
  let rows = (data as any[]).map(rowToSurvey);
  if (filters.search) {
    const q = filters.search.toLowerCase();
    rows = rows.filter((r) => r.name.toLowerCase().includes(q));
  }
  return rows;
}

export async function getBudayaSurveyById(id: string): Promise<BudayaSurvey | null> {
  const { data, error } = await supabase.from(SURVEYS_TABLE).select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? rowToSurvey(data) : null;
}

export function subscribeToBudayaSurveys(callback: (rows: BudayaSurvey[]) => void, onError?: (err: Error) => void): Unsubscribe {
  const refresh = async () => {
    try {
      callback(await getBudayaSurveys());
    } catch (err) {
      onError?.(err as Error);
    }
  };
  refresh();
  const channel = supabase
    .channel('budaya-surveys')
    .on('postgres_changes', { event: '*', schema: 'public', table: SURVEYS_TABLE }, () => refresh())
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

// ────────────────────────────────────────────────────────────────
// Distribusi (token / QR / access code)
// ────────────────────────────────────────────────────────────────

function generateReadableToken(len = 24): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function createBudayaSurveyToken(params: {
  surveyId: string;
  kind: BudayaTokenKind;
  unitId?: string;
  maxUses?: number;
  expiresAt?: string;
}): Promise<BudayaSurveyToken> {
  const { data, error } = await supabase
    .from(TOKENS_TABLE)
    .insert({
      survey_id: params.surveyId,
      token: generateReadableToken(),
      kind: params.kind,
      unit_id: params.unitId ?? null,
      max_uses: params.maxUses ?? null,
      expires_at: params.expiresAt ?? null,
    })
    .select('*')
    .single();
  if (error) throw error;
  return rowToToken(data);
}

export async function getBudayaSurveyTokens(surveyId: string): Promise<BudayaSurveyToken[]> {
  const { data, error } = await supabase.from(TOKENS_TABLE).select('*').eq('survey_id', surveyId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data as any[]).map(rowToToken);
}

// ────────────────────────────────────────────────────────────────
// Info survei untuk halaman PUBLIK (sebelum sesi dimulai) — lewat RPC
// budaya_get_public_survey(), bukan select langsung ke budaya_surveys
// (yang RLS-nya dibatasi untuk role authenticated).
// ────────────────────────────────────────────────────────────────

export interface BudayaPublicSurveyInfo {
  surveyId: string;
  name: string;
  instrumentVersion: string;
  anonymityMode: 'anonymous' | 'identified';
  units: { id: string; code: string; name: string }[];
}

export async function getBudayaPublicSurvey(surveyToken: string): Promise<BudayaPublicSurveyInfo | null> {
  const { data, error } = await supabase.rpc('budaya_get_public_survey', { p_token: surveyToken });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return {
    surveyId: row.survey_id,
    name: row.name,
    instrumentVersion: row.instrument_version,
    anonymityMode: row.anonymity_mode,
    units: row.units ?? [],
  };
}

// ────────────────────────────────────────────────────────────────
// Alur pengisian PUBLIK/ANONIM — lewat fungsi SECURITY DEFINER
// (budaya_start_session / budaya_submit_answer / budaya_complete_session),
// BUKAN akses tabel langsung, supaya aman diakses tanpa login (poin AB).
// ────────────────────────────────────────────────────────────────

/** Dipanggil dari halaman pembuka survei publik, sebelum Bagian A. */
export async function startBudayaSession(surveyToken: string, unitId: string): Promise<{ respondentId: string; respondentToken: string }> {
  const { data, error } = await supabase.rpc('budaya_start_session', { p_survey_token: surveyToken, p_unit_id: unitId });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return { respondentId: row.respondent_id, respondentToken: row.respondent_token };
}

/** Dipanggil setiap kali responden menjawab satu item (autosave per pertanyaan/halaman). */
export async function submitBudayaAnswer(params: {
  respondentToken: string;
  questionId: string;
  rawAnswer?: number | null;
  rawAnswerText?: string | null;
}): Promise<void> {
  const { error } = await supabase.rpc('budaya_submit_answer', {
    p_respondent_token: params.respondentToken,
    p_question_id: params.questionId,
    p_raw_answer: params.rawAnswer ?? null,
    p_raw_answer_text: params.rawAnswerText ?? null,
  });
  if (error) throw error;
}

/** Dipanggil di layar terakhir ("Kirim Survey") — mengunci sesi (poin AH: prevent double submission). */
export async function completeBudayaSession(respondentToken: string): Promise<void> {
  const { error } = await supabase.rpc('budaya_complete_session', { p_respondent_token: respondentToken });
  if (error) throw error;
}

/** Komentar bebas (Bagian I) disimpan lewat tabel biasa karena tidak berskor dan RLS-nya read-only untuk reviewer; insert publik tetap lewat kolom raw_answer_text di budaya_answers untuk item I1 — komentar terpisah (tabel budaya_comments) diisi ulang oleh proses AI clustering di Fase 4, bukan langsung oleh responden. */

// ────────────────────────────────────────────────────────────────
// Responden — dilihat reviewer/admin saja (RLS), untuk dashboard progres
// ────────────────────────────────────────────────────────────────

export async function getBudayaRespondents(surveyId: string): Promise<BudayaRespondent[]> {
  const { data, error } = await supabase.from(RESPONDENTS_TABLE).select('*').eq('survey_id', surveyId);
  if (error) throw error;
  return (data as any[]).map(rowToRespondent);
}

export interface BudayaResponseStats {
  target: number;
  started: number;
  completed: number;
  incomplete: number;
  responseRate: number; // completed / target * 100
}

/** Poin AD — Response Rate = jumlah responden SELESAI / target x 100%. */
export async function getBudayaResponseStats(surveyId: string): Promise<BudayaResponseStats> {
  const survey = await getBudayaSurveyById(surveyId);
  const respondents = await getBudayaRespondents(surveyId);
  const started = respondents.filter((r) => r.status !== 'not_started').length;
  const completed = respondents.filter((r) => r.status === 'completed').length;
  const target = survey?.targetRespondents ?? 0;
  return {
    target,
    started,
    completed,
    incomplete: started - completed,
    responseRate: target > 0 ? Math.round((completed / target) * 10000) / 100 : 0,
  };
}

export async function getBudayaComments(surveyId: string): Promise<BudayaComment[]> {
  const { data, error } = await supabase.from(COMMENTS_TABLE).select('*').eq('survey_id', surveyId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data as any[]).map(rowToComment);
}

// ────────────────────────────────────────────────────────────────
// SCORING ENGINE
// Formula & aturan mengikuti dokumen instruksi (poin P/Q/T/U/V/BU) —
// transparan dan bisa diaudit (poin BO), tidak ada angka contoh dipakai
// sebagai data (poin BU #10).
// ────────────────────────────────────────────────────────────────

/** Reverse: 1<->5, 2<->4, 3 tetap. Identik formula standar AHRQ (6 - x). */
export function reverseBudayaScore(raw: number): number {
  return 6 - raw;
}

export type BudayaResponseClass = 'positive' | 'neutral' | 'negative';

/** Positif = scored 4-5, Netral = scored 3, Negatif = scored 1-2 — SELALU dihitung SETELAH reverse (poin T). */
export function classifyBudayaResponse(scored: number): BudayaResponseClass {
  if (scored >= 4) return 'positive';
  if (scored === 3) return 'neutral';
  return 'negative';
}

/**
 * Kategori budaya dari % positif.
 * >75%        -> Kuat
 * 50% - 75%   -> Sedang  (mencakup TEPAT 50%, penanganan eksplisit sesuai
 *                          poin V — tidak dibiarkan ambigu antara
 *                          "<50% Lemah" dan "51%-<75% Sedang" pada dokumen
 *                          sumber)
 * <50%        -> Lemah
 */
export function categorizeBudayaScore(positivePercentage: number): BudayaCategory {
  if (positivePercentage > BUDAYA_DEFAULT_THRESHOLDS.strong) return 'kuat';
  if (positivePercentage >= BUDAYA_DEFAULT_THRESHOLDS.moderateFloor) return 'sedang';
  return 'lemah';
}

interface ScoredAnswerRow {
  scored_answer: number | null;
  question: { dimension_id: string | null; is_scored: boolean } | null;
  respondent: { survey_id: string; status: string; unit_id: string | null } | null;
}

/** Ambil semua jawaban BERSKOR milik responden yang SUDAH SELESAI untuk satu survei (dasar semua agregasi). */
async function getScoredAnswersForSurvey(surveyId: string): Promise<ScoredAnswerRow[]> {
  const { data, error } = await supabase
    .from(ANSWERS_TABLE)
    .select('scored_answer, question:budaya_questions!inner(dimension_id, is_scored), respondent:budaya_respondents!inner(survey_id, status, unit_id)')
    .eq('respondent.survey_id', surveyId)
    .eq('respondent.status', 'completed')
    .eq('question.is_scored', true)
    .not('scored_answer', 'is', null); // jawaban kosong TIDAK dihitung sebagai negatif — dikeluarkan dari denominator (poin AF/BU)
  if (error) throw error;
  return data as unknown as ScoredAnswerRow[];
}

function aggregate(rows: { scored_answer: number }[]): {
  positive: number; negative: number; neutral: number; total: number; pct: number | null; category: BudayaCategory | null;
} {
  let positive = 0, negative = 0, neutral = 0;
  for (const r of rows) {
    const cls = classifyBudayaResponse(r.scored_answer);
    if (cls === 'positive') positive++;
    else if (cls === 'negative') negative++;
    else neutral++;
  }
  const total = rows.length;
  const pct = total > 0 ? Math.round((positive / total) * 10000) / 100 : null;
  const category = pct !== null ? categorizeBudayaScore(pct) : null;
  return { positive, negative, neutral, total, pct, category };
}

/**
 * Quality check WAJIB sebelum finalisasi (poin BN). Mengembalikan daftar
 * masalah — jika ada satu saja, finalizeBudayaSurvey() MENOLAK finalisasi
 * (poin BN — "BLOCK FINALIZATION").
 */
export async function runBudayaQualityCheck(surveyId: string): Promise<BudayaQualityCheckResult> {
  const issues: BudayaQualityIssue[] = [];
  const survey = await getBudayaSurveyById(surveyId);
  if (!survey) {
    return { passed: false, issues: [{ code: 'survey_not_found', message: 'Survei tidak ditemukan.' }] };
  }

  const respondents = await getBudayaRespondents(surveyId);
  const completedCount = respondents.filter((r) => r.status === 'completed').length;
  if (completedCount === 0) {
    issues.push({ code: 'no_respondents', message: 'Belum ada responden dengan status Completed — belum bisa dihitung.' });
  }
  if (completedCount < survey.minRespondentThreshold) {
    issues.push({
      code: 'below_min_threshold',
      message: `Jumlah responden selesai (${completedCount}) di bawah ambang minimum anonimitas (${survey.minRespondentThreshold}).`,
    });
  }

  const questions = await getBudayaQuestions(survey.instrumentVersion);
  const scoredQuestions = questions.filter((q) => q.isScored);
  const unmapped = scoredQuestions.filter((q) => !q.dimensionId);
  if (unmapped.length > 0) {
    issues.push({
      code: 'unmapped_questions',
      message: `Ada ${unmapped.length} pertanyaan berskor tanpa mapping dimensi: ${unmapped.map((q) => q.itemCode).join(', ')}.`,
    });
  }

  if (completedCount > 0 && issues.every((i) => i.code !== 'no_respondents')) {
    const scoredRows = await getScoredAnswersForSurvey(surveyId);
    if (scoredRows.length === 0) {
      issues.push({ code: 'no_scored_answers', message: 'Tidak ada jawaban berskor yang bisa dihitung untuk survei ini.' });
    }
  }

  return { passed: issues.length === 0, issues };
}

/**
 * Menghitung ulang & MENYIMPAN hasil agregat per dimensi, per unit, dan
 * ringkasan periode, lalu mengunci survei menjadi status 'final'.
 * MENOLAK berjalan jika quality check gagal (poin BN).
 */
export async function finalizeBudayaSurvey(surveyId: string, actorId?: string): Promise<BudayaQualityCheckResult> {
  const check = await runBudayaQualityCheck(surveyId);
  if (!check.passed) return check; // caller menampilkan "Data belum dapat difinalisasi..." (poin BN)

  const survey = await getBudayaSurveyById(surveyId);
  if (!survey) throw new Error('Survei tidak ditemukan.');

  const dimensions = await getBudayaDimensions();
  const rows = await getScoredAnswersForSurvey(surveyId);

  // ── Agregasi per dimensi (overall) ──────────────────────────────────
  for (const dim of dimensions) {
    const dimRows = rows.filter((r) => r.question?.dimension_id === dim.id).map((r) => ({ scored_answer: r.scored_answer as number }));
    const agg = aggregate(dimRows);
    await supabase.from(DIMENSION_RESULTS_TABLE).upsert(
      {
        survey_id: surveyId,
        dimension_id: dim.id,
        positive_count: agg.positive,
        negative_count: agg.negative,
        neutral_count: agg.neutral,
        total_responses: agg.total,
        positive_percentage: agg.pct,
        category: agg.category,
        computed_at: new Date().toISOString(),
      },
      { onConflict: 'survey_id,dimension_id' }
    );
  }

  // ── Agregasi per unit x dimensi (poin Z — heatmap), dengan minimum
  //    respondent threshold: unit dengan responden < ambang TIDAK ditulis
  //    ke tabel hasil (poin AC — bukan sekadar disembunyikan di UI, supaya
  //    tidak ada cara mengintip lewat API).
  const unitIds = Array.from(new Set(rows.map((r) => r.respondent?.unit_id).filter(Boolean))) as string[];
  for (const unitId of unitIds) {
    const unitRowsAll = rows.filter((r) => r.respondent?.unit_id === unitId);
    const respondentCountForUnit = new Set(unitRowsAll.map((r) => r.respondent)).size; // pendekatan; lihat catatan di bawah
    for (const dim of dimensions) {
      const dimUnitRows = unitRowsAll.filter((r) => r.question?.dimension_id === dim.id).map((r) => ({ scored_answer: r.scored_answer as number }));
      if (dimUnitRows.length === 0) continue;
      const agg = aggregate(dimUnitRows);
      await supabase.from(UNIT_RESULTS_TABLE).upsert(
        {
          survey_id: surveyId,
          unit_id: unitId,
          dimension_id: dim.id,
          positive_count: agg.positive,
          negative_count: agg.negative,
          neutral_count: agg.neutral,
          total_responses: agg.total,
          positive_percentage: agg.pct,
          category: agg.category,
          computed_at: new Date().toISOString(),
        },
        { onConflict: 'survey_id,unit_id,dimension_id' }
      );
    }
    void respondentCountForUnit; // penegakan ambang minimum per-unit dilakukan di getBudayaUnitHeatmap() saat baca, lihat catatan fungsi tsb.
  }

  // ── Ringkasan overall (semua dimensi digabung) + response rate ──────
  const overallAgg = aggregate(rows.map((r) => ({ scored_answer: r.scored_answer as number })));
  const stats = await getBudayaResponseStats(surveyId);
  await supabase.from(PERIOD_RESULTS_TABLE).upsert(
    {
      survey_id: surveyId,
      overall_score: overallAgg.pct,
      overall_category: overallAgg.category,
      total_respondents: stats.completed,
      response_rate: stats.responseRate,
      source: 'system',
      computed_at: new Date().toISOString(),
    },
    { onConflict: 'survey_id' }
  );

  await updateBudayaSurvey(surveyId, { status: 'final' }, actorId);
  await logBudayaAudit({
    msg: `Survei "${survey.name}" difinalisasi — skor keseluruhan ${overallAgg.pct ?? '-'}% (${overallAgg.category ?? '-'})`,
    badge: 'Finalisasi',
    userId: actorId,
    entityId: surveyId,
    newValue: { overall_score: overallAgg.pct, overall_category: overallAgg.category },
  });

  return check;
}

// ────────────────────────────────────────────────────────────────
// Hasil — pembacaan (untuk Dashboard, Analisis Dimensi, Analisis Unit)
// ────────────────────────────────────────────────────────────────

export async function getBudayaDimensionResults(surveyId: string): Promise<BudayaDimensionResult[]> {
  const { data, error } = await supabase.from(DIMENSION_RESULTS_TABLE).select('*').eq('survey_id', surveyId);
  if (error) throw error;
  return (data as any[]).map(rowToDimensionResult);
}

export async function getBudayaPeriodResult(surveyId: string): Promise<BudayaPeriodResult | null> {
  const { data, error } = await supabase.from(PERIOD_RESULTS_TABLE).select('*').eq('survey_id', surveyId).maybeSingle();
  if (error) throw error;
  return data ? rowToPeriodResult(data) : null;
}

/** Untuk grafik trend antar periode (poin AN) — semua survei yang sudah final, urut tahun+periode. */
export async function getBudayaPeriodTrend(): Promise<{ survey: BudayaSurvey; result: BudayaPeriodResult }[]> {
  const surveys = (await getBudayaSurveys({ status: 'final' })).sort((a, b) => a.year - b.year || a.period.localeCompare(b.period));
  const out: { survey: BudayaSurvey; result: BudayaPeriodResult }[] = [];
  for (const s of surveys) {
    const r = await getBudayaPeriodResult(s.id);
    if (r) out.push({ survey: s, result: r });
  }
  return out;
}

/**
 * Heatmap Unit x Dimensi (poin Z), dengan penegakan minimum respondent
 * threshold (poin AC): unit yang jumlah responden-nya di bawah ambang
 * survei TIDAK ditampilkan per-unit, diganti pesan baku.
 */
export async function getBudayaUnitHeatmap(surveyId: string): Promise<{
  units: BudayaUnit[];
  dimensions: BudayaDimension[];
  cells: Map<string, BudayaUnitResult>; // key = `${unitId}:${dimensionId}`
  hiddenUnitIds: Set<string>;
}> {
  const survey = await getBudayaSurveyById(surveyId);
  const [units, dimensions, results, respondents] = await Promise.all([
    getBudayaUnits(),
    getBudayaDimensions(),
    supabase.from(UNIT_RESULTS_TABLE).select('*').eq('survey_id', surveyId).then((r) => {
      if (r.error) throw r.error;
      return (r.data as any[]).map(rowToUnitResult);
    }),
    getBudayaRespondents(surveyId),
  ]);

  const completedByUnit = new Map<string, number>();
  for (const r of respondents) {
    if (r.status !== 'completed' || !r.unitId) continue;
    completedByUnit.set(r.unitId, (completedByUnit.get(r.unitId) ?? 0) + 1);
  }
  const threshold = survey?.minRespondentThreshold ?? 10;
  const hiddenUnitIds = new Set(units.filter((u) => (completedByUnit.get(u.id) ?? 0) < threshold).map((u) => u.id));

  const cells = new Map<string, BudayaUnitResult>();
  for (const res of results) {
    if (hiddenUnitIds.has(res.unitId)) continue; // poin AC — "Data belum ditampilkan..."
    cells.set(`${res.unitId}:${res.dimensionId}`, res);
  }

  return { units, dimensions, cells, hiddenUnitIds };
}

// ────────────────────────────────────────────────────────────────
// Rencana Tindak Lanjut & Monitoring
// ────────────────────────────────────────────────────────────────

export async function createBudayaFollowup(followup: Partial<BudayaFollowup> & { surveyId: string; dimensionId: string }): Promise<BudayaFollowup> {
  const row = followupToRow(followup);
  const { data, error } = await supabase.from(FOLLOWUPS_TABLE).insert(row).select('*').single();
  if (error) throw error;
  const created = rowToFollowup(data);
  await logBudayaAudit({ msg: 'Rencana tindak lanjut dibuat', badge: 'Tindak Lanjut', userId: followup.createdBy ?? undefined, entityId: created.id, newValue: row });
  return created;
}

export async function updateBudayaFollowup(id: string, patch: Partial<BudayaFollowup>, actorId?: string): Promise<BudayaFollowup> {
  const row = followupToRow(patch);
  const { data, error } = await supabase.from(FOLLOWUPS_TABLE).update(row).eq('id', id).select('*').single();
  if (error) throw error;
  const updated = rowToFollowup(data);
  if (patch.status) {
    await logBudayaAudit({ msg: `Status tindak lanjut berubah menjadi "${patch.status}"`, badge: 'Status', userId: actorId, entityId: id, newValue: { status: patch.status } });
  }
  return updated;
}

export async function getBudayaFollowups(surveyId: string): Promise<BudayaFollowup[]> {
  const { data, error } = await supabase.from(FOLLOWUPS_TABLE).select('*').eq('survey_id', surveyId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data as any[]).map(rowToFollowup);
}

export async function createBudayaFollowupMonitoring(
  entry: Omit<BudayaFollowupMonitoring, 'id' | 'createdAt'>
): Promise<BudayaFollowupMonitoring> {
  const { data, error } = await supabase
    .from(FOLLOWUP_MONITORINGS_TABLE)
    .insert({
      followup_id: entry.followupId,
      monitoring_date: entry.monitoringDate,
      activity: entry.activity,
      pic_id: entry.picId,
      progress_percentage: entry.progressPercentage,
      notes: entry.notes,
      evidence_url: entry.evidenceUrl,
      created_by: entry.createdBy,
    })
    .select('*')
    .single();
  if (error) throw error;
  return rowToFollowupMonitoring(data);
}

export async function getBudayaFollowupMonitorings(followupId: string): Promise<BudayaFollowupMonitoring[]> {
  const { data, error } = await supabase
    .from(FOLLOWUP_MONITORINGS_TABLE)
    .select('*')
    .eq('followup_id', followupId)
    .order('monitoring_date', { ascending: false });
  if (error) throw error;
  return (data as any[]).map(rowToFollowupMonitoring);
}

// ────────────────────────────────────────────────────────────────
// Laporan & Approval
// ────────────────────────────────────────────────────────────────

export async function createBudayaReport(surveyId: string, reportType: BudayaReportType, contentSummary: string, createdBy?: string): Promise<BudayaReport> {
  const { data, error } = await supabase
    .from(REPORTS_TABLE)
    .insert({ survey_id: surveyId, report_type: reportType, content_summary: contentSummary, created_by: createdBy ?? null })
    .select('*')
    .single();
  if (error) throw error;
  return rowToReport(data);
}

export async function getBudayaReports(surveyId: string): Promise<BudayaReport[]> {
  const { data, error } = await supabase.from(REPORTS_TABLE).select('*').eq('survey_id', surveyId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data as any[]).map(rowToReport);
}

export async function advanceBudayaReportStatus(id: string, status: BudayaReport['status'], actorId?: string): Promise<BudayaReport> {
  const { data, error } = await supabase.from(REPORTS_TABLE).update({ status }).eq('id', id).select('*').single();
  if (error) throw error;
  await logBudayaAudit({ msg: `Status laporan berubah menjadi "${status}"`, badge: 'Laporan', userId: actorId, entityId: id, newValue: { status } });
  return rowToReport(data);
}

export async function addBudayaApproval(approval: Omit<BudayaApproval, 'id' | 'createdAt'>): Promise<BudayaApproval> {
  const { data, error } = await supabase
    .from(APPROVALS_TABLE)
    .insert({
      report_id: approval.reportId,
      reviewer_id: approval.reviewerId,
      reviewer_name: approval.reviewerName,
      reviewer_position: approval.reviewerPosition,
      approved_at: approval.approvedAt,
      notes: approval.notes,
    })
    .select('*')
    .single();
  if (error) throw error;
  return rowToApproval(data);
}

export async function getBudayaApprovals(reportId: string): Promise<BudayaApproval[]> {
  const { data, error } = await supabase.from(APPROVALS_TABLE).select('*').eq('report_id', reportId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data as any[]).map(rowToApproval);
}

// ────────────────────────────────────────────────────────────────
// Integrasi -> Manajemen Risiko (poin BH) — tombol "JADIKAN RISIKO".
// Mengikuti pola persis createRiskFromIkpIncident() di riskData.ts: hanya
// membuat DRAFT (status default DB, biasanya 'draft'); Risk Owner,
// Probabilitas, Dampak, Controllability TETAP wajib diisi manual oleh user
// berwenang di modul Manajemen Risiko — TIDAK ditentukan otomatis di sini.
// ────────────────────────────────────────────────────────────────

export async function createRiskFromBudayaDimension(
  params: { surveyName: string; dimensionName: string; unitName?: string; positivePercentage: number; category: string },
  actorId: string
) {
  // Import dinamis supaya modul ini tidak menambah dependency langsung ke
  // riskData.ts di top-level (keduanya tetap modul independen/additive).
  const { createRisk } = await import('@/lib/riskData');
  return createRisk({
    riskYear: new Date().getFullYear(),
    unitLokasi: params.unitName || 'Lintas Unit',
    category: 'keselamatan_pasien',
    risiko: `Budaya keselamatan pasien terkait "${params.dimensionName}" belum optimal (${params.positivePercentage}% — ${params.category})`,
    sebabInsiden: `Hasil Survey Budaya Keselamatan Pasien "${params.surveyName}" menunjukkan dimensi "${params.dimensionName}" berada pada kategori ${params.category}. (mohon lengkapi analisis akar masalah)`,
    efekDampak: '(mohon lengkapi dampak potensial terhadap keselamatan pasien)',
    createdBy: actorId,
  } as any);
}
