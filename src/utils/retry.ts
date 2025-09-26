import { setTimeout } from 'timers/promises';

export interface RetryOptions {
  retries?: number; // 最大重试次数，默认为 3
  delay?: number; // 每次重试前的延迟（毫秒），默认为 1000ms
  factor?: number; // 延迟的指数增长因子，默认为 2 (即 1s, 2s, 4s, ...)
  maxDelay?: number; // 最大延迟（毫秒），默认为 30000ms (30秒)
  shouldRetry?: (error: any) => boolean; // 判断是否应该重试的函数，默认为捕获所有错误
}

/**
 * 封装一个异步函数，使其在失败时自动重试。
 * @param fn 要执行的异步函数。
 * @param options 重试配置项。
 * @returns 一个 Promise，它将在成功时解析，或在所有重试失败后拒绝。
 */
export async function retry<T>(fn: () => Promise<T>, options?: RetryOptions): Promise<T> {
  const {
    retries = 3,
    delay = 1000,
    factor = 2,
    maxDelay = 30000,
    shouldRetry = (error: any) => true, // 默认重试所有错误
  } = options || {};

  let currentDelay = delay;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === retries || !shouldRetry(error)) {
        console.error(`❌ 重试失败: ${retries} 次尝试后仍未成功. 原始错误: ${(error as Error).message}`);
        throw error; // 所有重试都失败，抛出原始错误
      }
      console.warn(`⚠️ 尝试失败 (第 ${i + 1}/${retries + 1} 次), 错误: ${(error as Error).message}. 将在 ${currentDelay / 1000} 秒后重试...`);
      await setTimeout(currentDelay);
      currentDelay = Math.min(currentDelay * factor, maxDelay);
    }
  }
  // 理论上不会到达这里，因为循环会抛出错误或返回结果
  throw new Error("Retry function reached an unexpected state.");
}
