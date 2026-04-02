import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { TerminalOutputStore } from './terminal-output-store';

describe('TerminalOutputStore', () => {
  it('tracks snapshots and flushes terminal output to disk', () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'claude-terminal-output-store-'),
    );
    const filePath = path.join(tempDir, 'session-1.log');
    const store = new TerminalOutputStore(filePath);

    try {
      store.reset();
      expect(store.getSnapshot()).toEqual({ output: '', version: 0 });

      expect(store.append('hello')).toBe(1);
      expect(store.append(' world')).toBe(2);
      expect(store.getSnapshot()).toEqual({
        output: 'hello world',
        version: 2,
      });

      store.dispose();

      expect(fs.readFileSync(filePath, 'utf8')).toBe('hello world');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('trims the stored output to the configured max length', () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'claude-terminal-output-store-'),
    );
    const filePath = path.join(tempDir, 'session-1.log');
    const store = new TerminalOutputStore(filePath, 5);

    try {
      store.reset();
      store.append('hello');
      store.append(' world');

      expect(store.getSnapshot()).toEqual({
        output: 'world',
        version: 2,
      });
    } finally {
      store.dispose();
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
