import {
  applyInputBuffer,
  createBootstrapOutput,
  MockTerminalService,
} from './mock-terminal-service';

describe('createBootstrapOutput', () => {
  it('returns a seeded transcript for a new terminal surface', () => {
    const result = createBootstrapOutput({
      sessionId: 'session-1',
      title: 'demo session',
      cwd: '/tmp/demo',
      command: 'claude',
    });

    expect(result.initialOutput).toContain('demo session');
    expect(result.initialOutput).toContain('/tmp/demo');
    expect(result.initialOutput).toContain('[demo session]$');
  });
});

describe('applyInputBuffer', () => {
  it('echoes typed characters and resets the buffer on enter', () => {
    const result = applyInputBuffer('hel', 'lo\r', '[demo]$ ');

    expect(result.nextBuffer).toBe('');
    expect(result.output).toContain('lo');
    expect(result.output).toContain('mock exec: hello');
  });
});

describe('MockTerminalService', () => {
  it('reuses sessions after bootstrap and emits output for input', () => {
    const service = new MockTerminalService();

    service.bootstrapSession({
      sessionId: 'session-2',
      title: 'second session',
      cwd: '/tmp/app',
      command: 'claude',
    });

    const output = service.handleInput({
      sessionId: 'session-2',
      data: 'pwd\r',
    });

    expect(output).toContain('pwd');
    expect(output).toContain('PTY bridge pending');
  });
});
