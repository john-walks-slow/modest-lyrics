import { LLMType, LLMConfig } from './index';
import { LLM_CONFIG_MAP } from './config';
import { providerCreaterMap } from './providers';
import { LLMService } from './LLMService';
import { LoadBalancer } from '../../utils/LoadBalancer';
import { customFetch } from '../../utils/fetch';

class LLMBalancerStore {
  private balancers: Map<string, LoadBalancer<LLMService>> = new Map();

  public getBalancer(modelType: LLMType): LoadBalancer<LLMService> {
    if (this.balancers.has(modelType)) {
      return this.balancers.get(modelType)!;
    }

    const config = LLM_CONFIG_MAP[modelType];
    if (!config) {
      throw new Error(`未知的 AI 模型类型: ${modelType}`);
    }

    const providerCreator = providerCreaterMap[config.provider];
    if (!providerCreator) {
      throw new Error(`未知的提供商: ${config.provider}`);
    }

    const balancer = new LoadBalancer(
      config.apiKeys,
      (apiKey: string) => {
        const provider = providerCreator(apiKey);
        const model = provider(config.modelName);
        return new LLMService(model, config.limiterConfig);
      }
    );

    this.balancers.set(modelType, balancer);
    return balancer;
  }
}

export const llmModelBalancerStore = new LLMBalancerStore();