import { LLMType, LLMConfig } from './index';
import { GOOGLE_API_KEYS, OPENROUTER_API_KEYS } from '../../config';
import { LimiterConfig } from '../../utils/ConcurrencyLimiter';


export const openRouterLimiterConfig: LimiterConfig = {
  concurrency: 5,
  requestsPerMinute: 10,
  minIntervalMs: 3000,
};

export const geminiLimiterConfig: LimiterConfig = {
  concurrency: 3,
  requestsPerMinute: 5,
  minIntervalMs: 5000,
};

export const LLM_CONFIG_MAP: Record<LLMType, LLMConfig> = {
  strong: {
    provider: 'google',
    modelName: 'gemini-2.5-flash',
    apiKeys: GOOGLE_API_KEYS,
    limiterConfig: geminiLimiterConfig,
  },
  weak: {
    provider: 'openrouter',
    modelName: 'x-ai/grok-4-fast:free',
    apiKeys: OPENROUTER_API_KEYS,
    limiterConfig: openRouterLimiterConfig,
  },
};
