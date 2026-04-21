import type { TerminalSession } from "../../model";
import type { TerminalSearchRequest, TerminalSearchResults } from "../search";
import { disposeParkingLot } from "../terminal-dom";
import {
  createTerminalSessionController,
  type TerminalSessionController,
  type TerminalSessionControllerRecord,
} from "./terminal-session-controller";

const terminalSessionControllers = new Map<
  string,
  TerminalSessionControllerRecord
>();

export function getTerminalSessionController(
  session: TerminalSession,
): TerminalSessionController {
  const existingController = terminalSessionControllers.get(session.id);

  if (existingController !== undefined) {
    return existingController;
  }

  const controller = createTerminalSessionController(session);

  terminalSessionControllers.set(session.id, controller);

  return controller;
}

export function applyTerminalSessionSearch(
  session: TerminalSession,
  request: TerminalSearchRequest,
): void {
  const controller = terminalSessionControllers.get(session.id);

  if (controller === undefined) {
    return;
  }

  controller.applySearch(request);
}

export function clearTerminalSessionSearch(session: TerminalSession): void {
  const controller = terminalSessionControllers.get(session.id);

  if (controller === undefined) {
    return;
  }

  controller.clearSearch();
}

export function updateTerminalSessionSearchResultsHandler(
  session: TerminalSession,
  onSearchResultsChange: ((results: TerminalSearchResults) => void) | null,
): void {
  const controller = terminalSessionControllers.get(session.id);

  if (controller === undefined) {
    return;
  }

  controller.updateSearchResultsHandler(onSearchResultsChange);
}

export function disposeTerminalSession(sessionId: string): void {
  const controller = terminalSessionControllers.get(sessionId);

  if (controller === undefined) {
    return;
  }

  controller.dispose();
  terminalSessionControllers.delete(sessionId);
}

export function disposeTerminalSessionsExcept(sessionIds: string[]): void {
  const activeSessionIds = new Set(sessionIds);

  for (const sessionId of [...terminalSessionControllers.keys()]) {
    if (activeSessionIds.has(sessionId)) {
      continue;
    }

    disposeTerminalSession(sessionId);
  }
}

export function disposeAllTerminalSessions(): void {
  for (const sessionId of [...terminalSessionControllers.keys()]) {
    disposeTerminalSession(sessionId);
  }

  disposeParkingLot();
}

export function syncAllTerminalThemes(): void {
  for (const controller of terminalSessionControllers.values()) {
    controller.updateTheme();
  }
}
