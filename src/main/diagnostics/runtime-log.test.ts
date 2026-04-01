import { mkdtempSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  createRuntimeLog,
  formatRuntimeLogLine,
  resolveRuntimeLogPath,
} from './runtime-log';

describe('resolveRuntimeLogPath', () => {
  it('uses a workspace path in development', () => {
    expect(
      resolveRuntimeLogPath('/tmp/app', '/tmp/user-data', false),
    ).toBe('/tmp/app/.runtime-logs/electron-dev.log');
  });

  it('uses the user-data logs path in packaged mode', () => {
    expect(
      resolveRuntimeLogPath('/tmp/app', '/tmp/user-data', true),
    ).toBe('/tmp/user-data/logs/electron-runtime.log');
  });
});

describe('formatRuntimeLogLine', () => {
  it('formats a timestamped runtime log line', () => {
    expect(
      formatRuntimeLogLine(
        'renderer',
        'booted',
        new Date('2026-04-01T00:00:00.000Z'),
      ),
    ).toBe('[2026-04-01T00:00:00.000Z] [renderer] booted\n');
  });
});

describe('createRuntimeLog', () => {
  it('writes messages and error stacks to disk', () => {
    const tempDir = mkdtempSync(path.join(os.tmpdir(), 'runtime-log-test-'));
    const filePath = path.join(tempDir, 'logs', 'runtime.log');
    const runtimeLog = createRuntimeLog(filePath);

    runtimeLog.write('main', 'boot');
    runtimeLog.writeError('renderer', new Error('boom'));

    const contents = readFileSync(filePath, 'utf8');

    expect(contents).toContain('[main] boot');
    expect(contents).toContain('[renderer] Error: boom');
  });
});
