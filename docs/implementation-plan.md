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
- [x] Pass dev/build flow and update documentation
- [x] Review architecture and summarize remaining gaps

## Current Notes

- Initial scaffold includes a typed Electron `main` / `preload` / React renderer split.
- Dependency installation is working and the initial verification commands passed: `pnpm typecheck`, `pnpm test`, `pnpm build`.
- The renderer shell now manages multiple session tabs in app state and keeps the bottom status panel fixed while reflecting the active session.
- The terminal workspace now renders vertically stacked panes with drag handles, and pane sizing is tracked in renderer state.
- Each pane now mounts an xterm.js surface through a typed preload bridge, with a temporary mock Electron backend standing in until node-pty is wired.
- The Electron main process now owns real node-pty shell sessions and starts an interactive shell in each bootstrapped terminal pane.
- The app now exposes a semantic assistant-status bridge, maps states to visuals in the status panel, and injects a `claude-status` helper command into terminal sessions.
- Terminal sessions now leave Claude launch under user control and wrap the `claude` command so session start, hook-driven activity, and exit can update the status panel automatically.
- The Electron main process now preflights `node-pty` `spawn-helper` permissions at startup and sanitizes PTY environment variables before shell launch.
- Claude lifecycle state changes are now traced through the runtime log so helper writes, hook events, and store snapshots can be compared in one place.
- Claude hook handling now tracks pending permission requests in a temp state file, detects `PostToolUseFailure.is_interrupt`, and infers soft permission cancels when follow-up tool events never arrive.
- Shared visual preset catalogs and asset-resolution primitives now exist as the foundation for user-managed image mappings and future MCP exposure.
- The Electron side now persists a sanitized visual-asset catalog in `userData`, exposes it through a typed preload bridge, and streams catalog snapshots back into the renderer for the upcoming asset-management UI.
- The renderer now resolves assistant snapshots through the shared `state + emotion` resolver and swaps the status-panel placeholder orb for a mapped local image whenever the catalog provides one.
- A first-pass visual-asset manager now lets the user pick local image files, mark a default asset, and map state-only or emotion-only presets without touching JSON by hand.
- `pnpm package:macos` now produces an unsigned local `.app` bundle, but Electron smoke-launch still aborts in this sandbox environment even for trivial `electron -e` commands.
- Packaging is intentionally deferred until the core multi-terminal flow is working.
