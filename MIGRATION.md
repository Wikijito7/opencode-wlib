# Migration guide: OpenCode v1 → v2 host API

wlib now targets **OpenCode 2.0.27** (local reference:
`/Users/cristianpc/.local/share/opencode/repos/github.com/anomalyco/opencode`,
`package.json` → `"version": "2.0.27"`). The v1 plugin API
(`@opencode-ai/plugin/tui`) is **not supported by v2**; a plugin must be ported.

The library no longer takes the raw host API in its command/keymap, dialog,
theme, or export-controller helpers. It takes a **`WlibHost` adapter** instead:

| Generation | Factory | Import | Status |
| --- | --- | --- | --- |
| v2 | `createV2Host(context)` | `./wlib/src/host/v2` | **Supported (production)** |
| v1 | `createV1Host(api)` | `./wlib/src/host/v1` | **Deprecated** — transition only |

**Policy:** pick exactly one factory. Never mix `createV1Host` and
`createV2Host` in the same runtime adapter. The v1 adapter is removed in
opencode-wlib#5.

## Function signature migration

```ts
// before (v1: raw TuiPluginApi)
registerSlashCommand(api, opts)
registerDialogKeyLayer(api, config)
resolveThemeColors(api.theme.current)
useDialogSizing(api, desired)
createExportController(api, exportable, opts)
// <DialogShell api={api} … />

// after (v2: build the adapter once, then pass it)
import { createV2Host } from "./wlib/src/host/v2"
const host = createV2Host(context)

registerSlashCommand(host, opts)
registerDialogKeyLayer(host, config)
host.theme()                        // or resolveSemanticTheme(context.theme)
useDialogSizing(host, desired)
createExportController(host, exportable, opts)
// <DialogShell host={host} … />
```

`DialogShell` now applies the resolved width tier itself
(`host.dialog.set({ size })`); `onSizeChange` is an optional notification hook,
not the mechanism that keeps the host in sync.

## Export-controller lifetime (v2)

The export controller registers a `createEffect` (its priority-2 key layer) and
an `onCleanup` (the flash timeout), so it needs a **stable Solid owner**. A
dialog's render callback re-runs on every signal read in its body, so creating
the controller inside the callback replaces it on each re-run — dropping the old
controller's key layer and rendering the overlay against a fresh, closed
instance. Create it **once** with `createOwnedInstance` (before
`host.dialog.show`, e.g. from the keymap command) and dispose that owner from the
dialog's `onClose`:

```ts
import { createOwnedInstance } from "./wlib/src/ui/owned-instance"
import { createExportController } from "./wlib/src/ui/export-controller"

const exporterOwner = createOwnedInstance(() =>
  createExportController(host, exportable, { name: "usage" }),
)
const exporter = exporterOwner.instance   // stable across render re-runs
// …
host.dialog.show(render, () => exporterOwner.dispose())
```

`createOwnedInstance` runs the factory inside a standalone `createRoot` owner
that the transient render computation cannot dispose; only the returned
`dispose()` tears it down (exactly once).

## Command field mapping (v1 → v2)

The host adapter performs this mapping, but the shape is worth knowing:

| wlib / v1 | v2 |
| --- | --- |
| command `name` | command `id` |
| command `category` | command `group` |
| `namespace: "palette"` | `palette: true` |
| `slashName` | `slash: { name, aliases? }` |
| inline binding `{ key, cmd, desc }` | `bind` on the command (+ `bindings` ID list for named commands) |
| `keymap.registerLayer()` (returns cleanup) | `keymap.layer(factory)` (disposal owned by the reactive computation; wlib cleanup is a no-op) |
| `enter` key name | `return` key name |

## Keymap mode (v2-only)

wlib plugin-global and dialog key layers are registered with **`mode: "global"`**
on v2. OpenCode 2.0.27 defaults an omitted keymap mode to `base` and switches the
active mode to `modal` whenever a dialog is open, so a layer left at the default
is *inactive in modal/composer states* — its palette/slash entry and key bindings
stop firing exactly when the dialog is visible. `registerSlashCommand` and
`registerDialogKeyLayer` set `global` for you; pass `mode` explicitly to scope a
layer to a single mode.

`mode` is a v2-only field. The v1 adapter ignores it (v1 has no keymap-mode
concept) and forwards every other layer field unchanged.

## Theme migration (v2 semantic tokens)

`resolveSemanticTheme(theme)` maps the v2 `ResolvedTheme` onto the same
`ThemePalette`:

| palette | v2 token |
| --- | --- |
| `fg` | `text.base` |
| `muted` | `text.muted` |
| `red` | `text.feedback.error.base` |
| `primary` | `background.action.primary.focused` → `selected` → `.base` |
| `selectedText` | `text.action.primary.focused` → `selected` → `.base` |
| `background` | `background.base` |
| `panel` | `background.raised.high` → `background.raised.base` |

Selection resolves from the **focused** state first: the default v2 theme
leaves `background.action.primary.base` and `.selected` `transparent` and only
paints the visible accent on `.focused`, so reading `.base` (the old mapping)
produced an invisible selected chip and `copied!` feedback.

**Raw vs resolved keys.** `context.theme` is an already-resolved `ResolvedTheme`,
so its action-state keys drop the `$` sigil — `focused`, `selected`, `base`,
`hovered`, `pressed`, `disabled` (the host's resolver strips it via
`resolvedKey`). The `$focused`/`$selected` spelling exists only in the *raw*
theme definitions a plugin authors, never in the resolved context. A resolver
must read `.focused`/`.selected` from `context.theme`.

A value of `"transparent"` (or a zero-alpha RGBA) is treated as **absent** for
surface tokens, so the resolver falls through to `selected`, `base`, and finally
the legacy `THEME_DEFAULTS` instead of painting nothing. The same rule applies
to `selectedText`: a transparent selected-text token is *skipped* (ending at
`undefined`) because zero-alpha text would be invisible — the consumer then
falls back to its resting text color. Non-transparent RGBA objects are passed
through by identity — never string-coerced.

## Coordinated consumer migration order

wlib lands first; consumers bump their submodule only **after** the v2 wlib
tests pass.

1. **opencode-wlib** (this repo) — shared v2 contract.
2. **opencode-persona-injector** (#34) — server hooks + TUI + system-snapshot writer.
3. **opencode-model-usage** (#47) — server hooks, data layer, TUI dialogs, snapshot reader.
4. **notifications** — scope/ownership TBD.

Each consumer keeps its deprecated v1 entrypoints during the transition window
and removes them in the follow-up cleanup issues (#35, #50; wlib #5).

---

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
| `./wlib/instance` | `./wlib/src/core/instance` |
| `./wlib/dialog` | `./wlib/src/ui/dialog` |
| `./wlib/owned-instance` | `./wlib/src/ui/owned-instance` |
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
