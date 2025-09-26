import { LanguageModel, generateObject } from 'ai';
import { ConcurrencyLimiter, LimiterConfig } from '../../utils/ConcurrencyLimiter';
import z from 'zod';

export class LLMService {
  private model: LanguageModel;
  private limiter: ConcurrencyLimiter;

  constructor(model: LanguageModel, config: LimiterConfig) {
    this.model = model;
    this.limiter = new ConcurrencyLimiter(config);
  }

  async generateObject({ schema, prompt }: { schema: z.ZodType, prompt: string; }) {
    return this.limiter.run(() => generateObject({ model: this.model, schema, prompt }));
  }
}