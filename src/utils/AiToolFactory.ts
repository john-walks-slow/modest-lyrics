import { generateObject, LanguageModel } from 'ai';
import { z, ZodTypeAny } from 'zod';
import { LLMType, getAiModel } from '../services/llm';

interface AIToolConfig<TInput, TOutputSchema extends z.ZodType> {
  description: string;
  modelType: LLMType; // 指定模型类型
  dataSchema: TOutputSchema;
  createPrompt: (input: TInput) => string;
}

export function createAITool<TInput, TOutputSchema extends z.ZodType>(
  config: AIToolConfig<TInput, TOutputSchema>
) {
  const responseSchema = z.object({
    success: z.boolean().describe('是否成功提取或生成了所要求的信息'),
    reasoning: z.string().optional().describe('如果 success 为 false，在这里简要说明失败原因'),
    data: config.dataSchema.nullable().describe('生成结果'),
  });
  type AIResponseType = {
    success: boolean;
    reasoning: string;
    data: z.infer<TOutputSchema> | null;
  };
  return {
    modelType: config.modelType,
    async execute(input: TInput): Promise<z.infer<TOutputSchema>> {
      console.log(`🤖 AI Tool executing: "${config.description}"...`);
      const fullPrompt = config.createPrompt(input);
      //       const fullPrompt = `
      // ${config.createPrompt(input)}
      // ---
      // 任务指令: 分析以上内容。根据你是否能成功提取或生成所需信息，以指定的 JSON 格式返回结果。
      // - 成功: 'success' 设为 true, 在 'data' 字段中提供结果。
      // - 失败: 'success' 设为 false, 在 'reasoning' 字段中简要说明原因。`;

      const currentService = getAiModel(config.modelType);

      try {
        const result = await currentService.generateObject({
          schema: responseSchema, prompt: fullPrompt
        });

        const aiResponse = result.object as AIResponseType;
        if (!aiResponse.success || aiResponse.data === null) {
          throw new Error(`AI 报告任务失败: ${aiResponse.reasoning || '未提供有效数据'}`);
        }
        return aiResponse.data;
      } catch (error) {
        throw new Error(`执行 "${config.description}" 工具时出错: ${(error as Error).message}`);
      }
    }
  };
}