import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

describe('claude-visual-state', () => {
  it('writes an emotion overlay payload', () => {
    const overlayFilePath = path.join(
      fs.mkdtempSync(path.join(os.tmpdir(), 'claude-visual-overlay-')),
      'overlay.json',
    );
    const result = spawnSync('node', ['./bin/claude-visual-state', '--emotion', 'sad'], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        CLAUDE_WITH_EMOTION_VISUAL_OVERLAY_FILE: overlayFilePath,
      },
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    expect(JSON.parse(fs.readFileSync(overlayFilePath, 'utf8'))).toEqual({
      emotion: 'sad',
    });
  });

  it('clears the emotion overlay when neutral is requested', () => {
    const overlayFilePath = path.join(
      fs.mkdtempSync(path.join(os.tmpdir(), 'claude-visual-overlay-')),
      'overlay.json',
    );
    const result = spawnSync(
      'node',
      ['./bin/claude-visual-state', '--emotion', 'neutral'],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          CLAUDE_WITH_EMOTION_VISUAL_OVERLAY_FILE: overlayFilePath,
        },
        encoding: 'utf8',
      },
    );

    expect(result.status).toBe(0);
    expect(JSON.parse(fs.readFileSync(overlayFilePath, 'utf8'))).toEqual({
      emotion: null,
    });
  });

  it('writes and clears a visual line overlay payload', () => {
    const overlayFilePath = path.join(
      fs.mkdtempSync(path.join(os.tmpdir(), 'claude-visual-overlay-')),
      'overlay.json',
    );
    const setResult = spawnSync(
      'node',
      ['./bin/claude-visual-state', '--line', '문제를 더 파볼게요!'],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          CLAUDE_WITH_EMOTION_VISUAL_OVERLAY_FILE: overlayFilePath,
        },
        encoding: 'utf8',
      },
    );

    expect(setResult.status).toBe(0);
    expect(JSON.parse(fs.readFileSync(overlayFilePath, 'utf8'))).toEqual({
      line: '문제를 더 파볼게요!',
    });

    const clearResult = spawnSync(
      'node',
      ['./bin/claude-visual-state', '--clear-line'],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          CLAUDE_WITH_EMOTION_VISUAL_OVERLAY_FILE: overlayFilePath,
        },
        encoding: 'utf8',
      },
    );

    expect(clearResult.status).toBe(0);
    expect(JSON.parse(fs.readFileSync(overlayFilePath, 'utf8'))).toEqual({
      line: null,
    });
  });
});
