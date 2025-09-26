import { LimiterConfig } from "../../utils/ConcurrencyLimiter";

export const firecrawlLimiterConfig: LimiterConfig = {
  concurrency: 2,
  requestsPerMinute: 5,
  minIntervalMs: 12000,
};