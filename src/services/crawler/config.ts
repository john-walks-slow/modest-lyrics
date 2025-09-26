import { LimiterConfig } from "../../utils/ConcurrencyLimiter";

export const playwrightLimiterConfig: LimiterConfig = {
  concurrency: 3,
  requestsPerMinute: Infinity,
  minIntervalMs: 0,
};