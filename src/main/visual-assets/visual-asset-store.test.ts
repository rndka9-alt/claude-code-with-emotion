import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { VisualAssetStore } from './visual-asset-store';

describe('VisualAssetStore', () => {
  it('starts empty when the catalog file does not exist yet', () => {
    const filePath = path.join(
      fs.mkdtempSync(path.join(os.tmpdir(), 'visual-asset-store-empty-')),
      'visual-assets.json',
    );
    const store = new VisualAssetStore(filePath);

    expect(store.getCatalog()).toEqual({
      version: 1,
      assets: [],
      mappings: [],
    });
  });

  it('sanitizes and persists the catalog to disk', () => {
    const directoryPath = fs.mkdtempSync(
      path.join(os.tmpdir(), 'visual-asset-store-write-'),
    );
    const filePath = path.join(directoryPath, 'visual-assets.json');
    const store = new VisualAssetStore(filePath);

    const savedCatalog = store.replaceCatalog({
      version: 1,
      assets: [
        {
          id: 'asset-working',
          kind: 'image',
          label: 'Working',
          path: '/tmp/working.png',
        },
      ],
      mappings: [
        {
          assetId: 'asset-working',
          state: 'working',
        },
        {
          assetId: 'missing-asset',
          emotion: 'happy',
        },
      ],
    });

    expect(savedCatalog.mappings).toEqual([
      {
        assetId: 'asset-working',
        state: 'working',
      },
    ]);
    expect(JSON.parse(fs.readFileSync(filePath, 'utf8'))).toEqual(savedCatalog);
    expect(store.getAvailableOptions()).toEqual({
      states: ['working'],
      emotions: [],
    });
  });

  it('emits snapshots to subscribers after saving', () => {
    const filePath = path.join(
      fs.mkdtempSync(path.join(os.tmpdir(), 'visual-asset-store-subscribe-')),
      'visual-assets.json',
    );
    const store = new VisualAssetStore(filePath);
    const snapshots: string[] = [];
    const unsubscribe = store.subscribe((catalog) => {
      snapshots.push(`${catalog.assets.length}:${catalog.mappings.length}`);
    });

    store.replaceCatalog({
      version: 1,
      assets: [
        {
          id: 'asset-default',
          isDefault: true,
          kind: 'image',
          label: 'Default',
          path: '/tmp/default.png',
        },
      ],
      mappings: [],
    });

    unsubscribe();

    expect(snapshots).toEqual(['1:0']);
  });
});
