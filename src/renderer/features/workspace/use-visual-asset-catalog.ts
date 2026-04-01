import { useEffect, useState } from 'react';
import {
  createEmptyVisualAssetCatalog,
  type VisualAssetCatalog,
} from '../../../shared/visual-assets';

export function useVisualAssetCatalog(): VisualAssetCatalog {
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

  return catalog;
}
