import dotenv from 'dotenv';

dotenv.config();

export const FIRECRAWL_API_KEYS = (process.env.FIRECRAWL_API_KEYS || process.env.FIRECRAWL_API_KEY)?.split(',').map(k => k.trim()).filter(Boolean) || [];
export const GOOGLE_API_KEYS = (process.env.GOOGLE_API_KEYS || process.env.GOOGLE_API_KEY)?.split(',').map(k => k.trim()).filter(Boolean) || [];
export const OPENROUTER_API_KEYS = (process.env.OPENROUTER_API_KEYS || process.env.OPENROUTER_API_KEY)?.split(',').map(k => k.trim()).filter(Boolean) || [];
export const USE_LOCAL_SCRAPER = process.env.USE_LOCAL_SCRAPER === 'true' || false;

if (FIRECRAWL_API_KEYS.length === 0 || GOOGLE_API_KEYS.length === 0 || OPENROUTER_API_KEYS.length === 0) {
  throw new Error("请在 .env 文件中设置至少一个 FIRECRAWL_API_KEY(S)、GOOGLE_API_KEY(S) 和 OPENROUTER_API_KEY(S)，多个 key 用逗号分隔");
}