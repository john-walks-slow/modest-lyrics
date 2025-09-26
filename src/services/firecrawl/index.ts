import { FIRECRAWL_API_KEYS } from '../../config/environment';
import { LoadBalancer } from '../../utils/LoadBalancer';
import { firecrawlLimiterConfig } from './config';
import { FirecrawlService } from './FirecrawlService';

const firecrawlBalancer = new LoadBalancer(
  FIRECRAWL_API_KEYS,
  (apiKey: string) => new FirecrawlService(apiKey, firecrawlLimiterConfig)
);

export const getFirecrawl = () => firecrawlBalancer.getRandom();