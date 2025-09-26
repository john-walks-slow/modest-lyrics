import { z } from 'zod';


export const SongMetadataSchema = z.object({
  title: z.string(),
  artist: z.string(),
  duration: z.string().optional(),
  localeCode: z.string().optional(),
});
export type SongMetadata = z.infer<typeof SongMetadataSchema>;

export const TrackItemSchema = z.object({
  title: z.string().describe('歌曲名（源语言／原始名称，请勿包含译名、注音、罗马音）'),
  duration: z.string().optional().describe('时长 (MM:SS'),
});
export type TrackItem = z.infer<typeof TrackItemSchema>;

export const AlbumMetadataSchema = z.object({
  albumTitle: z.string().describe('专辑标题（源语言／原始名称，请勿包含译名、注音、罗马音）'),
  artist: z.string().describe('艺术家（源语言／原始名称，请勿包含译名、注音、罗马音）'),
  releaseDate: z.string().optional().describe('发行日期（YYYY[-MM][-DD]）'),
  localeCode: z.string().describe('专辑所属的主要语言地区，允许启发式推测 (ISO Locale Code，如zh-TW)'),
  tracklist: z.array(TrackItemSchema).describe('曲目列表，包含歌曲名和可选的时长'),
});
export type AlbumMetadata = z.infer<typeof AlbumMetadataSchema>;


export const TranslationSchema = z.object({
  translatedTitle: z.string().describe('歌名的中文翻译'),
  translatedLyrics: z.string().describe('歌词的中文翻译'),
  footnotes: z.array(z.object({
    originalText: z.string().describe('脚注指向的原始文字'),
    note: z.string().describe('脚注内容'),
  })).optional().describe('脚注列表'),
});
export type Translation = z.infer<typeof TranslationSchema>;

export const VerificationResultSchema = z.object({
  verifiedLyrics: z.string().describe('经过整合的歌词纯文本'),
  verificationComment: z.string().optional().describe('评校意见')
});
export type VerificationResult = z.infer<typeof VerificationResultSchema>;

export const ExtractedLyricsSchema = z.object({
  lyrics: z.string().describe('歌词纯文本'),
});
export type ExtractedLyrics = z.infer<typeof ExtractedLyricsSchema>;

export class SongLyrics {
  public readonly id: string;
  public metadata: SongMetadata;
  public lyrics: string | null;
  public sources: string[];
  public status: 'raw' | 'verified' | 'translated';
  public verificationComment?: string;
  public translation?: Translation;

  constructor(
    metadata: SongMetadata,
    lyrics: string | null = null,
    sources: string[] = [],
    status: 'raw' | 'verified' | 'translated' = 'raw',
    verificationComment?: string,
    translation?: Translation
  ) {
    this.id = SongLyrics.generateId(metadata);
    this.metadata = metadata;
    this.lyrics = lyrics;
    this.sources = sources;
    this.status = status;
    this.verificationComment = verificationComment;
    this.translation = translation;
  }

  static generateId(metadata: SongMetadata): string {
    // Simple ID generation based on title and artist
    return `${metadata.artist}-${metadata.title}`.replace(/\s+/g, '_').toLowerCase();
  }

  setLyrics(lyrics: string) {
    this.lyrics = lyrics;
    this.status = 'raw';
  }

  verifyLyrics(verifiedLyrics: string, comment?: string) {
    this.lyrics = verifiedLyrics;
    this.status = 'verified';
    this.verificationComment = comment;
  }

  addTranslation(translation: Translation) {
    this.translation = translation;
    this.status = 'translated';
  }

  addSource(source: string) {
    if (!this.sources.includes(source)) {
      this.sources.push(source);
    }
  }
}

export function createCrossVerifiedLyrics(
  rawLyrics: SongLyrics[],
  { verifiedLyrics, verificationComment }: VerificationResult
): SongLyrics {
  return new SongLyrics(
    rawLyrics[0].metadata,
    verifiedLyrics,
    rawLyrics.map(l => l.sources).flat(),
    'verified',
    verificationComment
  );
}

export interface AlbumLyrics {
  metadata: AlbumMetadata;
  songs: SongLyrics[];
}

export interface ScrapeResult {
  content: string;
  url: string;
}
