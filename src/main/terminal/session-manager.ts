import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node-pty';
import type { IPty } from 'node-pty';
import { ensureClaudeHooksSettingsFile } from './claude-hooks-settings';
import { ensureClaudeVisualMcpConfigFile } from './claude-mcp-config';
import { TerminalOutputStore } from './terminal-output-store';
import type {
  TerminalBootstrapRequest,
  TerminalBootstrapResponse,
  TerminalCloseRequest,
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
  outputStore: TerminalOutputStore;
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
type OutputListener = (
  sessionId: string,
  event: { data: string; outputVersion: number },
) => void;
type ExitListener = (
  sessionId: string,
  event: { exitCode: number; signal: number },
) => void;

interface TerminalDimensions {
  cols: number;
  rows: number;
}

interface ShellLaunchConfig {
  env: Record<string, string>;
  shellArgs: string[];
}

function createInitialCommandInput(command: string): string {
  const trimmedCommand = command.trim();

  if (trimmedCommand.length === 0) {
    return '';
  }

  return `${trimmedCommand}\r`;
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
  visualAssetCatalogFilePath: string,
  visualOverlayFilePath: string,
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
    CLAUDE_WITH_EMOTION_HOOK_STATE_FILE: `${statusFilePath}.hook-state.json`,
    CLAUDE_WITH_EMOTION_ORIGINAL_PATH: existingPath ?? '',
    CLAUDE_WITH_EMOTION_HELPER_BIN_DIR: helperBinDir,
    CLAUDE_WITH_EMOTION_TRACE_FILE: traceFilePath,
    CLAUDE_WITH_EMOTION_VISUAL_ASSET_CATALOG_FILE: visualAssetCatalogFilePath,
    CLAUDE_WITH_EMOTION_VISUAL_OVERLAY_FILE: visualOverlayFilePath,
    PWD: cwd,
    PATH: pathSegments.join(':'),
    HEADLINE_INFO_MODE: env.HEADLINE_INFO_MODE ?? 'prompt',
    HEADLINE_LINE_MODE: env.HEADLINE_LINE_MODE ?? 'off',
    HEADLINE_DO_CLOCK: env.HEADLINE_DO_CLOCK ?? 'false',
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
  const interactiveShellArgs = ['-i', '-l'];

  if (shellName === 'zsh') {
    const homeDir = env.HOME;

    if (typeof homeDir === 'string' && homeDir.length > 0) {
      const wrapperDir = ensureZshWrapperDir(homeDir, env);

      return {
        env: {
          ...env,
          ZDOTDIR: wrapperDir,
        },
        shellArgs: interactiveShellArgs,
      };
    }
  }

  if (shellName === 'bash') {
    return {
      env,
      shellArgs: interactiveShellArgs,
    };
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
    private readonly emitExit: ExitListener,
    private readonly helperBinDir: string,
    private readonly traceFilePath: string,
    private readonly visualAssetCatalogFilePath: string,
    private readonly outputRootDir: string,
  ) {}

  bootstrapSession(
    request: TerminalBootstrapRequest,
    statusFilePath: string,
    visualOverlayFilePath: string,
  ): TerminalBootstrapResponse {
    const existingSession = this.sessions.get(request.sessionId);

    if (existingSession !== undefined) {
      const size = normalizeTerminalDimensions(request.cols, request.rows);

      existingSession.runtime.resize(size.cols, size.rows);

      const snapshot = existingSession.outputStore.getSnapshot();

      return {
        outputSnapshot: snapshot.output,
        outputVersion: snapshot.version,
      };
    }

    const shell = resolveShell(process.env);
    const size = normalizeTerminalDimensions(request.cols, request.rows);
    const runtimeEnv = createRuntimeEnv(
      process.env,
      request.cwd,
      this.helperBinDir,
      statusFilePath,
      this.traceFilePath,
      this.visualAssetCatalogFilePath,
      visualOverlayFilePath,
    );
    const homeDir = runtimeEnv.HOME;

    if (typeof homeDir === 'string' && homeDir.length > 0) {
      runtimeEnv.CLAUDE_WITH_EMOTION_HOOKS_SETTINGS_FILE =
        ensureClaudeHooksSettingsFile(this.helperBinDir, homeDir);
    }

    runtimeEnv.CLAUDE_WITH_EMOTION_MCP_CONFIG_FILE =
      ensureClaudeVisualMcpConfigFile(this.helperBinDir);

    const launchConfig = createShellLaunchConfig(shell, runtimeEnv);
    const runtime = this.runtimeFactory({
      cols: size.cols,
      rows: size.rows,
      cwd: request.cwd,
      env: launchConfig.env,
      shell,
      shellArgs: launchConfig.shellArgs,
    });
    const outputStore = new TerminalOutputStore(
      path.join(this.outputRootDir, `${request.sessionId}.log`),
    );

    outputStore.reset();

    const dataSubscription = runtime.onData((data) => {
      const outputVersion = outputStore.append(data);

      this.emitOutput(request.sessionId, {
        data,
        outputVersion,
      });
    });
    const exitSubscription = runtime.onExit((event) => {
      const exitMessage = `\r\n[session exited: code ${event.exitCode}, signal ${event.signal ?? 0}]\r\n`;
      const outputVersion = outputStore.append(exitMessage);

      this.emitOutput(request.sessionId, {
        data: exitMessage,
        outputVersion,
      });
      this.emitExit(request.sessionId, {
        exitCode: event.exitCode,
        signal: event.signal ?? 0,
      });
      this.disposeSession(request.sessionId);
    });

    this.sessions.set(request.sessionId, {
      outputStore,
      runtime,
      disposables: [dataSubscription, exitSubscription],
    });

    const initialCommandInput = createInitialCommandInput(request.command);

    if (initialCommandInput.length > 0) {
      runtime.write(initialCommandInput);
    }

    const snapshot = outputStore.getSnapshot();

    return {
      outputSnapshot: snapshot.output,
      outputVersion: snapshot.version,
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

  closeSession(request: TerminalCloseRequest): void {
    this.disposeSession(request.sessionId);
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
    session.outputStore.dispose();
    session.runtime.kill();
  }
}

export function createTerminalSessionManager(
  emitOutput: OutputListener,
  emitExit: ExitListener,
  helperBinDir: string,
  traceFilePath: string,
  visualAssetCatalogFilePath: string,
  outputRootDir: string,
): TerminalSessionManager {
  return new TerminalSessionManager(
    createNodePtyRuntime,
    emitOutput,
    emitExit,
    helperBinDir,
    traceFilePath,
    visualAssetCatalogFilePath,
    outputRootDir,
  );
}
