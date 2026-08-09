import { NextRequest, NextResponse } from 'next/server';
import { generateAIResponse } from '@/lib/ai/ai-service';
import { AI_INSIGHTS_SYSTEM_PROMPT, buildIndicatorAnalysisPrompt } from '@/lib/ai/prompts';
import { authenticateApiRequest } from '@/lib/api-auth';

export async function POST(req: NextRequest) {
  // ── Authenticate ────────────────────────────────────────────────
  const auth = await authenticateApiRequest(req);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const { indicatorType, stats, entries, unitId } = body as {
      indicatorType: string;
      stats: { num: number; den: number; pct: number; ok: boolean };
      entries: { indicatorType: string; date?: string; unitId?: string }[];
      unitId: string;
    };

    // Validate required fields
    if (!indicatorType || !stats || !entries || !unitId) {
      return NextResponse.json(
        { error: 'Missing required fields: indicatorType, stats, entries, unitId' },
        { status: 400 }
      );
    }

    // Build prompts
    const systemPrompt = AI_INSIGHTS_SYSTEM_PROMPT;
    const userPrompt = buildIndicatorAnalysisPrompt({
      indicatorType,
      unitName: unitId,
      stats,
      entries,
    });

    // Call DeepSeek via centralized service
    const result = await generateAIResponse({
      systemPrompt,
      userPrompt,
      temperature: 0.7,
      maxTokens: 2048,
    });

    if (!result.success) {
      console.error('[AI Insights] Generation failed:', result.error);
      return NextResponse.json(
        { error: 'AI sedang tidak tersedia. Silakan coba kembali.' },
        { status: 503 }
      );
    }

    return NextResponse.json({
      insights: result.content,
      usage: result.usage,
    });
  } catch (error) {
    console.error('[AI Insights] Unexpected error:', error instanceof Error ? error.message : 'Unknown');
    return NextResponse.json(
      { error: 'Failed to generate insights' },
      { status: 500 }
    );
  }
}
