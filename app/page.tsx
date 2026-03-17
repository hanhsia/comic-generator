'use client';

import { useMemo, useState } from 'react';
import { ComicPanelCard } from '@/components/ComicPanelCard';
import type { CharacterAnchor, ComicGenerationResponse, StylePreset } from '@/lib/types';

const DEFAULT_STORY = '深夜的便利店里，一只会说话的橘猫突然跳上收银台，告诉疲惫的店员今天月亮会掉下来。店员半信半疑，却在凌晨三点听见屋顶传来像玻璃碎裂一样的声音。';

const STYLE_OPTIONS: Array<{ value: StylePreset; label: string; description: string }> = [
  { value: 'manga', label: 'Manga', description: '黑白漫画感、情绪夸张、速度线明显。' },
  { value: 'storyboard', label: 'Storyboard', description: '偏影视故事板，强调调度与镜头说明。' },
  { value: 'newspaper-strip', label: 'Newspaper Strip', description: '简洁连载条漫，角色辨识度优先。' },
  { value: 'cinematic', label: 'Cinematic', description: '电影感光影和镜头语言更强。' }
];

const EMPTY_CHARACTER = (): CharacterAnchor => ({
  id: `char-${Math.random().toString(36).slice(2, 10)}`,
  name: '',
  appearance: '',
  traits: ''
});

export default function HomePage() {
  const [story, setStory] = useState(DEFAULT_STORY);
  const [panelCount, setPanelCount] = useState(4);
  const [stylePreset, setStylePreset] = useState<StylePreset>('cinematic');
  const [characters, setCharacters] = useState<CharacterAnchor[]>([EMPTY_CHARACTER()]);
  const [result, setResult] = useState<ComicGenerationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeCharacters = useMemo(() => {
    return characters.filter((character) => character.name || character.appearance || character.traits);
  }, [characters]);

  const helperText = useMemo(() => {
    const styleLabel = STYLE_OPTIONS.find((option) => option.value === stylePreset)?.label ?? stylePreset;
    return `建议输入一个有明确角色、场景和转折的小故事。当前目标：${panelCount} 格 · 风格：${styleLabel} · 角色锚点：${activeCharacters.length} 个。`;
  }, [activeCharacters.length, panelCount, stylePreset]);

  function updateCharacter(id: string, field: keyof Omit<CharacterAnchor, 'id'>, value: string) {
    setCharacters((current) =>
      current.map((character) =>
        character.id === id
          ? {
              ...character,
              [field]: value
            }
          : character
      )
    );
  }

  function addCharacter() {
    setCharacters((current) => [...current, EMPTY_CHARACTER()]);
  }

  function removeCharacter(id: string) {
    setCharacters((current) => {
      if (current.length === 1) {
        return [EMPTY_CHARACTER()];
      }

      return current.filter((character) => character.id !== id);
    });
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/generate-comic', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ story, panelCount, stylePreset, characters: activeCharacters })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '生成失败');
      }

      setResult(data);
    } catch (submitError) {
      setResult(null);
      setError(submitError instanceof Error ? submitError.message : '生成失败');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <section className="hero">
        <div className="hero-card">
          <h1>Comic Generator</h1>
          <p>
            输入一句故事设定，选择画面风格，再补充角色锚点。应用会先生成带风格约束的分镜脚本，
            再逐格细化图片提示词并尝试生成图片；如果图片接口不可用，也会保留提示词和分镜内容。
          </p>

          <form className="form-grid" onSubmit={onSubmit}>
            <div className="field">
              <label htmlFor="story">故事 / 设定</label>
              <textarea
                id="story"
                name="story"
                value={story}
                onChange={(event) => setStory(event.target.value)}
                placeholder="例如：退休机器人在海边修理一台捡来的老式收音机，却意外收到来自过去的求救信号。"
              />
            </div>

            <div className="field-row two-up">
              <div className="field">
                <label htmlFor="panelCount">目标格数（2 - 8，可选）</label>
                <input
                  id="panelCount"
                  name="panelCount"
                  type="number"
                  min={2}
                  max={8}
                  value={panelCount}
                  onChange={(event) => setPanelCount(Number(event.target.value) || 4)}
                />
              </div>

              <div className="field">
                <label htmlFor="stylePreset">风格预设</label>
                <select
                  id="stylePreset"
                  name="stylePreset"
                  value={stylePreset}
                  onChange={(event) => setStylePreset(event.target.value as StylePreset)}
                >
                  {STYLE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="style-grid">
              {STYLE_OPTIONS.map((option) => (
                <label key={option.value} className={`style-card ${stylePreset === option.value ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="stylePresetCards"
                    value={option.value}
                    checked={stylePreset === option.value}
                    onChange={() => setStylePreset(option.value)}
                  />
                  <strong>{option.label}</strong>
                  <span>{option.description}</span>
                </label>
              ))}
            </div>

            <div className="field">
              <div className="section-heading">
                <label>角色锚点（可选）</label>
                <button type="button" className="secondary" onClick={addCharacter}>
                  + 添加角色
                </button>
              </div>
              <div className="character-list">
                {characters.map((character, index) => (
                  <div key={character.id} className="character-card">
                    <div className="section-heading">
                      <strong>角色 {index + 1}</strong>
                      <button type="button" className="tertiary" onClick={() => removeCharacter(character.id)}>
                        删除
                      </button>
                    </div>
                    <div className="field-row three-up">
                      <div className="field">
                        <label htmlFor={`${character.id}-name`}>名称</label>
                        <input
                          id={`${character.id}-name`}
                          value={character.name}
                          onChange={(event) => updateCharacter(character.id, 'name', event.target.value)}
                          placeholder="橘猫阿姜"
                        />
                      </div>
                      <div className="field">
                        <label htmlFor={`${character.id}-appearance`}>外观</label>
                        <input
                          id={`${character.id}-appearance`}
                          value={character.appearance}
                          onChange={(event) => updateCharacter(character.id, 'appearance', event.target.value)}
                          placeholder="胖乎乎、橘白相间、戴旧领结"
                        />
                      </div>
                      <div className="field">
                        <label htmlFor={`${character.id}-traits`}>特征 / 性格</label>
                        <input
                          id={`${character.id}-traits`}
                          value={character.traits}
                          onChange={(event) => updateCharacter(character.id, 'traits', event.target.value)}
                          placeholder="毒舌但可靠，讲话像深夜电台主持人"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="actions">
              <button className="primary" type="submit" disabled={loading}>
                {loading ? '生成中…' : '生成漫画'}
              </button>
              <div className="meta">{helperText}</div>
            </div>
          </form>

          {error ? <div className="error" style={{ marginTop: 16 }}>{error}</div> : null}
        </div>
      </section>

      {loading ? <section className="results"><div className="result-card"><div className="notice">正在调用模型生成分镜、细化提示词与图片，请稍等。</div></div></section> : null}

      {result ? (
        <section className="results">
          <div className="result-card">
            <h2 style={{ marginTop: 0, marginBottom: 10 }}>{result.title}</h2>
            <p className="panel-copy">{result.summary}</p>
            <div className="summary-grid">
              <div className="summary-chip">
                <strong>当前风格</strong>
                <span>{STYLE_OPTIONS.find((option) => option.value === result.stylePreset)?.label ?? result.stylePreset}</span>
              </div>
              <div className="summary-chip">
                <strong>角色锚点</strong>
                <span>{result.characters.length > 0 ? `${result.characters.length} 个` : '未提供'}</span>
              </div>
            </div>

            {result.characters.length > 0 ? (
              <div className="character-summary-grid">
                {result.characters.map((character) => (
                  <div key={character.id} className="character-summary-card">
                    <strong>{character.name}</strong>
                    <p className="panel-copy">外观：{character.appearance}</p>
                    <p className="panel-copy">特征：{character.traits}</p>
                  </div>
                ))}
              </div>
            ) : null}

            <p className="footer-note">
              文本模型：{result.model}
              {result.imageModel ? ` · 图片模型：${result.imageModel}` : ''}
            </p>
            {result.usedFallbackImages ? (
              <div className="notice" style={{ marginTop: 16 }}>
                部分或全部图片已自动回退为提示词预览卡，分镜结果仍可继续使用。
              </div>
            ) : null}
            {result.warnings.length > 0 ? (
              <div className="notice" style={{ marginTop: 16 }}>
                {result.warnings.map((warning) => (
                  <div key={warning}>{warning}</div>
                ))}
              </div>
            ) : null}
          </div>

          <div className="panel-grid">
            {result.panels.map((panel) => (
              <ComicPanelCard key={panel.id} panel={panel} />
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
