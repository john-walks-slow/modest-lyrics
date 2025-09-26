import { limiterRegistry } from './limiter-registry';
import { retry, RetryOptions } from './retry';
import { LanguageModel } from 'ai';

export const defaultRetryOptions: RetryOptions = {
  retries: 5,
  delay: 15000,
  factor: 2,
  maxDelay: 60000,
  shouldRetry: (error: any) => {
    return true
    error.message.includes('API_ERROR') || error.message.includes('RATE_LIMIT_EXCEEDED')
  },
};

/**
 * 通用 limiter + retry 执行函数。
 * @param fn 要执行的异步函数
 * @param key 服务名 (string) 或 LanguageModel
 * @param options 可选 retry 配置
 * @returns fn 的结果
 */
export async function withLimitAndRetry<T>(fn: () => Promise<T>, key: string | LanguageModel, options?: RetryOptions): Promise<T> {
  const limiter = limiterRegistry.getLimiter(key);
  const effectiveOptions = options || defaultRetryOptions;
  return limiter.run(() => retry(fn, effectiveOptions));
}