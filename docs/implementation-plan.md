# Implementation Plan

## Milestones

- [x] Scaffold pnpm + Electron + React + TypeScript project structure
- [ ] Implement top tab bar shell and app-state model for sessions and titles
- [ ] Implement vertically stacked resizable terminal panes
- [ ] Integrate xterm.js terminal rendering
- [ ] Wire node-pty session lifecycle and Claude Code launch flow
- [ ] Implement fixed bottom status panel layout
- [ ] Implement semantic visual state catalog and asset mapping
- [ ] Connect assistant one-line message and structured current task display
- [ ] Pass dev/build flow and update documentation
- [ ] Review architecture and summarize remaining gaps

## Current Notes

- Initial scaffold includes a typed Electron `main` / `preload` / React renderer split.
- Dependency installation is working and the initial verification commands passed: `pnpm typecheck`, `pnpm test`, `pnpm build`.
- Packaging is intentionally deferred until the core multi-terminal flow is working.
