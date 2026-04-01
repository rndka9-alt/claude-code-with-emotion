import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  buildClaudeHookCommand,
  createClaudeHooksSettings,
  ensureClaudeHooksSettingsFile,
} from './claude-hooks-settings';

describe('claude hooks settings', () => {
  it('builds absolute hook commands for Claude event hooks', () => {
    const command = buildClaudeHookCommand(
      '/tmp/helper-bin',
      'UserPromptSubmit',
    );

    expect(command).toBe(
      "'/tmp/helper-bin/claude-session-hook' 'UserPromptSubmit'",
    );
  });

  it('creates event hook settings for the Claude session lifecycle', () => {
    const settings = createClaudeHooksSettings('/tmp/helper-bin');

    expect(settings.hooks.SessionStart[0]?.hooks[0]?.command).toContain(
      'SessionStart',
    );
    expect(settings.hooks.UserPromptSubmit[0]?.hooks[0]?.command).toContain(
      'UserPromptSubmit',
    );
    expect(settings.hooks.PreToolUse[0]?.hooks[0]?.command).toContain(
      'PreToolUse',
    );
    expect(settings.hooks.PostToolUse[0]?.hooks[0]?.command).toContain(
      'PostToolUse',
    );
    expect(settings.hooks.Stop[0]?.hooks[0]?.command).toContain('Stop');
    expect(settings.hooks.StopFailure[0]?.hooks[0]?.command).toContain(
      'StopFailure',
    );
    expect(settings.hooks.SessionEnd[0]?.hooks[0]?.command).toContain(
      'SessionEnd',
    );
  });

  it('writes a reusable settings file for the current user home', () => {
    const tempHome = fs.mkdtempSync(
      path.join(os.tmpdir(), 'claude-with-emotion-hooks-home-'),
    );

    try {
      const settingsFilePath = ensureClaudeHooksSettingsFile(
        '/tmp/helper-bin',
        tempHome,
      );
      const settingsFile = fs.readFileSync(settingsFilePath, 'utf8');

      expect(settingsFile).toContain('"SessionStart"');
      expect(settingsFile).toContain('claude-session-hook');
      expect(settingsFile).toContain('UserPromptSubmit');
    } finally {
      fs.rmSync(tempHome, { recursive: true, force: true });
    }
  });
});
