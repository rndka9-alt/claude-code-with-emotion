import type {
  AvailableVisualOptions,
  VisualAssetCatalog,
} from './visual-assets';

export interface VisualAssetBridge {
  getAvailableOptions: () => Promise<AvailableVisualOptions>;
  getCatalog: () => Promise<VisualAssetCatalog>;
  onCatalog: (listener: (catalog: VisualAssetCatalog) => void) => () => void;
  saveCatalog: (catalog: VisualAssetCatalog) => Promise<VisualAssetCatalog>;
}

export const VISUAL_ASSET_CHANNELS: {
  availableOptions: string;
  catalog: string;
  getAvailableOptions: string;
  getCatalog: string;
  saveCatalog: string;
} = {
  availableOptions: 'visual-assets:available-options',
  catalog: 'visual-assets:catalog',
  getAvailableOptions: 'visual-assets:get-catalog-options',
  getCatalog: 'visual-assets:get-catalog',
  saveCatalog: 'visual-assets:save-catalog',
};
