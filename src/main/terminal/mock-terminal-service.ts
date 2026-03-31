import type {
  TerminalBootstrapRequest,
  TerminalBootstrapResponse,
  TerminalInputRequest,
  TerminalResizeRequest,
} from '../../shared/terminal-bridge';

interface MockTerminalSession {
  command: string;
  cwd: string;
  inputBuffer: string;
  title: string;
}

interface InputResult {
  nextBuffer: string;
  output: string;
}

function createPrompt(title: string): string {
  return `[${title}]$ `;
}

export function createBootstrapOutput(
  request: TerminalBootstrapRequest,
): TerminalBootstrapResponse {
  const prompt = createPrompt(request.title);

  return {
    initialOutput:
      `Claude Code terminal surface booted for ${request.title}\r\n` +
      `cwd: ${request.cwd}\r\n` +
      `command: ${request.command}\r\n` +
      'Renderer is now speaking to Electron through the typed preload bridge.\r\n' +
      'node-pty wiring lands in the next milestone.\r\n\r\n' +
      prompt,
  };
}

export function applyInputBuffer(
  currentBuffer: string,
  data: string,
  prompt: string,
): InputResult {
  let nextBuffer = currentBuffer;
  let output = '';

  for (const character of data) {
    if (character === '\r') {
      output += '\r\n';

      if (nextBuffer.length > 0) {
        output += `mock exec: ${nextBuffer}\r\n`;
      }

      output += 'PTY bridge pending. Keyboard path is working though...!\r\n';
      output += prompt;
      nextBuffer = '';
      continue;
    }

    if (character === '\u007f') {
      if (nextBuffer.length > 0) {
        nextBuffer = nextBuffer.slice(0, -1);
        output += '\b \b';
      }

      continue;
    }

    nextBuffer += character;
    output += character;
  }

  return {
    nextBuffer,
    output,
  };
}

export class MockTerminalService {
  private readonly sessions = new Map<string, MockTerminalSession>();

  bootstrapSession(
    request: TerminalBootstrapRequest,
  ): TerminalBootstrapResponse {
    const existingSession = this.sessions.get(request.sessionId);

    if (existingSession !== undefined) {
      return {
        initialOutput: createPrompt(existingSession.title),
      };
    }

    this.sessions.set(request.sessionId, {
      command: request.command,
      cwd: request.cwd,
      inputBuffer: '',
      title: request.title,
    });

    return createBootstrapOutput(request);
  }

  handleInput(request: TerminalInputRequest): string {
    const session = this.sessions.get(request.sessionId);

    if (session === undefined) {
      return '';
    }

    const prompt = createPrompt(session.title);
    const result = applyInputBuffer(session.inputBuffer, request.data, prompt);

    this.sessions.set(request.sessionId, {
      ...session,
      inputBuffer: result.nextBuffer,
    });

    return result.output;
  }

  handleResize(_request: TerminalResizeRequest): void {
    // The mock bridge does not need terminal dimensions yet,
    // but the typed API is already shaped like the upcoming PTY backend.
  }
}
