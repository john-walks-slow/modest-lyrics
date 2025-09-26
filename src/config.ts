import * as path from 'path';
import FirecrawlApp from '@mendable/firecrawl-js';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenRouter, LanguageModelV2 } from '@openrouter/ai-sdk-provider';
import { customFetch } from './utils/fetch';
import { LanguageModel } from 'ai';
import dotenv from 'dotenv';

dotenv.config();

export interface LimiterConfig {
  concurrency: number;
  requestsPerMinute?: number;
  minIntervalMs?: number;
}

export const limiterConfigs: { [key: string]: LimiterConfig } = {
  firecrawl: {
    concurrency: 5,
    requestsPerMinute: 5,
    minIntervalMs: 20000,
  },
  ai: {
    concurrency: 5,
    requestsPerMinute: 5,
    minIntervalMs: 10000,
  },
  'x-ai/grok-4-fast:free': {
    concurrency: 10,
    requestsPerMinute: 60,
    minIntervalMs: 1000,
  },
  'gemini-2.5-flash': {
    concurrency: 5,
    requestsPerMinute: 15,
    minIntervalMs: 4000,
  },
  // 可以根据需要添加更多服务/模型的配置
};

export const TEMP_JSON_DIR = path.join(__dirname, '../temp-json');
export const FINAL_OUTPUT_DIR = path.join(__dirname, '../output');

export const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;
export const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
export const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

if (!FIRECRAWL_API_KEY || !GOOGLE_API_KEY || !OPENROUTER_API_KEY) {
  throw new Error("请在 .env 文件中设置 FIRECRAWL_API_KEY、GOOGLE_API_KEY 和 OPENROUTER_API_KEY");
}

export const firecrawl = new FirecrawlApp({ apiKey: FIRECRAWL_API_KEY });
export const gemini = createGoogleGenerativeAI({ apiKey: GOOGLE_API_KEY, fetch: customFetch });
export const openrouter = createOpenRouter({ apiKey: OPENROUTER_API_KEY, fetch: customFetch });

import { chromium } from 'playwright';

export const WEAK_AI_MODEL: LanguageModelV2 = openrouter('x-ai/grok-4-fast:free');
export const STRONG_AI_MODEL: LanguageModelV2 = gemini('gemini-2.5-flash');

export const USE_LOCAL_SCRAPER = process.env.USE_LOCAL_SCRAPER === 'true' || false;

export async function createBrowser() {
  return await chromium.launch({
    proxy: {
      server: 'http://localhost:7890'
    },
    headless: true,
  });
}