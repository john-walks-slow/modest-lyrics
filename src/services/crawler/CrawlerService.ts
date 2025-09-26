import { chromium } from 'playwright';
import { ConcurrencyLimiter, LimiterConfig } from '../../utils/ConcurrencyLimiter';

export class CrawlerService {
  private limiter: ConcurrencyLimiter;

  constructor(config: LimiterConfig) {
    this.limiter = new ConcurrencyLimiter(config);
  }

  private async createBrowser() {
    return await chromium.launch({
      proxy: {
        server: 'http://localhost:7890',
      },
      headless: false,
    });
  }

  async run(task: (browser: any) => Promise<any>): Promise<any> {
    return this.limiter.run(async () => {
      const browser = await this.createBrowser();
      try {
        return await task(browser);
      } finally {
        await browser.close();
      }
    });
  }
}