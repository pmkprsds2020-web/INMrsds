import { supabase } from '@/lib/supabase/client';
import type {
  IkpIncident,
  IkpInvestigation,
  IkpAction,
  IkpAttachment,
  IkpAuditEntry,
  IkpFilters,
  IkpStatus,
} from '@/types/ikp';

// Mengikuti pola src/lib/supabaseData.ts: akses langsung dari client,
// snake_case <-> camelCase di boundary, realtime lewat postgres_changes.

const INCIDENTS_TABLE = 'ikp_incidents';
const INVESTIGATIONS_TABLE = 'ikp_investigations';
const ACTIONS_TABLE = 'ikp_actions';
const ATTACHMENTS_TABLE = 'ikp_attachments';
const AUDIT_TABLE = 'audit_logs';
const STORAGE_BUCKET = 'ikp-attachments';

type Unsubscribe = () => void;

// ────────────────────────────────────────────────────────────────
// Row <-> model mapping
// ────────────────────────────────────────────────────────────────

function rowToIncident(row: Record<string, any>): IkpIncident {
  return {
    id: row.id,
    reportNumber: row.report_number,
    reportKind: row.report_kind,
    status: row.status,
    reportDate: row.report_date,
    reportTime: row.report_time,
    reporterId: row.reporter_id,
    reporterName: row.reporter_name,
    reporterUnit: row.reporter_unit,
    reporterProfession: row.reporter_profession,
    reporterContact: row.reporter_contact,
    isAnonymous: !!row.is_anonymous,
    tempat: row.tempat,
    patientName: row.patient_name,
    patientMrNumber: row.patient_mr_number,
    patientRoom: row.patient_room,
    patientAgeGroup: row.patient_age_group,
    patientGender: row.patient_gender,
    payerType: row.payer_type,
    admissionDate: row.admission_date,
    admissionTime: row.admission_time,
    incidentDate: row.incident_date,
    incidentTime: row.incident_time,
    incidentSummary: row.incident_summary,
    chronology: row.chronology,
    incidentType: row.incident_type,
    isSentinel: !!row.is_sentinel,
    reportedByCategory: row.reported_by_category,
    reportedByDetail: row.reported_by_detail,
    incidentSubject: row.incident_subject,
    incidentSubjectDetail: row.incident_subject_detail,
    patientServiceType: row.patient_service_type,
    incidentLocation: row.incident_location,
    patientServiceUnit: row.patient_service_unit,
    patientServiceUnitOther: row.patient_service_unit_other,
    causingUnit: row.causing_unit,
    patientImpact: row.patient_impact,
    immediateAction: row.immediate_action,
    immediateActionResult: row.immediate_action_result,
    actionTakenBy: row.action_taken_by,
    actionTakenByDetail: row.action_taken_by_detail,
    recurrenceElsewhere: row.recurrence_elsewhere,
    recurrenceDetail: row.recurrence_detail,
    kpcDescription: row.kpc_description,
    kpcLocation: row.kpc_location,
    kpcRelatedUnit: row.kpc_related_unit,
    severityGrade: row.severity_grade,
    severitySetBy: row.severity_set_by,
    severitySetAt: row.severity_set_at,
    investigationRequired: row.investigation_required,
    reportMakerName: row.report_maker_name,
    reportReceiverName: row.report_receiver_name,
    reportReceiverId: row.report_receiver_id,
    reportReceivedDate: row.report_received_date,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    submittedAt: row.submitted_at,
    verifiedAt: row.verified_at,
    closedAt: row.closed_at,
  };
}

/** camelCase model (parsial) -> kolom snake_case untuk insert/update. */
function incidentToRow(entry: Partial<IkpIncident>): Record<string, any> {
  const map: Record<string, string> = {
    reportKind: 'report_kind', status: 'status', reportDate: 'report_date',
    reportTime: 'report_time', reporterId: 'reporter_id', reporterName: 'reporter_name',
    reporterUnit: 'reporter_unit', reporterProfession: 'reporter_profession',
    reporterContact: 'reporter_contact', isAnonymous: 'is_anonymous', tempat: 'tempat',
    patientName: 'patient_name', patientMrNumber: 'patient_mr_number', patientRoom: 'patient_room',
    patientAgeGroup: 'patient_age_group', patientGender: 'patient_gender', payerType: 'payer_type',
    admissionDate: 'admission_date', admissionTime: 'admission_time',
    incidentDate: 'incident_date', incidentTime: 'incident_time', incidentSummary: 'incident_summary',
    chronology: 'chronology', incidentType: 'incident_type', isSentinel: 'is_sentinel',
    reportedByCategory: 'reported_by_category', reportedByDetail: 'reported_by_detail',
    incidentSubject: 'incident_subject', incidentSubjectDetail: 'incident_subject_detail',
    patientServiceType: 'patient_service_type', incidentLocation: 'incident_location',
    patientServiceUnit: 'patient_service_unit', patientServiceUnitOther: 'patient_service_unit_other',
    causingUnit: 'causing_unit', patientImpact: 'patient_impact',
    immediateAction: 'immediate_action', immediateActionResult: 'immediate_action_result',
    actionTakenBy: 'action_taken_by', actionTakenByDetail: 'action_taken_by_detail',
    recurrenceElsewhere: 'recurrence_elsewhere', recurrenceDetail: 'recurrence_detail',
    kpcDescription: 'kpc_description', kpcLocation: 'kpc_location', kpcRelatedUnit: 'kpc_related_unit',
    severityGrade: 'severity_grade', severitySetBy: 'severity_set_by', severitySetAt: 'severity_set_at',
    investigationRequired: 'investigation_required',
    reportMakerName: 'report_maker_name', reportReceiverName: 'report_receiver_name',
    reportReceiverId: 'report_receiver_id', reportReceivedDate: 'report_received_date',
    createdBy: 'created_by', submittedAt: 'submitted_at', verifiedAt: 'verified_at', closedAt: 'closed_at',
  };
  const row: Record<string, any> = {};
  for (const [key, value] of Object.entries(entry)) {
    const col = map[key];
    if (col) row[col] = value;
  }
  return row;
}

function rowToInvestigation(row: Record<string, any>): IkpInvestigation {
  return {
    id: row.id,
    incidentId: row.incident_id,
    investigatorId: row.investigator_id,
    investigatorName: row.investigator_name,
    method: row.method,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    findings: row.findings,
    rootCause: row.root_cause,
    contributingFactors: row.contributing_factors ?? [],
    contributingFactorsDetail: row.contributing_factors_detail,
    recommendation: row.recommendation,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToAction(row: Record<string, any>): IkpAction {
  return {
    id: row.id,
    incidentId: row.incident_id,
    action: row.action,
    actionType: row.action_type,
    picId: row.pic_id,
    picName: row.pic_name,
    unit: row.unit,
    priority: row.priority,
    dueDate: row.due_date,
    status: row.status,
    completedAt: row.completed_at,
    evidenceNote: row.evidence_note,
    verifierId: row.verifier_id,
    verificationResult: row.verification_result,
    verifiedAt: row.verified_at,
    notes: row.notes,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToAttachment(row: Record<string, any>): IkpAttachment {
  return {
    id: row.id,
    incidentId: row.incident_id,
    actionId: row.action_id,
    filename: row.filename,
    storageKey: row.storage_key,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    uploadedBy: row.uploaded_by,
    createdAt: row.created_at,
  };
}

function rowToAudit(row: Record<string, any>): IkpAuditEntry {
  return {
    id: row.id,
    type: 'ikp',
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
// Audit trail / notifikasi — menulis ke tabel audit_logs yang sudah
// ada (type = 'ikp'), sehingga otomatis muncul di AuditTrailPanel &
// NotificationPanel existing tanpa sistem notifikasi baru.
// ────────────────────────────────────────────────────────────────

export async function logIkpAudit(params: {
  msg: string;
  badge: string;
  userId?: string;
  unitId?: string;
  entityId?: string;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
}): Promise<void> {
  const { error } = await supabase.from(AUDIT_TABLE).insert({
    type: 'ikp',
    msg: params.msg,
    badge: params.badge,
    ts: new Date().toLocaleString('id-ID'),
    user_id: params.userId || null,
    unit_id: params.unitId || null,
    entity_type: 'ikp_incidents',
    entity_id: params.entityId || null,
    old_value: params.oldValue ?? null,
    new_value: params.newValue ?? null,
  });
  if (error) console.error('[logIkpAudit] gagal menulis audit log:', error);
}

export async function getIkpAuditTrail(incidentId?: string, limitCount = 200): Promise<IkpAuditEntry[]> {
  let query = supabase.from(AUDIT_TABLE).select('*').eq('type', 'ikp');
  if (incidentId) query = query.eq('entity_id', incidentId);
  const { data, error } = await query.order('created_at', { ascending: false }).limit(limitCount);
  if (error) throw error;
  return (data as any[]).map(rowToAudit);
}

// ────────────────────────────────────────────────────────────────
// Insiden — CRUD
// ────────────────────────────────────────────────────────────────

export async function createIkpIncident(
  entry: Partial<IkpIncident> & { reportKind: 'insiden' | 'kpc'; createdBy: string }
): Promise<IkpIncident> {
  const row = incidentToRow(entry);
  const { data, error } = await supabase.from(INCIDENTS_TABLE).insert(row).select('*').single();
  if (error) throw error;
  const created = rowToIncident(data);
  await logIkpAudit({
    msg: `Draft laporan ${created.reportNumber} dibuat`,
    badge: created.reportKind === 'kpc' ? 'KPC' : 'IKP',
    userId: entry.createdBy,
    entityId: created.id,
    newValue: row,
  });
  return created;
}

export async function updateIkpIncident(
  id: string,
  patch: Partial<IkpIncident>,
  actorId?: string
): Promise<IkpIncident> {
  const row = incidentToRow(patch);
  const { data, error } = await supabase.from(INCIDENTS_TABLE).update(row).eq('id', id).select('*').single();
  if (error) throw error;
  const updated = rowToIncident(data);

  // Log khusus untuk perubahan status (paling penting untuk audit trail/notifikasi).
  if (patch.status) {
    await logIkpAudit({
      msg: `Status laporan ${updated.reportNumber} berubah menjadi "${patch.status}"`,
      badge: 'Status',
      userId: actorId,
      entityId: id,
      newValue: { status: patch.status },
    });
  }
  return updated;
}

export async function submitIkpIncident(id: string, actorId?: string): Promise<IkpIncident> {
  return updateIkpIncident(id, { status: 'dilaporkan', submittedAt: new Date().toISOString() }, actorId);
}

export async function deleteIkpIncident(id: string): Promise<void> {
  const { error } = await supabase.from(INCIDENTS_TABLE).delete().eq('id', id);
  if (error) throw error;
}

export async function getIkpIncidentById(id: string): Promise<IkpIncident | null> {
  const { data, error } = await supabase.from(INCIDENTS_TABLE).select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? rowToIncident(data) : null;
}

export async function getIkpIncidents(filters: IkpFilters = {}): Promise<IkpIncident[]> {
  let query = supabase.from(INCIDENTS_TABLE).select('*');

  const dateCol = filters.dateField === 'report' ? 'report_date' : 'incident_date';
  if (filters.startDate) query = query.gte(dateCol, filters.startDate);
  if (filters.endDate) query = query.lte(dateCol, filters.endDate);
  if (filters.unit) query = query.or(`causing_unit.eq.${filters.unit},patient_service_unit.eq.${filters.unit},reporter_unit.eq.${filters.unit}`);
  if (filters.incidentType) query = query.eq('incident_type', filters.incidentType);
  if (filters.severityGrade) query = query.eq('severity_grade', filters.severityGrade);
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.reportKind) query = query.eq('report_kind', filters.reportKind);

  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw error;
  let rows = (data as any[]).map(rowToIncident);

  if (filters.search) {
    const q = filters.search.toLowerCase();
    rows = rows.filter((r) =>
      r.reportNumber.toLowerCase().includes(q) ||
      (r.incidentSummary ?? '').toLowerCase().includes(q) ||
      (r.patientName ?? '').toLowerCase().includes(q) ||
      (r.causingUnit ?? '').toLowerCase().includes(q)
    );
  }
  return rows;
}

/** Realtime listener untuk daftar insiden (dipakai Dashboard & Daftar Insiden). */
export function subscribeToIkpIncidents(
  filters: IkpFilters,
  callback: (rows: IkpIncident[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const refresh = async () => {
    try {
      callback(await getIkpIncidents(filters));
    } catch (err) {
      onError?.(err as Error);
    }
  };
  refresh();

  const channel = supabase
    .channel('ikp-incidents')
    .on('postgres_changes', { event: '*', schema: 'public', table: INCIDENTS_TABLE }, () => refresh())
    .subscribe();

  return () => supabase.removeChannel(channel);
}

// ────────────────────────────────────────────────────────────────
// Investigasi
// ────────────────────────────────────────────────────────────────

export async function getIkpInvestigation(incidentId: string): Promise<IkpInvestigation | null> {
  const { data, error } = await supabase
    .from(INVESTIGATIONS_TABLE)
    .select('*')
    .eq('incident_id', incidentId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToInvestigation(data) : null;
}

export async function upsertIkpInvestigation(
  incidentId: string,
  patch: Partial<IkpInvestigation>,
  actorId?: string
): Promise<IkpInvestigation> {
  const existing = await getIkpInvestigation(incidentId);
  const row = {
    incident_id: incidentId,
    investigator_id: patch.investigatorId,
    investigator_name: patch.investigatorName,
    method: patch.method,
    started_at: patch.startedAt,
    completed_at: patch.completedAt,
    findings: patch.findings,
    root_cause: patch.rootCause,
    contributing_factors: patch.contributingFactors,
    contributing_factors_detail: patch.contributingFactorsDetail,
    recommendation: patch.recommendation,
    created_by: patch.createdBy ?? actorId,
  };
  const cleaned = Object.fromEntries(Object.entries(row).filter(([, v]) => v !== undefined));

  let data;
  if (existing) {
    const res = await supabase.from(INVESTIGATIONS_TABLE).update(cleaned).eq('id', existing.id).select('*').single();
    if (res.error) throw res.error;
    data = res.data;
  } else {
    const res = await supabase.from(INVESTIGATIONS_TABLE).insert(cleaned).select('*').single();
    if (res.error) throw res.error;
    data = res.data;
  }

  await logIkpAudit({
    msg: `Data investigasi diperbarui`,
    badge: 'Investigasi',
    userId: actorId,
    entityId: incidentId,
    newValue: cleaned,
  });
  return rowToInvestigation(data);
}

// ────────────────────────────────────────────────────────────────
// Tindak lanjut (corrective / preventive action)
// ────────────────────────────────────────────────────────────────

export async function getIkpActions(incidentId: string): Promise<IkpAction[]> {
  const { data, error } = await supabase
    .from(ACTIONS_TABLE)
    .select('*')
    .eq('incident_id', incidentId)
    .order('due_date', { ascending: true });
  if (error) throw error;
  return (data as any[]).map(rowToAction);
}

/** Semua tindak lanjut lintas-insiden — dipakai halaman "Tindak Lanjut" & "Investigasi". */
export async function getAllIkpActions(filters: { status?: string; picId?: string } = {}): Promise<IkpAction[]> {
  try {
    await supabase.rpc('mark_overdue_ikp_actions');
  } catch {
    // Non-fatal — hanya penanda visual "Terlambat"; halaman tetap menampilkan
    // data meski RPC belum tersedia (mis. migration_ikp.sql belum dijalankan).
  }
  let query = supabase.from(ACTIONS_TABLE).select('*');
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.picId) query = query.eq('pic_id', filters.picId);
  const { data, error } = await query.order('due_date', { ascending: true });
  if (error) throw error;
  return (data as any[]).map(rowToAction);
}

export async function createIkpAction(entry: Partial<IkpAction> & { incidentId: string }, actorId?: string): Promise<IkpAction> {
  const row = {
    incident_id: entry.incidentId,
    action: entry.action,
    action_type: entry.actionType,
    pic_id: entry.picId,
    pic_name: entry.picName,
    unit: entry.unit,
    priority: entry.priority,
    due_date: entry.dueDate,
    status: entry.status ?? 'belum_dimulai',
    notes: entry.notes,
    created_by: actorId,
  };
  const { data, error } = await supabase.from(ACTIONS_TABLE).insert(row).select('*').single();
  if (error) throw error;
  await logIkpAudit({ msg: `Tindak lanjut baru ditambahkan: ${entry.action}`, badge: 'Tindak Lanjut', userId: actorId, entityId: entry.incidentId });
  return rowToAction(data);
}

export async function updateIkpAction(id: string, patch: Partial<IkpAction>, actorId?: string): Promise<IkpAction> {
  const map: Record<string, string> = {
    action: 'action', actionType: 'action_type', picId: 'pic_id', picName: 'pic_name', unit: 'unit',
    priority: 'priority', dueDate: 'due_date', status: 'status', completedAt: 'completed_at',
    evidenceNote: 'evidence_note', verifierId: 'verifier_id', verificationResult: 'verification_result',
    verifiedAt: 'verified_at', notes: 'notes',
  };
  const row: Record<string, any> = {};
  for (const [k, v] of Object.entries(patch)) if (map[k]) row[map[k]] = v;

  const { data, error } = await supabase.from(ACTIONS_TABLE).update(row).eq('id', id).select('*').single();
  if (error) throw error;
  const updated = rowToAction(data);
  if (patch.status) {
    await logIkpAudit({
      msg: `Tindak lanjut "${updated.action}" berubah status menjadi "${patch.status}"`,
      badge: 'Tindak Lanjut',
      userId: actorId,
      entityId: updated.incidentId,
    });
  }
  return updated;
}

// ────────────────────────────────────────────────────────────────
// Attachment
// ────────────────────────────────────────────────────────────────

export async function uploadIkpAttachment(
  incidentId: string,
  file: File,
  uploadedBy: string,
  actionId?: string
): Promise<IkpAttachment> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storageKey = `${incidentId}/${Date.now()}_${safeName}`;

  const { error: uploadError } = await supabase.storage.from(STORAGE_BUCKET).upload(storageKey, file, {
    contentType: file.type,
    upsert: false,
  });
  if (uploadError) throw uploadError;

  const { data, error } = await supabase
    .from(ATTACHMENTS_TABLE)
    .insert({
      incident_id: incidentId,
      action_id: actionId ?? null,
      filename: file.name,
      storage_key: storageKey,
      mime_type: file.type,
      size_bytes: file.size,
      uploaded_by: uploadedBy,
    })
    .select('*')
    .single();
  if (error) throw error;

  await logIkpAudit({ msg: `Berkas "${file.name}" diunggah`, badge: 'Attachment', userId: uploadedBy, entityId: incidentId });
  return rowToAttachment(data);
}

export async function getIkpAttachments(incidentId: string): Promise<IkpAttachment[]> {
  const { data, error } = await supabase.from(ATTACHMENTS_TABLE).select('*').eq('incident_id', incidentId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data as any[]).map(rowToAttachment);
}

/** Signed URL sementara (1 jam) — bucket bersifat privat, hanya boleh diakses via RLS. */
export async function getIkpAttachmentUrl(storageKey: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(storageKey, 3600);
  if (error) {
    console.error('[getIkpAttachmentUrl] gagal membuat signed URL:', error);
    return null;
  }
  return data.signedUrl;
}

export async function deleteIkpAttachment(id: string, storageKey: string): Promise<void> {
  await supabase.storage.from(STORAGE_BUCKET).remove([storageKey]);
  const { error } = await supabase.from(ATTACHMENTS_TABLE).delete().eq('id', id);
  if (error) throw error;
}

// ────────────────────────────────────────────────────────────────
// Statistik ringkas untuk Dashboard IKP
// ────────────────────────────────────────────────────────────────

export interface IkpDashboardStats {
  total: number;
  bulanIni: number;
  belumDitindaklanjuti: number;
  sedangInvestigasi: number;
  selesai: number;
  byImpact: Record<string, number>;
  byType: Record<string, number>;
  byUnit: Record<string, number>;
  bySeverity: Record<string, number>;
  byStatus: Record<string, number>;
  byMonth: { month: string; count: number }[];
}

export function computeIkpDashboardStats(rows: IkpIncident[]): IkpDashboardStats {
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const stats: IkpDashboardStats = {
    total: rows.length,
    bulanIni: 0,
    belumDitindaklanjuti: 0,
    sedangInvestigasi: 0,
    selesai: 0,
    byImpact: {},
    byType: {},
    byUnit: {},
    bySeverity: {},
    byStatus: {},
    byMonth: [],
  };

  const monthBuckets: Record<string, number> = {};

  for (const r of rows) {
    const refDate = r.incidentDate || r.reportDate;
    if (refDate?.startsWith(thisMonth)) stats.bulanIni++;
    if (r.status === 'dilaporkan' || r.status === 'diverifikasi') stats.belumDitindaklanjuti++;
    if (r.status === 'investigasi' || r.status === 'analisis') stats.sedangInvestigasi++;
    if (r.status === 'selesai') stats.selesai++;

    if (r.patientImpact) stats.byImpact[r.patientImpact] = (stats.byImpact[r.patientImpact] ?? 0) + 1;
    if (r.incidentType) stats.byType[r.incidentType] = (stats.byType[r.incidentType] ?? 0) + 1;
    const unit = r.causingUnit || r.patientServiceUnit || 'Tidak diketahui';
    stats.byUnit[unit] = (stats.byUnit[unit] ?? 0) + 1;
    if (r.severityGrade) stats.bySeverity[r.severityGrade] = (stats.bySeverity[r.severityGrade] ?? 0) + 1;
    stats.byStatus[r.status] = (stats.byStatus[r.status] ?? 0) + 1;

    if (refDate) {
      const bucket = refDate.slice(0, 7);
      monthBuckets[bucket] = (monthBuckets[bucket] ?? 0) + 1;
    }
  }

  stats.byMonth = Object.entries(monthBuckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([month, count]) => ({ month, count }));

  return stats;
}

export function isOverdueReport(incidentDate: string | null, status: IkpStatus): boolean {
  if (!incidentDate || status !== 'draft') return false;
  const hours = (Date.now() - new Date(incidentDate).getTime()) / 36e5;
  return hours > 48;
}
