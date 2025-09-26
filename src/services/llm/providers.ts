import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { customFetch } from '../../utils/fetch';

export const providerCreaterMap = {
  google: (apiKey: string) => createGoogleGenerativeAI({ apiKey, fetch: customFetch }),
  openrouter: (apiKey: string) => createOpenRouter({ apiKey, fetch: customFetch }),
} as const;

export type LLMProviderName = keyof typeof providerCreaterMap;