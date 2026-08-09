// ── AI Module barrel export ────────────────────────────────────────
export { deepseekChat, deepseekChatSimple, getDeepSeekConfig, isDeepSeekConfigured } from './deepseek';
export { generateAIResponse, getAIHealth } from './ai-service';
export { AI_INSIGHTS_SYSTEM_PROMPT, buildIndicatorAnalysisPrompt } from './prompts';
export type { AiGenerateParams, AiGenerateResult, AiHealthCheck, DeepSeekMessage, DeepSeekResponse } from './types';
