export type ImageStatus = 'generated' | 'fallback';

export type StylePreset = 'manga' | 'storyboard' | 'newspaper-strip' | 'cinematic';

export interface CharacterAnchor {
  id: string;
  name: string;
  appearance: string;
  traits: string;
}

export interface PanelGenerationMetadata {
  panelId: string;
  scriptIndex: number;
  visualSummary: string;
  shotType: string;
  rerunHint: string;
  characterAnchorIds: string[];
}

export interface ComicPanel {
  id: string;
  index: number;
  title: string;
  caption: string;
  dialogue?: string;
  imagePrompt: string;
  imageUrl?: string | null;
  imageStatus: ImageStatus;
  imageError?: string;
  metadata: PanelGenerationMetadata;
}

export interface ComicGenerationResponse {
  title: string;
  summary: string;
  stylePreset: StylePreset;
  characters: CharacterAnchor[];
  model: string;
  imageModel?: string;
  usedFallbackImages: boolean;
  panels: ComicPanel[];
  warnings: string[];
}

export interface ComicGenerationRequest {
  story: string;
  panelCount?: number;
  stylePreset?: StylePreset;
  characters?: CharacterAnchor[];
}
