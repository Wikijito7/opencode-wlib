# Migration guide: flat layout → `src/core` + `src/ui`

This document explains how to migrate a plugin that consumes `opencode-wlib` as a
git submodule after the repo was restructured from a flat root into `src/core`
(pure/logic modules) and `src/ui` (SolidJS/TUI components), with tests moved to
`test/`.

The restructure is a **hard cutover**: import paths change. There is no
backward-compatible shim, so every consumer must update its imports in one shot.

## When to apply this

Apply this after bumping the submodule to a commit that contains the `src/`
layout (see issue #2). Before that commit, keep using the old `./wlib/<module>`
paths.

## Steps

1. **Update the submodule**
   ```bash
   git submodule update --remote --merge
   git commit -m "chore: bump opencode-wlib (src/ layout)"
   ```

2. **Rewrite imports** using the mapping below. A single `find`/`sed` (or your
   IDE's replace-in-files) per old path is enough — the folder segment is the
   only thing that changes (`core` vs `ui`).

3. **Verify** the plugin still type-checks and its own tests pass.

## Import mapping

| Old import | New import |
|---|---|
| `./wlib/system` | `./wlib/src/core/system` |
| `./wlib/clipboard` | `./wlib/src/core/clipboard` |
| `./wlib/scroll` | `./wlib/src/core/scroll` |
| `./wlib/keys` | `./wlib/src/core/keys` |
| `./wlib/theme` | `./wlib/src/core/theme` |
| `./wlib/log` | `./wlib/src/core/log` |
| `./wlib/reload` | `./wlib/src/core/reload` |
| `./wlib/command` | `./wlib/src/core/command` |
| `./wlib/dialog-fit` | `./wlib/src/core/dialog-fit` |
| `./wlib/file` | `./wlib/src/core/file` |
| `./wlib/open-folder` | `./wlib/src/core/open-folder` |
| `./wlib/export` | `./wlib/src/core/export` |
| `./wlib/export-state` | `./wlib/src/core/export-state` |
| `./wlib/help` | `./wlib/src/core/help` |
| `./wlib/dialog` | `./wlib/src/ui/dialog` |
| `./wlib/copied-flash` | `./wlib/src/ui/copied-flash` |
| `./wlib/export-controller` | `./wlib/src/ui/export-controller` |
| `./wlib/export-overlay` | `./wlib/src/ui/export-overlay` |
| `./wlib/export-result-overlay` | `./wlib/src/ui/export-result-overlay` |
| `./wlib/help-overlay` | `./wlib/src/ui/help-overlay` |

Rule of thumb: **logic / pure helpers → `src/core`**, **SolidJS/TUI components
→ `src/ui`**. If you are unsure which bucket a module is in, check the
[README](../README.md) — each module section states whether it is core or UI.

## Example

```ts
// before
import { writeSystemSnapshot } from "./persona-injector/wlib/system"
import { makeScrollState } from "./wlib/scroll"
import { DialogShell } from "./wlib/dialog"

// after
import { writeSystemSnapshot } from "./persona-injector/wlib/src/core/system"
import { makeScrollState } from "./wlib/src/core/scroll"
import { DialogShell } from "./wlib/src/ui/dialog"
```

## Need help?

Open an issue on `Wikijito7/opencode-wlib` referencing #2.
