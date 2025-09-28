import * as fs from 'fs/promises';
import * as path from 'path';
import { sanitizeName } from '../utils/FileUtils';
import { TEMP_JSON_DIR } from '../config';
import { AlbumLyrics } from '../constants/types';
import { saveFinalAlbumResults } from '../main/io';
import { processSongPipeline } from '../main/workflows';

/**
 * 从执行结果JSON中重试失败的歌曲。
  * @param albumJsonPath 专辑JSON文件路径
   * @param sourceSites 可选的来源站点
    */
export async function retryFailedSongs(albumJsonPath: string, sourceSites?: string[]) {
  console.log(`🔄 开始重试失败歌曲: ${albumJsonPath}`);

  try {
    // 读取JSON
    const jsonContent = await fs.readFile(albumJsonPath, 'utf-8');
    const finalAlbum: AlbumLyrics = JSON.parse(jsonContent);

    const failedSongs = finalAlbum.songs.filter(song => song.status === 'failed');
    if (failedSongs.length === 0) {
      console.log('没有失败的歌曲需要重试。');
      return;
    }

    console.log(`📝 发现 ${failedSongs.length} 首失败歌曲，开始重试...`);

    const retryPromises = failedSongs.map(async (failedSong) => {
      try {
        const result = await processSongPipeline(failedSong.metadata, sourceSites);
        // 替换原数组中的对应歌曲（基于id）
        const index = finalAlbum.songs.findIndex(s => s.id === failedSong.id);
        if (index !== -1) {
          finalAlbum.songs[index] = result;
          console.log(`✅ 重试成功: ${failedSong.metadata.title}`);
        }
        return result;
      } catch (error) {
        console.error(`❌ 重试 "${failedSong.metadata.title}" 失败: ${(error as Error).message}`);
        // 保持原失败状态
        return failedSong;
      }
    });

    await Promise.all(retryPromises);

    // 保存更新后的JSON
    const sanitizedAlbumTitle = sanitizeName(finalAlbum.metadata.albumTitle);
    const updatedJsonPath = path.join(TEMP_JSON_DIR, `${sanitizedAlbumTitle}_retry.json`);
    await fs.writeFile(updatedJsonPath, JSON.stringify(finalAlbum, null, 2));
    console.log(`💾 更新后的JSON已保存: ${updatedJsonPath}`);

    // 可选：重新生成Markdown文件
    await saveFinalAlbumResults(finalAlbum);
    console.log('📄 Markdown文件已更新。');

  } catch (error) {
    console.error(`❌ 重试过程失败: ${(error as Error).message}`);
  }
}