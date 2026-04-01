import { useEffect, useState } from 'react';
import {
  createEmptyVisualAssetCatalog,
  type VisualAssetCatalog,
} from '../../../shared/visual-assets';
import type { VisualAssetPickerFile } from '../../../shared/visual-assets-bridge';

export interface VisualAssetCatalogViewModel {
  catalog: VisualAssetCatalog;
  pickFiles: () => Promise<VisualAssetPickerFile[]>;
  saveCatalog: (catalog: VisualAssetCatalog) => Promise<VisualAssetCatalog>;
}

export function useVisualAssetCatalog(): VisualAssetCatalogViewModel {
  const bridge = window.claudeApp?.visualAssets;
  const [catalog, setCatalog] = useState<VisualAssetCatalog>(
    createEmptyVisualAssetCatalog(),
  );

  useEffect(() => {
    if (bridge === undefined) {
      return;
    }

    let isDisposed = false;

    void bridge.getCatalog().then((nextCatalog) => {
      if (!isDisposed) {
        setCatalog(nextCatalog);
      }
    });

    const unsubscribe = bridge.onCatalog((nextCatalog) => {
      setCatalog(nextCatalog);
    });

    return () => {
      isDisposed = true;
      unsubscribe();
    };
  }, [bridge]);

  return {
    catalog,
    pickFiles: async () => {
      if (bridge === undefined) {
        return [];
      }

      return bridge.pickFiles();
    },
    saveCatalog: async (nextCatalog) => {
      if (bridge === undefined) {
        setCatalog(nextCatalog);
        return nextCatalog;
      }

      const savedCatalog = await bridge.saveCatalog(nextCatalog);

      setCatalog(savedCatalog);
      return savedCatalog;
    },
  };
}
