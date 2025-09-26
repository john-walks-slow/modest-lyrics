import { playwrightLimiterConfig } from './config';
import { CrawlerService } from './CrawlerService';

export const crawlerService = new CrawlerService(playwrightLimiterConfig);

export const getCrawler = () => crawlerService;