import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

interface HookInvocationResult {
  statusFilePath: string;
  traceFilePath: string;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function invokeHook(
  eventName: string,
  payload: Record<string, unknown>,
): HookInvocationResult {
  const statusFilePath = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), 'claude-hook-status-')),
    'status.json',
  );
  const traceFilePath = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), 'claude-hook-trace-')),
    'trace.log',
  );
  const helperBinDir = path.resolve(process.cwd(), 'bin');
  const result = spawnSync('node', ['./bin/claude-session-hook', eventName], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      CLAUDE_WITH_EMOTION_STATUS_FILE: statusFilePath,
      CLAUDE_WITH_EMOTION_TRACE_FILE: traceFilePath,
      CLAUDE_WITH_EMOTION_HELPER_BIN_DIR: helperBinDir,
    },
    input: JSON.stringify(payload),
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    throw new Error(
      `Hook invocation failed for ${eventName}: ${result.stderr || result.stdout}`,
    );
  }

  return {
    statusFilePath,
    traceFilePath,
  };
}

function readStatusFile(statusFilePath: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(fs.readFileSync(statusFilePath, 'utf8'));

  if (!isObjectRecord(parsed)) {
    throw new Error('Expected hook status file to contain an object payload');
  }

  return parsed;
}

describe('claude-session-hook', () => {
  it('maps PermissionRequest into a waiting state', () => {
    const result = invokeHook('PermissionRequest', {
      tool_name: 'Bash',
    });
    const status = readStatusFile(result.statusFilePath);

    expect(status.state).toBe('waiting');
    expect(status.line).toBe('권한 확인 기다리는 중이에요...!');
    expect(status.currentTask).toBe('Waiting on permission for Bash');
    expect(status.durationMs).toBe(12000);
  });

  it('maps Notification into a surprised transient state', () => {
    const result = invokeHook('Notification', {
      message: 'Build completed successfully',
    });
    const status = readStatusFile(result.statusFilePath);

    expect(status.state).toBe('surprised');
    expect(status.line).toBe('새 알림이 와서 확인 중이에요...!');
    expect(status.currentTask).toBe(
      'Notification: Build completed successfully',
    );
    expect(status.durationMs).toBe(3500);
  });

  it('maps TaskCompleted into a happy transient state', () => {
    const result = invokeHook('TaskCompleted', {
      description: 'Finished updating the renderer layout',
    });
    const status = readStatusFile(result.statusFilePath);

    expect(status.state).toBe('happy');
    expect(status.line).toBe('작업 하나를 마무리햇어요...!');
    expect(status.currentTask).toBe(
      'Task: Finished updating the renderer layout',
    );
    expect(status.durationMs).toBe(4500);
  });
});
