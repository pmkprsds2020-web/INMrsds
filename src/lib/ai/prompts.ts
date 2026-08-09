// ── Centralized AI Prompts ─────────────────────────────────────────
// All system prompts for different AI use cases in the application.

// ── Medical safety disclaimer (appended to clinical prompts) ──────

const MEDICAL_DISCLAIMER =
  '\n\nPENTING: Hasil AI merupakan bantuan analisis dan tidak menggantikan penilaian klinis profesional.';

// ── Main AI Insights prompt ───────────────────────────────────────

export const AI_INSIGHTS_SYSTEM_PROMPT = `Anda adalah konsultan mutu rumah sakit yang ahli dalam analisis indikator mutu dan keselamatan pasien. Anda memberikan analisis dalam bahasa Indonesia yang jelas, terstruktur, dan actionable.

Tugas Anda:
1. Analisis tren kepatuhan berdasarkan data yang diberikan
2. Identifikasi area yang perlu perbaikan
3. Berikan rekomendasi tindakan yang konkret dan dapat dilaksanakan
4. Bandingkan kinerja saat ini dengan target yang ditetapkan
5. Berikan konteks tentang signifikansi temuan

Format jawaban Anda dalam bahasa Indonesia dengan struktur berikut:

## Temuan Utama
[Daftar temuan utama dari analisis data]

## Analisis Tren
[Analisis tren kinerja berdasarkan data historis]

## Rekomendasi Tindakan
[Rekomendasi spesifik dan actionable untuk perbaikan]

## Evaluasi Target
[Evaluasi pencapaian terhadap target yang ditetapkan]${MEDICAL_DISCLAIMER}`;

// ── Build user prompt for indicator analysis ──────────────────────

export function buildIndicatorAnalysisPrompt(params: {
  indicatorType: string;
  unitName: string;
  stats: { num: number; den: number; pct: number; ok: boolean };
  entries: { date?: string; unitId?: string }[];
}): string {
  const { indicatorType, unitName, stats, entries } = params;

  return `Analisis data indikator mutu berikut:

**Indikator:** ${indicatorType}
**Unit:** ${unitName}
**Statistik:**
- Numerator: ${stats.num}
- Denominator: ${stats.den}
- Capaian: ${stats.pct}%
- Target tercapai: ${stats.ok ? 'Ya' : 'Tidak'}

**Jumlah Data:** ${entries.length} entri

${entries.length > 0 ? `**Ringkasan Data Terbaru:**
${entries.slice(0, 10).map((e, i) => `${i + 1}. Tanggal: ${e.date || '-'}, Unit: ${e.unitId || '-'}`).join('\n')}` : 'Tidak ada data tersedia untuk periode ini.'}

Berikan analisis lengkap dalam bahasa Indonesia.`;
}
