import ZAI from 'z-ai-web-dev-sdk';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { indicatorType, stats, entries, unitId } = body as {
      indicatorType: string;
      stats: { num: number; den: number; pct: number; ok: boolean };
      entries: { indicatorType: string; date?: string; unitId?: string }[];
      unitId: string;
    };

    const zai = await ZAI.create();

    const systemPrompt = `Anda adalah konsultan mutu rumah sakit yang ahli dalam analisis indikator mutu dan keselamatan pasien. Anda memberikan analisis dalam bahasa Indonesia yang jelas, terstruktur, dan actionable.

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
[Evaluasi pencapaian terhadap target yang ditetapkan]`;

    const userPrompt = `Analisis data indikator mutu berikut:

**Indikator:** ${indicatorType}
**Unit:** ${unitId || 'Semua Unit'}
**Statistik:**
- Numerator: ${stats.num}
- Denominator: ${stats.den}
- Capaian: ${stats.pct}%
- Target tercapai: ${stats.ok ? 'Ya' : 'Tidak'}

**Jumlah Data:** ${entries.length} entri

${entries.length > 0 ? `**Ringkasan Data Terbaru:**
${entries.slice(0, 10).map((e, i) => `${i + 1}. Tanggal: ${e.date || '-'}, Unit: ${e.unitId || '-'}`).join('\n')}` : 'Tidak ada data tersedia untuk periode ini.'}

Berikan analisis lengkap dalam bahasa Indonesia.`;

    const response = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      thinking: { type: 'disabled' },
    });

    const insights = response.choices[0]?.message?.content || 'Tidak dapat menghasilkan analisis.';

    return NextResponse.json({ insights });
  } catch (error) {
    console.error('AI Insights error:', error);
    return NextResponse.json(
      { error: 'Failed to generate insights' },
      { status: 500 }
    );
  }
}
