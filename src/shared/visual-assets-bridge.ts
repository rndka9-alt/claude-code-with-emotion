import type {
  AvailableVisualOptions,
  VisualAssetCatalog,
} from './visual-assets';

export interface VisualAssetPickerFile {
  label: string;
  path: string;
}

export interface VisualAssetBridge {
  getAvailableOptions: () => Promise<AvailableVisualOptions>;
  getCatalog: () => Promise<VisualAssetCatalog>;
  importFiles: (
    filePaths: ReadonlyArray<string>,
  ) => Promise<VisualAssetPickerFile[]>;
  onCatalog: (listener: (catalog: VisualAssetCatalog) => void) => () => void;
  pickFiles: () => Promise<VisualAssetPickerFile[]>;
  printAvailableOptions: () => Promise<AvailableVisualOptions>;
  saveCatalog: (catalog: VisualAssetCatalog) => Promise<VisualAssetCatalog>;
}

export const VISUAL_ASSET_CHANNELS: {
  availableOptions: string;
  catalog: string;
  getAvailableOptions: string;
  getCatalog: string;
  importFiles: string;
  pickFiles: string;
  printAvailableOptions: string;
  saveCatalog: string;
} = {
  availableOptions: 'visual-assets:available-options',
  catalog: 'visual-assets:catalog',
  getAvailableOptions: 'visual-assets:get-catalog-options',
  getCatalog: 'visual-assets:get-catalog',
  importFiles: 'visual-assets:import-files',
  pickFiles: 'visual-assets:pick-files',
  printAvailableOptions: 'visual-assets:print-available-options',
  saveCatalog: 'visual-assets:save-catalog',
};
