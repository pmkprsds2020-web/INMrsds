/**
 * OPPE — engine perhitungan (status indikator, trigger, skor, skor berbobot,
 * kategori hasil akhir, trend, rekomendasi otomatis).
 *
 * MURNI (tanpa akses database / React) supaya:
 *   - dipakai sama persis di form evaluasi (preview real-time), saat simpan,
 *     saat import, dan saat hitung ulang massal;
 *   - mudah diuji (lihat scripts/test-oppe-scoring.mjs).
 *
 * Semua angka konfigurasi (skor per status, bobot kategori, rentang
 * kategori hasil, teks rekomendasi, ambang trend/FPPE) masuk lewat parameter
 * `settings`/`categories` — tidak ada nilai bisnis yang di-hard-code di sini.
 */
import type {
  OppeRule,
  OppeItemStatus,
  OppeSettings,
  OppeIndicatorCategory,
  OppeCategoryScore,
  OppeResultCategory,
  OppeTrend,
  OppeTargetOperator,
} from '@/types/oppe';

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────

const CATEGORICAL = new Set(['boolean', 'grade', 'pass', 'category']);

export function isCategorical(dataType: string): boolean {
  return CATEGORICAL.has(dataType);
}

function norm(s: string): string {
  return s.trim().toLowerCase();
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Format angka gaya Indonesia (koma desimal). */
export function fmtNum(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return n.toLocaleString('id-ID', { maximumFractionDigits: digits });
}

/**
 * Ubah input realisasi (dari form/Excel) menjadi angka. Menerima "98", "98%",
 * "98,5", "1.234,5", " 3 kasus". Persen SELALU dibaca sebagai angka 0–100
 * (0,5 = 0,5%, bukan 50%) — tidak ada konversi pecahan otomatis supaya
 * indikator dengan target kecil (mis. ≤ 1%) tidak salah baca.
 */
export function parseNumeric(raw: unknown, _dataType?: string): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? raw : null;
  }
  const s = String(raw).trim();
  if (s === '') return null;
  const cleaned = s.replace(/%/g, '').replace(/[^\d,.\-]/g, '');
  if (cleaned === '' || cleaned === '-' ) return null;
  // "1.234,5" -> 1234.5 ; "98,5" -> 98.5 ; "98.5" -> 98.5
  let normalized = cleaned;
  if (cleaned.includes(',') && cleaned.includes('.')) normalized = cleaned.replace(/\./g, '').replace(',', '.');
  else if (cleaned.includes(',')) normalized = cleaned.replace(',', '.');
  const n = Number(normalized);
  if (!Number.isFinite(n)) return null;
  return n;
}

/** Normalisasi operator target ke pembanding dasar. */
export function normalizeTarget(op: OppeTargetOperator, value: number | null): { cmp: 'gte' | 'lte' | 'eq' | 'zero' | 'category'; value: number | null } {
  switch (op) {
    case 'pct100': return { cmp: 'gte', value: 100 };
    case 'min': case 'score': case 'gte': return { cmp: 'gte', value };
    case 'max': case 'lte': return { cmp: 'lte', value };
    case 'eq': return { cmp: 'eq', value };
    case 'zero': return { cmp: 'zero', value: 0 };
    case 'category': return { cmp: 'category', value: null };
    default: return { cmp: 'gte', value };
  }
}

export function targetSymbol(op: OppeTargetOperator): string {
  switch (op) {
    case 'gte': case 'min': return '≥';
    case 'score': return 'skor ≥';
    case 'lte': case 'max': return '≤';
    case 'eq': return '=';
    case 'zero': return '';
    case 'pct100': return '';
    default: return '';
  }
}

/** Teks target ringkas bila master tidak punya target_text. */
export function describeTarget(rule: Pick<OppeRule, 'targetOperator' | 'targetValue' | 'passValues' | 'dataType'>, unitLabel?: string | null): string {
  const u = unitLabel ? (unitLabel === '%' ? '%' : ` ${unitLabel}`) : '';
  if (rule.targetOperator === 'zero') return `0${unitLabel && unitLabel !== '%' ? ` ${unitLabel}` : ' kasus'}`;
  if (rule.targetOperator === 'pct100') return '100%';
  if (rule.targetOperator === 'category' || isCategorical(rule.dataType)) return rule.passValues.join(' / ') || '—';
  if (rule.targetValue === null || rule.targetValue === undefined) return 'Sesuai target';
  return `${targetSymbol(rule.targetOperator)} ${fmtNum(rule.targetValue)}${u}`.trim();
}

// ────────────────────────────────────────────────────────────────
// Status indikator
// ────────────────────────────────────────────────────────────────

export interface ItemEvaluationInput extends OppeRule {
  realizationText: string | null;
  realizationNumber: number | null;
}

export interface ItemEvaluationResult {
  status: OppeItemStatus;
  isTrigger: boolean;
  achievement: number | null;
  score: number | null;
  reason: string;
}

function meetsTarget(cmp: ReturnType<typeof normalizeTarget>, n: number): boolean | null {
  if (cmp.cmp === 'zero') return n <= 0;
  if (cmp.value === null || cmp.value === undefined) return null;
  if (cmp.cmp === 'gte') return n >= cmp.value;
  if (cmp.cmp === 'lte') return n <= cmp.value;
  if (cmp.cmp === 'eq') return n === cmp.value;
  return null;
}

function isTriggered(rule: OppeRule, target: ReturnType<typeof normalizeTarget>, n: number, met: boolean | null): boolean | null {
  const tv = rule.triggerValue;
  switch (rule.triggerOperator) {
    case 'lt': return tv === null ? null : n < tv;
    case 'lte': return tv === null ? null : n <= tv;
    case 'gt': return tv === null ? null : n > tv;
    case 'gte': return tv === null ? null : n >= tv;
    case 'eq': return tv === null ? null : n === tv;
    case 'neq': return tv === null ? null : n !== tv;
    case 'lt_target': return target.value === null ? null : n < target.value;
    case 'gt_target': return target.value === null ? null : n > target.value;
    case 'none':
    case 'not_pass':
    default:
      return met === null ? null : !met;
  }
}

function achievementOf(target: ReturnType<typeof normalizeTarget>, n: number): number | null {
  if (target.cmp === 'zero') return n <= 0 ? 100 : 0;
  const v = target.value;
  if (v === null || v === undefined) return null;
  if (target.cmp === 'gte') {
    if (v === 0) return 100;
    return round2(Math.max(0, (n / v) * 100));
  }
  if (target.cmp === 'lte') {
    if (n <= v) return 100;
    if (n === 0) return 100;
    return round2(Math.max(0, (v / n) * 100));
  }
  if (target.cmp === 'eq') return n === v ? 100 : 0;
  return null;
}

function scoreFor(status: OppeItemStatus, rule: OppeRule, settings: Pick<OppeSettings, 'scoreMet' | 'scoreAttention' | 'scoreTrigger'>): number | null {
  if (status === 'met') return rule.scoreMet ?? settings.scoreMet;
  if (status === 'attention') return rule.scoreAttention ?? settings.scoreAttention;
  if (status === 'trigger') return rule.scoreTrigger ?? settings.scoreTrigger;
  return null;
}

/**
 * Hitung status satu indikator.
 * Urutan keputusan (poin 14–16 master prompt):
 *   1. tanpa realisasi                       -> ABU-ABU (no_data)
 *   2. kategori: nilai lulus                 -> HIJAU; nilai "perhatian" -> KUNING; lainnya -> MERAH
 *   3. numerik: memenuhi kondisi trigger     -> MERAH (trigger)
 *               memenuhi target              -> HIJAU (met)
 *               di antara target & trigger   -> KUNING (attention)
 */
export function evaluateItem(input: ItemEvaluationInput, settings: Pick<OppeSettings, 'scoreMet' | 'scoreAttention' | 'scoreTrigger'>): ItemEvaluationResult {
  const rule = input;
  const noData = (reason: string): ItemEvaluationResult => ({ status: 'no_data', isTrigger: false, achievement: null, score: null, reason });

  if (isCategorical(rule.dataType) || rule.targetOperator === 'category') {
    const raw = (input.realizationText ?? '').trim();
    if (!raw) return noData('Realisasi belum diisi');
    const v = norm(raw);
    const pass = rule.passValues.map(norm);
    const attention = rule.attentionValues.map(norm);
    let status: OppeItemStatus;
    let reason: string;
    if (pass.includes(v)) { status = 'met'; reason = `"${raw}" sesuai target (${rule.passValues.join('/')})`; }
    else if (attention.includes(v)) { status = 'attention'; reason = `"${raw}" — perlu perhatian`; }
    else { status = 'trigger'; reason = `"${raw}" tidak sesuai target (${rule.passValues.join('/') || '—'})`; }
    return {
      status,
      isTrigger: status === 'trigger',
      achievement: status === 'met' ? 100 : status === 'attention' ? 50 : 0,
      score: scoreFor(status, rule, settings),
      reason,
    };
  }

  const n = input.realizationNumber ?? parseNumeric(input.realizationText, rule.dataType);
  if (n === null || n === undefined) return noData('Realisasi belum diisi');

  const target = normalizeTarget(rule.targetOperator, rule.targetValue);
  const met = meetsTarget(target, n);
  const triggered = isTriggered(rule, target, n, met);

  if (met === null && triggered === null) return noData('Target belum ditetapkan untuk indikator ini');

  let status: OppeItemStatus;
  let reason: string;
  if (triggered === true) {
    status = 'trigger';
    reason = `Realisasi ${fmtNum(n)} menyentuh batas trigger`;
  } else if (met === true) {
    status = 'met';
    reason = `Realisasi ${fmtNum(n)} memenuhi target`;
  } else if (met === null) {
    // target kosong tetapi tidak menyentuh trigger
    status = 'attention';
    reason = 'Tidak menyentuh trigger, namun target belum ditetapkan';
  } else {
    status = 'attention';
    reason = `Realisasi ${fmtNum(n)} belum mencapai target, belum menyentuh trigger`;
  }

  return {
    status,
    isTrigger: status === 'trigger',
    achievement: achievementOf(target, n),
    score: scoreFor(status, rule, settings),
    reason,
  };
}

// ────────────────────────────────────────────────────────────────
// Agregasi evaluasi
// ────────────────────────────────────────────────────────────────

export interface ScoredItem {
  id?: string;
  name: string;
  code?: string | null;
  categoryId: string | null;
  categoryCode: string;
  weight: number;
  isCritical: boolean;
  status: OppeItemStatus;
  score: number | null;
}

export interface EvaluationComputation {
  categoryScores: OppeCategoryScore[];
  scoreProfessional: number | null;
  scoreDevelopment: number | null;
  scoreClinical: number | null;
  weightedScore: number | null;
  finalScore: number | null;
  finalCategory: OppeResultCategory | null;
  metCount: number;
  attentionCount: number;
  triggerCount: number;
  noDataCount: number;
  criticalTriggers: ScoredItem[];
  triggerItems: ScoredItem[];
  attentionItems: ScoredItem[];
  requiresFppe: boolean;
  trend: OppeTrend | null;
  significantDecline: boolean;
  warnings: string[];
  conclusion: string;
  recommendation: string;
}

export function classifyScore(score: number | null, categories: OppeResultCategory[]): OppeResultCategory | null {
  if (score === null || score === undefined) return null;
  const s = round2(score);
  const sorted = [...categories].sort((a, b) => b.min - a.min);
  for (const c of sorted) {
    if (s >= c.min && (c.max === null || c.max === undefined || s < c.max)) return c;
  }
  // skor di luar semua rentang (mis. > max tertinggi) -> kategori dengan min tertinggi yang terlewati
  return sorted.find((c) => s >= c.min) ?? sorted[sorted.length - 1] ?? null;
}

export function computeTrend(current: number | null, previous: number | null, settings: Pick<OppeSettings, 'stableBand' | 'significantDrop'>): { trend: OppeTrend | null; significantDecline: boolean; diff: number | null } {
  if (current === null || previous === null || current === undefined || previous === undefined) return { trend: null, significantDecline: false, diff: null };
  const diff = round2(current - previous);
  const trend: OppeTrend = diff >= settings.stableBand ? 'naik' : diff <= -settings.stableBand ? 'turun' : 'stabil';
  return { trend, significantDecline: diff <= -settings.significantDrop, diff };
}

export function validateCategoryWeights(categories: Pick<OppeIndicatorCategory, 'weight' | 'isActive'>[]): { total: number; ok: boolean } {
  const total = round2(categories.filter((c) => c.isActive).reduce((s, c) => s + Number(c.weight || 0), 0));
  return { total, ok: Math.abs(total - 100) < 0.001 };
}

export function computeEvaluation(params: {
  items: ScoredItem[];
  categories: OppeIndicatorCategory[];
  settings: OppeSettings;
  previousScore?: number | null;
  previousHadFppe?: boolean;
}): EvaluationComputation {
  const { items, settings } = params;
  const categories = [...params.categories].filter((c) => c.isActive).sort((a, b) => a.sortOrder - b.sortOrder);

  const categoryScores: OppeCategoryScore[] = categories.map((cat) => {
    // Item masuk kategori berdasarkan category_id; bila id tidak dikenal
    // (mis. kategori sudah diganti), jatuh ke pencocokan kode kategori.
    const catItems = items.filter((i) =>
      i.categoryId === cat.id ||
      ((!i.categoryId || !categories.some((c) => c.id === i.categoryId)) && i.categoryCode === cat.code));
    const scored = catItems.filter((i) => i.status !== 'no_data' && i.score !== null);
    const wSum = scored.reduce((s, i) => s + (i.weight > 0 ? i.weight : 1), 0);
    const score = scored.length > 0 && wSum > 0
      ? round2(scored.reduce((s, i) => s + (i.score as number) * (i.weight > 0 ? i.weight : 1), 0) / wSum)
      : null;
    return {
      categoryId: cat.id,
      code: cat.code,
      name: cat.name,
      weight: Number(cat.weight),
      score,
      weighted: score === null ? null : round2((score * Number(cat.weight)) / 100),
      itemCount: catItems.length,
      metCount: catItems.filter((i) => i.status === 'met').length,
    };
  });

  const present = categoryScores.filter((c) => c.score !== null);
  const weightPresent = present.reduce((s, c) => s + c.weight, 0);
  const weightedScore = present.length > 0 ? round2(present.reduce((s, c) => s + (c.weighted as number), 0)) : null;
  // Bila ada kategori tanpa data, skor dinormalisasi ke bobot kategori yang ada.
  const finalScore = weightedScore === null || weightPresent <= 0 ? null : round2((weightedScore / weightPresent) * 100);

  const byCode = (code: string) => categoryScores.find((c) => c.code === code)?.score ?? null;

  const metCount = items.filter((i) => i.status === 'met').length;
  const attentionItems = items.filter((i) => i.status === 'attention');
  const triggerItems = items.filter((i) => i.status === 'trigger');
  const noDataCount = items.filter((i) => i.status === 'no_data').length;
  const criticalTriggers = triggerItems.filter((i) => i.isCritical);

  const finalCategory = classifyScore(finalScore, settings.resultCategories);
  const { trend, significantDecline } = computeTrend(finalScore, params.previousScore ?? null, settings);

  const warnings: string[] = [];
  if (criticalTriggers.length > 0) warnings.push('Terdapat indikator kritis yang terkena trigger.');
  if (settings.fppeTriggerCountThreshold > 0 && triggerItems.length >= settings.fppeTriggerCountThreshold) {
    warnings.push(`Jumlah indikator trigger (${triggerItems.length}) mencapai ambang ${settings.fppeTriggerCountThreshold}.`);
  }
  if (significantDecline) warnings.push('Skor turun signifikan dibanding periode sebelumnya.');
  if (noDataCount > 0) warnings.push(`${noDataCount} indikator belum memiliki data realisasi.`);
  const missingCats = categoryScores.filter((c) => c.itemCount > 0 && c.score === null);
  if (missingCats.length > 0) warnings.push(`Kategori tanpa data: ${missingCats.map((c) => c.name).join(', ')} — skor akhir dinormalisasi ke bobot kategori yang terisi.`);

  const requiresFppe =
    criticalTriggers.length > 0 ||
    (settings.fppeTriggerCountThreshold > 0 && triggerItems.length >= settings.fppeTriggerCountThreshold);

  // ── Rekomendasi otomatis (poin 22) ──
  const rec: string[] = [];
  if (finalCategory) rec.push(finalCategory.recommendation);
  if (criticalTriggers.length > 0) {
    rec.push(`Terdapat indikator kritis yang terkena trigger (${criticalTriggers.map((i) => i.name).join('; ')}). ${settings.recommendationCriticalTrigger} Keputusan akhir sesuai Komite Medik.`);
  } else if (settings.fppeTriggerCountThreshold > 0 && triggerItems.length >= settings.fppeTriggerCountThreshold) {
    rec.push(settings.recommendationMultipleTrigger);
  } else if (triggerItems.length > 0) {
    rec.push(`Rencana perbaikan dan pemantauan pada indikator trigger: ${triggerItems.map((i) => i.name).join('; ')}.`);
  }
  if (significantDecline) rec.push(settings.recommendationDecline);
  if (params.previousHadFppe) rec.push('Dokter memiliki riwayat FPPE pada periode sebelumnya — perhatikan kesinambungan tindak lanjut.');

  const conclusionParts: string[] = [];
  if (finalScore !== null) conclusionParts.push(`Skor akhir OPPE ${fmtNum(finalScore)}${finalCategory ? ` (${finalCategory.label})` : ''}.`);
  else conclusionParts.push('Skor akhir belum dapat dihitung (belum ada data realisasi).');
  conclusionParts.push(`${metCount} indikator memenuhi, ${attentionItems.length} perlu perhatian, ${triggerItems.length} trigger${noDataCount ? `, ${noDataCount} belum ada data` : ''}.`);
  if (criticalTriggers.length > 0) conclusionParts.push(`Indikator kritis terkena trigger: ${criticalTriggers.map((i) => i.name).join('; ')}.`);
  else conclusionParts.push('Tidak ada indikator kritis yang terkena trigger.');
  if (trend) conclusionParts.push(`Trend dibanding periode sebelumnya: ${trend}.`);

  return {
    categoryScores,
    scoreProfessional: byCode('A'),
    scoreDevelopment: byCode('B'),
    scoreClinical: byCode('C'),
    weightedScore,
    finalScore,
    finalCategory,
    metCount,
    attentionCount: attentionItems.length,
    triggerCount: triggerItems.length,
    noDataCount,
    criticalTriggers,
    triggerItems,
    attentionItems,
    requiresFppe,
    trend,
    significantDecline,
    warnings,
    conclusion: conclusionParts.join(' '),
    recommendation: rec.join('\n'),
  };
}
