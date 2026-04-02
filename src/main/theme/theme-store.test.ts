import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ThemeStore } from './theme-store';

describe('ThemeStore', () => {
  it('initializes with the default theme when no file exists', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-theme-store-'));
    const store = new ThemeStore(path.join(tempDir, 'app-theme.json'));

    expect(store.getSelection()).toEqual({
      themeId: 'current-dark',
    });
  });

  it('sanitizes invalid theme ids when saving', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-theme-store-'));
    const filePath = path.join(tempDir, 'app-theme.json');

    fs.writeFileSync(
      filePath,
      JSON.stringify({ themeId: 'totally-broken-theme' }, null, 2),
      'utf8',
    );

    const store = new ThemeStore(filePath);

    const savedSelection = store.getSelection();

    expect(savedSelection).toEqual({
      themeId: 'current-dark',
    });
  });
});
