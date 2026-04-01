import { render } from '@testing-library/react';
import { TerminalSurface } from './TerminalSurface';

const { MockTerminal, terminalInstances } = vi.hoisted(() => {
  const hoistedTerminalInstances: Array<{
    attachCustomKeyEventHandler: ReturnType<typeof vi.fn>;
    cols: number;
    dispose: ReturnType<typeof vi.fn>;
    focus: ReturnType<typeof vi.fn>;
    onData: ReturnType<typeof vi.fn>;
    onTitleChange: ReturnType<typeof vi.fn>;
    open: ReturnType<typeof vi.fn>;
    options: { scrollback: number };
    resize: ReturnType<typeof vi.fn>;
    rows: number;
    write: ReturnType<typeof vi.fn>;
  }> = [];

  class HoistedMockTerminal {
    cols = 80;
    rows = 24;
    options = { scrollback: 1000 };
    focus = vi.fn();
    open = vi.fn();
    resize = vi.fn((cols: number, rows: number) => {
      this.cols = cols;
      this.rows = rows;
    });
    write = vi.fn();
    dispose = vi.fn();
    attachCustomKeyEventHandler = vi.fn();
    onData = vi.fn(() => ({ dispose: vi.fn() }));
    onTitleChange = vi.fn(() => ({ dispose: vi.fn() }));

    constructor() {
      hoistedTerminalInstances.push(this);
    }
  }

  return {
    MockTerminal: HoistedMockTerminal,
    terminalInstances: hoistedTerminalInstances,
  };
});

vi.mock('@xterm/xterm', () => {
  return {
    Terminal: MockTerminal,
  };
});

describe('TerminalSurface', () => {
  beforeEach(() => {
    terminalInstances.length = 0;

    Object.defineProperty(window, 'claudeApp', {
      configurable: true,
      value: {
        terminals: {
          bootstrapSession: vi.fn().mockResolvedValue({}),
          sendInput: vi.fn().mockResolvedValue(undefined),
          resizeSession: vi.fn().mockResolvedValue(undefined),
          closeSession: vi.fn().mockResolvedValue(undefined),
          onOutput: vi.fn(() => () => {}),
          onExit: vi.fn(() => () => {}),
        },
      },
    });
  });

  it('refocuses the terminal when the focus request key changes', () => {
    const session = {
      id: 'session-1',
      title: 'new session 1 · claude-code-with-emotion',
      cwd: '/tmp',
      command: '',
      lifecycle: 'bootstrapping' as const,
      createdAtMs: Date.now(),
    };
    const { rerender } = render(
      <TerminalSurface
        focusRequestKey={0}
        isActive={true}
        onTitleChange={vi.fn()}
        session={session}
      />,
    );

    const terminal = terminalInstances[0];

    expect(terminal).toBeDefined();
    expect(terminal?.focus).toHaveBeenCalledTimes(1);

    rerender(
      <TerminalSurface
        focusRequestKey={1}
        isActive={true}
        onTitleChange={vi.fn()}
        session={session}
      />,
    );

    expect(terminal?.focus).toHaveBeenCalledTimes(2);
  });
});
