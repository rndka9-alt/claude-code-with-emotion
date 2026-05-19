import {
  assistantEmotionalStateSchema,
  assistantSemanticStateSchema,
  type AssistantEmotionalState,
  type AssistantSemanticState,
} from "./assistant-status";

const INITIAL_WORKSPACE_STATE_ARGUMENT_PREFIX = "--initial-workspace-state=";

export type SessionLifecycle = "bootstrapping" | "ready";
export type PaneSplitDirection = "horizontal" | "vertical";

export interface TerminalSession {
  id: string;
  title: string;
  cwd: string;
  command: string;
  lifecycle: SessionLifecycle;
  createdAtMs: number;
}

export interface WorkspacePaneNode {
  kind: "pane";
  id: string;
  sessionId: string;
}

export interface WorkspaceSplitNode {
  kind: "split";
  id: string;
  direction: PaneSplitDirection;
  children: [WorkspaceLayoutNode, WorkspaceLayoutNode];
  sizes: [number, number];
}

export type WorkspaceLayoutNode = WorkspacePaneNode | WorkspaceSplitNode;

export interface WorkspaceTab {
  id: string;
  // 사용자가 보는 탭 레이블. 수동 rename 이 걸리면 이 값이 우선이다.
  title: string;
  focusedPaneId: string;
  focusedSessionId: string;
  isManuallyRenamed: boolean;
  layout: WorkspaceLayoutNode;
  // 탭 레벨 알림과 기본 제목 sync 의 기준이 되는 대표 세션.
  primarySessionId: string;
  // 대표 세션이 마지막으로 올린 터미널 제목. 수동 rename 해도 별도로 유지한다.
  primarySessionTitle: string;
}

export interface AssistantStatus {
  visualState: AssistantSemanticState;
  // lifecycle 상태(visualState) 와 감정 오버레이(emotion) 는 독립 축으로 따로 들고다닌다.
  // UI 조작 직후의 "해피 기분" 같은 짧은 무드를 표현하려면 여기서 emotion 을 얹는다.
  emotion?: AssistantEmotionalState;
  line: string;
  currentTask: string;
  statusSinceMs: number;
}

export interface WorkspaceState {
  tabs: WorkspaceTab[];
  sessions: Record<string, TerminalSession>;
  activeTabId: string;
  nextSessionNumber: number;
  assistantStatus: AssistantStatus;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isSessionLifecycle(value: unknown): value is SessionLifecycle {
  return value === "bootstrapping" || value === "ready";
}

function isPaneSplitDirection(value: unknown): value is PaneSplitDirection {
  return value === "horizontal" || value === "vertical";
}

function isAssistantStatus(value: unknown): value is AssistantStatus {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isString(value.visualState) &&
    assistantSemanticStateSchema.safeParse(value.visualState).success &&
    (value.emotion === undefined ||
      assistantEmotionalStateSchema.safeParse(value.emotion).success) &&
    isString(value.line) &&
    isString(value.currentTask) &&
    isFiniteNumber(value.statusSinceMs)
  );
}

function isTerminalSession(value: unknown): value is TerminalSession {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isString(value.id) &&
    isString(value.title) &&
    isString(value.cwd) &&
    isString(value.command) &&
    isSessionLifecycle(value.lifecycle) &&
    isFiniteNumber(value.createdAtMs)
  );
}

function isWorkspaceLayoutNode(value: unknown): value is WorkspaceLayoutNode {
  if (!isRecord(value) || !isString(value.id)) {
    return false;
  }

  if (value.kind === "pane") {
    return isString(value.sessionId);
  }

  if (value.kind !== "split") {
    return false;
  }

  const children = value.children;
  const sizes = value.sizes;

  return (
    isPaneSplitDirection(value.direction) &&
    Array.isArray(children) &&
    children.length === 2 &&
    isWorkspaceLayoutNode(children[0]) &&
    isWorkspaceLayoutNode(children[1]) &&
    Array.isArray(sizes) &&
    sizes.length === 2 &&
    isFiniteNumber(sizes[0]) &&
    isFiniteNumber(sizes[1])
  );
}

function isWorkspaceTab(value: unknown): value is WorkspaceTab {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isString(value.id) &&
    isString(value.title) &&
    isString(value.focusedPaneId) &&
    isString(value.focusedSessionId) &&
    typeof value.isManuallyRenamed === "boolean" &&
    isWorkspaceLayoutNode(value.layout) &&
    isString(value.primarySessionId) &&
    isString(value.primarySessionTitle)
  );
}

function isTerminalSessionRecord(
  value: unknown,
): value is Record<string, TerminalSession> {
  if (!isRecord(value)) {
    return false;
  }

  return Object.values(value).every((session) => isTerminalSession(session));
}

export function parseWorkspaceState(value: unknown): WorkspaceState {
  if (!isRecord(value)) {
    throw new Error("Workspace state payload must be an object.");
  }

  const tabs = value.tabs;
  const sessions = value.sessions;
  const activeTabId = value.activeTabId;
  const nextSessionNumber = value.nextSessionNumber;
  const assistantStatus = value.assistantStatus;

  if (
    !Array.isArray(tabs) ||
    !tabs.every((tab) => isWorkspaceTab(tab)) ||
    !isTerminalSessionRecord(sessions) ||
    !isString(activeTabId) ||
    !isFiniteNumber(nextSessionNumber) ||
    !isAssistantStatus(assistantStatus)
  ) {
    throw new Error("Workspace state payload is invalid.");
  }

  return {
    tabs,
    sessions,
    activeTabId,
    nextSessionNumber,
    assistantStatus,
  };
}

export function createInitialWorkspaceStateArgument(
  workspaceState: WorkspaceState,
): string {
  return `${INITIAL_WORKSPACE_STATE_ARGUMENT_PREFIX}${encodeURIComponent(
    JSON.stringify(workspaceState),
  )}`;
}

export function parseInitialWorkspaceStateFromArguments(
  args: readonly string[],
): WorkspaceState | undefined {
  const argument = args.find((value) =>
    value.startsWith(INITIAL_WORKSPACE_STATE_ARGUMENT_PREFIX),
  );

  if (argument === undefined) {
    return undefined;
  }

  const encodedPayload = argument.slice(
    INITIAL_WORKSPACE_STATE_ARGUMENT_PREFIX.length,
  );

  try {
    return parseWorkspaceState(JSON.parse(decodeURIComponent(encodedPayload)));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown parse failure";

    throw new Error(`Invalid initial workspace state argument: ${message}`);
  }
}
