# Module Structure Guide

## Goal

- Keep the codebase organized around explicit modules.
- Make each module's public API obvious.
- Prevent direct imports into internal implementation files.
- Refactor safely without coupling callers to file layout.

## Core Principles

1. A module is primarily a directory.
2. A module may be a single file only when it has no meaningful internal structure yet.
3. External code must only depend on a module's public entry.
4. Public entries expose contracts. Implementation stays internal.
5. Split by responsibility, not by arbitrary file count.

## Module Rules

1. Manage modules as folders by default. If a module has only one implementation file and no supporting files, a single-file module is allowed.

2. External code may only import through a module's public entry:
   - `some-module/index.ts`
   - `some-module/index.tsx`
   - or the single-file module itself

3. `index.ts` and `index.tsx` are re-export only. Do not place runtime logic in them.

4. Do not use `export *` in module entry files. Re-export only the specific functions, types, and components that are intentionally part of the module's public API.

5. Organize files around one responsibility per file. Do not force one function per file, but split immediately when a file starts carrying multiple responsibilities.

6. Types, constants, and helpers that are used by only one function or component should stay as close to that implementation as possible. Promote them to shared module members only after real reuse appears.

7. Allowed subfolders inside a module should use explicit names. Prefer:
   - `components`
   - `hooks`
   - `model`
   - `utils`
   - `types`
   - `constants`
   - `internal`

8. Avoid vague folder names such as `common`, `misc`, or `helper`.

9. When a subfolder grows its own responsibility and internal structure, promote it to a submodule.
   - A submodule may be public to the app, or private to its parent module.
   - Even private submodules should expose their own entry point when they become large enough.

10. Code outside a parent module must not import from that parent module's private submodules or internal files.

11. Tests should primarily target a module's public API and key user-visible flows. Internal tests are allowed for complex pure logic, branch-heavy transformations, or regression-prone logic.

12. Keep module dependencies directional. Avoid circular imports between sibling modules.

## Promotion Heuristics

Promote a folder to a submodule when at least some of these are true:

- It keeps growing beyond a few files.
- It has a clear responsibility that can be named.
- It starts to need its own `types`, `utils`, `hooks`, or `model`.
- It has an obvious entry point that other files in the parent module rely on.
- Its internal imports are becoming denser than its connection to the rest of the parent module.

## Import Boundaries

Good:

```ts
import { TerminalSurface } from "./terminal";
import { createWorkspaceState } from "./model";
```

Bad:

```ts
import { TerminalSurface } from "./terminal/TerminalSurface";
import { pruneTerminalSessions } from "./terminal/hooks/use-terminal-session-pruner";
```

Good:

```ts
export { TerminalSurface } from "./TerminalSurface";
export type { SessionTab } from "./types";
```

Bad:

```ts
export * from "./TerminalSurface";
export * from "./types";
```

## Testing Guidance

- Prefer tests that assert behavior through the module's public API.
- Add internal tests only when they buy real safety.
- Do not couple tests to file layout without a strong reason.

## Refactoring Standard

- A flatter folder is acceptable when the code is still small.
- Create structure when it improves boundaries, not just to satisfy ceremony.
- Optimize for clear ownership, stable imports, and low-friction refactoring.
