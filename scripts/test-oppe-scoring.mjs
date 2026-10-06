// Uji unit engine OPPE (src/lib/oppeScoring.ts) — tanpa dependensi tambahan.
// Jalankan:  node scripts/test-oppe-scoring.mjs   (Node >= 22.18, type-stripping bawaan)
import assert from 'node:assert/strict';
import { evaluateItem, computeEvaluation, parseNumeric, classifyScore, computeTrend, validateCategoryWeights } from '../src/lib/oppeScoring.ts';

const settings = {
  scoreMet: 100, scoreAttention: 70, scoreTrigger: 0,
  resultCategories: [
    { code: 'sangat_baik', label: 'Sangat Baik', min: 90, max: null, color: '', recommendation: 'R-SB' },
    { code: 'baik', label: 'Baik', min: 80, max: 90, color: '', recommendation: 'R-B' },
    { code: 'perlu_perbaikan', label: 'Perlu Perbaikan', min: 70, max: 80, color: '', recommendation: 'R-PP' },
    { code: 'tidak_memenuhi', label: 'Tidak Memenuhi', min: 0, max: 70, color: '', recommendation: 'R-TM' },
  ],
  recommendationCriticalTrigger: 'FPPE-KRITIS', recommendationMultipleTrigger: 'FPPE-MULTI', recommendationDecline: 'TURUN',
  significantDrop: 10, stableBand: 2, fppeTriggerCountThreshold: 3, dueReminderDays: 14, requireCompleteBeforeSubmit: true, hospitalName: 'RS',
};

const base = { options: [], passValues: [], attentionValues: [], isCritical: false, weight: 1, scoreMet: null, scoreAttention: null, scoreTrigger: null, realizationNumber: null };
const pct = (realizationText, extra = {}) => ({ ...base, dataType: 'percent', targetOperator: 'gte', targetValue: 95, triggerOperator: 'lt', triggerValue: 90, realizationText, ...extra });

let passed = 0;
const t = (name, fn) => { fn(); passed++; console.log('  ✓', name); };

console.log('Status indikator');
t('≥95% realisasi 98 -> memenuhi', () => assert.equal(evaluateItem(pct('98'), settings).status, 'met'));
t('≥95% realisasi 92 -> perlu perhatian', () => assert.equal(evaluateItem(pct('92'), settings).status, 'attention'));
t('≥95% realisasi 88 (trigger <90) -> trigger', () => { const r = evaluateItem(pct('88'), settings); assert.equal(r.status, 'trigger'); assert.equal(r.isTrigger, true); assert.equal(r.score, 0); });
t('skor default 100/70/0', () => { assert.equal(evaluateItem(pct('97'), settings).score, 100); assert.equal(evaluateItem(pct('92'), settings).score, 70); });
t('skor override per indikator', () => assert.equal(evaluateItem(pct('92', { scoreAttention: 50 }), settings).score, 50));
t('tanpa realisasi -> abu-abu', () => assert.equal(evaluateItem(pct(''), settings).status, 'no_data'));
t('≤5% (trigger >5): 3 met, 6 trigger', () => {
  const lte = (v) => ({ ...base, dataType: 'percent', targetOperator: 'lte', targetValue: 5, triggerOperator: 'gt', triggerValue: 5, realizationText: v });
  assert.equal(evaluateItem(lte('3'), settings).status, 'met');
  assert.equal(evaluateItem(lte('6'), settings).status, 'trigger');
});
t('≤1% trigger >1,5%: 1,2 -> perhatian', () => assert.equal(evaluateItem({ ...base, dataType: 'percent', targetOperator: 'lte', targetValue: 1, triggerOperator: 'gt', triggerValue: 1.5, realizationText: '1,2' }, settings).status, 'attention'));
t('0 kasus: 0 met, 1 trigger', () => {
  const z = (v) => ({ ...base, dataType: 'count', targetOperator: 'zero', targetValue: 0, triggerOperator: 'gte', triggerValue: 1, realizationText: v });
  assert.equal(evaluateItem(z('0'), settings).status, 'met');
  assert.equal(evaluateItem(z('1'), settings).status, 'trigger');
});
t('100% (trigger <100): 99 -> trigger', () => assert.equal(evaluateItem({ ...base, dataType: 'percent', targetOperator: 'pct100', targetValue: 100, triggerOperator: 'lt', triggerValue: 100, realizationText: '99' }, settings).status, 'trigger'));
t('Baik/Cukup: Baik met, Cukup perhatian, Kurang trigger', () => {
  const g = (v) => ({ ...base, dataType: 'grade', targetOperator: 'category', targetValue: null, triggerOperator: 'not_pass', triggerValue: null, options: ['Baik', 'Cukup', 'Kurang'], passValues: ['Baik'], attentionValues: ['Cukup'], realizationText: v });
  assert.equal(evaluateItem(g('Baik'), settings).status, 'met');
  assert.equal(evaluateItem(g('cukup'), settings).status, 'attention');
  assert.equal(evaluateItem(g('Kurang'), settings).status, 'trigger');
});
t('Lulus/Belum & Ya/Tidak', () => {
  const p = (v) => ({ ...base, dataType: 'pass', targetOperator: 'category', targetValue: null, triggerOperator: 'not_pass', triggerValue: null, options: ['Lulus', 'Belum'], passValues: ['Lulus'], realizationText: v });
  assert.equal(evaluateItem(p('Lulus'), settings).status, 'met');
  assert.equal(evaluateItem(p('Belum'), settings).status, 'trigger');
  const b = (v) => ({ ...base, dataType: 'boolean', targetOperator: 'category', targetValue: null, triggerOperator: 'not_pass', triggerValue: null, options: ['Ya', 'Tidak'], passValues: ['Ya'], realizationText: v });
  assert.equal(evaluateItem(b('Ya'), settings).status, 'met');
  assert.equal(evaluateItem(b('Tidak'), settings).status, 'trigger');
});
t('SKP dibanding target SKP (lt_target)', () => {
  const s = (v, tv) => ({ ...base, dataType: 'skp', targetOperator: 'gte', targetValue: tv, triggerOperator: 'lt_target', triggerValue: null, realizationText: v });
  assert.equal(evaluateItem(s('60', 50), settings).status, 'met');
  assert.equal(evaluateItem(s('40', 50), settings).status, 'trigger');
  assert.equal(evaluateItem(s('40', null), settings).status, 'no_data');
});
t('Min. 1x/tahun: 0 trigger, 2 met', () => {
  const m = (v) => ({ ...base, dataType: 'count', targetOperator: 'min', targetValue: 1, triggerOperator: 'lt', triggerValue: 1, realizationText: v });
  assert.equal(evaluateItem(m('0'), settings).status, 'trigger');
  assert.equal(evaluateItem(m('2'), settings).status, 'met');
});
t('parse angka: "98,5%", "0,5" tetap 0,5%, "3 kasus"', () => {
  assert.equal(parseNumeric('98,5%', 'percent'), 98.5);
  assert.equal(parseNumeric('0,5', 'percent'), 0.5);
  assert.equal(parseNumeric(0.5, 'percent'), 0.5);
  assert.equal(parseNumeric('3 kasus', 'count'), 3);
  assert.equal(parseNumeric('abc', 'percent'), null);
});

console.log('Skor berbobot & kategori');
const cats = [
  { id: 'a', code: 'A', name: 'Perilaku Profesional', weight: 30, description: null, sortOrder: 1, isActive: true },
  { id: 'b', code: 'B', name: 'Pengembangan Profesional', weight: 20, description: null, sortOrder: 2, isActive: true },
  { id: 'c', code: 'C', name: 'Kinerja Klinis', weight: 50, description: null, sortOrder: 3, isActive: true },
];
t('contoh master prompt: 90×30% + 80×20% + 95×50% = 90,5', () => {
  // A: 9 item met + 1 trigger = 90 ; B: 4 met + 1 trigger = 80 ; C: 19 met + 1 trigger = 95
  const mk = (cat, met, trig) => [
    ...Array.from({ length: met }, (_, i) => ({ name: `${cat}${i}`, categoryId: cat.toLowerCase(), categoryCode: cat, weight: 1, isCritical: false, status: 'met', score: 100 })),
    ...Array.from({ length: trig }, (_, i) => ({ name: `${cat}T${i}`, categoryId: cat.toLowerCase(), categoryCode: cat, weight: 1, isCritical: false, status: 'trigger', score: 0 })),
  ];
  const r = computeEvaluation({ items: [...mk('A', 9, 1), ...mk('B', 4, 1), ...mk('C', 19, 1)], categories: cats, settings });
  assert.equal(r.scoreProfessional, 90); assert.equal(r.scoreDevelopment, 80); assert.equal(r.scoreClinical, 95);
  assert.equal(r.finalScore, 90.5);
  assert.equal(r.finalCategory.label, 'Sangat Baik');
});
t('trigger override: skor 92 + indikator kritis trigger -> FPPE', () => {
  const items = [
    ...Array.from({ length: 12 }, (_, i) => ({ name: `X${i}`, categoryId: 'c', categoryCode: 'C', weight: 1, isCritical: false, status: 'met', score: 100 })),
    { name: 'Perioperative Cardiac Arrest', categoryId: 'c', categoryCode: 'C', weight: 1, isCritical: true, status: 'trigger', score: 0 },
    ...Array.from({ length: 5 }, (_, i) => ({ name: `A${i}`, categoryId: 'a', categoryCode: 'A', weight: 1, isCritical: false, status: 'met', score: 100 })),
    ...Array.from({ length: 3 }, (_, i) => ({ name: `B${i}`, categoryId: 'b', categoryCode: 'B', weight: 1, isCritical: false, status: 'met', score: 100 })),
  ];
  const r = computeEvaluation({ items, categories: cats, settings });
  assert.ok(r.finalScore >= 90, `skor ${r.finalScore}`);
  assert.equal(r.finalCategory.label, 'Sangat Baik');
  assert.equal(r.requiresFppe, true);
  assert.ok(r.warnings.includes('Terdapat indikator kritis yang terkena trigger.'));
  assert.ok(r.recommendation.includes('FPPE-KRITIS'));
});
t('batas kategori: 89,99 Baik; 90 Sangat Baik; 69,99 Tidak Memenuhi', () => {
  assert.equal(classifyScore(89.99, settings.resultCategories).label, 'Baik');
  assert.equal(classifyScore(90, settings.resultCategories).label, 'Sangat Baik');
  assert.equal(classifyScore(69.99, settings.resultCategories).label, 'Tidak Memenuhi');
  assert.equal(classifyScore(100, settings.resultCategories).label, 'Sangat Baik');
});
t('kategori tanpa data dinormalisasi', () => {
  const items = [{ name: 'a', categoryId: 'a', categoryCode: 'A', weight: 1, isCritical: false, status: 'met', score: 100 }, { name: 'c', categoryId: 'c', categoryCode: 'C', weight: 1, isCritical: false, status: 'attention', score: 70 }];
  const r = computeEvaluation({ items, categories: cats, settings });
  // (100*30 + 70*50)/80 = 81.25
  assert.equal(r.finalScore, 81.25);
});
t('3 trigger non-kritis -> FPPE dipertimbangkan', () => {
  const items = Array.from({ length: 10 }, (_, i) => ({ name: `i${i}`, categoryId: 'c', categoryCode: 'C', weight: 1, isCritical: false, status: i < 3 ? 'trigger' : 'met', score: i < 3 ? 0 : 100 }));
  const r = computeEvaluation({ items, categories: cats, settings });
  assert.equal(r.requiresFppe, true);
  assert.ok(r.recommendation.includes('FPPE-MULTI'));
});
t('trend naik/stabil/turun + penurunan signifikan', () => {
  assert.equal(computeTrend(89, 84, settings).trend, 'naik');
  assert.equal(computeTrend(85, 84, settings).trend, 'stabil');
  const d = computeTrend(70, 85, settings);
  assert.equal(d.trend, 'turun'); assert.equal(d.significantDecline, true);
});
t('validasi bobot 100%', () => {
  assert.equal(validateCategoryWeights(cats).ok, true);
  assert.equal(validateCategoryWeights([{ weight: 30, isActive: true }, { weight: 20, isActive: true }]).ok, false);
});

console.log(`\n${passed} uji lulus.`);
