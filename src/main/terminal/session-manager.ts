import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node-pty';
import type { IPty } from 'node-pty';
import { ensureClaudeHooksSettingsFile } from './claude-hooks-settings';
import type {
  TerminalBootstrapRequest,
  TerminalBootstrapResponse,
  TerminalInputRequest,
  TerminalResizeRequest,
} from '../../shared/terminal-bridge';

interface TerminalDisposable {
  dispose: () => void;
}

interface TerminalSessionRuntime {
  write: (data: string) => void;
  resize: (cols: number, rows: number) => void;
  kill: () => void;
  onData: (listener: (data: string) => void) => TerminalDisposable;
  onExit: (
    listener: (event: { exitCode: number; signal?: number }) => void,
  ) => TerminalDisposable;
}

interface TerminalSessionRecord {
  runtime: TerminalSessionRuntime;
  disposables: TerminalDisposable[];
}

interface RuntimeFactoryOptions {
  cols: number;
  rows: number;
  cwd: string;
  shell: string;
  shellArgs: string[];
  env: Record<string, string>;
}

type RuntimeFactory = (options: RuntimeFactoryOptions) => TerminalSessionRuntime;
type OutputListener = (sessionId: string, data: string) => void;

interface TerminalDimensions {
  cols: number;
  rows: number;
}

interface ShellLaunchConfig {
  env: Record<string, string>;
  shellArgs: string[];
}

function adaptPty(ptyProcess: IPty): TerminalSessionRuntime {
  return {
    write: (data) => {
      ptyProcess.write(data);
    },
    resize: (cols, rows) => {
      ptyProcess.resize(cols, rows);
    },
    kill: () => {
      ptyProcess.kill();
    },
    onData: (listener) => {
      return ptyProcess.onData(listener);
    },
    onExit: (listener) => {
      return ptyProcess.onExit(listener);
    },
  };
}

function createNodePtyRuntime(options: RuntimeFactoryOptions): TerminalSessionRuntime {
  const ptyProcess = spawn(options.shell, options.shellArgs, {
    cols: options.cols,
    rows: options.rows,
    cwd: options.cwd,
    env: options.env,
    name: 'xterm-256color',
  });

  return adaptPty(ptyProcess);
}

export function resolveShell(env: NodeJS.ProcessEnv): string {
  const shell = env.SHELL;

  if (typeof shell === 'string' && shell.length > 0) {
    return shell;
  }

  return '/bin/zsh';
}

export function createRuntimeEnv(
  env: NodeJS.ProcessEnv,
  cwd: string,
  helperBinDir: string,
  statusFilePath: string,
  traceFilePath: string,
): Record<string, string> {
  const sanitizedEnvEntries = Object.entries(env).filter((entry) => {
    return typeof entry[1] === 'string';
  });
  const pathSegments = [helperBinDir];
  const existingPath = env.PATH;

  if (typeof existingPath === 'string' && existingPath.length > 0) {
    pathSegments.push(existingPath);
  }

  return {
    ...Object.fromEntries(sanitizedEnvEntries),
    CLAUDE_WITH_EMOTION_STATUS_FILE: statusFilePath,
    CLAUDE_WITH_EMOTION_ORIGINAL_PATH: existingPath ?? '',
    CLAUDE_WITH_EMOTION_HELPER_BIN_DIR: helperBinDir,
    CLAUDE_WITH_EMOTION_TRACE_FILE: traceFilePath,
    PWD: cwd,
    PATH: pathSegments.join(':'),
    TERM: 'xterm-256color',
    TERM_PROGRAM: 'claude-code-with-emotion',
  };
}

function quoteForShell(value: string): string {
  return `'${value.replaceAll("'", "'\"'\"'")}'`;
}

function createShellExports(env: Record<string, string>): string {
  return Object.entries(env)
    .map(([key, value]) => {
      return `export ${key}=${quoteForShell(value)}`;
    })
    .join('\n');
}

function createZshWrapperFile(
  sourceFileName: string,
  env: Record<string, string>,
): string {
  const sourceLine = [
    `if [ -f "$HOME/${sourceFileName}" ]; then`,
    `  . "$HOME/${sourceFileName}"`,
    'fi',
  ].join('\n');

  return `${sourceLine}\n${createShellExports(env)}\n`;
}

function getZshWrapperDir(homeDir: string): string {
  return path.join(
    os.tmpdir(),
    'claude-code-with-emotion-shell',
    Buffer.from(homeDir).toString('hex'),
    'zsh',
  );
}

function ensureZshWrapperDir(
  homeDir: string,
  env: Record<string, string>,
): string {
  const wrapperDir = getZshWrapperDir(homeDir);

  fs.mkdirSync(wrapperDir, { recursive: true });
  fs.writeFileSync(
    path.join(wrapperDir, '.zshenv'),
    createZshWrapperFile('.zshenv', env),
    'utf8',
  );
  fs.writeFileSync(
    path.join(wrapperDir, '.zprofile'),
    createZshWrapperFile('.zprofile', env),
    'utf8',
  );
  fs.writeFileSync(
    path.join(wrapperDir, '.zshrc'),
    createZshWrapperFile('.zshrc', env),
    'utf8',
  );
  fs.writeFileSync(
    path.join(wrapperDir, '.zlogin'),
    createZshWrapperFile('.zlogin', env),
    'utf8',
  );

  return wrapperDir;
}

export function createShellLaunchConfig(
  shell: string,
  env: Record<string, string>,
): ShellLaunchConfig {
  const shellName = path.basename(shell);

  if (shellName === 'zsh') {
    const homeDir = env.HOME;

    if (typeof homeDir === 'string' && homeDir.length > 0) {
      const wrapperDir = ensureZshWrapperDir(homeDir, env);

      return {
        env: {
          ...env,
          ZDOTDIR: wrapperDir,
        },
        shellArgs: ['-l'],
      };
    }
  }

  return {
    env,
    shellArgs: ['-l'],
  };
}

function normalizeTerminalDimensions(
  cols: number,
  rows: number,
): TerminalDimensions {
  return {
    cols: Math.max(2, cols),
    rows: Math.max(1, rows),
  };
}

export class TerminalSessionManager {
  private readonly sessions = new Map<string, TerminalSessionRecord>();

  constructor(
    private readonly runtimeFactory: RuntimeFactory,
    private readonly emitOutput: OutputListener,
    private readonly helperBinDir: string,
    private readonly statusFilePath: string,
    private readonly traceFilePath: string,
  ) {}

  bootstrapSession(
    request: TerminalBootstrapRequest,
  ): TerminalBootstrapResponse {
    const existingSession = this.sessions.get(request.sessionId);

    if (existingSession !== undefined) {
      const size = normalizeTerminalDimensions(request.cols, request.rows);

      existingSession.runtime.resize(size.cols, size.rows);

      return { initialOutput: '' };
    }

    const shell = resolveShell(process.env);
    const size = normalizeTerminalDimensions(request.cols, request.rows);
    const runtimeEnv = createRuntimeEnv(
      process.env,
      request.cwd,
      this.helperBinDir,
      this.statusFilePath,
      this.traceFilePath,
    );
    const homeDir = runtimeEnv.HOME;

    if (typeof homeDir === 'string' && homeDir.length > 0) {
      runtimeEnv.CLAUDE_WITH_EMOTION_HOOKS_SETTINGS_FILE =
        ensureClaudeHooksSettingsFile(this.helperBinDir, homeDir);
    }

    const launchConfig = createShellLaunchConfig(shell, runtimeEnv);
    const runtime = this.runtimeFactory({
      cols: size.cols,
      rows: size.rows,
      cwd: request.cwd,
      env: launchConfig.env,
      shell,
      shellArgs: launchConfig.shellArgs,
    });

    const dataSubscription = runtime.onData((data) => {
      this.emitOutput(request.sessionId, data);
    });
    const exitSubscription = runtime.onExit((event) => {
      this.emitOutput(
        request.sessionId,
        `\r\n[session exited: code ${event.exitCode}, signal ${event.signal ?? 0}]\r\n`,
      );
      this.disposeSession(request.sessionId);
    });

    this.sessions.set(request.sessionId, {
      runtime,
      disposables: [dataSubscription, exitSubscription],
    });

    return {
      initialOutput:
        `Shell ready in ${shell}\r\n` + `cwd: ${request.cwd}\r\n`,
    };
  }

  sendInput(request: TerminalInputRequest): void {
    const session = this.sessions.get(request.sessionId);

    if (session !== undefined) {
      session.runtime.write(request.data);
    }
  }

  resizeSession(request: TerminalResizeRequest): void {
    const session = this.sessions.get(request.sessionId);

    if (session !== undefined) {
      session.runtime.resize(
        Math.max(2, request.cols),
        Math.max(1, request.rows),
      );
    }
  }

  dispose(): void {
    for (const sessionId of [...this.sessions.keys()]) {
      this.disposeSession(sessionId);
    }
  }

  private disposeSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);

    if (session === undefined) {
      return;
    }

    for (const disposable of session.disposables) {
      disposable.dispose();
    }

    this.sessions.delete(sessionId);
    session.runtime.kill();
  }
}

export function createTerminalSessionManager(
  emitOutput: OutputListener,
  helperBinDir: string,
  statusFilePath: string,
  traceFilePath: string,
): TerminalSessionManager {
  return new TerminalSessionManager(
    createNodePtyRuntime,
    emitOutput,
    helperBinDir,
    statusFilePath,
    traceFilePath,
  );
}
