import { LLMService } from './LLMService';
import { llmModelBalancerStore } from './LLMBalancerStore';
import { LimiterConfig } from '../../utils/ConcurrencyLimiter';
import { LLMProviderName } from './providers';

export enum LLMType {
  Weak = 'weak',
  Strong = 'strong',
}

export interface LLMConfig {
  provider: LLMProviderName;
  modelName: string;
  apiKeys: string[];
  limiterConfig: LimiterConfig;
}

export function getAiModel(type: LLMType): LLMService {
  return llmModelBalancerStore.getBalancer(type).getRandom();
}