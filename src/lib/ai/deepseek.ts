import 'server-only';
import type { DeepSeekMessage, DeepSeekResponse, DeepSeekError } from './types';

// ── Configuration ──────────────────────────────────────────────────

function getConfig() {
  return {
    apiKey: process.env.DEEPSEEK_API_KEY || '',
    baseUrl: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
    model: process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash',
  };
}

// ── Low-level fetch wrapper ────────────────────────────────────────

export async function deepseekChat(
  messages: DeepSeekMessage[],
  options?: {
    temperature?: number;
    maxTokens?: number;
  }
): Promise<DeepSeekResponse> {
  const { apiKey, baseUrl, model } = getConfig();

  if (!apiKey) {
    throw new Error('DEEPSEEK_API_KEY is not configured');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60_000); // 60s timeout

  try {
    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 2048,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorBody = (await response.json().catch(() => null)) as DeepSeekError | null;
      const errorMessage = errorBody?.error?.message || `DeepSeek API returned ${response.status}`;

      if (response.status === 401) {
        throw new Error('Invalid DeepSeek API key');
      }
      if (response.status === 429) {
        throw new Error('AI rate limit exceeded');
      }
      if (response.status >= 500) {
        throw new Error('AI service temporarily unavailable');
      }

      throw new Error(errorMessage);
    }

    return (await response.json()) as DeepSeekResponse;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('AI request timeout');
    }
    // Re-throw custom errors as-is
    if (err instanceof Error) throw err;
    throw new Error('Unknown AI error');
  } finally {
    clearTimeout(timeoutId);
  }
}

// ── Convenience wrappers ───────────────────────────────────────────

export async function deepseekChatSimple(
  systemPrompt: string,
  userPrompt: string,
  options?: { temperature?: number; maxTokens?: number }
): Promise<DeepSeekResponse> {
  return deepseekChat(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    options
  );
}

// ── Health check (no API call — just verifies config) ──────────────

export function getDeepSeekConfig() {
  return getConfig();
}

export function isDeepSeekConfigured(): boolean {
  const { apiKey } = getConfig();
  return !!apiKey && apiKey.length > 0;
}
