# Claude Code With Emotion

macOS Electron desktop app that embeds Claude Code in vertically stacked terminal panes and keeps a fixed assistant status panel pinned to the bottom of the window.

## Core Features

This app wraps Claude Code in an Electron shell and wires together terminal hooks, helper commands, and a user-scope MCP server so Claude's current state can drive an in-app visual status panel.

- Embedded Claude Code workspace with Chrome-style tabs and vertically stacked terminal panes
- `node-pty` shell sessions that bootstrap inside the selected workspace and expose typed terminal IPC through Electron `main` / `preload` / renderer boundaries
- A session-level `claude` wrapper that injects Claude hook settings and visual-tool usage prompts before launching the real Claude Code CLI
- Internal helper commands on session `PATH`, including `claude-status` and `claude-visual-state`, so Claude or the user can update semantic state, overlay emotion, and one-line copy from inside the shell
- A user-scope stdio MCP server, `bin/claude-visual-mcp`, that exposes visual option discovery and overlay updates to Claude Code
- Bottom status panel that resolves semantic state plus optional emotion into app-owned visuals, status lines, and avatar assets
- In-app visual asset manager for importing local image assets, setting a default asset, mapping state and emotion presets, and editing per-state lines / per-emotion descriptions
- Persisted visual asset catalog and imported asset library under Electron `userData`, with content-hash reuse and automatic pruning of unreferenced assets
- Built-in app themes, theme persistence, tab notifications, toast feedback, runtime diagnostics, and one-click MCP installation status handling

## How It Works

1. The renderer opens one or more app-managed terminal sessions through a typed preload bridge.
2. Each session is backed by `node-pty` and starts with an app-controlled environment that places helper binaries on `PATH`.
3. When Claude is launched from that terminal, the wrapper injects Claude hook configuration plus prompt guidance for the visual MCP tools.
4. Claude hooks and helper commands write semantic state and visual overlay data into app-managed files.
5. The Electron main process watches and bridges that state into the renderer.
6. The renderer resolves `state + emotion -> emotion -> state -> default` against the visual asset catalog and renders the bottom status panel accordingly.

## What Ships Today

- Electron `main` / `preload` / React renderer split with typed IPC contracts
- Chrome-style top tab bar with app-owned titles, rename support, drag reordering, and notification badges
- Vertically stacked terminal panes with drag resizing and focus management
- `xterm.js` terminal surfaces backed by app-managed `node-pty` sessions
- Fixed bottom status panel with collapse / expand toggle
- Claude lifecycle tracking through injected hook settings
- User-scope visual MCP registration flow with in-app install prompt and status checks
- Visual asset manager dialog for asset import, mapping, and theme selection
- Built-in theme presets with persisted selection
- Toast-based user feedback for workspace and asset-management actions
- Runtime diagnostics appended to `.runtime-logs/electron-dev.log`

## Requirements

- macOS
- Node.js 20+
- pnpm 10+
- Claude Code installed and available as `claude`

## Local Development

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Start the desktop app:

   ```bash
   pnpm dev
   ```

`pnpm dev` rebuilds the renderer into `dist/renderer`, watches Electron `main` / `preload`, and launches Electron from the generated files. This keeps development working in environments where opening a local dev-server port is blocked.

In development the app also:

- opens DevTools automatically in a detached window after the renderer finishes loading
- installs a standard macOS `View -> Toggle Developer Tools` menu entry
- installs a standard macOS `Edit` menu so native `Cmd+C`, `Cmd+V`, and `Cmd+A` shortcuts work inside the app
- writes runtime diagnostics to `.runtime-logs/electron-dev.log`
- preflights `node-pty` helper binaries and restores execute bits when a local install leaves `spawn-helper` non-executable

## Build

Compile the production assets:

```bash
pnpm build
```

This produces:

- `dist/main`
- `dist/preload`
- `dist/renderer`

## Packaging

Create an unsigned local macOS `.app` bundle:

```bash
pnpm package:macos
```

The output bundle is written to:

```text
dist/macos/Claude Code With Emotion.app
```

Notes:

- This is a local unsigned bundle intended for development and manual testing.
- Code signing, notarization, and update delivery are still outside the current scope.

## Assistant Status Helpers

Each embedded shell session gets `claude-status` and `claude-visual-state` on `PATH`.

`claude-status` updates the semantic assistant state and optional overlay copy:

```bash
claude-status --state thinking --line "로그 읽는 중..." --task "Inspecting failing test" --intensity high
```

You can optionally add an emotion layer:

```bash
claude-status --state working --emotion sad --line "우회 경로 찾는 중..." --task "Permission workaround"
```

You can also pass a JSON payload:

```bash
claude-status '{"state":"happy","line":"붙엇다!","currentTask":"Build passed"}'
```

And you can inspect which visual presets are currently mapped in the catalog:

```bash
claude-status --list-visual-options
```

`claude-visual-state` is focused on overlay-only updates:

```bash
claude-visual-state --emotion happy
claude-visual-state --emotion neutral
claude-visual-state --line "문제를 좀 더 파볼게요!"
claude-visual-state --clear-line
claude-visual-state --reset
```

`neutral` clears the overlay and lets the current semantic state render by itself again.

The status panel renders two layers of copy:

- the hook-driven `activityLabel`, shown by itself like `(자료를 찾는 중)` when no custom line exists
- an optional MCP-driven in-character one-line utterance, rendered as `문제를 좀 더 파볼게요! (자료를 찾는 중)`

Supported semantic states:

- `disconnected`
- `idle`
- `thinking`
- `working`
- `responding`
- `waiting`
- `surprised`
- `sad`
- `happy`
- `error`

The assistant chooses the semantic state and message. The app chooses how that state is rendered in the bottom panel.

## Claude Hook Integration

When Claude is launched through an embedded terminal, the app injects a Claude Code hook settings file so coarse state transitions can be tracked automatically:

- `SessionStart` -> `waiting`
- `UserPromptSubmit` -> `thinking`
- `PermissionRequest` -> `waiting`
- `PermissionDenied` -> `sad` when Claude emits it directly
- `PreToolUse` -> `working`
- `PostToolUse` -> `thinking`
- `PostToolUseFailure` -> `waiting` for `is_interrupt === true`, otherwise `error`
- `Notification` -> `surprised`
- `Elicitation` -> `waiting`
- `ElicitationResult` -> `thinking`
- `SubagentStart` -> `working`
- `SubagentStop` -> `thinking`
- `TeammateIdle` -> `waiting`
- `TaskCompleted` -> `happy`
- `Stop` -> `waiting`
- `StopFailure` -> `error`
- `SessionEnd` -> `disconnected`

The hook helper also keeps a small temp state file so a `PermissionRequest` followed by `UserPromptSubmit` or `SessionEnd` without any `PreToolUse` can be treated as a soft permission cancel instead of getting stuck in a waiting state.

All helper writes and hook transitions are traced into `.runtime-logs/electron-dev.log`.

## Visual Asset System

The visual asset system is built around shared preset catalogs and app-managed local assets.

Current behavior:

- lifecycle-oriented visual `state` presets stay aligned with Claude hook outputs
- optional `emotion` presets refine the visual without changing the underlying semantic state
- resolver priority is `state + emotion -> emotion -> state -> default`
- the persisted `visual-assets.json` catalog lives under Electron `userData`
- imported local image assets are copied into an app-managed library under Electron `userData`
- re-importing the same file reuses the existing stored asset by content hash
- removing the last reference to an imported asset prunes it from the managed library
- the renderer resolves both the image asset and the per-state / per-emotion text metadata from the same catalog

The in-app visual asset manager currently supports:

- choosing a default avatar asset
- mapping exact `state + emotion` pairs
- mapping state-only assets
- mapping emotion-only assets
- editing per-state status lines
- editing per-emotion descriptions
- selecting the current app theme

Built-in theme presets currently include:

- `current-dark`
- `iterm-beige`
- `gruvbox-dark`
- `gruvbox-light`

## Visual Emotion MCP

The repo includes an emotion-focused stdio MCP server at:

```text
bin/claude-visual-mcp
```

Current tools:

- `get_available_visual_options`
- `set_visual_overlay` (set `emotion`, `line`, or both; pass `emotion: "neutral"` or `line: null` to clear)

The MCP surface splits its guidance across dedicated prompt files in `bin/prompts/`, so emotion selection and one-line copy rules can evolve independently without bloating the server script.

When Claude is launched through an embedded terminal, the wrapper appends a session-level visual-tool usage prompt, loaded from `bin/prompts/`, so Claude gets explicit guidance about when to call the emotion and one-line tools.

The app expects the visual MCP server to be installed once at Claude's `user` scope. If that setup is missing, the status panel shows an install prompt and can run the one-time Claude MCP registration for you.

### MCP Troubleshooting

The local visual MCP server is intended to live at Claude's `user` scope.

- If the status panel still shows the install prompt, the one-time user-scope setup has not completed yet.
- The globally registered server stays effectively dormant outside the app because it reads a runtime state file from the app's `userData` directory before exposing tools.
- App-managed terminal sessions refresh that runtime state file as they bootstrap, so the MCP helper knows which overlay file and catalog to use.

## Verification

Current verification commands:

```bash
pnpm typecheck
pnpm test
pnpm build
```

## Debugging

When `pnpm dev` is running:

- DevTools should open automatically in a separate window
- You can also use the app menu: `View -> Toggle Developer Tools`
- Main-process, renderer-console, load, and crash diagnostics are appended to:

```text
.runtime-logs/electron-dev.log
```

If the window goes black, reproducing the issue and then sharing the newest lines from that log file is usually enough for debugging.

If terminal bootstrapping fails, check the same log for `terminal-helper` entries. The app reports which `node-pty` `spawn-helper` binary it found and whether it had to repair its execute permissions.

## Project Layout

- `src/main`: Electron main process composition root and IPC wiring
- `src/main/diagnostics`: runtime log creation and diagnostic forwarding
- `src/main/platform`: platform-specific shell adapters, helper-bin resolution, and path helpers
- `src/main/status`: assistant status store plus file bridges for semantic state and overlay state
- `src/main/terminal`: PTY session bootstrap, Claude wrapper setup, Claude hook / MCP installation support, and terminal runtime helpers
- `src/main/theme`: persisted app theme selection
- `src/main/visual-assets`: persisted visual asset catalog and managed asset library
- `src/main/window`: window bounds persistence
- `src/preload`: typed Electron bridge exposed to the renderer
- `src/renderer`: React app shell
- `src/renderer/features/toast`: toast controller and viewport
- `src/renderer/features/workspace`: workspace-facing UI and screen view-model
- `src/renderer/features/workspace/tabs`: tab bar, tab notifications, and title editing / drag behaviors
- `src/renderer/features/workspace/terminal`: pane stack, terminal surfaces, session registry, and terminal interaction hooks
- `src/renderer/features/workspace/status-panel`: status-panel presentation and line / visual resolution
- `src/renderer/features/workspace/visual-asset-manager`: visual asset manager dialog, mapping editors, and catalog helpers
- `src/shared`: shared IPC contracts, theme definitions, semantic status types, visual preset definitions, and visual asset resolution helpers
- `bin/claude`: wrapper command placed on session `PATH` before launching Claude Code
- `bin/claude-status`: semantic status helper command injected into terminal sessions
- `bin/claude-visual-state`: overlay-only helper command injected into terminal sessions
- `bin/claude-session-hook`: Claude hook entrypoint used by the injected hook settings
- `bin/claude-visual-mcp`: stdio MCP server for visual option discovery and overlay updates
- `bin/prompts`: prompt fragments used by the wrapper and MCP server
- `scripts/package-macos.mjs`: local unsigned macOS app packaging script
