import type {
  AssistantEmotionalState,
  AssistantSemanticState,
} from "./assistant-status";

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
