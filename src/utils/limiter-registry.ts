import { ConcurrencyLimiter } from './concurrency';
import { limiterConfigs, LimiterConfig } from '../config';
import { LanguageModel } from 'ai';

export class LimiterRegistry {
  private static instance: LimiterRegistry;
  private limiters: Map<string, ConcurrencyLimiter> = new Map();

  private constructor() {
    // 私有构造函数，确保单例模式
  }

  public static getInstance(): LimiterRegistry {
    if (!LimiterRegistry.instance) {
      LimiterRegistry.instance = new LimiterRegistry();
    }
    return LimiterRegistry.instance;
  }

  /**
   * 根据服务名称或模型获取或创建并发限制器。
   * 如果传入 LanguageModel，将使用 model.model 作为键，并 fallback 到 'ai' 如果无特定配置。
   * @param key 服务名称 (string) 或 LanguageModel。
   * @returns 对应的 ConcurrencyLimiter 实例。
   * @throws 如果是 string 且无配置，则抛出错误。
   */
  public getLimiter(key: string | LanguageModel): ConcurrencyLimiter {
    let serviceName: string;
    if (typeof key === 'string') {
      serviceName = key;
    } else {
      serviceName = key.modelId;  // 使用 modelId，因为是 LanguageModelV2
      if (!limiterConfigs[serviceName]) {
        console.warn(`未找到模型 "${serviceName}" 的特定配置，使用 'ai' 默认配置。`);
        serviceName = 'ai';
      }
    }

    if (!this.limiters.has(serviceName)) {
      const config: LimiterConfig | undefined = limiterConfigs[serviceName];

      if (!config) {
        throw new Error(`找不到服务 "${serviceName}" 的并发限制器配置。`);
      }

      const { concurrency, requestsPerMinute, minIntervalMs } = config;
      this.limiters.set(
        serviceName,
        new ConcurrencyLimiter(concurrency, requestsPerMinute, minIntervalMs)
      );
    }
    return this.limiters.get(serviceName)!;
  }
}

export const limiterRegistry = LimiterRegistry.getInstance();