import { supabase } from '@/lib/supabase/client';
import type {
  Risk,
  RiskAssessment,
  RiskMitigation,
  RiskMonitoring,
  RiskReview,
  RiskAttachment,
  RiskHistoryEntry,
  RiskAuditEntry,
  RiskFilters,
  RiskStatus,
  RiskLevel,
} from '@/types/risk';
import { skorLevelFromScore, matrixLevelFromScore } from '@/types/risk';

// Mengikuti pola src/lib/ikpData.ts: akses langsung dari client Supabase,
// snake_case <-> camelCase di boundary, realtime lewat postgres_changes,
// audit trail lewat tabel audit_logs existing (type = 'risk').

const RISKS_TABLE = 'risks';
const ASSESSMENTS_TABLE = 'risk_assessments';
const MITIGATIONS_TABLE = 'risk_mitigations';
const MONITORINGS_TABLE = 'risk_monitorings';
const REVIEWS_TABLE = 'risk_reviews';
const ATTACHMENTS_TABLE = 'risk_attachments';
const HISTORY_TABLE = 'risk_history';
const AUDIT_TABLE = 'audit_logs';
const STORAGE_BUCKET = 'risk-attachments';

type Unsubscribe = () => void;

// ────────────────────────────────────────────────────────────────
// Row <-> model mapping
// ────────────────────────────────────────────────────────────────

function rowToAssessment(row: Record<string, any>): RiskAssessment {
  return {
    id: row.id,
    riskId: row.risk_id,
    probabilitas: row.probabilitas,
    dampak: row.dampak,
    controllability: row.controllability,
    skorRisiko: row.skor_risiko,
    levelSkor: row.level_skor,
    matrixScore: row.matrix_score,
    matrixLevel: row.matrix_level,
    evaluationDecision: row.evaluation_decision,
    evaluatedBy: row.evaluated_by,
    evaluatedAt: row.evaluated_at,
    analyzedBy: row.analyzed_by,
    analyzedAt: row.analyzed_at,
    updatedAt: row.updated_at,
  };
}

function rowToRisk(row: Record<string, any>): Risk {
  return {
    id: row.id,
    riskCode: row.risk_code,
    riskYear: row.risk_year,
    identifiedDate: row.identified_date,
    unitLokasi: row.unit_lokasi,
    category: row.category,
    subcategory: row.subcategory,
    risiko: row.risiko,
    sebabInsiden: row.sebab_insiden,
    efekDampak: row.efek_dampak,
    prosesTerdampak: row.proses_terdampak,
    dokumenSpoTerkait: row.dokumen_spo_terkait,
    kontrolExisting: row.kontrol_existing,
    buktiPendukung: row.bukti_pendukung,
    sourceIkpIncidentId: row.source_ikp_incident_id,
    sourceAuditRef: row.source_audit_ref,
    status: row.status,
    riskOwnerId: row.risk_owner_id,
    riskOwnerName: row.risk_owner_name,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    closedAt: row.closed_at,
    assessment: row.risk_assessments
      ? rowToAssessment(Array.isArray(row.risk_assessments) ? row.risk_assessments[0] : row.risk_assessments)
      : undefined,
  };
}

function riskToRow(entry: Partial<Risk>): Record<string, any> {
  const map: Record<string, string> = {
    riskYear: 'risk_year', identifiedDate: 'identified_date', unitLokasi: 'unit_lokasi',
    category: 'category', subcategory: 'subcategory', risiko: 'risiko',
    sebabInsiden: 'sebab_insiden', efekDampak: 'efek_dampak', prosesTerdampak: 'proses_terdampak',
    dokumenSpoTerkait: 'dokumen_spo_terkait', kontrolExisting: 'kontrol_existing',
    buktiPendukung: 'bukti_pendukung', sourceIkpIncidentId: 'source_ikp_incident_id',
    sourceAuditRef: 'source_audit_ref', status: 'status', riskOwnerId: 'risk_owner_id',
    riskOwnerName: 'risk_owner_name', createdBy: 'created_by', closedAt: 'closed_at',
  };
  const row: Record<string, any> = {};
  for (const [key, value] of Object.entries(entry)) {
    const col = map[key];
    if (col) row[col] = value;
  }
  return row;
}

function rowToMitigation(row: Record<string, any>): RiskMitigation {
  return {
    id: row.id,
    riskId: row.risk_id,
    strategi: row.strategi,
    rencanaTindakan: row.rencana_tindakan,
    tujuanTindakan: row.tujuan_tindakan,
    picId: row.pic_id,
    picName: row.pic_name,
    tanggalMulai: row.tanggal_mulai,
    targetPenyelesaian: row.target_penyelesaian,
    indikatorKeberhasilan: row.indikator_keberhasilan,
    targetCapaian: row.target_capaian,
    sumberDaya: row.sumber_daya,
    anggaran: row.anggaran,
    status: row.status,
    progressPercent: row.progress_percent,
    buktiTindakLanjut: row.bukti_tindak_lanjut,
    catatan: row.catatan,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToMonitoring(row: Record<string, any>): RiskMonitoring {
  return {
    id: row.id,
    riskId: row.risk_id,
    mitigationId: row.mitigation_id,
    tanggal: row.tanggal,
    aktivitas: row.aktivitas,
    picName: row.pic_name,
    catatan: row.catatan,
    progressPercent: row.progress_percent,
    bukti: row.bukti,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

function rowToReview(row: Record<string, any>): RiskReview {
  return {
    id: row.id,
    riskId: row.risk_id,
    reviewDate: row.review_date,
    kondisiSaatIni: row.kondisi_saat_ini,
    masihTerjadi: row.masih_terjadi,
    mitigasiDilakukan: row.mitigasi_dilakukan,
    mitigasiEfektif: row.mitigasi_efektif,
    probabilitasBaru: row.probabilitas_baru,
    dampakBaru: row.dampak_baru,
    controllabilityBaru: row.controllability_baru,
    skorResidual: row.skor_residual,
    levelResidual: row.level_residual,
    keputusan: row.keputusan,
    reviewedBy: row.reviewed_by,
    createdAt: row.created_at,
  };
}

function rowToAttachment(row: Record<string, any>): RiskAttachment {
  return {
    id: row.id,
    riskId: row.risk_id,
    filename: row.filename,
    storageKey: row.storage_key,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    uploadedBy: row.uploaded_by,
    createdAt: row.created_at,
  };
}

function rowToHistory(row: Record<string, any>): RiskHistoryEntry {
  return {
    id: row.id,
    riskId: row.risk_id,
    fromStatus: row.from_status,
    toStatus: row.to_status,
    changedBy: row.changed_by,
    note: row.note,
    createdAt: row.created_at,
  };
}

function rowToAudit(row: Record<string, any>): RiskAuditEntry {
  return {
    id: row.id,
    type: 'risk',
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
// Audit trail — menulis ke tabel audit_logs existing (type = 'risk'),
// otomatis muncul di AuditTrailPanel/NotificationPanel existing.
// ────────────────────────────────────────────────────────────────

export async function logRiskAudit(params: {
  msg: string;
  badge: string;
  userId?: string;
  unitId?: string;
  entityId?: string;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
}): Promise<void> {
  const { error } = await supabase.from(AUDIT_TABLE).insert({
    type: 'risk',
    msg: params.msg,
    badge: params.badge,
    ts: new Date().toLocaleString('id-ID'),
    user_id: params.userId || null,
    unit_id: params.unitId || null,
    entity_type: 'risks',
    entity_id: params.entityId || null,
    old_value: params.oldValue ?? null,
    new_value: params.newValue ?? null,
  });
  if (error) console.error('[logRiskAudit] gagal menulis audit log:', error);
}

export async function getRiskAuditTrail(riskId?: string, limitCount = 200): Promise<RiskAuditEntry[]> {
  let query = supabase.from(AUDIT_TABLE).select('*').eq('type', 'risk');
  if (riskId) query = query.eq('entity_id', riskId);
  const { data, error } = await query.order('created_at', { ascending: false }).limit(limitCount);
  if (error) throw error;
  return (data as any[]).map(rowToAudit);
}

export async function getRiskHistory(riskId: string): Promise<RiskHistoryEntry[]> {
  const { data, error } = await supabase
    .from(HISTORY_TABLE)
    .select('*')
    .eq('risk_id', riskId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as any[]).map(rowToHistory);
}

// ────────────────────────────────────────────────────────────────
// Risiko — CRUD (identifikasi)
// ────────────────────────────────────────────────────────────────

export async function createRisk(
  entry: Partial<Risk> & { riskYear: number; unitLokasi: string; category: string; risiko: string; sebabInsiden: string; efekDampak: string; createdBy: string }
): Promise<Risk> {
  const row = riskToRow(entry);
  const { data, error } = await supabase.from(RISKS_TABLE).insert(row).select('*').single();
  if (error) throw error;
  const created = rowToRisk(data);
  await logRiskAudit({
    msg: `Risiko baru diidentifikasi: ${created.riskCode} — ${created.risiko}`,
    badge: 'Identifikasi',
    userId: entry.createdBy,
    entityId: created.id,
    newValue: row,
  });
  return created;
}

export async function updateRisk(id: string, patch: Partial<Risk>, actorId?: string): Promise<Risk> {
  const row = riskToRow(patch);
  const { data, error } = await supabase.from(RISKS_TABLE).update(row).eq('id', id).select('*').single();
  if (error) throw error;
  const updated = rowToRisk(data);
  if (patch.status) {
    await logRiskAudit({
      msg: `Status risiko ${updated.riskCode} berubah menjadi "${patch.status}"`,
      badge: 'Status',
      userId: actorId,
      entityId: id,
      newValue: { status: patch.status },
    });
  }
  return updated;
}

/** Soft-close (poin 16/37) — tidak menghapus data, hanya menandai status. */
export async function closeRisk(id: string, actorId?: string): Promise<Risk> {
  return updateRisk(id, { status: 'ditutup', closedAt: new Date().toISOString() }, actorId);
}

/** DELETE fisik — dibatasi RLS hanya untuk admin (poin 37). */
export async function deleteRisk(id: string): Promise<void> {
  const { error } = await supabase.from(RISKS_TABLE).delete().eq('id', id);
  if (error) throw error;
}

export async function getRiskById(id: string): Promise<Risk | null> {
  const { data, error } = await supabase
    .from(RISKS_TABLE)
    .select('*, risk_assessments(*)')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToRisk(data) : null;
}

export async function getRisks(filters: RiskFilters = {}): Promise<Risk[]> {
  let query = supabase.from(RISKS_TABLE).select('*, risk_assessments(*)');

  if (filters.year) query = query.eq('risk_year', filters.year);
  if (filters.unit) query = query.eq('unit_lokasi', filters.unit);
  if (filters.category) query = query.eq('category', filters.category);
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.ownerId) query = query.eq('risk_owner_id', filters.ownerId);

  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw error;
  let rows = (data as any[]).map(rowToRisk);

  // Level dihitung dari assessment (join) — difilter di aplikasi karena level_skor
  // ada di tabel terpisah (risk_assessments), bukan kolom langsung di risks.
  if (filters.level) rows = rows.filter((r) => r.assessment?.levelSkor === filters.level);

  if (filters.search) {
    const q = filters.search.toLowerCase();
    rows = rows.filter((r) =>
      r.riskCode.toLowerCase().includes(q) ||
      r.risiko.toLowerCase().includes(q) ||
      r.unitLokasi.toLowerCase().includes(q) ||
      (r.riskOwnerName ?? '').toLowerCase().includes(q)
    );
  }

  // Ranking (poin 13): skor tertinggi dulu, lalu level, dampak, probabilitas, tanggal identifikasi.
  rows.sort((a, b) => {
    const sa = a.assessment?.skorRisiko ?? -1;
    const sb = b.assessment?.skorRisiko ?? -1;
    if (sb !== sa) return sb - sa;
    const da = a.assessment?.dampak ?? 0;
    const db = b.assessment?.dampak ?? 0;
    if (db !== da) return db - da;
    const pa = a.assessment?.probabilitas ?? 0;
    const pb = b.assessment?.probabilitas ?? 0;
    if (pb !== pa) return pb - pa;
    return new Date(a.identifiedDate).getTime() - new Date(b.identifiedDate).getTime();
  });

  return rows;
}

/** Realtime listener untuk daftar risiko (Dashboard, Risk Register, Matrix). */
export function subscribeToRisks(
  filters: RiskFilters,
  callback: (rows: Risk[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const refresh = async () => {
    try {
      callback(await getRisks(filters));
    } catch (err) {
      onError?.(err as Error);
    }
  };
  refresh();

  const channel = supabase
    .channel('risk-register')
    .on('postgres_changes', { event: '*', schema: 'public', table: RISKS_TABLE }, () => refresh())
    .on('postgres_changes', { event: '*', schema: 'public', table: ASSESSMENTS_TABLE }, () => refresh())
    .subscribe();

  return () => supabase.removeChannel(channel);
}

// ────────────────────────────────────────────────────────────────
// Analisis & Evaluasi Risiko (poin 7-14)
// ────────────────────────────────────────────────────────────────

/** skor_risiko/level_skor/matrix_score/matrix_level dihitung DI DATABASE
 *  (generated column) — fungsi ini hanya mengirim probabilitas/dampak/
 *  controllability, tidak pernah mengirim skor secara manual (poin 41). */
export async function upsertRiskAssessment(
  riskId: string,
  input: { probabilitas: number; dampak: number; controllability: number },
  actorId?: string
): Promise<RiskAssessment> {
  const { data: existing } = await supabase.from(ASSESSMENTS_TABLE).select('id').eq('risk_id', riskId).maybeSingle();

  const row = {
    risk_id: riskId,
    probabilitas: input.probabilitas,
    dampak: input.dampak,
    controllability: input.controllability,
    analyzed_by: actorId,
  };

  let data;
  if (existing) {
    const res = await supabase.from(ASSESSMENTS_TABLE).update(row).eq('id', existing.id).select('*').single();
    if (res.error) throw res.error;
    data = res.data;
  } else {
    const res = await supabase.from(ASSESSMENTS_TABLE).insert(row).select('*').single();
    if (res.error) throw res.error;
    data = res.data;
  }

  const assessment = rowToAssessment(data);
  await updateRisk(riskId, { status: 'dianalisis' }, actorId);
  await logRiskAudit({
    msg: `Analisis risiko diperbarui — Skor Risiko = ${assessment.skorRisiko} (D${input.dampak} x P${input.probabilitas} x C${input.controllability})`,
    badge: 'Analisis',
    userId: actorId,
    entityId: riskId,
    newValue: row,
  });
  return assessment;
}

export async function evaluateRisk(
  riskId: string,
  decision: string,
  actorId?: string
): Promise<RiskAssessment> {
  const { data, error } = await supabase
    .from(ASSESSMENTS_TABLE)
    .update({ evaluation_decision: decision, evaluated_by: actorId, evaluated_at: new Date().toISOString() })
    .eq('risk_id', riskId)
    .select('*')
    .single();
  if (error) throw error;
  await updateRisk(riskId, { status: 'dievaluasi' }, actorId);
  await logRiskAudit({ msg: `Evaluasi risiko: "${decision}"`, badge: 'Evaluasi', userId: actorId, entityId: riskId });
  return rowToAssessment(data);
}

export async function getRiskAssessment(riskId: string): Promise<RiskAssessment | null> {
  const { data, error } = await supabase.from(ASSESSMENTS_TABLE).select('*').eq('risk_id', riskId).maybeSingle();
  if (error) throw error;
  return data ? rowToAssessment(data) : null;
}

// ────────────────────────────────────────────────────────────────
// Pengelolaan Risiko / Mitigasi (poin 15)
// ────────────────────────────────────────────────────────────────

export async function getRiskMitigations(riskId: string): Promise<RiskMitigation[]> {
  const { data, error } = await supabase
    .from(MITIGATIONS_TABLE)
    .select('*')
    .eq('risk_id', riskId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as any[]).map(rowToMitigation);
}

/** Semua mitigasi lintas-risiko — dipakai halaman worklist Mitigasi/Monitoring. */
export async function getAllRiskMitigations(filters: { status?: string; picId?: string } = {}): Promise<RiskMitigation[]> {
  try {
    await supabase.rpc('mark_overdue_risk_mitigations');
  } catch {
    // Non-fatal — hanya penanda visual "Terlambat"; halaman tetap tampil meski
    // migration_risk.sql belum dijalankan / RPC belum tersedia.
  }
  let query = supabase.from(MITIGATIONS_TABLE).select('*');
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.picId) query = query.eq('pic_id', filters.picId);
  const { data, error } = await query.order('target_penyelesaian', { ascending: true });
  if (error) throw error;
  return (data as any[]).map(rowToMitigation);
}

export async function createRiskMitigation(
  entry: Partial<RiskMitigation> & { riskId: string; rencanaTindakan: string },
  actorId?: string
): Promise<RiskMitigation> {
  const row = {
    risk_id: entry.riskId,
    strategi: entry.strategi,
    rencana_tindakan: entry.rencanaTindakan,
    tujuan_tindakan: entry.tujuanTindakan,
    pic_id: entry.picId,
    pic_name: entry.picName,
    tanggal_mulai: entry.tanggalMulai,
    target_penyelesaian: entry.targetPenyelesaian,
    indikator_keberhasilan: entry.indikatorKeberhasilan,
    target_capaian: entry.targetCapaian,
    sumber_daya: entry.sumberDaya,
    anggaran: entry.anggaran,
    status: entry.status ?? 'belum_dimulai',
    progress_percent: entry.progressPercent ?? 0,
    catatan: entry.catatan,
    created_by: actorId,
  };
  const { data, error } = await supabase.from(MITIGATIONS_TABLE).insert(row).select('*').single();
  if (error) throw error;
  await updateRisk(entry.riskId, { status: 'dalam_mitigasi' }, actorId);
  await logRiskAudit({ msg: `Rencana mitigasi baru ditambahkan: ${entry.rencanaTindakan}`, badge: 'Mitigasi', userId: actorId, entityId: entry.riskId });
  return rowToMitigation(data);
}

export async function updateRiskMitigation(id: string, patch: Partial<RiskMitigation>, actorId?: string): Promise<RiskMitigation> {
  const map: Record<string, string> = {
    strategi: 'strategi', rencanaTindakan: 'rencana_tindakan', tujuanTindakan: 'tujuan_tindakan',
    picId: 'pic_id', picName: 'pic_name', tanggalMulai: 'tanggal_mulai',
    targetPenyelesaian: 'target_penyelesaian', indikatorKeberhasilan: 'indikator_keberhasilan',
    targetCapaian: 'target_capaian', sumberDaya: 'sumber_daya', anggaran: 'anggaran',
    status: 'status', progressPercent: 'progress_percent', buktiTindakLanjut: 'bukti_tindak_lanjut',
    catatan: 'catatan',
  };
  const row: Record<string, any> = {};
  for (const [k, v] of Object.entries(patch)) if (map[k]) row[map[k]] = v;

  const { data, error } = await supabase.from(MITIGATIONS_TABLE).update(row).eq('id', id).select('*').single();
  if (error) throw error;
  const updated = rowToMitigation(data);
  if (patch.status || patch.progressPercent !== undefined) {
    await logRiskAudit({
      msg: `Mitigasi "${updated.rencanaTindakan}" diperbarui${patch.status ? ` — status: ${patch.status}` : ''}${patch.progressPercent !== undefined ? ` — progress: ${patch.progressPercent}%` : ''}`,
      badge: 'Mitigasi',
      userId: actorId,
      entityId: updated.riskId,
    });
  }
  return updated;
}

// ────────────────────────────────────────────────────────────────
// Monitoring Risiko (poin 17)
// ────────────────────────────────────────────────────────────────

export async function getRiskMonitorings(riskId: string): Promise<RiskMonitoring[]> {
  const { data, error } = await supabase
    .from(MONITORINGS_TABLE)
    .select('*')
    .eq('risk_id', riskId)
    .order('tanggal', { ascending: false });
  if (error) throw error;
  return (data as any[]).map(rowToMonitoring);
}

export async function createRiskMonitoring(
  entry: Partial<RiskMonitoring> & { riskId: string; aktivitas: string },
  actorId?: string
): Promise<RiskMonitoring> {
  const row = {
    risk_id: entry.riskId,
    mitigation_id: entry.mitigationId,
    tanggal: entry.tanggal ?? new Date().toISOString().slice(0, 10),
    aktivitas: entry.aktivitas,
    pic_name: entry.picName,
    catatan: entry.catatan,
    progress_percent: entry.progressPercent,
    bukti: entry.bukti,
    created_by: actorId,
  };
  const { data, error } = await supabase.from(MONITORINGS_TABLE).insert(row).select('*').single();
  if (error) throw error;
  await updateRisk(entry.riskId, { status: 'monitoring' }, actorId);
  await logRiskAudit({ msg: `Aktivitas monitoring dicatat: ${entry.aktivitas}`, badge: 'Monitoring', userId: actorId, entityId: entry.riskId });
  return rowToMonitoring(data);
}

// ────────────────────────────────────────────────────────────────
// Review Risiko & Risiko Residual (poin 18-19)
// ────────────────────────────────────────────────────────────────

export async function getRiskReviews(riskId: string): Promise<RiskReview[]> {
  const { data, error } = await supabase
    .from(REVIEWS_TABLE)
    .select('*')
    .eq('risk_id', riskId)
    .order('review_date', { ascending: false });
  if (error) throw error;
  return (data as any[]).map(rowToReview);
}

export async function createRiskReview(
  entry: Partial<RiskReview> & { riskId: string },
  actorId?: string
): Promise<RiskReview> {
  const row = {
    risk_id: entry.riskId,
    review_date: entry.reviewDate ?? new Date().toISOString().slice(0, 10),
    kondisi_saat_ini: entry.kondisiSaatIni,
    masih_terjadi: entry.masihTerjadi,
    mitigasi_dilakukan: entry.mitigasiDilakukan,
    mitigasi_efektif: entry.mitigasiEfektif,
    probabilitas_baru: entry.probabilitasBaru,
    dampak_baru: entry.dampakBaru,
    controllability_baru: entry.controllabilityBaru,
    keputusan: entry.keputusan,
    reviewed_by: actorId,
  };
  const { data, error } = await supabase.from(REVIEWS_TABLE).insert(row).select('*').single();
  if (error) throw error;
  const review = rowToReview(data);

  const nextStatus = entry.keputusan === 'risiko_dapat_ditutup' ? 'ditutup' : 'review';
  await updateRisk(entry.riskId, { status: nextStatus, closedAt: nextStatus === 'ditutup' ? new Date().toISOString() : undefined }, actorId);

  await logRiskAudit({
    msg: `Review risiko dicatat${review.skorResidual != null ? ` — Skor Residual: ${review.skorResidual}` : ''}${entry.keputusan ? ` — Keputusan: ${entry.keputusan}` : ''}`,
    badge: 'Review',
    userId: actorId,
    entityId: entry.riskId,
  });
  return review;
}

// ────────────────────────────────────────────────────────────────
// Attachment / Evidence
// ────────────────────────────────────────────────────────────────

export async function uploadRiskAttachment(riskId: string, file: File, uploadedBy: string): Promise<RiskAttachment> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storageKey = `${riskId}/${Date.now()}_${safeName}`;

  const { error: uploadError } = await supabase.storage.from(STORAGE_BUCKET).upload(storageKey, file, {
    contentType: file.type,
    upsert: false,
  });
  if (uploadError) throw uploadError;

  const { data, error } = await supabase
    .from(ATTACHMENTS_TABLE)
    .insert({ risk_id: riskId, filename: file.name, storage_key: storageKey, mime_type: file.type, size_bytes: file.size, uploaded_by: uploadedBy })
    .select('*')
    .single();
  if (error) throw error;

  await logRiskAudit({ msg: `Berkas bukti "${file.name}" diunggah`, badge: 'Evidence', userId: uploadedBy, entityId: riskId });
  return rowToAttachment(data);
}

export async function getRiskAttachments(riskId: string): Promise<RiskAttachment[]> {
  const { data, error } = await supabase.from(ATTACHMENTS_TABLE).select('*').eq('risk_id', riskId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data as any[]).map(rowToAttachment);
}

export async function getRiskAttachmentUrl(storageKey: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(storageKey, 3600);
  if (error) {
    console.error('[getRiskAttachmentUrl] gagal membuat signed URL:', error);
    return null;
  }
  return data.signedUrl;
}

export async function deleteRiskAttachment(id: string, storageKey: string): Promise<void> {
  await supabase.storage.from(STORAGE_BUCKET).remove([storageKey]);
  const { error } = await supabase.from(ATTACHMENTS_TABLE).delete().eq('id', id);
  if (error) throw error;
}

// ────────────────────────────────────────────────────────────────
// Integrasi IKP -> Risiko (poin 22) — tombol "Jadikan Risiko"
// ────────────────────────────────────────────────────────────────

export async function createRiskFromIkpIncident(
  ikpIncident: {
    id: string; reportNumber: string; incidentDate?: string | null; causingUnit?: string | null;
    patientServiceUnit?: string | null; chronology?: string | null; incidentSummary?: string | null;
    immediateAction?: string | null;
  },
  actorId: string
): Promise<Risk> {
  const row = {
    risk_year: new Date().getFullYear(),
    unit_lokasi: ikpIncident.causingUnit || ikpIncident.patientServiceUnit || 'Lainnya',
    category: 'keselamatan_pasien',
    identified_date: ikpIncident.incidentDate || new Date().toISOString().slice(0, 10),
    risiko: ikpIncident.incidentSummary || `Risiko dari insiden ${ikpIncident.reportNumber}`,
    sebab_insiden: ikpIncident.chronology || '(mohon lengkapi berdasarkan kronologi IKP)',
    efek_dampak: ikpIncident.immediateAction || '(mohon lengkapi)',
    source_ikp_incident_id: ikpIncident.id,
    status: 'draft',
    created_by: actorId,
  };
  const { data, error } = await supabase.from(RISKS_TABLE).insert(row).select('*').single();
  if (error) throw error;
  const created = rowToRisk(data);
  await logRiskAudit({
    msg: `Risiko dibuat dari IKP ${ikpIncident.reportNumber} — menunggu validasi`,
    badge: 'Dari IKP',
    userId: actorId,
    entityId: created.id,
  });
  return created;
}

// ────────────────────────────────────────────────────────────────
// Statistik ringkas untuk Dashboard Risiko
// ────────────────────────────────────────────────────────────────

export interface RiskDashboardStats {
  total: number;
  aktif: number;
  sangatTinggi: number;
  tinggi: number;
  sedang: number;
  rendah: number;
  selesai: number;
  belumDitindaklanjuti: number;
  melebihiDeadline: number;
  byLevel: Record<string, number>;
  byUnit: Record<string, number>;
  byCategory: Record<string, number>;
  byYear: Record<string, number>;
  byMonth: { month: string; count: number }[];
  byMitigationStatus: Record<string, number>;
  top10: Risk[];
}

export function computeRiskDashboardStats(rows: Risk[], mitigations: RiskMitigation[]): RiskDashboardStats {
  const stats: RiskDashboardStats = {
    total: rows.length,
    aktif: 0,
    sangatTinggi: 0,
    tinggi: 0,
    sedang: 0,
    rendah: 0,
    selesai: 0,
    belumDitindaklanjuti: 0,
    melebihiDeadline: 0,
    byLevel: {},
    byUnit: {},
    byCategory: {},
    byYear: {},
    byMonth: [],
    byMitigationStatus: {},
    top10: [],
  };

  const monthBuckets: Record<string, number> = {};

  for (const r of rows) {
    if (r.status !== 'selesai' && r.status !== 'ditutup') stats.aktif++;
    if (r.status === 'selesai' || r.status === 'ditutup') stats.selesai++;
    if (r.status === 'draft' || r.status === 'identifikasi') stats.belumDitindaklanjuti++;

    const level = r.assessment?.levelSkor;
    if (level) {
      stats.byLevel[level] = (stats.byLevel[level] ?? 0) + 1;
      if (level === 'sangat_tinggi') stats.sangatTinggi++;
      if (level === 'tinggi') stats.tinggi++;
      if (level === 'sedang') stats.sedang++;
      if (level === 'rendah') stats.rendah++;
    }

    stats.byUnit[r.unitLokasi] = (stats.byUnit[r.unitLokasi] ?? 0) + 1;
    stats.byCategory[r.category] = (stats.byCategory[r.category] ?? 0) + 1;
    stats.byYear[String(r.riskYear)] = (stats.byYear[String(r.riskYear)] ?? 0) + 1;

    if (r.identifiedDate) {
      const bucket = r.identifiedDate.slice(0, 7);
      monthBuckets[bucket] = (monthBuckets[bucket] ?? 0) + 1;
    }
  }

  for (const m of mitigations) {
    stats.byMitigationStatus[m.status] = (stats.byMitigationStatus[m.status] ?? 0) + 1;
    if (m.status === 'terlambat') stats.melebihiDeadline++;
  }

  stats.byMonth = Object.entries(monthBuckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([month, count]) => ({ month, count }));

  stats.top10 = [...rows]
    .filter((r) => r.assessment)
    .sort((a, b) => (b.assessment!.skorRisiko - a.assessment!.skorRisiko))
    .slice(0, 10);

  return stats;
}

// ────────────────────────────────────────────────────────────────
// Analisis Trend Antar-Tahun (poin 26) & Risiko Berulang (poin 27)
// ────────────────────────────────────────────────────────────────

export interface RiskYearComparison {
  year: number;
  jumlahRisiko: number;
  risikoBaru: number;
  risikoBerulang: number;
  risikoDitutup: number;
  topUnit: string | null;
  topRisk: Risk | null;
}

/** Bandingkan beberapa tahun Risk Register sekaligus (poin 26). */
export function compareRiskYears(allRows: Risk[], years: number[]): RiskYearComparison[] {
  return years.map((year) => {
    const rowsThisYear = allRows.filter((r) => r.riskYear === year);
    const rowsPrevYear = allRows.filter((r) => r.riskYear === year - 1);

    const berulang = rowsThisYear.filter((r) =>
      rowsPrevYear.some((p) => p.unitLokasi === r.unitLokasi && p.risiko === r.risiko && p.sebabInsiden === r.sebabInsiden)
    ).length;

    const unitCount: Record<string, number> = {};
    for (const r of rowsThisYear) unitCount[r.unitLokasi] = (unitCount[r.unitLokasi] ?? 0) + 1;
    const topUnit = Object.entries(unitCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    const topRisk = [...rowsThisYear].filter((r) => r.assessment).sort((a, b) => b.assessment!.skorRisiko - a.assessment!.skorRisiko)[0] ?? null;

    return {
      year,
      jumlahRisiko: rowsThisYear.length,
      risikoBaru: rowsThisYear.length - berulang,
      risikoBerulang: berulang,
      risikoDitutup: rowsThisYear.filter((r) => r.status === 'ditutup' || r.status === 'selesai').length,
      topUnit,
      topRisk,
    };
  });
}

/** Cek risiko berulang (poin 27) — unit, risiko, dan sebab sama dengan tahun sebelumnya. */
export function findSimilarRiskInPreviousYear(current: Risk, allRows: Risk[]): Risk | null {
  return (
    allRows.find(
      (r) =>
        r.riskYear === current.riskYear - 1 &&
        r.unitLokasi === current.unitLokasi &&
        r.risiko.toLowerCase() === current.risiko.toLowerCase() &&
        r.sebabInsiden.toLowerCase() === current.sebabInsiden.toLowerCase()
    ) ?? null
  );
}

export { skorLevelFromScore, matrixLevelFromScore };
