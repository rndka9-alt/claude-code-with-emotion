# Implementation Plan

## Milestones

- [x] Scaffold pnpm + Electron + React + TypeScript project structure
- [x] Implement top tab bar shell and app-state model for sessions and titles
- [x] Implement vertically stacked resizable terminal panes
- [x] Integrate xterm.js terminal rendering
- [ ] Wire node-pty session lifecycle and Claude Code launch flow
- [ ] Implement fixed bottom status panel layout
- [ ] Implement semantic visual state catalog and asset mapping
- [ ] Connect assistant one-line message and structured current task display
- [ ] Pass dev/build flow and update documentation
- [ ] Review architecture and summarize remaining gaps

## Current Notes

- Initial scaffold includes a typed Electron `main` / `preload` / React renderer split.
- Dependency installation is working and the initial verification commands passed: `pnpm typecheck`, `pnpm test`, `pnpm build`.
- The renderer shell now manages multiple session tabs in app state and keeps the bottom status panel fixed while reflecting the active session.
- The terminal workspace now renders vertically stacked panes with drag handles, and pane sizing is tracked in renderer state.
- Each pane now mounts an xterm.js surface through a typed preload bridge, with a temporary mock Electron backend standing in until node-pty is wired.
- Packaging is intentionally deferred until the core multi-terminal flow is working.
