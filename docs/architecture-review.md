# Architecture Review

## What is solid

- Electron process boundaries are explicit: `main`, `preload`, `renderer`, and `shared` contracts are separated and typed.
- Multi-session terminal layout exists in the renderer before PTY wiring, so session state and pane state are already app-owned rather than hidden inside xterm instances.
- PTY sessions run through a dedicated session manager instead of ad hoc IPC handlers.
- The assistant status path is semantic end-to-end: helper command -> file bridge -> main store -> preload -> renderer panel.

## Remaining Gaps

- Tab titles still come entirely from local app state. Terminal title escape sequences and Claude `/rename` hints are not yet observed.
- Session persistence does not exist yet. Closing the app loses pane layout, active tab, and assistant base state.
- The macOS bundle script creates an unsigned local `.app`, but code signing, notarization, and update delivery are not implemented.
- The status helper uses a file bridge, which is intentionally simple but not yet authenticated or namespaced for multiple app instances.
- PTY sessions are scoped to one window lifecycle. There is no reconnect/recover flow after renderer crashes or window recreation.

## Suggested Next Hardening Work

- Persist session metadata and pane sizes to disk.
- Capture title hints from xterm and reconcile them into app-owned tab titles.
- Move the status helper from a file bridge to a local socket or named-pipe protocol when multi-window coordination matters.
- Add packaging/signing automation once the interaction model is stable.
