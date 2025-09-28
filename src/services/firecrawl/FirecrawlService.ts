import FirecrawlApp, { SearchRequest } from '@mendable/firecrawl-js';
import { ConcurrencyLimiter, LimiterConfig } from '../../utils/ConcurrencyLimiter';
import { retry } from '../../utils/retry';

export class FirecrawlService {
  private app: FirecrawlApp;
  private limiter: ConcurrencyLimiter;

  constructor(apiKey: string, config: LimiterConfig) {
    this.app = new FirecrawlApp({ apiKey });
    this.limiter = new ConcurrencyLimiter(config);
  }

  async search(query: string, options: Omit<SearchRequest, "query"> | undefined) {
    return this.limiter.run(() => retry(() => this.app.search(query, options)));
  }
}