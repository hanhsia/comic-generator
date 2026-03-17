import { NextResponse } from 'next/server';
import { z } from 'zod';
import { generateComic } from '@/lib/openai';

const stylePresetSchema = z.enum(['manga', 'storyboard', 'newspaper-strip', 'cinematic']);

const characterSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, '角色名称不能为空').max(80),
  appearance: z.string().min(1, '角色外观不能为空').max(400),
  traits: z.string().min(1, '角色特征不能为空').max(400)
});

const requestSchema = z.object({
  story: z.string().min(1, '请输入故事内容'),
  panelCount: z.number().int().min(2).max(8).optional(),
  stylePreset: stylePresetSchema.optional(),
  characters: z.array(characterSchema).max(6).optional()
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = requestSchema.parse({
      story: typeof body.story === 'string' ? body.story.trim() : body.story,
      panelCount: typeof body.panelCount === 'number' ? body.panelCount : undefined,
      stylePreset: typeof body.stylePreset === 'string' ? body.stylePreset : undefined,
      characters: Array.isArray(body.characters)
        ? body.characters
            .map((character: unknown) => {
              const item = (character ?? {}) as Record<string, unknown>;
              return {
                id: typeof item.id === 'string' ? item.id : '',
                name: typeof item.name === 'string' ? item.name.trim() : '',
                appearance: typeof item.appearance === 'string' ? item.appearance.trim() : '',
                traits: typeof item.traits === 'string' ? item.traits.trim() : ''
              };
            })
            .filter((character: { name: string; appearance: string; traits: string }) => character.name || character.appearance || character.traits)
        : undefined
    });

    const result = await generateComic(parsed);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || '请求参数无效。' },
        { status: 400 }
      );
    }

    const message = error instanceof Error ? error.message : '生成失败，请稍后重试。';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
