# Claude Code With Emotion

macOS Electron desktop app that embeds Claude Code in vertically stacked terminal panes and keeps a fixed assistant status panel pinned to the bottom of the window.

## What ships today

- Electron `main` / `preload` / React renderer split
- Chrome-style top tab bar with app-owned session titles
- Vertically stacked terminal panes with drag resizing
- `xterm.js` terminals wired through a typed preload bridge
- `node-pty` shell sessions that auto-launch `claude`
- Fixed bottom status panel with semantic state-to-visual mapping
- Internal `claude-status` helper command for updating assistant state from inside a terminal session

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

You can also pass a JSON payload:

```bash
claude-status '{"state":"happy","line":"붙엇다!","currentTask":"Build passed"}'
```

Supported semantic states:

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

## Verification

Current verification commands:

```bash
pnpm typecheck
pnpm test
pnpm build
```

## Project Layout

- `src/main`: Electron main process, PTY sessions, status bridge
- `src/preload`: typed Electron bridge exposed to the renderer
- `src/renderer`: React UI, pane layout, xterm surfaces, status panel
- `src/shared`: shared IPC contracts and semantic status types
- `bin/claude-status`: helper command injected into terminal session `PATH`
- `docs/implementation-plan.md`: running milestone checklist
- `docs/architecture-review.md`: current architecture review and remaining gaps
