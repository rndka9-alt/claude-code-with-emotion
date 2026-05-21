import { useEffect, useState } from "react";
import {
  createEmptyVisualAssetCatalogStore,
  type VisualAssetCatalog,
  type VisualAssetCatalogStore,
} from "../../../../../shared/visual-assets";
import type { VisualAssetPickerFile } from "../../../../../shared/visual-assets-bridge";

export interface VisualAssetCatalogViewModel {
  catalog: VisualAssetCatalogStore;
  importFiles: (
    filePaths: ReadonlyArray<string>,
  ) => Promise<VisualAssetPickerFile[]>;
  pickFiles: () => Promise<VisualAssetPickerFile[]>;
  saveCatalog: (
    catalog: VisualAssetCatalogStore,
  ) => Promise<VisualAssetCatalogStore>;
}

// 메인 프로세스가 구버전 스키마(필드 누락)로 catalog 를 돌려줄 수 있어서 IPC
// 경계에서 기본값으로 채워 넣음. 그러지 않으면 신규 필드를 iterate 하는 UI 가
// 즉시 throw 해버린다.
function normalizeCatalog(
  catalog: VisualAssetCatalog | VisualAssetCatalogStore,
): VisualAssetCatalogStore {
  const emptyCatalogStore = createEmptyVisualAssetCatalogStore();

  if (!("providers" in catalog)) {
    return {
      version: 1,
      providers: {
        claude: {
          ...catalog,
          useBaseProviderWhenMissing: false,
        },
        codex: emptyCatalogStore.providers.codex,
      },
    };
  }

  return {
    ...catalog,
    providers: {
      claude: catalog.providers.claude ?? emptyCatalogStore.providers.claude,
      codex: catalog.providers.codex ?? emptyCatalogStore.providers.codex,
    },
  };
}

export function useVisualAssetCatalog(): VisualAssetCatalogViewModel {
  const bridge = window.claudeApp?.visualAssets;
  const [catalog, setCatalog] = useState<VisualAssetCatalogStore>(
    createEmptyVisualAssetCatalogStore(),
  );

  useEffect(() => {
    if (bridge === undefined) {
      return;
    }

    let isDisposed = false;

    void bridge.getCatalog().then((nextCatalog) => {
      if (!isDisposed) {
        setCatalog(normalizeCatalog(nextCatalog));
      }
    });

    const unsubscribe = bridge.onCatalog((nextCatalog) => {
      setCatalog(normalizeCatalog(nextCatalog));
    });

    return () => {
      isDisposed = true;
      unsubscribe();
    };
  }, [bridge]);

  return {
    catalog,
    importFiles: async (filePaths) => {
      if (bridge === undefined || filePaths.length === 0) {
        return [];
      }

      return bridge.importFiles(filePaths);
    },
    pickFiles: async () => {
      if (bridge === undefined) {
        return [];
      }

      return bridge.pickFiles();
    },
    saveCatalog: async (nextCatalog) => {
      if (bridge === undefined) {
        setCatalog(normalizeCatalog(nextCatalog));
        return nextCatalog;
      }

      const savedCatalog = await bridge.saveCatalog(nextCatalog);

      setCatalog(normalizeCatalog(savedCatalog));
      return savedCatalog;
    },
  };
}
