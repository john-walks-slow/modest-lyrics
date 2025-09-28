import * as fs from 'fs/promises';
import * as path from 'path';
import { SongLyrics, AlbumLyrics } from '../constants/types';
import { TEMP_JSON_DIR, FINAL_OUTPUT_DIR } from '../config';
import { sanitizeName } from '../utils/FileUtils';

async function saveIntermediateObjects(objects: SongLyrics[]): Promise<void> {
  await fs.mkdir(TEMP_JSON_DIR, { recursive: true });
  for (const object of objects) {
    const filePath = path.join(TEMP_JSON_DIR, `${sanitizeName(object.id)}_${object.status}.json`);
    await fs.writeFile(filePath, JSON.stringify(object, null, 2));
    console.log(`✅ 已保存中间文件: ${path.basename(filePath)}`);
  }
}

async function saveFinalAlbumResults(finalAlbum: AlbumLyrics): Promise<void> {
  // 净化用于路径的专辑和艺术家名称
  const sanitizedAlbumTitle = sanitizeName(finalAlbum.metadata.albumTitle);
  const sanitizedArtist = sanitizeName(finalAlbum.metadata.artist);

  // 1. 保存最终的聚合 JSON 文件
  const finalJsonPath = path.join(TEMP_JSON_DIR, `${sanitizedAlbumTitle}_final.json`);
  await fs.writeFile(finalJsonPath, JSON.stringify(finalAlbum, null, 2));
  console.log(`\n🎉 所有歌曲处理完毕！最终专辑 JSON 已保存至: ${finalJsonPath}`);

  // 2. 在目录结构中生成所有 Markdown 文件
  console.log(`\n📦 正在生成最终的双语文件...`);
  const albumDir = path.join(FINAL_OUTPUT_DIR, sanitizedArtist, sanitizedAlbumTitle);
  await fs.mkdir(albumDir, { recursive: true });

  for (const [index, song] of finalAlbum.songs.entries()) {
    let content: string;
    if (song.status === 'failed') {
      content = `# ${song.metadata.title}\n\n**Failed to process lyrics:** ${song.verificationComment || 'Unknown error'}\n\n`;
    } else if (!song.lyrics || !song.translation) {
      continue;
    } else {
      const originalLines = song.lyrics.split('\n');
      const translatedLines = song.translation.translatedLyrics.split('\n');
      content = `# ${song.metadata.title} ${song.translation.translatedTitle}\n\n`;

    // 交替输出歌词行
    for (let i = 0; i < originalLines.length; i++) {
      if (originalLines[i].trim()) {
        content += `${originalLines[i].replace(/\n/g, '  \n')}\n\n`;
      } else {
        content += '<br>\n\n';
        continue;
      }
      if (translatedLines[i] && translatedLines[i].trim()) {
        content += `${translatedLines[i].replace(/\n/g, '  \n')}\n\n`;
      }
    }

    // 脚注
    if (song.translation.footnotes?.length) {
      content += '<br>\n\n';
      song.translation.footnotes.forEach((footnote, i) => {
        content = content.replace(footnote.originalText, footnote.originalText + `[^${i + 1}]`);
        content += `[^${i + 1}] ${footnote.originalText}: ${footnote.note}\n\n`;
      });
    }

    // 资料来源
    if (song.sources && song.sources.length > 0) {
      content += '<br>\n\n资料来源：\n\n';
      song.sources.forEach(source => {
        content += `- ${source}\n\n`;
      });
    }

    // 创建格式化的文件名
    const trackNumber = (index + 1).toString().padStart(2, '0'); // 将编号格式化为两位数（例如：01、14）
    const sanitizedTitle = sanitizeName(song.metadata.title);
    const fileName = `${trackNumber}_${sanitizedTitle}.md`;
    const filePath = path.join(albumDir, fileName);

    await fs.writeFile(filePath, content);
    console.log(`   - 已创建: ${filePath}`);
  }
  console.log(`\n📂 双语文件已生成至目录: ${albumDir}`);
}
}
export { saveIntermediateObjects, saveFinalAlbumResults }