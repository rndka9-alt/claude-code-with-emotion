import {
  mergePickedVisualAssets,
  removeVisualAsset,
  setVisualAssetDefault,
  setVisualAssetEmotionMapping,
  setVisualAssetStateEmotionMapping,
  setVisualAssetStateMapping,
} from './visual-asset-catalog-edits';

describe('visual asset catalog edits', () => {
  it('merges picked files without duplicating existing paths', () => {
    const catalog = mergePickedVisualAssets(
      {
        version: 1,
        assets: [
          {
            id: 'asset-a',
            kind: 'image',
            label: 'A',
            path: '/tmp/a.png',
          },
        ],
        mappings: [],
      },
      [
        {
          label: 'A again',
          path: '/tmp/a.png',
        },
        {
          label: 'B',
          path: '/tmp/b.png',
        },
      ],
      () => 'asset-b',
    );

    expect(catalog.assets.map((asset) => asset.id)).toEqual([
      'asset-a',
      'asset-b',
    ]);
  });

  it('keeps only one default asset at a time', () => {
    const catalog = setVisualAssetDefault(
      {
        version: 1,
        assets: [
          {
            id: 'asset-a',
            isDefault: true,
            kind: 'image',
            label: 'A',
            path: '/tmp/a.png',
          },
          {
            id: 'asset-b',
            kind: 'image',
            label: 'B',
            path: '/tmp/b.png',
          },
        ],
        mappings: [],
      },
      'asset-b',
      true,
    );

    expect(catalog.assets).toEqual([
      {
        id: 'asset-a',
        isDefault: false,
        kind: 'image',
        label: 'A',
        path: '/tmp/a.png',
      },
      {
        id: 'asset-b',
        isDefault: true,
        kind: 'image',
        label: 'B',
        path: '/tmp/b.png',
      },
    ]);
  });

  it('adds and removes state-only and emotion-only mappings independently', () => {
    const withState = setVisualAssetStateMapping(
      {
        version: 1,
        assets: [
          {
            id: 'asset-a',
            kind: 'image',
            label: 'A',
            path: '/tmp/a.png',
          },
        ],
        mappings: [],
      },
      'asset-a',
      'working',
      true,
    );
    const withEmotion = setVisualAssetEmotionMapping(
      withState,
      'asset-a',
      'happy',
      true,
    );
    const withoutState = setVisualAssetStateMapping(
      withEmotion,
      'asset-a',
      'working',
      false,
    );

    expect(withEmotion.mappings).toEqual([
      {
        assetId: 'asset-a',
        state: 'working',
      },
      {
        assetId: 'asset-a',
        emotion: 'happy',
      },
    ]);
    expect(withoutState.mappings).toEqual([
      {
        assetId: 'asset-a',
        emotion: 'happy',
      },
    ]);
  });

  it('removes asset mappings together with the asset', () => {
    const catalog = removeVisualAsset(
      {
        version: 1,
        assets: [
          {
            id: 'asset-a',
            kind: 'image',
            label: 'A',
            path: '/tmp/a.png',
          },
        ],
        mappings: [
          {
            assetId: 'asset-a',
            state: 'working',
          },
        ],
      },
      'asset-a',
    );

    expect(catalog).toEqual({
      version: 1,
      assets: [],
      mappings: [],
    });
  });

  it('adds and removes exact state-and-emotion mappings independently', () => {
    const withPair = setVisualAssetStateEmotionMapping(
      {
        version: 1,
        assets: [
          {
            id: 'asset-a',
            kind: 'image',
            label: 'A',
            path: '/tmp/a.png',
          },
        ],
        mappings: [],
      },
      'asset-a',
      'working',
      'sad',
      true,
    );
    const withoutPair = setVisualAssetStateEmotionMapping(
      withPair,
      'asset-a',
      'working',
      'sad',
      false,
    );

    expect(withPair.mappings).toEqual([
      {
        assetId: 'asset-a',
        state: 'working',
        emotion: 'sad',
      },
    ]);
    expect(withoutPair.mappings).toEqual([]);
  });
});
