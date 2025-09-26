import { firecrawl, USE_LOCAL_SCRAPER, createBrowser } from './config';
import { ConcurrencyLimiter } from './utils/concurrency'; // 仍然需要 ConcurrencyLimiter 的类型
import { AITools } from './ai-tools';
import { retry, RetryOptions } from './utils/retry';
import { limiterRegistry } from './utils/limiter-registry';
import { withLimitAndRetry } from './utils/limit-and-retry';
import { AlbumMetadata, LyricsObject, ProcessingResult, SearchContent, SongMetadata, TrackItem, VerificationResult } from './types';
import { v4 as uuidv4 } from 'uuid';
import { Document, SearchResultWeb } from '@mendable/firecrawl-js';
import { saveIntermediateObjects } from './io';
import { FinalAlbum } from './types';
import { saveFinalAlbumResults } from './io';

const firecrawlLimiter = limiterRegistry.getLimiter('firecrawl');

async function getContentFromSearch(query: string): Promise<SearchContent> {
  if (USE_LOCAL_SCRAPER) {
    return await withLimitAndRetry(async () => {
      console.log(`🔍 Local Scrape: "${query}"`);
      const browser = await createBrowser();
      let page;
      try {
        page = await browser.newPage();
        const searchQuery = query.includes('site:') ? query : query + ' lyrics';
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`;
        await page.goto(searchUrl, { waitUntil: 'networkidle' });
        await page.waitForSelector('div.g', { timeout: 10000 });
        const firstLink = await page.$('div.g a[href]');
        if (!firstLink) {
          throw new Error('未找到搜索结果链接');
        }
        await firstLink.click();
        await page.waitForLoadState('networkidle');
        const content = await page.evaluate(() => {
          const main = document.querySelector('article, main, .post-content, #main-content, .entry-content') || document.body;
          let text = ((main as HTMLElement).innerText || main.textContent || '').trim();
          // 简单清理为markdown-like: 保留段落换行
          text = text.replace(/\s+/g, ' ').replace(/([.!?])\s*([A-Z])/g, '$1\n\n$2');
          return text;
        });
        const url = page.url();
        if (!content) {
          throw new Error('页面内容提取失败');
        }
        return { content, url };
      } finally {
        if (page) await page.close();
        await browser.close();
      }
    }, 'playwright');
  } else {
    const searchResult = await withLimitAndRetry(async () => {
      console.log(`🔍 Web Search: "${query}"`);
      return firecrawl.search(query, {
        limit: 1,
        scrapeOptions: {
          formats: ['markdown'],
          blockAds: true,
          onlyMainContent: true,
          excludeTags: ['i', 'img', 'header', 'footer'],
        }
      });
    }, 'firecrawl');
    if (!searchResult.web || searchResult.web.length <= 0) {
      throw new Error(`找不到关于 "${query}" 的任何 web 结果。`);
    }
    const firstResult = searchResult.web[0] as SearchResultWeb & Document;
    if (!firstResult.url || !firstResult.markdown) {
      throw new Error(`Web 结果不符合预期。`);
    }
    return { content: firstResult.markdown, url: firstResult.url };
  }
}

async function getAlbumMetadata(query: string): Promise<AlbumMetadata> {
  const { content } = await getContentFromSearch(`tracklist ${query}`);
  const metadata = await withLimitAndRetry(() => AITools.albumMetadataExtractor.execute(content), AITools.albumMetadataExtractor.model);
  if (!metadata.tracklist || metadata.tracklist.length === 0) throw new Error("提取到的曲目列表为空。");
  console.log(`🎵 元数据获取成功: ${metadata.albumTitle}。`);
  return metadata;
}

/**
 * 从所有指定来源并发抓取歌词，并返回所有成功的结果。
 */
async function fetchAllRawLyricsSources(songMetadata: SongMetadata, sourceSites: string[]): Promise<LyricsObject[]> {
  const { title, artist } = songMetadata;
  const fetchPromises = sourceSites.map(async (site) => {
    const { content: rawLyrics, url } = await getContentFromSearch(`${title} ${artist} lyrics site:${site}`);
    const { lyrics: extractedLyrics } = await withLimitAndRetry(() => AITools.lyricsExtractor.execute(rawLyrics), AITools.lyricsExtractor.model);
    const lyrics = extractedLyrics.replace(/\\n/g, '\n');
    return {
      id: uuidv4(), metadata: songMetadata, lyrics,
      sources: [url], status: 'raw' as const,
    };
  });

  const results = await Promise.allSettled(fetchPromises);

  // 清晰地处理已敲定(settled)的 Promise 结果
  const successfulRaws = results.reduce<LyricsObject[]>((acc, result) => {
    if (result.status === 'fulfilled') {
      acc.push(result.value);
    } else {
      console.warn(`   ⚠️ 抓取 "${title}" 时出错: ${result.reason.message}`);
    }
    return acc;
  }, []);

  if (successfulRaws.length === 0) {
    throw new Error(`未能从任何来源成功获取到歌词。`);
  }
  return successfulRaws;
}

/**
 * 根据抓取的原始歌词对象，决定是否需要验证并返回最终的歌词文本。
 */
async function verifyLyricsFromSources(rawObjects: LyricsObject[]): Promise<VerificationResult> {
  if (rawObjects.length === 1) {
    console.log("   -> 单一来源，无需交叉验证。");
    return {
      verifiedLyrics: rawObjects[0].lyrics!
    };
  }
  console.log(`   -> ${rawObjects.length} 个来源，开始交叉验证...`);
  let verificationResult = await withLimitAndRetry(() => AITools.lyricsVerifier.execute(rawObjects), AITools.lyricsVerifier.model);
  if (verificationResult.verifiedLyrics) {
    verificationResult.verifiedLyrics = verificationResult.verifiedLyrics.replace(/\\n/g, '\n');
  }
  return verificationResult;
}

/**
 * 单首歌曲处理管道：抓取 -> 验证 -> 翻译
 */
async function processSongPipeline(songMetadata: SongMetadata, sourceSites: string[]): Promise<LyricsObject | null> {
  const { title: songTitle, artist } = songMetadata;
  console.log(`\n--- 开始处理歌曲: "${songTitle}" ---`);
  try {
    // 步骤 1: 抓取
    const rawObjects = await fetchAllRawLyricsSources(songMetadata, sourceSites);
    await saveIntermediateObjects(rawObjects);

    // 步骤 2: 验证
    const verifiedLyrics = await verifyLyricsFromSources(rawObjects);
    const verifiedObject: LyricsObject = {
      id: uuidv4(), metadata: { title: songTitle, artist }, lyrics: verifiedLyrics.verifiedLyrics, verificationComment: verifiedLyrics.verificationComment,
      sources: rawObjects.map(obj => obj.sources[0]),
      status: 'verified',
    };
    await saveIntermediateObjects([verifiedObject]);

    // 步骤 3: 翻译
    const translation = await withLimitAndRetry(() => AITools.lyricsTranslator.execute(verifiedObject), AITools.lyricsTranslator.model);
    const translatedObject: LyricsObject = { ...verifiedObject, status: 'translated', translation };
    await saveIntermediateObjects([translatedObject]);

    return translatedObject;
  } catch (error) {
    console.error(`❌ 处理 "${songTitle}" 的流程失败: ${(error as Error).message}`);
    return null;
  }
}

/**
 * 主流程，根据 query 和来源，搜索、整合、翻译歌词，输出双语对照译文
 * @param query 
 * @param sourceSites 
 */
export async function mainWorkflow(query: string, sourceSites: string[]) {
  console.log(`🚀 开始处理查询：${query}`);

  try {
    const albumMetadata: AlbumMetadata = await getAlbumMetadata(query);

    const songProcessingPromises = albumMetadata.tracklist.map((trackItem: TrackItem) => {
      const songMetadata: SongMetadata = { title: trackItem.title, artist: albumMetadata.artist };
      return processSongPipeline(songMetadata, sourceSites);
    });
    const results: ProcessingResult[] = await Promise.all(songProcessingPromises);
    const finalTranslatedSongs = results.filter((song) => song !== null);

    if (finalTranslatedSongs.length > 0) {
      const finalAlbum: FinalAlbum = { metadata: albumMetadata, songs: finalTranslatedSongs };
      await saveFinalAlbumResults(finalAlbum);
    } else {
      console.warn("\n🟡 未能成功处理任何歌曲，无法生成最终文件。");
    }
  } catch (error) {
    console.error(`❌ 程序发生致命错误，终止运行: ${(error as Error).message}`);
  }
}

export { getContentFromSearch, getAlbumMetadata, fetchAllRawLyricsSources, verifyLyricsFromSources, processSongPipeline };