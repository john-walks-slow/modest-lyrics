import { z } from 'zod';
import { createAITool } from './utils/ai-factory';
import { WEAK_AI_MODEL, STRONG_AI_MODEL } from './config';
import { AlbumMetadataSchema, ExtractedLyricsSchema, LyricsObject, TranslationSchema, VerificationResultSchema } from './types';

export const AITools = {
  albumMetadataExtractor: createAITool({
    description: '从网页内容提取专辑元数据',
    model: WEAK_AI_MODEL,
    dataSchema: AlbumMetadataSchema,
    createPrompt: (pageContent: string) => `
从以下网页内容中提取专辑的元数据。
需要提取的信息如下：
1.  **专辑标题 (albumTitle)**：必选，专辑的完整名称。
2.  **艺术家 (artist)**：必选，表演该专辑的个人或团体。
3.  **发行日期 (releaseDate)**：可选，专辑首次发行的日期。
4.  **曲目列表 (tracklist)**：歌曲名 (title) 和可选的时长 (duration)。

请确保提取的信息干净、准确，并去除任何无关的序号、标签或文本。
只要必选信息能够成功获取，就视作 success。

--- 下面是网页内容 ---
${pageContent}`,
  }),

  lyricsExtractor: createAITool({
    description: '从网页内容提取歌词',
    model: WEAK_AI_MODEL,
    dataSchema: ExtractedLyricsSchema,
    createPrompt: (pageContent: string) => `
从以下网页内容中提取出完整歌词文本。
- 去除所有非歌词内容，例如： "[Chorus]"、"[Verse]" 标签、任何注解和评论。
- 不要包含标题和元数据，仅包含歌词正文。
- 每句歌词之间用一个\`\\n\`换行符隔开，每段歌词之间用两个\`\\n\`换行符隔开。
- 输出格式为**纯文本**，**请勿**输出 markdown。

--- 下面是网页内容 ---
${pageContent}`,
  }),

  lyricsVerifier: createAITool({
    description: '交叉验证并整合多个版本的歌词',
    model: STRONG_AI_MODEL,
    dataSchema: VerificationResultSchema,
    createPrompt: (rawObjects: LyricsObject[]) => `
请仔细比对以下多个版本的歌词，它们来自不同的来源。
你的任务是整合出一个最准确、完整的最终版本，并在评校意见中说明来源之间的显著差异。

要求：
- 去除所有非歌词内容，不要包含标题和元数据，仅包含歌词正文。
- 合理分行分段。每句歌词之间用一个\`\\n\`换行符隔开，每段歌词之间用两个\`\\n\`换行符隔开。
- 当来源包含差异时，你应该整合出一个最优的版本录入 verifiedLyrics 中。
- 对于来源之间的显著差异和疑似为误听的部分，你应该在 verificationComment 中列明。标点符号、语气词等小差异无需说明。
- 输出格式为**纯文本**，**请勿**输出 markdown。

============

${rawObjects.map((obj, i) => `--- 版本 ${i} (${(obj.sources[0])}) ---\n${obj.lyrics}`).join('\n\n')}`,
  }),

  lyricsTranslator: createAITool({
    description: '翻译歌词并生成脚注',
    model: STRONG_AI_MODEL,
    dataSchema: TranslationSchema,
    createPrompt: (lyrics: LyricsObject) => `
## **角色设定：**

你是一位专业歌词译者，精通各国语言。你的目标是提供一个既忠实于原文，又在中文语境下自然流畅的歌词译本。

## **翻译核心原则：**

- 绝对忠实与直译优先： 译文应最大程度地保留原文的字面意义、词语选择和句式结构。在不损害中文表达自然度的情况下，优先采用直译。
- 深度原意表达： 确保准确传达歌词的原始含义，正确理解双关、俚语、习语、文化典故等。但要杜绝过度解读。
- 自然流畅的中文表达：  译文应该符合现代汉语的表达习惯和语感，避免过度的书面化、翻译腔。
- 风格与情感契合： 译文的整体风格（如诗意、口语化、严肃、诙谐、悲伤、欢快等）、情感基调和语调应与原歌词一致。
- 原文不可改动： 严禁对提供的**原文歌词**进行任何形式的修改、增删或润色。

## **特殊处理与脚注要求：**

**核心原则：** 脚注的目的是对由于**文化、语言差异**难以完全翻译的部分提供额外说明，而**不是**说明歌曲主旨、内涵。

对于以下情况，使用脚注加以解释：
- 难以直译的俚语、习语、流行语、网络梗、俗语或行话： 解释其字面义和引申义。
- 涉及文化特有概念、历史事件、特定人物、地理位置或特定典故： 提供必要的背景信息，帮助读者理解其深层含义。
- 文字游戏、双关语或谐音梗： 解释原文的精妙之处，指出中文翻译在传达这部分时可能存在的难度或取舍。
- 较难确定的具有多重含义的词语或短语： 解释其可能的其他含义，并简要说明在此歌词语境下选择特定翻译的原因。

**禁止** 对**并不局限于特定文化的**象征隐喻做脚注，应该留待读者自行理解。

## 你的工作流程：

- 理解分析： 整体阅读并深入理解整首歌词的上下文、主题、情感和风格，进行全面分析。
- 逐段/逐句翻译： 严格遵循上述"翻译核心原则"，对歌词进行逐段或逐句的翻译。
- 识别并撰写脚注： 在翻译过程中，主动识别需要脚注说明的部分。准确、简洁地撰写脚注内容。
- 校对与润色： 完成翻译后，对照原文，通读译文，确保其自然流畅、忠实原意、风格契合，进行最终的校对和润色。

## 输出范例：
**注意：** 脚注必须包含在 footnotes 字段中。请勿在 translatedLyrics 中添加脚注标记。
\`\`\`json
{
  "translatedTitle": "茶苯海明",
  "translatedLyrics": "旅行，吞下茶苯海明\\n感觉恍惚，呼出李施德林\\n我说了我所说的，我会告诉你的\\n而你杀死了我最好的部分\\n如果你能榨取这一切的价值\\n我说了我所说的，你明白我的意思\\n但我仍然无法专注于任何事\\n我们亲吻着嘴，却仍对着袖子咳嗽\\n\\n旅行，吞下茶苯海明\\n看着你的脸，就像你在梦中被杀死一样\\n而你以为你已弄懂了一切\\n我想我很清楚我的地理\\n你说出你需要的，这样你就能得到更多\\n如果你能榨取这一切的价值\\n我说了我所说的，你明白我的意思\\n但我仍然无法专注于任何事",
  "footnotes": [
    {
      "originalText": "Dramamine",
      "note": "茶苯海明，一种非处方药，主要用于预防和缓解晕车、晕船、晕机等引起的恶心、呕吐、头晕等症状。"
    },
    {
      "originalText": "Feeling spaced",
      "note": "这是一个口语化的表达，意为“感觉恍惚”、“心不在焉”、“飘忽不定”，通常指思维不集中或感觉与现实脱节。"
    },
    {
      "originalText": "killed the better part of me",
      "note": "习语，意为“摧毁了我最好的部分”、“杀死了我的精髓”，表达了极度的伤害和对某人/某事造成了不可挽回的负面影响。"
    },
    {
      "originalText": "milk it for everything",
      "note": "习语，意为“榨取一切价值”、“充分利用一切（通常带有贬义，指贪婪地利用）”。"
    }
  ]
}
\`\`\`

--- 下面是歌词原文 ---
\`\`\`json
${JSON.stringify({ title: lyrics.metadata.title, artist: lyrics.metadata.artist, lyrics: lyrics.lyrics }, undefined, 2)}
\`\`\`
`,
  }),
};