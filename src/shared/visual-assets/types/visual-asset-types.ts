import type {
  VisualEmotionPresetId,
  VisualStatePresetId,
} from "../../visual-presets";

export type VisualAssetProviderId = "claude" | "codex";

export interface VisualAssetProviderOption {
  id: VisualAssetProviderId;
  isBase: boolean;
  label: string;
}

export interface VisualProviderStateMetadata {
  description: string;
  eventNames: ReadonlyArray<string>;
  state: VisualStatePresetId;
}

export interface VisualAssetRecord {
  id: string;
  isDefault?: boolean;
  kind: "image";
  label: string;
  path: string;
}

export interface VisualAssetMapping {
  assetId: string;
  emotion?: VisualEmotionPresetId;
  state?: VisualStatePresetId;
}

export interface VisualStateLineMapping {
  line: string;
  state: VisualStatePresetId;
}

export interface VisualEmotionDescriptionMapping {
  description: string;
  emotion: VisualEmotionPresetId;
}

export interface VisualAssetProviderOverride {
  defaultAssetId: string | undefined;
  emotionDescriptions: ReadonlyArray<VisualEmotionDescriptionMapping>;
  mappings: ReadonlyArray<VisualAssetMapping>;
  stateLines: ReadonlyArray<VisualStateLineMapping>;
  useBaseProviderWhenMissing: boolean;
}

export type VisualAssetProviderOverrides = Partial<
  Record<Exclude<VisualAssetProviderId, "claude">, VisualAssetProviderOverride>
>;

export interface VisualAssetCatalog {
  assets: ReadonlyArray<VisualAssetRecord>;
  emotionDescriptions: ReadonlyArray<VisualEmotionDescriptionMapping>;
  mappings: ReadonlyArray<VisualAssetMapping>;
  providerOverrides?: VisualAssetProviderOverrides;
  stateLines: ReadonlyArray<VisualStateLineMapping>;
  version: 1;
}

export interface VisualAssetResolutionRequest {
  emotion: VisualEmotionPresetId | null;
  state: VisualStatePresetId;
}

export interface VisualAssetResolution {
  asset: VisualAssetRecord;
  mapping: VisualAssetMapping | null;
  match: "default" | "emotion" | "state" | "state-and-emotion";
}

export type VisualEmotionDescriptionOverrides = Partial<
  Record<VisualEmotionPresetId, string>
>;

export interface AvailableVisualOptions {
  emotionDescriptions: VisualEmotionDescriptionOverrides;
  emotions: VisualEmotionPresetId[];
  states: VisualStatePresetId[];
}
