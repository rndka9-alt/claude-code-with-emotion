# Claude Code With Emotion

macOS Electron desktop app that embeds Claude Code in vertically stacked terminal panes and keeps a fixed assistant status panel pinned to the bottom of the window.

## What ships today

- Electron `main` / `preload` / React renderer split
- Chrome-style top tab bar with app-owned session titles
- Vertically stacked terminal panes with drag resizing
- `xterm.js` terminals wired through a typed preload bridge
- `node-pty` shell sessions that start in an interactive shell inside the selected workspace
- Fixed bottom status panel with semantic state-to-visual mapping
- Internal `claude-status` helper command for updating assistant state from inside a terminal session
- A `claude` wrapper on session `PATH` that updates the bottom status panel when a Claude session starts, moves through hooks, or exits

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

## Assistant Status Helper

Each embedded shell session gets a `claude-status` command on `PATH`.

Example:

```bash
claude-status --state thinking --line "로그 읽는 중..." --task "Inspecting failing test" --duration-ms 4000 --intensity high
```

You can optionally add an emotion layer when the current visual catalog supports it:

```bash
claude-status --state working --emotion sad --line "우회 경로 찾는 중..." --task "Permission workaround"
```

You can also pass a JSON payload:

```bash
claude-status '{"state":"happy","line":"붙엇다!","currentTask":"Build passed"}'
```

And you can inspect which visual presets are currently mapped in the user catalog:

```bash
claude-status --list-visual-options
```

For emotion-only visual overrides, each embedded shell session also gets:

```bash
claude-visual-state --emotion happy
claude-visual-state --emotion neutral
```

`neutral` clears the overlay and lets the current semantic state render by itself again.

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

The next asset-system layer is being built around shared preset catalogs:

- lifecycle-oriented visual `state` presets that stay aligned with Claude hook outputs
- optional `emotion` presets that can refine the visual without changing the underlying task state
- a resolver order of `state + emotion` -> `state` -> `emotion` -> default asset
- a persisted `visual-assets.json` catalog in Electron `userData`, exposed through a typed preload bridge for the upcoming import/mapping UI and MCP surface
- renderer-side status visuals that normalize Claude's current semantic state and load a mapped local image when the catalog has a match
- a first-pass in-app visual asset manager, opened from the avatar area, for picking local files and mapping them to state or emotion presets
- exact `state + emotion` pair mappings in that manager, matching the resolver priority of `state + emotion -> state -> emotion -> default`
- imported visual assets are copied into an app-managed library under Electron `userData`, reused by content hash when the same file is imported again, and pruned when no catalog entry references them anymore

When Claude itself is launched through the embedded terminal, the app also injects a Claude Code hook settings file so coarse state transitions can be tracked automatically:

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

The hook helper also keeps a tiny temp state file so a `PermissionRequest` followed by a new `UserPromptSubmit` or `SessionEnd` without any `PreToolUse` can be treated as a soft permission cancel instead of getting stuck in a waiting state.

All helper writes and hook transitions are traced into `.runtime-logs/electron-dev.log`.

## Visual Emotion MCP

The repo now includes an emotion-focused stdio MCP server at:

```text
bin/claude-visual-mcp
```

Current tools:

- `get_available_visual_options`
- `set_visual_emotion`

`set_visual_emotion` only deals with the emotion overlay for now. The hook-driven task state and the one-line assistant copy remain separate, so the future summary/message surface can be added without reworking the emotion transport.

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

If terminal bootstrapping fails, check the same log for `terminal-helper` entries. The app now reports which `node-pty` `spawn-helper` binary it found and whether it had to repair its execute permissions.

## Project Layout

- `src/main`: Electron main process, PTY sessions, status bridge
- `src/preload`: typed Electron bridge exposed to the renderer
- `src/renderer`: React UI, pane layout, xterm surfaces, status panel
- `src/shared`: shared IPC contracts and semantic status types
- `bin/claude-status`: helper command injected into terminal session `PATH`
- `docs/implementation-plan.md`: running milestone checklist
- `docs/architecture-review.md`: current architecture review and remaining gaps
