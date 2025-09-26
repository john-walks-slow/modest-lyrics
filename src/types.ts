import { z } from 'zod';


export const SongMetadataSchema = z.object({
  title: z.string(),
  artist: z.string(),
  duration: z.string().optional().describe('时长'),
});
export type SongMetadata = z.infer<typeof SongMetadataSchema>;

export const TrackItemSchema = z.object({
  title: z.string().describe('歌曲名'),
  duration: z.string().optional().describe('时长'),
});

export const AlbumMetadataSchema = z.object({
  albumTitle: z.string().describe('专辑标题'),
  artist: z.string().describe('艺术家'),
  releaseDate: z.string().optional().describe('发行日期'),
  tracklist: z.array(TrackItemSchema).describe('曲目列表，包含歌曲名和可选的时长'),
});
export type AlbumMetadata = z.infer<typeof AlbumMetadataSchema>;

export type TrackItem = z.infer<typeof TrackItemSchema>;

export const TranslationSchema = z.object({
  translatedTitle: z.string().describe('歌名的中文翻译'),
  translatedLyrics: z.string().describe('歌词的中文翻译'),
  footnotes: z.array(z.object({
    originalText: z.string().describe('脚注指向的原始文字'),
    note: z.string().describe('脚注内容'),
  })).optional().describe('脚注列表'),
});
export type Translation = z.infer<typeof TranslationSchema>;
export const VerificationResultSchema = z.object({ verifiedLyrics: z.string().describe('经过整合的歌词纯文本'), verificationComment: z.string().optional().describe('评校意见') });
export type VerificationResult = z.infer<typeof VerificationResultSchema>;

export interface LyricsObject {
  id: string;
  metadata: SongMetadata;
  lyrics: string | null;
  sources: string[];
  status: 'raw' | 'verified' | 'translated';
  verificationComment?: string;
  translation?: Translation;
}

export interface FinalAlbum {
  metadata: AlbumMetadata;
  songs: LyricsObject[];
}

export interface SearchContent {
  content: string;
  url: string;
}

export type ProcessingResult = LyricsObject | null;

export const ExtractedLyricsSchema = z.object({
  lyrics: z.string().describe('歌词纯文本'),
});

export type ExtractedLyrics = z.infer<typeof ExtractedLyricsSchema>;