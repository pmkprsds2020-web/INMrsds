import { NextRequest, NextResponse } from 'next/server';
import { generateAIResponse } from '@/lib/ai/ai-service';
import { authenticateApiRequest } from '@/lib/api-auth';
import { createClient } from '@/lib/supabase/server';
import { OPPE_AI_SYSTEM_PROMPT, buildOppeAnalysisPrompt } from '@/lib/ai/oppePrompts';

/**
 * AI OPPE Analysis — DECISION SUPPORT saja (poin 41–42).
 *
 * Data diambil di server memakai sesi pengguna (RLS Supabase tetap berlaku),
 * BUKAN dari payload klien — sehingga AI hanya melihat data OPPE yang memang
 * boleh dilihat pengguna tersebut. Tidak ada keputusan kredensial yang
 * disimpan/diambil otomatis; hasil hanya ditampilkan sebagai draf.
 */
export async function POST(req: NextRequest) {
  const auth = await authenticateApiRequest(req);
  if (!auth.ok) return auth.response;

  try {
    const { evaluationId } = (await req.json()) as { evaluationId?: string };
    if (!evaluationId || !/^[0-9a-f-]{36}$/i.test(evaluationId)) {
      return NextResponse.json({ error: 'evaluationId wajib diisi.' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: ev, error } = await supabase
      .from('oppe_evaluations')
      .select('*, oppe_doctors(name, title, profession, specialty), oppe_ksm(name)')
      .eq('id', evaluationId)
      .maybeSingle();
    if (error || !ev) {
      return NextResponse.json({ error: 'Evaluasi tidak ditemukan atau Anda tidak memiliki akses.' }, { status: 404 });
    }

    const [{ data: items }, { data: history }, { data: fppe }] = await Promise.all([
      supabase.from('oppe_evaluation_items').select('code, category_code, name, target_text, realization_text, unit_label, trigger_text, status, is_critical, achievement').eq('evaluation_id', evaluationId).order('sequence'),
      supabase.from('oppe_evaluations').select('id, year, period_type, final_score, final_category_label, trigger_count, critical_indicators, status').eq('doctor_id', ev.doctor_id).limit(20),
      supabase.from('oppe_fppe').select('fppe_number, trigger_indicator_name, reason, status, result, start_date').eq('doctor_id', ev.doctor_id).limit(20),
    ]);

    const userPrompt = buildOppeAnalysisPrompt({ evaluation: ev, items: items ?? [], history: history ?? [], fppe: fppe ?? [] });
    const result = await generateAIResponse({ systemPrompt: OPPE_AI_SYSTEM_PROMPT, userPrompt, temperature: 0.3, maxTokens: 2048 });

    if (!result.success) {
      console.error('[OPPE AI] Generation failed:', result.error);
      return NextResponse.json({ error: 'AI sedang tidak tersedia. Silakan coba kembali.' }, { status: 503 });
    }
    return NextResponse.json({ analysis: result.content, usage: result.usage });
  } catch (err) {
    console.error('[OPPE AI] Unexpected error:', err instanceof Error ? err.message : 'Unknown');
    return NextResponse.json({ error: 'Analisis AI gagal dibuat. Silakan coba kembali.' }, { status: 500 });
  }
}
