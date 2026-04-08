import path from "node:path";
import { spawn } from "node-pty";
import type { IPty } from "node-pty";
import {
  getPlatformShellAdapter,
  joinPathList,
  resolveHomeDir,
} from "../../platform";
import { ensureClaudeHooksSettingsFile } from "../claude-hooks";
import { stripScreenHardstatus } from "./strip-screen-hardstatus";
import { TerminalOutputStore } from "./output-store";
import type {
  TerminalBootstrapRequest,
  TerminalBootstrapResponse,
  TerminalCloseRequest,
  TerminalInputRequest,
  TerminalResizeRequest,
} from "../../../shared/terminal-bridge";

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

type RuntimeFactory = (
  options: RuntimeFactoryOptions,
) => TerminalSessionRuntime;
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

function createInitialCommandInput(command: string): string {
  const trimmedCommand = command.trim();

  if (trimmedCommand.length === 0) {
    return "";
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

function createNodePtyRuntime(
  options: RuntimeFactoryOptions,
): TerminalSessionRuntime {
  const ptyProcess = spawn(options.shell, options.shellArgs, {
    cols: options.cols,
    rows: options.rows,
    cwd: options.cwd,
    env: options.env,
    name: "xterm-256color",
  });

  return adaptPty(ptyProcess);
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
    return typeof entry[1] === "string";
  });
  const pathSegments = [helperBinDir];
  const existingPath = env.PATH;

  if (typeof existingPath === "string" && existingPath.length > 0) {
    pathSegments.push(existingPath);
  }

  // Finder 에서 실행한 Electron 은 LANG/LC_* 를 상속 못 받아서 쉘이 C 로케일로 떨어진다.
  // 그 상태에선 한글·이모지가 raw 바이트로 처리돼 입력이 `\x80\x82` 처럼 깨져 보이기 때문에
  // UTF-8 기본값을 주입해 멀티바이트 입력이 항상 UTF-8 로 해석되게 보장한다.
  return {
    ...Object.fromEntries(sanitizedEnvEntries),
    CLAUDE_WITH_EMOTION_STATUS_FILE: statusFilePath,
    CLAUDE_WITH_EMOTION_HOOK_STATE_FILE: `${statusFilePath}.hook-state.json`,
    CLAUDE_WITH_EMOTION_ORIGINAL_PATH: existingPath ?? "",
    CLAUDE_WITH_EMOTION_HELPER_BIN_DIR: helperBinDir,
    CLAUDE_WITH_EMOTION_TRACE_FILE: traceFilePath,
    CLAUDE_WITH_EMOTION_VISUAL_ASSET_CATALOG_FILE: visualAssetCatalogFilePath,
    CLAUDE_WITH_EMOTION_VISUAL_OVERLAY_FILE: visualOverlayFilePath,
    PWD: cwd,
    PATH: joinPathList(pathSegments),
    LANG: env.LANG ?? "en_US.UTF-8",
    LC_CTYPE: env.LC_CTYPE ?? env.LC_ALL ?? env.LANG ?? "en_US.UTF-8",
    HEADLINE_INFO_MODE: env.HEADLINE_INFO_MODE ?? "prompt",
    HEADLINE_LINE_MODE: env.HEADLINE_LINE_MODE ?? "off",
    HEADLINE_DO_CLOCK: env.HEADLINE_DO_CLOCK ?? "false",
    // xterm.js는 DA2에서 xterm 276을 자칭하지만 modifyOtherKeys 키 인코딩을 미지원.
    // TERM=xterm* 이면 vim 9.0+가 mok2 termcap을 로드해 키 입력이 먹통이 되고,
    // codex·claude code 등 CLI 도구가 xterm 전용 시퀀스를 남겨 찌꺼기가 보인다.
    // screen-256color는 256색을 유지하면서 이 문제들을 회피한다.
    TERM: "screen-256color",
    TERM_PROGRAM: "claude-code-with-emotion",
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

    const shellAdapter = getPlatformShellAdapter();
    const shell = shellAdapter.resolveDefaultShell(process.env);
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
    const homeDir = resolveHomeDir(runtimeEnv);

    if (typeof homeDir === "string" && homeDir.length > 0) {
      runtimeEnv.CLAUDE_WITH_EMOTION_HOOKS_SETTINGS_FILE =
        ensureClaudeHooksSettingsFile(this.helperBinDir, homeDir);
    }

    const launchConfig = shellAdapter.createLaunchConfig(shell, runtimeEnv);
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
      const filtered = stripScreenHardstatus(data);
      const outputVersion = outputStore.append(filtered);

      this.emitOutput(request.sessionId, {
        data: filtered,
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
