import { supabase } from '@/lib/supabase/client';
import type {
  KepuasanSurvey,
  KepuasanSurveyFilters,
  KepuasanSurveyToken,
  KepuasanTokenKind,
  KepuasanResponse,
  KepuasanSubmitPayload,
  KepuasanPeriodResult,
  KepuasanPublicSurveyInfo,
  KepuasanUnsurField,
  KepuasanClassificationBand,
} from '@/types/kepuasan';
import { KEPUASAN_UNSUR_FIELDS, KEPUASAN_UNSUR_WEIGHT, KEPUASAN_NIK_MULTIPLIER, KEPUASAN_DEFAULT_THRESHOLDS, classifyKepuasanScore, evaluateKepuasanTarget } from '@/types/kepuasan';
import { getCustomIndicatorBundle, getCustomIndicatorMeasurements, recordCustomIndicatorMeasurement } from '@/lib/customIndicatorData';
import { computeAchievementStatus, computePeriodKey } from '@/types/customIndicators';

const CUSTOM_INDICATOR_MEASUREMENTS_TABLE = 'custom_indicator_measurements';

// Mengikuti pola src/lib/budayaData.ts / customIndicatorData.ts: akses
// langsung dari client, snake_case <-> camelCase di boundary, realtime lewat
// postgres_changes, audit trail reuse tabel `audit_logs` (type='kepuasan').

const SURVEYS_TABLE = 'kepuasan_surveys';
const TOKENS_TABLE = 'kepuasan_survey_tokens';
const RESPONSES_TABLE = 'kepuasan_responses';
const PERIOD_RESULTS_TABLE = 'kepuasan_period_results';
const AUDIT_TABLE = 'audit_logs';

type Unsubscribe = () => void;

// ────────────────────────────────────────────────────────────────
// Row <-> model mapping
// ────────────────────────────────────────────────────────────────

function rowToSurvey(row: Record<string, any>): KepuasanSurvey {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    unitId: row.unit_id,
    startDate: row.start_date,
    endDate: row.end_date,
    targetRespondents: row.target_respondents,
    surveyMode: row.survey_mode,
    status: row.status,
    instrumentVersion: row.instrument_version,
    targetValue: Number(row.target_value),
    targetOperator: row.target_operator,
    classificationThresholds: (row.classification_thresholds as KepuasanClassificationBand[]) ?? KEPUASAN_DEFAULT_THRESHOLDS,
    kioskResetSeconds: row.kiosk_reset_seconds,
    linkedIndicatorId: row.linked_indicator_id,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function surveyToRow(s: Partial<KepuasanSurvey>): Record<string, any> {
  const row: Record<string, any> = {};
  if (s.name !== undefined) row.name = s.name;
  if (s.description !== undefined) row.description = s.description;
  if (s.unitId !== undefined) row.unit_id = s.unitId;
  if (s.startDate !== undefined) row.start_date = s.startDate;
  if (s.endDate !== undefined) row.end_date = s.endDate;
  if (s.targetRespondents !== undefined) row.target_respondents = s.targetRespondents;
  if (s.surveyMode !== undefined) row.survey_mode = s.surveyMode;
  if (s.status !== undefined) row.status = s.status;
  if (s.targetValue !== undefined) row.target_value = s.targetValue;
  if (s.targetOperator !== undefined) row.target_operator = s.targetOperator;
  if (s.classificationThresholds !== undefined) row.classification_thresholds = s.classificationThresholds;
  if (s.kioskResetSeconds !== undefined) row.kiosk_reset_seconds = s.kioskResetSeconds;
  if (s.linkedIndicatorId !== undefined) row.linked_indicator_id = s.linkedIndicatorId;
  if ((s as any).createdBy !== undefined) row.created_by = (s as any).createdBy;
  return row;
}

function rowToToken(row: Record<string, any>): KepuasanSurveyToken {
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

function rowToResponse(row: Record<string, any>): KepuasanResponse {
  const scores = {} as Record<KepuasanUnsurField, 1 | 2 | 3 | 4>;
  for (const f of KEPUASAN_UNSUR_FIELDS) scores[f] = row[f];
  return {
    id: row.id,
    responseCode: row.response_code,
    surveyId: row.survey_id,
    tokenId: row.token_id,
    unitId: row.unit_id,
    respondentName: row.respondent_name,
    scores,
    kritikSaran: row.kritik_saran,
    willingToContact: row.willing_to_contact,
    contactPhone: row.contact_phone,
    followupStatus: row.followup_status,
    followupPic: row.followup_pic,
    followupNote: row.followup_note,
    followupDate: row.followup_date,
    source: row.source,
    isValid: row.is_valid,
    submittedAt: row.submitted_at,
  };
}

function rowToPeriodResult(row: Record<string, any>): KepuasanPeriodResult {
  return {
    id: row.id,
    surveyId: row.survey_id,
    unitId: row.unit_id,
    totalRespondents: row.total_respondents,
    unsurAverages: row.unsur_averages ?? {},
    nilaiIndeks: row.nilai_indeks === null ? null : Number(row.nilai_indeks),
    ikm: row.ikm === null ? null : Number(row.ikm),
    grade: row.grade,
    gradeLabel: row.grade_label,
    statusCapaian: row.status_capaian,
    computedAt: row.computed_at,
  };
}

// ────────────────────────────────────────────────────────────────
// Audit
// ────────────────────────────────────────────────────────────────

export async function logKepuasanAudit(params: {
  msg: string;
  badge: string;
  userId?: string;
  unitId?: string;
  entityId?: string;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
}): Promise<void> {
  const { error } = await supabase.from(AUDIT_TABLE).insert({
    type: 'kepuasan',
    msg: params.msg,
    badge: params.badge,
    ts: new Date().toLocaleString('id-ID'),
    user_id: params.userId || null,
    unit_id: params.unitId || null,
    entity_type: SURVEYS_TABLE,
    entity_id: params.entityId || null,
    old_value: params.oldValue ?? null,
    new_value: params.newValue ?? null,
  });
  if (error) console.error('[logKepuasanAudit] gagal menulis audit log:', error);
}

// ────────────────────────────────────────────────────────────────
// Survey CRUD
// ────────────────────────────────────────────────────────────────

export async function createKepuasanSurvey(
  survey: Partial<KepuasanSurvey> & { name: string; unitId: string; startDate: string; endDate: string; createdBy: string }
): Promise<KepuasanSurvey> {
  const row = surveyToRow(survey);
  const { data, error } = await supabase.from(SURVEYS_TABLE).insert(row).select('*').single();
  if (error) throw error;
  const created = rowToSurvey(data);
  await logKepuasanAudit({ msg: `Survei "${created.name}" dibuat`, badge: 'Survey', userId: survey.createdBy, entityId: created.id, newValue: row });
  return created;
}

export async function updateKepuasanSurvey(id: string, patch: Partial<KepuasanSurvey>, actorId?: string): Promise<KepuasanSurvey> {
  const row = surveyToRow(patch);
  const { data, error } = await supabase.from(SURVEYS_TABLE).update(row).eq('id', id).select('*').single();
  if (error) throw error;
  const updated = rowToSurvey(data);
  if (patch.status) {
    await logKepuasanAudit({ msg: `Status survei "${updated.name}" berubah menjadi "${patch.status}"`, badge: 'Status', userId: actorId, entityId: id, newValue: { status: patch.status } });
  }
  return updated;
}

export async function getKepuasanSurveys(filters: KepuasanSurveyFilters = {}): Promise<KepuasanSurvey[]> {
  let query = supabase.from(SURVEYS_TABLE).select('*');
  if (filters.status) {
    query = Array.isArray(filters.status) ? query.in('status', filters.status) : query.eq('status', filters.status);
  }
  if (filters.unitId) query = query.eq('unit_id', filters.unitId);
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw error;
  let rows = (data as any[]).map(rowToSurvey);
  if (filters.search) {
    const q = filters.search.toLowerCase();
    rows = rows.filter((r) => r.name.toLowerCase().includes(q));
  }
  return rows;
}

export async function getKepuasanSurveyById(id: string): Promise<KepuasanSurvey | null> {
  const { data, error } = await supabase.from(SURVEYS_TABLE).select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? rowToSurvey(data) : null;
}

export function subscribeToKepuasanSurveys(callback: (rows: KepuasanSurvey[]) => void, onError?: (err: Error) => void): Unsubscribe {
  const refresh = async () => {
    try {
      callback(await getKepuasanSurveys());
    } catch (err) {
      onError?.(err as Error);
    }
  };
  refresh();
  const channel = supabase
    .channel('kepuasan-surveys')
    .on('postgres_changes', { event: '*', schema: 'public', table: SURVEYS_TABLE }, () => refresh())
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

// ────────────────────────────────────────────────────────────────
// Distribusi (link / QR / access code)
// ────────────────────────────────────────────────────────────────

function generateReadableToken(len = 24): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function createKepuasanSurveyToken(params: {
  surveyId: string;
  kind: KepuasanTokenKind;
  unitId?: string;
  maxUses?: number;
  expiresAt?: string;
  createdBy?: string;
}): Promise<KepuasanSurveyToken> {
  const { data, error } = await supabase
    .from(TOKENS_TABLE)
    .insert({
      survey_id: params.surveyId,
      token: generateReadableToken(),
      kind: params.kind,
      unit_id: params.unitId ?? null,
      max_uses: params.maxUses ?? null,
      expires_at: params.expiresAt ?? null,
      created_by: params.createdBy ?? null,
    })
    .select('*')
    .single();
  if (error) throw error;
  return rowToToken(data);
}

export async function getKepuasanSurveyTokens(surveyId: string): Promise<KepuasanSurveyToken[]> {
  const { data, error } = await supabase.from(TOKENS_TABLE).select('*').eq('survey_id', surveyId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data as any[]).map(rowToToken);
}

/** URL QR yang dirender lewat layanan gambar publik (api.qrserver.com) —
 *  tidak menambah dependency npm baru. Bila butuh generate offline, ganti
 *  fungsi ini dengan library seperti `qrcode`/`qrcode.react` di kemudian hari. */
export function buildKepuasanQrImageUrl(targetUrl: string, size = 300): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(targetUrl)}`;
}

// ────────────────────────────────────────────────────────────────
// Info survei publik + pengisian — lewat RPC SECURITY DEFINER, bukan
// select/insert langsung (lihat migration_kepuasan.sql bagian 9).
// ────────────────────────────────────────────────────────────────

export async function getKepuasanPublicSurvey(token: string): Promise<KepuasanPublicSurveyInfo | null> {
  const { data, error } = await supabase.rpc('kepuasan_get_public_survey', { p_token: token });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return {
    surveyId: row.survey_id,
    name: row.name,
    description: row.description,
    unitId: row.unit_id,
    surveyMode: row.survey_mode,
    kioskResetSeconds: row.kiosk_reset_seconds,
  };
}

/** Dipanggil TEPAT SEKALI saat pasien menekan "Kirim Survey" — satu panggilan
 *  = satu response baru. TIDAK ADA pembatasan berdasarkan perangkat/sesi
 *  sebelumnya (bagian 14 dokumen instruksi): perangkat yang sama boleh
 *  memanggil fungsi ini berkali-kali untuk pasien berbeda-beda. */
export async function submitKepuasanResponse(payload: KepuasanSubmitPayload): Promise<{ responseId: string; responseCode: string }> {
  const s = payload.scores;
  const { data, error } = await supabase.rpc('kepuasan_submit_response', {
    p_token: payload.token,
    p_unit_id: payload.unitId ?? null,
    p_respondent_name: payload.respondentName ?? null,
    p_u1: s.u1_persyaratan,
    p_u2: s.u2_prosedur,
    p_u3: s.u3_waktu,
    p_u4: s.u4_biaya,
    p_u5: s.u5_produk_layanan,
    p_u6: s.u6_kompetensi_pelaksana,
    p_u7: s.u7_perilaku_pelaksana,
    p_u8: s.u8_penanganan_pengaduan,
    p_u9: s.u9_sarana_prasarana,
    p_kritik_saran: payload.kritikSaran ?? null,
    p_willing_to_contact: payload.willingToContact ?? false,
    p_contact_phone: payload.contactPhone ?? null,
    p_source: payload.source ?? 'online',
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return { responseId: row.response_id, responseCode: row.response_code };
}

// ────────────────────────────────────────────────────────────────
// Response — dibaca reviewer/admin (RLS)
// ────────────────────────────────────────────────────────────────

export async function getKepuasanResponses(surveyId: string, filters: { unitId?: string; followupStatus?: string } = {}): Promise<KepuasanResponse[]> {
  let query = supabase.from(RESPONSES_TABLE).select('*').eq('survey_id', surveyId);
  if (filters.unitId) query = query.eq('unit_id', filters.unitId);
  if (filters.followupStatus) query = query.eq('followup_status', filters.followupStatus);
  const { data, error } = await query.order('submitted_at', { ascending: false });
  if (error) throw error;
  return (data as any[]).map(rowToResponse);
}

export async function getKepuasanResponsesWithKritikSaran(surveyId: string): Promise<KepuasanResponse[]> {
  const { data, error } = await supabase
    .from(RESPONSES_TABLE)
    .select('*')
    .eq('survey_id', surveyId)
    .not('kritik_saran', 'is', null)
    .order('submitted_at', { ascending: false });
  if (error) throw error;
  return (data as any[]).map(rowToResponse);
}

export async function updateKepuasanFollowup(
  id: string,
  patch: { followupStatus?: string; followupPic?: string; followupNote?: string; followupDate?: string },
  actorId?: string
): Promise<KepuasanResponse> {
  const row: Record<string, any> = {};
  if (patch.followupStatus !== undefined) row.followup_status = patch.followupStatus;
  if (patch.followupPic !== undefined) row.followup_pic = patch.followupPic;
  if (patch.followupNote !== undefined) row.followup_note = patch.followupNote;
  if (patch.followupDate !== undefined) row.followup_date = patch.followupDate;
  const { data, error } = await supabase.from(RESPONSES_TABLE).update(row).eq('id', id).select('*').single();
  if (error) throw error;
  const updated = rowToResponse(data);
  await logKepuasanAudit({ msg: `Tindak lanjut kritik/saran ${updated.responseCode} diperbarui`, badge: 'Tindak Lanjut', userId: actorId, entityId: updated.surveyId });
  return updated;
}

/** Import Excel (bagian 30) — baris yang lolos validasi dimasukkan sebagai
 *  response biasa (source='import'); baris gagal dikembalikan sebagai error,
 *  TIDAK dimasukkan ke database. */
export async function importKepuasanResponses(
  surveyId: string,
  unitId: string,
  rows: { respondentName?: string; date?: string; scores: Record<KepuasanUnsurField, number> }[]
): Promise<{ inserted: number; failed: { row: number; reason: string }[] }> {
  const failed: { row: number; reason: string }[] = [];
  const toInsert: Record<string, any>[] = [];

  rows.forEach((r, idx) => {
    const issues: string[] = [];
    for (const f of KEPUASAN_UNSUR_FIELDS) {
      const v = r.scores[f];
      if (!Number.isFinite(v) || v < 1 || v > 4) issues.push(`${f} harus bernilai 1-4`);
    }
    if (issues.length > 0) {
      failed.push({ row: idx + 1, reason: issues.join('; ') });
      return;
    }
    const code = `KP-IMPORT-${surveyId.slice(0, 8)}-${idx + 1}-${Date.now()}`;
    const record: Record<string, any> = {
      response_code: code,
      survey_id: surveyId,
      unit_id: unitId,
      respondent_name: r.respondentName || null,
      source: 'import',
      submitted_at: r.date ? new Date(r.date).toISOString() : new Date().toISOString(),
    };
    for (const f of KEPUASAN_UNSUR_FIELDS) record[f] = r.scores[f];
    toInsert.push(record);
  });

  let inserted = 0;
  if (toInsert.length > 0) {
    const { data, error } = await supabase.from(RESPONSES_TABLE).insert(toInsert).select('id');
    if (error) throw error;
    inserted = (data as any[])?.length ?? 0;
  }
  return { inserted, failed };
}

// ────────────────────────────────────────────────────────────────
// Perhitungan IKM (bagian 17-19) — murni, tidak menyentuh DB, supaya bisa
// dites/dipakai ulang di dashboard maupun proses recompute.
// ────────────────────────────────────────────────────────────────

export interface KepuasanCalculation {
  totalRespondents: number;
  unsurAverages: Partial<Record<KepuasanUnsurField, number>>;
  nilaiIndeks: number | null;
  ikm: number | null;
  grade: string | null;
  gradeLabel: string | null;
  statusCapaian: 'tercapai' | 'tidak_tercapai' | null;
}

export function computeKepuasanFromResponses(
  responses: KepuasanResponse[],
  thresholds: KepuasanClassificationBand[],
  target: number,
  operator: KepuasanSurvey['targetOperator']
): KepuasanCalculation {
  const valid = responses.filter((r) => r.isValid);
  const total = valid.length;
  if (total === 0) {
    return { totalRespondents: 0, unsurAverages: {}, nilaiIndeks: null, ikm: null, grade: null, gradeLabel: null, statusCapaian: null };
  }

  const unsurAverages: Partial<Record<KepuasanUnsurField, number>> = {};
  let weightedSum = 0;
  for (const f of KEPUASAN_UNSUR_FIELDS) {
    const sum = valid.reduce((acc, r) => acc + (r.scores[f] ?? 0), 0);
    const avg = sum / total;
    unsurAverages[f] = Number(avg.toFixed(4));
    weightedSum += avg * KEPUASAN_UNSUR_WEIGHT;
  }

  const nilaiIndeks = Number(weightedSum.toFixed(4));
  const ikm = Number((nilaiIndeks * KEPUASAN_NIK_MULTIPLIER).toFixed(2));
  const { grade, label } = classifyKepuasanScore(ikm, thresholds);
  const statusCapaian = evaluateKepuasanTarget(ikm, target, operator) ? 'tercapai' : 'tidak_tercapai';

  return { totalRespondents: total, unsurAverages, nilaiIndeks, ikm, grade, gradeLabel: label, statusCapaian };
}

export async function getKepuasanPeriodResult(surveyId: string, unitId: string | null = null): Promise<KepuasanPeriodResult | null> {
  let query = supabase.from(PERIOD_RESULTS_TABLE).select('*').eq('survey_id', surveyId);
  query = unitId === null ? query.is('unit_id', null) : query.eq('unit_id', unitId);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data ? rowToPeriodResult(data) : null;
}

export async function getKepuasanUnitBreakdown(surveyId: string): Promise<KepuasanPeriodResult[]> {
  const { data, error } = await supabase.from(PERIOD_RESULTS_TABLE).select('*').eq('survey_id', surveyId).not('unit_id', 'is', null);
  if (error) throw error;
  return (data as any[]).map(rowToPeriodResult);
}

/**
 * Hitung ulang hasil periode (overall + per-unit bila survei-nya "Semua
 * Unit") dan simpan ke kepuasan_period_results. Dipanggil setiap kali admin
 * membuka Dashboard/Monev survei (bukan hanya saat "finalisasi") supaya
 * angka Total Responden selalu real-time (bagian 39 dokumen: "jumlah
 * response bertambah, dashboard diperbarui"), lalu — bila survei ditautkan
 * ke indikator mutu — hasilnya didorong ke custom_indicator_measurements
 * (bagian 26-28).
 */
export async function recomputeKepuasanPeriodResult(surveyId: string, actorId?: string): Promise<KepuasanPeriodResult> {
  const survey = await getKepuasanSurveyById(surveyId);
  if (!survey) throw new Error('Survei tidak ditemukan.');
  const responses = await getKepuasanResponses(surveyId);

  const overall = computeKepuasanFromResponses(responses, survey.classificationThresholds, survey.targetValue, survey.targetOperator);
  await supabase.from(PERIOD_RESULTS_TABLE).upsert(
    {
      survey_id: surveyId,
      unit_id: null,
      total_respondents: overall.totalRespondents,
      unsur_averages: overall.unsurAverages,
      nilai_indeks: overall.nilaiIndeks,
      ikm: overall.ikm,
      grade: overall.grade,
      grade_label: overall.gradeLabel,
      status_capaian: overall.statusCapaian,
      computed_at: new Date().toISOString(),
    },
    { onConflict: 'survey_id,unit_id' }
  );

  // Breakdown per unit HANYA relevan bila survei mencakup "Semua Unit" —
  // kalau survei sudah spesifik ke satu unit, hasil overall = hasil unit itu.
  if (survey.unitId === 'all') {
    const unitIds = Array.from(new Set(responses.map((r) => r.unitId)));
    for (const unitId of unitIds) {
      const unitResponses = responses.filter((r) => r.unitId === unitId);
      const agg = computeKepuasanFromResponses(unitResponses, survey.classificationThresholds, survey.targetValue, survey.targetOperator);
      await supabase.from(PERIOD_RESULTS_TABLE).upsert(
        {
          survey_id: surveyId,
          unit_id: unitId,
          total_respondents: agg.totalRespondents,
          unsur_averages: agg.unsurAverages,
          nilai_indeks: agg.nilaiIndeks,
          ikm: agg.ikm,
          grade: agg.grade,
          grade_label: agg.gradeLabel,
          status_capaian: agg.statusCapaian,
          computed_at: new Date().toISOString(),
        },
        { onConflict: 'survey_id,unit_id' }
      );
    }
  }

  // ── Dorong ke Master Indikator Mutu (bagian 26-28) — hanya bila
  //    ditautkan dan ada minimal 1 responden. UPSERT: bila baris untuk
  //    periode ini sudah pernah dibuat sebelumnya (dashboard dibuka
  //    berkali-kali dalam bulan yang sama), nilainya DIPERBARUI, bukan
  //    ditolak sebagai duplikat — supaya Monev indikator selalu
  //    mencerminkan jumlah responden terbaru (bagian 39: "dashboard
  //    diperbarui"). Kegagalan di sini TIDAK membatalkan perhitungan IKM
  //    survei itu sendiri (loosely coupled), supaya modul ini tetap
  //    berfungsi walau indikator belum ditautkan atau user tidak punya
  //    hak akses modul indikator.
  if (survey.linkedIndicatorId && overall.ikm !== null && actorId) {
    try {
      const bundle = await getCustomIndicatorBundle(survey.linkedIndicatorId);
      if (bundle?.currentVersion) {
        const version = bundle.currentVersion;
        const targetUnitId = survey.unitId === 'all' ? 'all' : survey.unitId;
        const period = computePeriodKey(survey.endDate, version.frequency);
        const achievementStatus = computeAchievementStatus(overall.ikm, version.targetValue, version.targetOperator);
        const measurementData = {
          source: 'survey_kepuasan_pasien',
          survey_id: surveyId,
          survey_name: survey.name,
          total_respondents: overall.totalRespondents,
          nilai_indeks: overall.nilaiIndeks,
          grade: overall.grade,
          unsur_averages: overall.unsurAverages,
        };
        const notes = `Dihitung otomatis dari Survey Kepuasan Pasien "${survey.name}".`;

        const existing = await getCustomIndicatorMeasurements({ indicatorId: survey.linkedIndicatorId, unitId: targetUnitId });
        const match = existing.find((m) => m.period === period && m.observationSeq === 1);

        if (match) {
          const { error: updateError } = await supabase.from(CUSTOM_INDICATOR_MEASUREMENTS_TABLE).update({
            indicator_version_id: version.id,
            measurement_date: survey.endDate,
            numerator: overall.ikm,
            denominator: null,
            value: overall.ikm,
            target_value: version.targetValue,
            target_operator: version.targetOperator,
            achievement_status: achievementStatus,
            measurement_data: measurementData,
            notes,
          }).eq('id', match.id);
          if (updateError) throw updateError;
        } else {
          await recordCustomIndicatorMeasurement({
            indicatorId: survey.linkedIndicatorId,
            version,
            unitId: targetUnitId,
            measurementDate: survey.endDate,
            numerator: overall.ikm,
            denominator: null,
            measurementData,
            notes,
            actorId,
          });
        }
      }
    } catch (err) {
      // Hak akses kurang (bukan pemilik measurement & bukan custom indicator
      // manager) atau indikator tidak aktif — catat di console, jangan
      // lempar ke pemanggil (lihat komentar di atas).
      console.warn('[recomputeKepuasanPeriodResult] gagal mendorong ke indikator mutu:', err);
    }
  }

  return (await getKepuasanPeriodResult(surveyId)) as KepuasanPeriodResult;
}

/** Trend antar-periode (Monev) — semua survei yang sudah punya hasil, terurut tanggal mulai. */
export async function getKepuasanPeriodTrend(unitId?: string): Promise<{ survey: KepuasanSurvey; result: KepuasanPeriodResult }[]> {
  const surveys = await getKepuasanSurveys(unitId ? { unitId } : {});
  const out: { survey: KepuasanSurvey; result: KepuasanPeriodResult }[] = [];
  for (const survey of surveys) {
    const result = await getKepuasanPeriodResult(survey.id, null);
    if (result && result.totalRespondents > 0) out.push({ survey, result });
  }
  return out.sort((a, b) => a.survey.startDate.localeCompare(b.survey.startDate));
}

export async function getKepuasanResponseCount(surveyId: string): Promise<number> {
  const { count, error } = await supabase.from(RESPONSES_TABLE).select('id', { count: 'exact', head: true }).eq('survey_id', surveyId);
  if (error) throw error;
  return count ?? 0;
}
