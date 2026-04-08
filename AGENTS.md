# Module Structure Guide

## Goal

- Keep module boundaries explicit.
- Make public APIs small and obvious.
- Hide internal implementation details.
- Refactor structure without breaking callers.

## Shared Rules

1. A module is a directory by default.
2. A single-file module is allowed only when the code is still very small and has no meaningful internal structure.
3. External code must import only through the module's public entry:
   - `index.ts`
   - `index.tsx`
   - or the single-file module itself
4. `index.ts` and `index.tsx` are re-export only. Do not put runtime logic in them.
5. Do not use `export *` in module entry files. Re-export only the functions, types, and components that are intentionally public.
6. Keep implementation details private. Code outside a module must not import its internal files directly.
7. Split code by responsibility. Do not force one function per file, but split when a file starts carrying multiple responsibilities.
8. Types, constants, and small helpers should stay near the code that owns them until real reuse appears.
9. Avoid vague names such as `common`, `misc`, or `helper`.
10. Keep module dependencies directional. Avoid circular imports between sibling modules.

## Renderer Rules

Use ownership and UI responsibility as the main grouping rule.

- Prefer feature-oriented names such as `tabs`, `status-panel`, `visual-asset-manager`, `dialog`, or `tab-bar`.
- Small hooks that are private to one UI module should stay under that module, for example `tab-bar/hooks`.
- `components`, `hooks`, `model`, `utils`, `types`, `constants`, and `internal` are valid as secondary structure inside a renderer module.
- Do not promote every small custom hook into a standalone top-level module just because it has a name.

## Main And Shared Rules

Use domain or service responsibility as the main grouping rule.

- Prefer names such as `session`, `runtime`, `claude-mcp`, `diagnostics`, `platform`, `status`, or `window`.
- Do not use `utils`, `types`, or `constants` as the primary top-level split when the code can first be grouped by responsibility.
- `utils`, `types`, `constants`, and `internal` are secondary structure inside a responsibility-focused module.

Good:

```text
terminal/
  claude-mcp/
  session/
  runtime/
```

Bad:

```text
terminal/
  utils/
  types/
  constants/
```

## Promotion Rules

Promote a folder into its own submodule when several of these become true:

- It has a clear responsibility that can be named.
- It keeps growing beyond a few files.
- It starts needing its own `types`, `hooks`, `utils`, `model`, or `internal`.
- Other files begin to rely on it through an obvious entry point.
- Its internal imports become denser than its connection to the rest of the parent module.

A submodule may be:

- public to the app
- private to its parent module

If it is large enough to deserve structure, give it its own entry point even when it stays private.

## Testing Rules

- Prefer tests that assert behavior through a module's public API.
- Internal tests are allowed for complex pure logic, branch-heavy transforms, or regression-prone logic.
- Do not couple tests to file layout unless there is a strong reason.

## Refactoring Standard

- Create structure only when it improves boundaries and ownership.
- Do not add folder depth just for symmetry.
- Optimize for clear imports, clear ownership, and low-friction refactoring.
