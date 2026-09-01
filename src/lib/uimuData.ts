import { supabase } from '@/lib/supabase/client';
import type {
  UimuUnit,
  UimuProposal,
  UimuRevision,
  UimuApproval,
  UimuAuditEntry,
  UimuFilters,
  UimuStatus,
  UimuReviewStage,
  UimuRevisionDecision,
  UimuApprovalStage,
  UimuApprovalDecision,
  UimuDashboardStats,
  PriorityCategory,
} from '@/types/uimu';
import { computeUimuPriority } from '@/types/uimu';

// Mengikuti pola src/lib/ikpData.ts: akses langsung dari client,
// snake_case <-> camelCase di boundary, audit trail lewat tabel audit_logs
// existing (type = 'uimu'), realtime lewat postgres_changes.

const UNITS_TABLE = 'uimu_units';
const PROPOSALS_TABLE = 'uimu_proposals';
const REVISIONS_TABLE = 'uimu_revisions';
const APPROVALS_TABLE = 'uimu_approvals';
const MASTER_VIEW = 'uimu_master_indikator';
const AUDIT_TABLE = 'audit_logs';

type Unsubscribe = () => void;

// ────────────────────────────────────────────────────────────────
// Row <-> model mapping
// ────────────────────────────────────────────────────────────────

function rowToUnit(row: Record<string, any>): UimuUnit {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    category: row.category,
    isActive: !!row.is_active,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function unitToRow(entry: Partial<UimuUnit>): Record<string, any> {
  const row: Record<string, any> = {};
  if (entry.code !== undefined) row.code = entry.code;
  if (entry.name !== undefined) row.name = entry.name;
  if (entry.category !== undefined) row.category = entry.category;
  if (entry.isActive !== undefined) row.is_active = entry.isActive;
  if ((entry as any).createdBy !== undefined) row.created_by = (entry as any).createdBy;
  return row;
}

function rowToProposal(row: Record<string, any>): UimuProposal {
  return {
    id: row.id,
    proposalNumber: row.proposal_number,
    periodYear: row.period_year,
    version: row.version,
    parentProposalId: row.parent_proposal_id,
    status: row.status,

    unitId: row.unit_id,
    unitNameSnapshot: row.unit_name_snapshot,
    subunit: row.subunit,
    proposerId: row.proposer_id,
    proposerName: row.proposer_name,
    proposerPosition: row.proposer_position,
    proposerEmail: row.proposer_email,
    proposerUnitIdHint: row.proposer_unit_id_hint,

    indicatorName: row.indicator_name,
    indicatorCategory: row.indicator_category,
    qualityDimension: row.quality_dimension,
    qualityDimensionOther: row.quality_dimension_other,
    aspectArea: row.aspect_area,
    aspectAreaOther: row.aspect_area_other,

    reasonChecklist: row.reason_checklist ?? [],
    reasonOther: row.reason_other,
    gapDescription: row.gap_description,

    eligibilityVisiMisi: row.eligibility_visi_misi,
    eligibilityEvidenceGap: row.eligibility_evidence_gap,
    eligibilityImportant: row.eligibility_important,
    eligibilityControllable: row.eligibility_controllable,
    eligibilityValidated: row.eligibility_validated,
    eligibilityQualityPrinciple: row.eligibility_quality_principle,
    eligibilityPatientSafety: row.eligibility_patient_safety,
    eligibilityRecommendation: row.eligibility_recommendation,

    operationalDefinition: row.operational_definition,
    indicatorGoal: row.indicator_goal,
    indicatorKind: row.indicator_kind,
    numerator: row.numerator,
    denominator: row.denominator,
    formula: row.formula,
    unitOfMeasure: row.unit_of_measure,
    inclusionCriteria: row.inclusion_criteria,
    exclusionCriteria: row.exclusion_criteria,
    population: row.population,
    dataSource: row.data_source,
    collectionMethod: row.collection_method,
    collectionInstrument: row.collection_instrument,
    picId: row.pic_id,
    picName: row.pic_name,
    collectionFrequency: row.collection_frequency,
    analysisPeriod: row.analysis_period,
    reportingPeriod: row.reporting_period,
    notes: row.notes,

    targetValue: row.target_value,
    targetUnit: row.target_unit,
    targetMin: row.target_min,
    targetMax: row.target_max,
    targetOperator: row.target_operator,
    nationalStandard: row.national_standard,
    hospitalStandard: row.hospital_standard,
    unitStandard: row.unit_standard,
    targetSource: row.target_source,
    targetReference: row.target_reference,
    targetYear: row.target_year,

    scorePatientSafetyRisk: row.score_patient_safety_risk,
    scoreGap: row.score_gap,
    scoreFrequency: row.score_frequency,
    scorePatientImpact: row.score_patient_impact,
    scoreHospitalImpact: row.score_hospital_impact,
    scoreCostUtilization: row.score_cost_utilization,
    scoreControllability: row.score_controllability,
    scoreStrategicImportance: row.score_strategic_importance,
    totalScore: row.total_score,

    decreeNumber: row.decree_number,
    establishedDate: row.established_date,
    establishedBy: row.established_by,
    rejectionReason: row.rejection_reason,

    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    submittedAt: row.submitted_at,
  };
}

/** Hanya menyertakan key yang ADA di patch — supaya update sebagian aman (tidak menimpa kolom lain dengan null). */
function proposalToRow(entry: Partial<UimuProposal>): Record<string, any> {
  const map: Record<string, string> = {
    periodYear: 'period_year', version: 'version', parentProposalId: 'parent_proposal_id', status: 'status',
    unitId: 'unit_id', unitNameSnapshot: 'unit_name_snapshot', subunit: 'subunit',
    proposerId: 'proposer_id', proposerName: 'proposer_name', proposerPosition: 'proposer_position',
    proposerEmail: 'proposer_email', proposerUnitIdHint: 'proposer_unit_id_hint',
    indicatorName: 'indicator_name', indicatorCategory: 'indicator_category',
    qualityDimension: 'quality_dimension', qualityDimensionOther: 'quality_dimension_other',
    aspectArea: 'aspect_area', aspectAreaOther: 'aspect_area_other',
    reasonChecklist: 'reason_checklist', reasonOther: 'reason_other', gapDescription: 'gap_description',
    eligibilityVisiMisi: 'eligibility_visi_misi', eligibilityEvidenceGap: 'eligibility_evidence_gap',
    eligibilityImportant: 'eligibility_important', eligibilityControllable: 'eligibility_controllable',
    eligibilityValidated: 'eligibility_validated', eligibilityQualityPrinciple: 'eligibility_quality_principle',
    eligibilityPatientSafety: 'eligibility_patient_safety', eligibilityRecommendation: 'eligibility_recommendation',
    operationalDefinition: 'operational_definition', indicatorGoal: 'indicator_goal', indicatorKind: 'indicator_kind',
    numerator: 'numerator', denominator: 'denominator', formula: 'formula', unitOfMeasure: 'unit_of_measure',
    inclusionCriteria: 'inclusion_criteria', exclusionCriteria: 'exclusion_criteria', population: 'population',
    dataSource: 'data_source', collectionMethod: 'collection_method', collectionInstrument: 'collection_instrument',
    picId: 'pic_id', picName: 'pic_name', collectionFrequency: 'collection_frequency',
    analysisPeriod: 'analysis_period', reportingPeriod: 'reporting_period', notes: 'notes',
    targetValue: 'target_value', targetUnit: 'target_unit', targetMin: 'target_min', targetMax: 'target_max',
    targetOperator: 'target_operator', nationalStandard: 'national_standard', hospitalStandard: 'hospital_standard',
    unitStandard: 'unit_standard', targetSource: 'target_source', targetReference: 'target_reference', targetYear: 'target_year',
    scorePatientSafetyRisk: 'score_patient_safety_risk', scoreGap: 'score_gap', scoreFrequency: 'score_frequency',
    scorePatientImpact: 'score_patient_impact', scoreHospitalImpact: 'score_hospital_impact',
    scoreCostUtilization: 'score_cost_utilization', scoreControllability: 'score_controllability',
    scoreStrategicImportance: 'score_strategic_importance',
    decreeNumber: 'decree_number', establishedDate: 'established_date', establishedBy: 'established_by',
    rejectionReason: 'rejection_reason', createdBy: 'created_by', submittedAt: 'submitted_at',
  };
  const row: Record<string, any> = {};
  for (const [key, col] of Object.entries(map)) {
    if ((entry as any)[key] !== undefined) row[col] = (entry as any)[key];
  }
  return row;
}

function rowToRevision(row: Record<string, any>): UimuRevision {
  return {
    id: row.id,
    proposalId: row.proposal_id,
    version: row.version,
    stage: row.stage,
    reviewerId: row.reviewer_id,
    reviewerName: row.reviewer_name,
    reviewerRole: row.reviewer_role,
    decision: row.decision,
    comment: row.comment,
    fieldsToFix: row.fields_to_fix,
    createdAt: row.created_at,
  };
}

function rowToApproval(row: Record<string, any>): UimuApproval {
  return {
    id: row.id,
    proposalId: row.proposal_id,
    stage: row.stage,
    approverId: row.approver_id,
    approverName: row.approver_name,
    approverPosition: row.approver_position,
    decision: row.decision,
    notes: row.notes,
    decidedAt: row.decided_at,
  };
}

function rowToAudit(row: Record<string, any>): UimuAuditEntry {
  return {
    id: row.id,
    type: 'uimu',
    msg: row.msg,
    badge: row.badge,
    ts: row.ts,
    userId: row.user_id ?? undefined,
    unitId: row.unit_id ?? undefined,
    entityType: row.entity_type ?? undefined,
    entityId: row.entity_id ?? undefined,
    oldValue: row.old_value ?? null,
    newValue: row.new_value ?? null,
    createdAt: row.created_at,
  };
}

// ────────────────────────────────────────────────────────────────
// Audit trail — menulis ke tabel audit_logs existing (type = 'uimu'),
// otomatis muncul di AuditTrailPanel & NotificationPanel tanpa sistem baru.
// ────────────────────────────────────────────────────────────────

export async function logUimuAudit(params: {
  msg: string;
  badge: string;
  userId?: string;
  unitId?: string;
  entityId?: string;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
}): Promise<void> {
  const { error } = await supabase.from(AUDIT_TABLE).insert({
    type: 'uimu',
    msg: params.msg,
    badge: params.badge,
    ts: new Date().toLocaleString('id-ID'),
    user_id: params.userId || null,
    unit_id: params.unitId || null,
    entity_type: 'uimu_proposals',
    entity_id: params.entityId || null,
    old_value: params.oldValue ?? null,
    new_value: params.newValue ?? null,
  });
  if (error) console.error('[logUimuAudit] gagal menulis audit log:', error);
}

export async function getUimuAuditTrail(proposalId?: string, limitCount = 200): Promise<UimuAuditEntry[]> {
  let query = supabase.from(AUDIT_TABLE).select('*').eq('type', 'uimu');
  if (proposalId) query = query.eq('entity_id', proposalId);
  const { data, error } = await query.order('created_at', { ascending: false }).limit(limitCount);
  if (error) throw error;
  return (data as any[]).map(rowToAudit);
}

// ────────────────────────────────────────────────────────────────
// Master Unit (poin 22)
// ────────────────────────────────────────────────────────────────

export async function getUimuUnits(includeInactive = false): Promise<UimuUnit[]> {
  let query = supabase.from(UNITS_TABLE).select('*');
  if (!includeInactive) query = query.eq('is_active', true);
  const { data, error } = await query.order('name', { ascending: true });
  if (error) throw error;
  return (data as any[]).map(rowToUnit);
}

export async function createUimuUnit(entry: Partial<UimuUnit> & { code: string; name: string; createdBy?: string }): Promise<UimuUnit> {
  const row = unitToRow(entry);
  const { data, error } = await supabase.from(UNITS_TABLE).insert(row).select('*').single();
  if (error) throw error;
  return rowToUnit(data);
}

export async function updateUimuUnit(id: string, patch: Partial<UimuUnit>): Promise<UimuUnit> {
  const row = unitToRow(patch);
  const { data, error } = await supabase.from(UNITS_TABLE).update(row).eq('id', id).select('*').single();
  if (error) throw error;
  return rowToUnit(data);
}

export async function setUimuUnitActive(id: string, isActive: boolean): Promise<UimuUnit> {
  return updateUimuUnit(id, { isActive });
}

// ────────────────────────────────────────────────────────────────
// Usulan — CRUD
// ────────────────────────────────────────────────────────────────

export async function createUimuProposal(
  entry: Partial<UimuProposal> & { createdBy: string; periodYear: number }
): Promise<UimuProposal> {
  const row = proposalToRow(entry);
  const { data, error } = await supabase.from(PROPOSALS_TABLE).insert(row).select('*').single();
  if (error) throw error;
  const created = rowToProposal(data);
  await logUimuAudit({
    msg: `Draft usulan ${created.proposalNumber} dibuat`,
    badge: 'UIMU',
    userId: entry.createdBy,
    entityId: created.id,
    newValue: row,
  });
  return created;
}

export async function updateUimuProposal(id: string, patch: Partial<UimuProposal>, actorId?: string): Promise<UimuProposal> {
  const row = proposalToRow(patch);
  const { data, error } = await supabase.from(PROPOSALS_TABLE).update(row).eq('id', id).select('*').single();
  if (error) throw error;
  const updated = rowToProposal(data);
  if (patch.status) {
    await logUimuAudit({
      msg: `Status usulan ${updated.proposalNumber} berubah menjadi "${patch.status}"`,
      badge: 'Status',
      userId: actorId,
      entityId: id,
      newValue: { status: patch.status },
    });
  }
  return updated;
}

export async function deleteUimuProposal(id: string): Promise<void> {
  const { error } = await supabase.from(PROPOSALS_TABLE).delete().eq('id', id);
  if (error) throw error;
}

export async function getUimuProposalById(id: string): Promise<UimuProposal | null> {
  const { data, error } = await supabase.from(PROPOSALS_TABLE).select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? rowToProposal(data) : null;
}

export async function getUimuProposals(filters: UimuFilters = {}): Promise<UimuProposal[]> {
  let query = supabase.from(PROPOSALS_TABLE).select('*');

  if (filters.periodYear) query = query.eq('period_year', filters.periodYear);
  if (filters.unitId) query = query.eq('unit_id', filters.unitId);
  if (filters.indicatorCategory) query = query.eq('indicator_category', filters.indicatorCategory);
  if (filters.qualityDimension) query = query.eq('quality_dimension', filters.qualityDimension);
  if (filters.status) query = query.eq('status', filters.status);

  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw error;
  let rows = (data as any[]).map(rowToProposal);

  if (filters.priority) {
    rows = rows.filter((r) => computeUimuPriority(r.totalScore) === filters.priority);
  }
  if (filters.search) {
    const q = filters.search.toLowerCase();
    rows = rows.filter((r) =>
      r.proposalNumber.toLowerCase().includes(q) ||
      (r.indicatorName ?? '').toLowerCase().includes(q) ||
      (r.proposerName ?? '').toLowerCase().includes(q) ||
      (r.unitNameSnapshot ?? '').toLowerCase().includes(q)
    );
  }
  return rows;
}

/** Indikator yang sudah ditetapkan/aktif — Master Indikator (poin 14), lewat view uimu_master_indikator. */
export async function getUimuMasterIndikator(filters: { periodYear?: number; unitId?: string } = {}): Promise<UimuProposal[]> {
  let query = supabase.from(MASTER_VIEW).select('*');
  if (filters.periodYear) query = query.eq('period_year', filters.periodYear);
  if (filters.unitId) query = query.eq('unit_id', filters.unitId);
  const { data, error } = await query.order('proposal_number', { ascending: true });
  if (error) throw error;
  return (data as any[]).map(rowToProposal);
}

/** Realtime listener untuk daftar usulan (Dashboard & Daftar Usulan). */
export function subscribeToUimuProposals(onChange: () => void): Unsubscribe {
  const channel = supabase
    .channel('uimu_proposals_changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: PROPOSALS_TABLE }, onChange)
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

// ────────────────────────────────────────────────────────────────
// Transisi workflow (poin 11)
// ────────────────────────────────────────────────────────────────

/** Pengusul mengirim draft -> diajukan -> masuk antrean review_unit. */
export async function submitUimuProposal(id: string, actorId: string, actorName?: string): Promise<UimuProposal> {
  const updated = await updateUimuProposal(id, { status: 'review_unit', submittedAt: new Date().toISOString() }, actorId);
  await supabase.from(APPROVALS_TABLE).insert({
    proposal_id: id, stage: 'pengusul', approver_id: actorId, approver_name: actorName ?? null,
    decision: 'mengirim', notes: null,
  });
  return updated;
}

/** Kepala Unit/PJ Mutu: setujui -> lanjut ke telaah_mutu, ATAU kembalikan -> dikembalikan. */
export async function reviewUimuProposalByUnit(params: {
  id: string;
  decision: 'setuju' | 'kembalikan';
  reviewerId: string;
  reviewerName?: string;
  reviewerRole?: string;
  comment?: string;
  fieldsToFix?: string[];
}): Promise<UimuProposal> {
  const proposal = await getUimuProposalById(params.id);
  if (!proposal) throw new Error('Usulan tidak ditemukan');
  const nextStatus: UimuStatus = params.decision === 'setuju' ? 'telaah_mutu' : 'dikembalikan';
  const updated = await updateUimuProposal(params.id, { status: nextStatus, version: params.decision === 'kembalikan' ? proposal.version : proposal.version }, params.reviewerId);

  const revisionDecision: UimuRevisionDecision = params.decision === 'setuju' ? 'disetujui' : 'dikembalikan';
  await insertUimuRevision({
    proposalId: params.id, version: proposal.version, stage: 'review_unit',
    reviewerId: params.reviewerId, reviewerName: params.reviewerName, reviewerRole: params.reviewerRole,
    decision: revisionDecision, comment: params.comment, fieldsToFix: params.fieldsToFix,
  });
  await supabase.from(APPROVALS_TABLE).insert({
    proposal_id: params.id, stage: 'kepala_unit', approver_id: params.reviewerId, approver_name: params.reviewerName ?? null,
    decision: params.decision === 'setuju' ? 'menyetujui' : 'meminta_revisi', notes: params.comment ?? null,
  });
  return updated;
}

/** Komite/Departemen Mutu: setujui -> disetujui, minta revisi -> revisi, tolak -> tidak_disetujui. */
export async function telaahUimuProposalByCommittee(params: {
  id: string;
  decision: 'setuju' | 'revisi' | 'tolak';
  reviewerId: string;
  reviewerName?: string;
  reviewerRole?: string;
  comment?: string;
  fieldsToFix?: string[];
  rejectionReason?: string;
}): Promise<UimuProposal> {
  const proposal = await getUimuProposalById(params.id);
  if (!proposal) throw new Error('Usulan tidak ditemukan');
  const nextStatus: UimuStatus =
    params.decision === 'setuju' ? 'disetujui' : params.decision === 'revisi' ? 'revisi' : 'tidak_disetujui';

  const updated = await updateUimuProposal(params.id, {
    status: nextStatus,
    rejectionReason: params.decision === 'tolak' ? params.rejectionReason ?? params.comment ?? null : proposal.rejectionReason,
  }, params.reviewerId);

  const revisionDecision: UimuRevisionDecision =
    params.decision === 'setuju' ? 'disetujui' : params.decision === 'revisi' ? 'revisi' : 'ditolak';
  await insertUimuRevision({
    proposalId: params.id, version: proposal.version, stage: 'telaah_mutu',
    reviewerId: params.reviewerId, reviewerName: params.reviewerName, reviewerRole: params.reviewerRole,
    decision: revisionDecision, comment: params.comment, fieldsToFix: params.fieldsToFix,
  });
  await supabase.from(APPROVALS_TABLE).insert({
    proposal_id: params.id, stage: 'komite_mutu', approver_id: params.reviewerId, approver_name: params.reviewerName ?? null,
    decision: params.decision === 'setuju' ? 'menyetujui' : params.decision === 'revisi' ? 'meminta_revisi' : 'menolak',
    notes: params.comment ?? null,
  });
  return updated;
}

/** Pengusul mengirim ulang usulan yang dikembalikan/revisi — naik nomor versi. */
export async function resubmitUimuProposal(id: string, actorId: string, actorName?: string): Promise<UimuProposal> {
  const proposal = await getUimuProposalById(id);
  if (!proposal) throw new Error('Usulan tidak ditemukan');
  if (!['dikembalikan', 'revisi'].includes(proposal.status)) {
    throw new Error('Usulan hanya bisa dikirim ulang dari status Dikembalikan atau Revisi');
  }
  const nextStatus: UimuStatus = proposal.status === 'dikembalikan' ? 'review_unit' : 'telaah_mutu';
  const updated = await updateUimuProposal(id, { status: nextStatus, version: proposal.version + 1 }, actorId);
  await supabase.from(APPROVALS_TABLE).insert({
    proposal_id: id, stage: 'pengusul', approver_id: actorId, approver_name: actorName ?? null,
    decision: 'mengirim', notes: `Kirim ulang sebagai versi ${proposal.version + 1}`,
  });
  return updated;
}

/** Manajemen/Direktur: persetujuan akhir opsional (poin 4/13) sebelum penetapan resmi. */
export async function approveUimuProposalByManagement(params: {
  id: string; decision: 'setuju' | 'tolak'; approverId: string; approverName?: string; approverPosition?: string; notes?: string;
}): Promise<UimuProposal> {
  await supabase.from(APPROVALS_TABLE).insert({
    proposal_id: params.id, stage: 'manajemen', approver_id: params.approverId, approver_name: params.approverName ?? null,
    approver_position: params.approverPosition ?? null,
    decision: params.decision === 'setuju' ? 'menyetujui' : 'menolak', notes: params.notes ?? null,
  });
  if (params.decision === 'tolak') {
    return updateUimuProposal(params.id, { status: 'tidak_disetujui', rejectionReason: params.notes ?? null }, params.approverId);
  }
  return getUimuProposalById(params.id) as Promise<UimuProposal>;
}

/** Penetapan resmi (poin 13): status disetujui -> ditetapkan, otomatis masuk Master Indikator. */
export async function establishUimuProposal(params: {
  id: string; decreeNumber: string; establishedBy: string; establishedByName?: string;
}): Promise<UimuProposal> {
  const updated = await updateUimuProposal(params.id, {
    status: 'ditetapkan',
    decreeNumber: params.decreeNumber,
    establishedDate: new Date().toISOString().slice(0, 10),
    establishedBy: params.establishedBy,
  }, params.establishedBy);
  await logUimuAudit({
    msg: `Indikator ${updated.proposalNumber} ditetapkan (No. ${params.decreeNumber})`,
    badge: 'Penetapan', userId: params.establishedBy, entityId: params.id,
    newValue: { decreeNumber: params.decreeNumber },
  });
  return updated;
}

/** Aktifkan indikator yang sudah ditetapkan supaya siap dipakai modul pengukuran (poin 15). */
export async function activateUimuIndicator(id: string, actorId: string): Promise<UimuProposal> {
  return updateUimuProposal(id, { status: 'aktif' }, actorId);
}

/** Nonaktifkan indikator aktif — TIDAK dihapus, sesuai aturan bisnis poin 28.12. */
export async function deactivateUimuIndicator(id: string, actorId: string): Promise<UimuProposal> {
  return updateUimuProposal(id, { status: 'tidak_aktif' }, actorId);
}

async function insertUimuRevision(params: {
  proposalId: string; version: number; stage: UimuReviewStage;
  reviewerId?: string; reviewerName?: string; reviewerRole?: string;
  decision: UimuRevisionDecision; comment?: string; fieldsToFix?: string[];
}): Promise<UimuRevision> {
  const { data, error } = await supabase.from(REVISIONS_TABLE).insert({
    proposal_id: params.proposalId, version: params.version, stage: params.stage,
    reviewer_id: params.reviewerId ?? null, reviewer_name: params.reviewerName ?? null, reviewer_role: params.reviewerRole ?? null,
    decision: params.decision, comment: params.comment ?? null, fields_to_fix: params.fieldsToFix ?? null,
  }).select('*').single();
  if (error) throw error;
  return rowToRevision(data);
}

export async function getUimuRevisions(proposalId: string): Promise<UimuRevision[]> {
  const { data, error } = await supabase.from(REVISIONS_TABLE).select('*').eq('proposal_id', proposalId).order('created_at', { ascending: true });
  if (error) throw error;
  return (data as any[]).map(rowToRevision);
}

export async function getUimuApprovals(proposalId: string): Promise<UimuApproval[]> {
  const { data, error } = await supabase.from(APPROVALS_TABLE).select('*').eq('proposal_id', proposalId).order('decided_at', { ascending: true });
  if (error) throw error;
  return (data as any[]).map(rowToApproval);
}

// ────────────────────────────────────────────────────────────────
// Salin indikator tahun sebelumnya (poin 26)
// ────────────────────────────────────────────────────────────────

export async function duplicateUimuProposalToNewYear(params: {
  sourceId: string; newYear: number; actorId: string;
}): Promise<UimuProposal> {
  const src = await getUimuProposalById(params.sourceId);
  if (!src) throw new Error('Usulan sumber tidak ditemukan');

  const draft = await createUimuProposal({
    createdBy: params.actorId,
    periodYear: params.newYear,
    parentProposalId: src.id,
    status: 'draft',
    unitId: src.unitId,
    unitNameSnapshot: src.unitNameSnapshot,
    subunit: src.subunit,
    proposerId: params.actorId,
    indicatorName: src.indicatorName,
    indicatorCategory: src.indicatorCategory,
    qualityDimension: src.qualityDimension,
    qualityDimensionOther: src.qualityDimensionOther,
    aspectArea: src.aspectArea,
    aspectAreaOther: src.aspectAreaOther,
    operationalDefinition: src.operationalDefinition,
    indicatorGoal: src.indicatorGoal,
    indicatorKind: src.indicatorKind,
    numerator: src.numerator,
    denominator: src.denominator,
    formula: src.formula,
    unitOfMeasure: src.unitOfMeasure,
    inclusionCriteria: src.inclusionCriteria,
    exclusionCriteria: src.exclusionCriteria,
    population: src.population,
    dataSource: src.dataSource,
    collectionMethod: src.collectionMethod,
    collectionInstrument: src.collectionInstrument,
    picId: src.picId,
    picName: src.picName,
    collectionFrequency: src.collectionFrequency,
    analysisPeriod: src.analysisPeriod,
    reportingPeriod: src.reportingPeriod,
    targetValue: src.targetValue,
    targetUnit: src.targetUnit,
    targetMin: src.targetMin,
    targetMax: src.targetMax,
    targetOperator: src.targetOperator,
    nationalStandard: src.nationalStandard,
    hospitalStandard: src.hospitalStandard,
    unitStandard: src.unitStandard,
    targetSource: src.targetSource,
    targetReference: src.targetReference,
    targetYear: params.newYear,
  });

  await logUimuAudit({
    msg: `Usulan ${draft.proposalNumber} disalin dari ${src.proposalNumber} (tahun ${params.newYear})`,
    badge: 'Salin', userId: params.actorId, entityId: draft.id,
  });
  return draft;
}

// ────────────────────────────────────────────────────────────────
// Dashboard
// ────────────────────────────────────────────────────────────────

export function computeUimuDashboardStats(rows: UimuProposal[], units: UimuUnit[]): UimuDashboardStats {
  const byStatus: Record<string, number> = {};
  const byIndicatorCategory: Record<string, number> = {};
  const byQualityDimension: Record<string, number> = {};
  const priorityCount: Record<PriorityCategory, number> = { rendah: 0, sedang: 0, tinggi: 0, prioritas: 0 };
  const unitMap = new Map<string, { unitId: string; unitName: string; total: number; disetujui: number; revisi: number; ditolak: number; ditetapkan: number }>();

  for (const r of rows) {
    byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
    if (r.indicatorCategory) byIndicatorCategory[r.indicatorCategory] = (byIndicatorCategory[r.indicatorCategory] ?? 0) + 1;
    if (r.qualityDimension) byQualityDimension[r.qualityDimension] = (byQualityDimension[r.qualityDimension] ?? 0) + 1;
    priorityCount[computeUimuPriority(r.totalScore)]++;

    const uid = r.unitId ?? 'tanpa-unit';
    const uname = r.unitNameSnapshot ?? units.find((u) => u.id === r.unitId)?.name ?? 'Tanpa Unit';
    if (!unitMap.has(uid)) unitMap.set(uid, { unitId: uid, unitName: uname, total: 0, disetujui: 0, revisi: 0, ditolak: 0, ditetapkan: 0 });
    const bucket = unitMap.get(uid)!;
    bucket.total++;
    if (['disetujui', 'ditetapkan', 'aktif'].includes(r.status)) bucket.disetujui++;
    if (['revisi', 'dikembalikan'].includes(r.status)) bucket.revisi++;
    if (r.status === 'tidak_disetujui') bucket.ditolak++;
    if (['ditetapkan', 'aktif'].includes(r.status)) bucket.ditetapkan++;
  }

  return {
    total: rows.length,
    byStatus: byStatus as Record<UimuStatus, number>,
    byUnit: Array.from(unitMap.values()).sort((a, b) => b.total - a.total),
    byIndicatorCategory,
    byQualityDimension,
    priorityCount,
  };
}
