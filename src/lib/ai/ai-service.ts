import 'server-only';
import { deepseekChatSimple, isDeepSeekConfigured } from './deepseek';
import type { AiGenerateParams, AiGenerateResult, AiHealthCheck } from './types';

// ── Centralized AI Service ─────────────────────────────────────────
// All AI calls route through this service. Modules should import from
// here rather than calling deepseek.ts directly.

const AI_TIMEOUT_MS = 55_000; // 55 second max for Vercel (60s hard limit)

/** Generate an AI response from the configured provider. */
export async function generateAIResponse(
  params: AiGenerateParams
): Promise<AiGenerateResult> {
  const { systemPrompt, userPrompt, temperature, maxTokens } = params;

  // Validate inputs
  if (!systemPrompt?.trim()) {
    return { success: false, error: 'System prompt is required' };
  }
  if (!userPrompt?.trim()) {
    return { success: false, error: 'User prompt is required' };
  }
  if (!isDeepSeekConfigured()) {
    return { success: false, error: 'DEEPSEEK_API_KEY is not configured' };
  }

  // Guard against excessively large prompts (> 32KB each)
  if (systemPrompt.length > 32_000 || userPrompt.length > 32_000) {
    return { success: false, error: 'Prompt terlalu besar. Maksimal 32.000 karakter.' };
  }

  try {
    const response = await deepseekChatSimple(systemPrompt, userPrompt, {
      temperature: temperature ?? 0.7,
      maxTokens: maxTokens ?? 2048,
    });

    const content = response.choices[0]?.message?.content;

    if (!content) {
      return { success: false, error: 'AI returned empty response' };
    }

    return {
      success: true,
      content,
      usage: response.usage
        ? {
            promptTokens: response.usage.prompt_tokens,
            completionTokens: response.usage.completion_tokens,
            totalTokens: response.usage.total_tokens,
          }
        : undefined,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'AI request failed';

    // Log errors (excluding API keys)
    console.error(`[AI Service] Error: ${message}`);

    return {
      success: false,
      error: message,
    };
  }
}

/** Check if the AI service is configured and ready. */
export function getAIHealth(): AiHealthCheck {
  const configured = isDeepSeekConfigured();
  return {
    success: configured,
    provider: 'deepseek',
    model: process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash',
    configured,
  };
}
