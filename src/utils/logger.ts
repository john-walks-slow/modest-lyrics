import fs from 'fs';
import path from 'path';
import { VERBOSE_LOGGING } from '../config';

const logDir = path.join(__dirname, '../../../output/logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}
const logFile = path.join(logDir, 'verbose.log');

export function logAITool(prompt: string, response: any) {
  if (!VERBOSE_LOGGING) return;
  const entry = {
    timestamp: new Date().toISOString(),
    type: 'ai',
    prompt,
    response
  };
  fs.appendFileSync(logFile, JSON.stringify(entry) + '\n');
}

export function logCrawl(params: { query: string; options?: any; localeCode?: string }, result: any) {
  if (!VERBOSE_LOGGING) return;
  const entry = {
    timestamp: new Date().toISOString(),
    type: 'crawl',
    params,
    result
  };
  fs.appendFileSync(logFile, JSON.stringify(entry) + '\n');
}