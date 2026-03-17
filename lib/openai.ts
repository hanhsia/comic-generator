import OpenAI from 'openai';
import { z } from 'zod';
import type {
  CharacterAnchor,
  ComicGenerationRequest,
  ComicGenerationResponse,
  ComicPanel,
  StylePreset
} from '@/lib/types';

const DEFAULT_TEXT_MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-mini';
const DEFAULT_IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1';
const DEFAULT_STYLE_PRESET: StylePreset = 'cinematic';

const stylePresetGuides: Record<StylePreset, string> = {
  manga: '黑白漫画感、强烈明暗对比、夸张速度线、清晰情绪表演、适合日漫分镜。',
  storyboard: '像影视故事板，重视镜头调度、构图说明、动作 blocking，可略带草图感。',
  'newspaper-strip': '报纸连载条漫风格，信息密度高、角色辨识度强、画面简洁、叙事清楚。',
  cinematic: '电影感强、镜头语言明确、光影层次丰富、场景氛围沉浸。'
};

const scriptPanelSchema = z.object({
  index: z.number().int().min(1),
  title: z.string().min(1),
  caption: z.string().min(1),
  dialogue: z.string().optional().default(''),
  visualSummary: z.string().min(1),
  shotType: z.string().min(1),
  characterNames: z.array(z.string()).default([])
});

const comicSchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(1),
  panels: z.array(scriptPanelSchema).min(1).max(8)
});

const panelImagePromptSchema = z.object({
  imagePrompt: z.string().min(1),
  rerunHint: z.string().min(1)
});

type ParsedComic = z.infer<typeof comicSchema>;
type ParsedScriptPanel = ParsedComic['panels'][number];

function getClient() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('缺少 OPENAI_API_KEY，无法调用 OpenAI。');
  }

  return new OpenAI({ apiKey });
}

function toPanelId(index: number) {
  return `panel-${String(index).padStart(2, '0')}`;
}

function normalizeCharacters(characters: CharacterAnchor[] | undefined) {
  return (characters ?? []).filter(
    (character) => character.name.trim() && character.appearance.trim() && character.traits.trim()
  );
}

function formatCharacterBlock(characters: CharacterAnchor[]) {
  if (characters.length === 0) {
    return '无角色锚点。若故事里出现角色，请根据故事自行保持基本一致性。';
  }

  return characters
    .map(
      (character, index) =>
        `${index + 1}. ${character.name}\n   - appearance: ${character.appearance}\n   - traits: ${character.traits}`
    )
    .join('\n');
}

function buildSharedContext({
  story,
  panelCount,
  stylePreset,
  characters
}: {
  story: string;
  panelCount: number;
  stylePreset: StylePreset;
  characters: CharacterAnchor[];
}) {
  return [
    `风格预设：${stylePreset}`,
    `风格说明：${stylePresetGuides[stylePreset]}`,
    `目标格数：${panelCount}`,
    '角色锚点：',
    formatCharacterBlock(characters),
    '',
    `用户故事：${story}`
  ].join('\n');
}

function buildScriptPrompt(input: {
  story: string;
  panelCount: number;
  stylePreset: StylePreset;
  characters: CharacterAnchor[];
}) {
  return [
    '你是一位擅长分镜的漫画编剧。',
    `请基于共享上下文，输出 ${input.panelCount} 格漫画的结构化 JSON。`,
    '必须显式吸收风格预设与角色锚点，让每格都延续相同角色设定与画面气质。',
    '每一格都要有：index、title、caption、dialogue、visualSummary、shotType、characterNames。',
    '要求：',
    '1. 画面推进清晰，角色动作具体。',
    '2. caption 用简洁中文描述当前分镜发生了什么。',
    '3. dialogue 若无对白可为空字符串。',
    '4. visualSummary 描述本格画面核心信息，供后续单独生成图片提示词使用。',
    '5. shotType 写镜头类型或构图方式，例如近景、大全景、仰拍、过肩镜头。',
    '6. characterNames 仅填写本格实际出场的角色名；若无明确角色可为空数组。',
    '7. 只输出 JSON，不要 markdown，不要解释。',
    '',
    buildSharedContext(input)
  ].join('\n');
}

function buildImagePromptPrompt({
  story,
  stylePreset,
  characters,
  panel
}: {
  story: string;
  stylePreset: StylePreset;
  characters: CharacterAnchor[];
  panel: ParsedScriptPanel;
}) {
  return [
    '你是一位漫画图像提示词设计师。',
    '请基于共享上下文与当前单格分镜，为图像模型生成高质量中文提示词。',
    '必须保留角色外观和性格一致性，并体现指定风格预设。',
    '输出 JSON，字段只有：imagePrompt、rerunHint。',
    '要求：',
    '1. imagePrompt 适合作为图像生成提示词，必须包含角色、场景、镜头、情绪、光线、构图、风格约束。',
    '2. 若当前格包含角色锚点中的人物，必须在提示词里重申其外观特征。',
    '3. rerunHint 用一句中文概括本格后续单独重绘时最关键的稳定约束。',
    '4. 只输出 JSON。',
    '',
    `风格预设：${stylePreset}`,
    `风格说明：${stylePresetGuides[stylePreset]}`,
    '角色锚点：',
    formatCharacterBlock(characters),
    '',
    `原始故事：${story}`,
    `当前分镜标题：${panel.title}`,
    `当前分镜说明：${panel.caption}`,
    `当前对白：${panel.dialogue || '无'}`,
    `当前画面摘要：${panel.visualSummary}`,
    `当前镜头：${panel.shotType}`,
    `当前角色：${panel.characterNames.join('、') || '未明确角色'}`
  ].join('\n');
}

async function createStructuredJson<T>(schemaName: string, schema: Record<string, unknown>, prompt: string): Promise<T> {
  const client = getClient();
  const response = await client.responses.create({
    model: DEFAULT_TEXT_MODEL,
    input: [
      {
        role: 'system',
        content: '你输出严格合法的 JSON，不要包含任何额外文本。'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    text: {
      format: {
        type: 'json_schema',
        name: schemaName,
        schema
      }
    }
  });

  const text = response.output_text;
  if (!text) {
    throw new Error('OpenAI 没有返回可解析的 JSON 结果。');
  }

  return JSON.parse(text) as T;
}

async function generateScript(input: {
  story: string;
  panelCount: number;
  stylePreset: StylePreset;
  characters: CharacterAnchor[];
}): Promise<ParsedComic> {
  const parsed = comicSchema.parse(
    await createStructuredJson<unknown>('comic_panels', {
      type: 'object',
      additionalProperties: false,
      properties: {
        title: { type: 'string' },
        summary: { type: 'string' },
        panels: {
          type: 'array',
          minItems: 1,
          maxItems: 8,
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              index: { type: 'integer' },
              title: { type: 'string' },
              caption: { type: 'string' },
              dialogue: { type: 'string' },
              visualSummary: { type: 'string' },
              shotType: { type: 'string' },
              characterNames: {
                type: 'array',
                items: { type: 'string' }
              }
            },
            required: ['index', 'title', 'caption', 'dialogue', 'visualSummary', 'shotType', 'characterNames']
          }
        }
      },
      required: ['title', 'summary', 'panels']
    }, buildScriptPrompt(input))
  );

  return {
    ...parsed,
    panels: parsed.panels.map((panel, idx) => ({
      ...panel,
      index: idx + 1
    }))
  };
}

async function generatePanelImagePrompt(input: {
  story: string;
  stylePreset: StylePreset;
  characters: CharacterAnchor[];
  panel: ParsedScriptPanel;
}) {
  return panelImagePromptSchema.parse(
    await createStructuredJson<unknown>('panel_image_prompt', {
      type: 'object',
      additionalProperties: false,
      properties: {
        imagePrompt: { type: 'string' },
        rerunHint: { type: 'string' }
      },
      required: ['imagePrompt', 'rerunHint']
    }, buildImagePromptPrompt(input))
  );
}

async function generateImage(prompt: string) {
  const client = getClient();
  const result = await client.images.generate({
    model: DEFAULT_IMAGE_MODEL,
    prompt,
    size: '1024x1024'
  });

  const image = result.data?.[0];
  const imageUrl = image?.url;
  const base64 = image?.b64_json;

  if (imageUrl) return imageUrl;
  if (base64) return `data:image/png;base64,${base64}`;

  throw new Error('图像接口没有返回图片数据。');
}

export async function generateComic(request: ComicGenerationRequest): Promise<ComicGenerationResponse> {
  const story = request.story.trim();
  const panelCount = Math.min(Math.max(request.panelCount ?? 4, 2), 8);
  const stylePreset = request.stylePreset ?? DEFAULT_STYLE_PRESET;
  const characters = normalizeCharacters(request.characters);

  if (!story) {
    throw new Error('请输入故事或设定。');
  }

  const script = await generateScript({ story, panelCount, stylePreset, characters });
  const warnings: string[] = [];

  const panels: ComicPanel[] = await Promise.all(
    script.panels.map(async (panel) => {
      const panelId = toPanelId(panel.index);
      const matchingCharacterIds = characters
        .filter((character) => panel.characterNames.includes(character.name))
        .map((character) => character.id);

      let imagePrompt = `${panel.visualSummary}，${stylePresetGuides[stylePreset]}`;
      let rerunHint = '保留当前分镜的主体动作、镜头和情绪。';

      try {
        const promptResult = await generatePanelImagePrompt({
          story,
          stylePreset,
          characters,
          panel
        });
        imagePrompt = promptResult.imagePrompt;
        rerunHint = promptResult.rerunHint;
      } catch (error) {
        const message = error instanceof Error ? error.message : '未知提示词生成错误';
        warnings.push(`第 ${panel.index} 格提示词细化失败，已使用分镜摘要回退：${message}`);
      }

      try {
        const imageUrl = await generateImage(imagePrompt);
        return {
          id: panelId,
          index: panel.index,
          title: panel.title,
          caption: panel.caption,
          dialogue: panel.dialogue || '',
          imagePrompt,
          imageUrl,
          imageStatus: 'generated' as const,
          metadata: {
            panelId,
            scriptIndex: panel.index,
            visualSummary: panel.visualSummary,
            shotType: panel.shotType,
            rerunHint,
            characterAnchorIds: matchingCharacterIds
          }
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : '未知图像生成错误';
        warnings.push(`第 ${panel.index} 格图片生成失败，已回退为提示词预览：${message}`);
        return {
          id: panelId,
          index: panel.index,
          title: panel.title,
          caption: panel.caption,
          dialogue: panel.dialogue || '',
          imagePrompt,
          imageUrl: null,
          imageStatus: 'fallback' as const,
          imageError: message,
          metadata: {
            panelId,
            scriptIndex: panel.index,
            visualSummary: panel.visualSummary,
            shotType: panel.shotType,
            rerunHint,
            characterAnchorIds: matchingCharacterIds
          }
        };
      }
    })
  );

  return {
    title: script.title,
    summary: script.summary,
    stylePreset,
    characters,
    model: DEFAULT_TEXT_MODEL,
    imageModel: DEFAULT_IMAGE_MODEL,
    usedFallbackImages: panels.some((panel) => panel.imageStatus === 'fallback'),
    panels,
    warnings
  };
}
