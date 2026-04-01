# Implementation Plan

## Milestones

- [x] Scaffold pnpm + Electron + React + TypeScript project structure
- [x] Implement top tab bar shell and app-state model for sessions and titles
- [x] Implement vertically stacked resizable terminal panes
- [x] Integrate xterm.js terminal rendering
- [x] Wire node-pty session lifecycle and Claude Code launch flow
- [x] Implement fixed bottom status panel layout
- [x] Implement semantic visual state catalog and asset mapping
- [x] Connect assistant one-line message and structured current task display
- [ ] Pass dev/build flow and update documentation
- [x] Review architecture and summarize remaining gaps

## Current Notes

- Initial scaffold includes a typed Electron `main` / `preload` / React renderer split.
- Dependency installation is working and the initial verification commands passed: `pnpm typecheck`, `pnpm test`, `pnpm build`.
- The renderer shell now manages multiple session tabs in app state and keeps the bottom status panel fixed while reflecting the active session.
- The terminal workspace now renders vertically stacked panes with drag handles, and pane sizing is tracked in renderer state.
- Each pane now mounts an xterm.js surface through a typed preload bridge, with a temporary mock Electron backend standing in until node-pty is wired.
- The Electron main process now owns real node-pty shell sessions and auto-launches `claude` inside each bootstrapped terminal pane.
- The app now exposes a semantic assistant-status bridge, maps states to visuals in the status panel, and injects a `claude-status` helper command into terminal sessions.
- `pnpm package:macos` now produces an unsigned local `.app` bundle, but Electron smoke-launch still aborts in this sandbox environment even for trivial `electron -e` commands.
- Packaging is intentionally deferred until the core multi-terminal flow is working.
