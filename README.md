# Claude Code With Emotion

macOS Electron desktop app that embeds Claude Code terminals in a multi-session workspace and renders a fixed assistant status panel at the bottom.

## Stack

- Electron
- React
- TypeScript
- pnpm
- xterm.js
- node-pty

## Local development

1. Install dependencies with `pnpm install`
2. Start the app with `pnpm dev`

The development flow runs:

- Vite for the renderer
- TypeScript watch mode for Electron `main` and `preload`
- Electron pointed at the local renderer dev server

## Build

1. Run `pnpm build`

This currently produces compiled application assets in `dist/`. Packaging for distributable macOS artifacts will be added as part of the production-build milestone.

## Architecture

- `src/main`: Electron main-process entry and native integrations
- `src/preload`: typed, isolated renderer bridge
- `src/renderer`: React UI
- `src/shared`: shared contracts and types used across processes
- `docs/implementation-plan.md`: running implementation checklist
