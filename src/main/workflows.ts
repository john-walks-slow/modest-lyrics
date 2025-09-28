import { TEMP_JSON_DIR, USE_LOCAL_SCRAPER } from '../config';
import { logCrawl } from '../utils/logger';
import { AITools } from './aiTools';
import { AlbumMetadata, SongLyrics, ScrapeResult, SongMetadata, TrackItem, VerificationResult, createCrossVerifiedLyrics } from '../constants/types';
import { v4 as uuidv4 } from 'uuid';
import { Document, SearchResultWeb } from '@mendable/firecrawl-js';
import { saveIntermediateObjects } from './io';
import { AlbumLyrics } from '../constants/types';
import { SingleBar } from 'cli-progress';
import { saveFinalAlbumResults } from './io';
import { getFirecrawl } from '../services/firecrawl';
import { LLMType } from '../services/llm';
import { getCrawler } from '../services/crawler';
import { lyricsTranslations } from '../constants/strings';
import { getLanguageCodeFromLocaleCode, getLocationCodeFromLocaleCode, normalizeLocaleCode } from '../utils/LocaleUtils';

async function getContentFromSearch(query: string, limit: number = 1, localeCode?: string): Promise<ScrapeResult[]> {
  if (USE_LOCAL_SCRAPER) {
    return getCrawler().run(async (browser) => {
      console.log(`🔍 Local Scrape: "${query}"`);
      let page;
      try {
        page = await browser.newPage();
        let searchQuery = query;
        const kl = localeCode ? localeCode.toLowerCase().replace('-', '_') : 'en_us';
        const searchUrl = `https://duckduckgo.com/?q=${encodeURIComponent(searchQuery)}&kl=${kl}`;
        await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
        const firstLocator = page.getByTestId('result-title-a').first();
        await firstLocator.waitFor({ state: 'visible', timeout: 20000 });
        await firstLocator.click();
        await page.waitForLoadState('domcontentloaded');
        const content = await page.evaluate(() => {
          // 排除更多无关元素
          const excludeSelectors = ['nav', 'aside', 'footer', 'header', 'script', 'style', '.ad', '[class*="ad"]', '[id*="ad"]'];
          excludeSelectors.forEach(sel => {
            const elements = document.querySelectorAll(sel);
            elements.forEach(el => el.remove());
          });
          const main = document.querySelector('article, main, .post-content, #main-content, .entry-content, .content') || document.body;
          let text = ((main as HTMLElement).innerText || main.textContent || '').trim();
          // 简单清理为markdown-like: 保留段落换行
          text = text.replace(/\s+/g, ' ').replace(/([.!?])\s*([A-Z])/g, '$1\n\n$2');
          return text;
        });
        const url = page.url();
        if (!content) {
          throw new Error('页面内容提取失败');
        }
        logCrawl({ query: query, localeCode: kl }, [{ content, url }]);
        return [{ content, url }];
      } finally {
        if (page) await page.close();
      }
    });
  } else {
    const searchResult = await (async () => {
      let searchQuery = query;
      let location = localeCode ? getLocationCodeFromLocaleCode(localeCode) : undefined;
      let scrapeLocation = localeCode ? {
        country: getLocationCodeFromLocaleCode(localeCode),
        languages: [getLanguageCodeFromLocaleCode(localeCode)]
      } : undefined;
      // if (localeCode) {
      //   searchQuery += ` lang:${localeCode}`;
      // }
      console.log(`🔍 Web Search: "${searchQuery}" ${localeCode}`);
      const firecrawl = getFirecrawl();
      return firecrawl.search(searchQuery, {
        limit,
        ignoreInvalidURLs: true,
        sources: ['web'],
        location,
        scrapeOptions: {
          formats: ['markdown'],
          // blockAds: false,
          onlyMainContent: true,
          excludeTags: ['i', 'img', 'header', 'footer'],
          // location: scrapeLocation
        }
      });
    })();
    if (!searchResult.web || searchResult.web.length === 0) {
      throw new Error(`找不到关于 "${query}" 的任何 web 结果。`);
    }
    const results: ScrapeResult[] = (searchResult.web as (SearchResultWeb & Document)[]).slice(0, limit)
      .map((result) => {
        if (!result.url || !result.markdown) {
          return null;
        }
        return { content: result.markdown, url: result.url };
      })
      .filter(r => r !== null) as ScrapeResult[];
    if (results.length === 0) {
      throw new Error(`Web 结果不符合预期，没有有效内容。`);
    }
    logCrawl({
      query: query,
      options: {
        limit,
        ignoreInvalidURLs: true,
        sources: ['web'],
        location,
        scrapeOptions: {
          formats: ['markdown'],
          onlyMainContent: true,
          excludeTags: ['i', 'img', 'header', 'footer']
        }
      },
      localeCode
    }, results);
    return results;
  }
}

async function getAlbumMetadata(query: string): Promise<AlbumMetadata> {
  const [scrapeResult] = await getContentFromSearch(`tracklist wiki ${query}`, 1);
  const metadata = await AITools.albumMetadataExtractor.execute(scrapeResult);
  if (!metadata.tracklist || metadata.tracklist.length === 0) throw new Error("提取到的曲目列表为空。");
  console.log(`🎵 元数据获取成功: ${metadata.albumTitle}。`);
  metadata.localeCode = normalizeLocaleCode(metadata.localeCode);
  return metadata;
}

/**
 * 从所有指定来源并发抓取歌词，并返回所有成功的结果。
 */
async function fetchAllRawLyricsSources(songMetadata: SongMetadata, sourceSites?: string[]): Promise<SongLyrics[]> {
  const { title, artist, localeCode } = songMetadata;
  const lyricsTerm = lyricsTranslations[getLanguageCodeFromLocaleCode(localeCode || 'en')] || 'lyrics';
  let fetchPromises: Promise<SongLyrics>[] = [];

  if (sourceSites && sourceSites.length > 0) {
    fetchPromises = sourceSites.map(async (site) => {
      const [scrapeResult] = await getContentFromSearch(`${title} ${artist} ${lyricsTerm} site:${site}`, 1, localeCode);
      const { lyrics: extractedLyrics } = await AITools.lyricsExtractor.execute(scrapeResult);
      const lyrics = extractedLyrics.replace(/\\n/g, '\n');
      return new SongLyrics({ title, artist, localeCode }, lyrics, [scrapeResult.url]);
    });
  } else {
    // 当未提供 sourceSites 时，进行通用搜索
    const [scrapeResult] = await getContentFromSearch(`${title} ${artist} ${lyricsTerm} lang:${localeCode}`, 1, localeCode);
    const { lyrics: extractedLyrics } = await AITools.lyricsExtractor.execute(scrapeResult);
    const lyrics = extractedLyrics.replace(/\\n/g, '\n');
    const singleResult = new SongLyrics({ title, artist, localeCode }, lyrics, [scrapeResult.url]);
    fetchPromises = [Promise.resolve(singleResult)];
  }

  const results = await Promise.allSettled(fetchPromises);

  // 清晰地处理已敲定(settled)的 Promise 结果
  const successfulRaws = results.reduce<SongLyrics[]>((acc, result) => {
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
async function verifyLyricsFromSources(rawLyricsArray: SongLyrics[]): Promise<VerificationResult> {
  if (rawLyricsArray.length === 1) {
    console.log("   -> 单一来源，无需交叉验证。");
    return {
      verifiedLyrics: rawLyricsArray[0].lyrics!
    };
  }
  console.log(`   -> ${rawLyricsArray.length} 个来源，开始交叉验证...`);
  let verificationResult = await AITools.lyricsVerifier.execute(rawLyricsArray);
  if (verificationResult.verifiedLyrics) {
    verificationResult.verifiedLyrics = verificationResult.verifiedLyrics.replace(/\\n/g, '\n');
  }
  return verificationResult;
}

/**
 * 单首歌曲处理管道：抓取 -> 验证 -> 翻译
 */
async function processSongPipeline(songMetadata: SongMetadata, sourceSites?: string[]): Promise<SongLyrics> {
  const { title: songTitle, artist } = songMetadata;
  console.log(`\n--- 开始处理歌曲: "${songTitle}" ---`);
  try {
    // 步骤 1: 抓取
    const rawLyricsArray = await fetchAllRawLyricsSources(songMetadata, sourceSites);
    await saveIntermediateObjects(rawLyricsArray);

    // 步骤 2: 验证
    const verificationResult = await verifyLyricsFromSources(rawLyricsArray);
    const verifiedLyrics = createCrossVerifiedLyrics(rawLyricsArray, verificationResult);
    await saveIntermediateObjects([verifiedLyrics]);

    // 步骤 3: 翻译
    const translation = await AITools.lyricsTranslator.execute(verifiedLyrics);
    verifiedLyrics.addTranslation(translation);
    await saveIntermediateObjects([verifiedLyrics]);

    return verifiedLyrics;
  } catch (error) {
    console.error(`❌ 处理 "${songTitle}" 的流程失败: ${(error as Error).message}`);
    return new SongLyrics(songMetadata, null, [], 'failed', undefined, undefined, (error as Error).message);
  }
}

/**
 * 主流程，根据 query 和来源，搜索、整合、翻译歌词，输出双语对照译文
 * @param query 
 * @param sourceSites 
 */
export async function mainWorkflow(query: string, sourceSites?: string[]) {
  console.log(`🚀 开始处理查询：${query}`);

  try {
    const albumMetadata: AlbumMetadata = await getAlbumMetadata(query);

    const total = albumMetadata.tracklist.length;
    if (total === 0) {
      console.log("专辑无曲目。");
      return;
    }

    const bar = new SingleBar({
      format: '歌曲进度 [{bar}] {percentage}% | {value}/{total} | ETA: {eta}s',
      hideCursor: true
    });
    bar.start(total, 0);

    const songProcessingPromises = albumMetadata.tracklist.map((trackItem: TrackItem) => {
      const songMetadata: SongMetadata = { title: trackItem.title, artist: albumMetadata.artist, localeCode: albumMetadata.localeCode };
      return processSongPipeline(songMetadata, sourceSites)
        .then((result) => {
          bar.increment();
          return result;
        });
    });
    const results = await Promise.all(songProcessingPromises);
    bar.stop();

    const finalTranslatedSongs = results;

    if (finalTranslatedSongs.length > 0) {
      const finalAlbum: AlbumLyrics = { metadata: albumMetadata, songs: finalTranslatedSongs };
      await saveFinalAlbumResults(finalAlbum);
    } else {
      console.warn("\n🟡 未能成功处理任何歌曲，无法生成最终文件。");
    }
  } catch (error) {
    console.error(`❌ 程序发生致命错误，终止运行: ${(error as Error).message}`);
  }
}

export { getContentFromSearch, getAlbumMetadata, fetchAllRawLyricsSources, verifyLyricsFromSources, processSongPipeline };
