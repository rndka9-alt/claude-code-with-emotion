export interface TerminalBootstrapRequest {
  sessionId: string;
  title: string;
  cwd: string;
  command: string;
  cols: number;
  rows: number;
}

export interface TerminalBootstrapResponse {}

export interface TerminalInputRequest {
  sessionId: string;
  data: string;
}

export interface TerminalResizeRequest {
  sessionId: string;
  cols: number;
  rows: number;
}

export interface TerminalCloseRequest {
  sessionId: string;
}

export interface TerminalOutputEvent {
  sessionId: string;
  data: string;
}

export interface TerminalExitEvent {
  sessionId: string;
  exitCode: number;
  signal: number;
}

export interface TerminalBridge {
  bootstrapSession: (
    request: TerminalBootstrapRequest,
  ) => Promise<TerminalBootstrapResponse>;
  sendInput: (request: TerminalInputRequest) => Promise<void>;
  resizeSession: (request: TerminalResizeRequest) => Promise<void>;
  closeSession: (request: TerminalCloseRequest) => Promise<void>;
  onOutput: (listener: (event: TerminalOutputEvent) => void) => (() => void);
  onExit: (listener: (event: TerminalExitEvent) => void) => (() => void);
}

export const TERMINAL_CHANNELS: {
  bootstrap: string;
  input: string;
  resize: string;
  close: string;
  output: string;
  exit: string;
} = {
  bootstrap: 'terminal:bootstrap',
  input: 'terminal:input',
  resize: 'terminal:resize',
  close: 'terminal:close',
  output: 'terminal:output',
  exit: 'terminal:exit',
};
