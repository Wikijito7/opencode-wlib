# opencode-wlib

A custom middle-man library for all duplicated logic in opencode plugins.

Wokis Lib centralises the behaviour shared across Wokis-branded opencode plugins (persona-injector, model-usage, and future ones) so the same logic is handled in a single, simple library instead of being copy-pasted per plugin. Distributed as a git submodule — no npm dependency.

## Host adapters (v1 / v2)

wlib talks to the host through a single, host-agnostic contract — `WlibHost`
(`src/host/types.ts`) — instead of the raw plugin API. Each OpenCode plugin
generation has its **own** adapter implementation; a runtime must use exactly
one of them and never mix the two. The command/keymap, dialog, theme and
renderer helpers all take a `WlibHost`.

| Generation | Factory | Package | Status |
| --- | --- | --- | --- |
| OpenCode **v2** | `createV2Host(context)` (`src/host/v2.ts`) | `@opencode/plugin/tui` | **Supported (production)** |
| OpenCode **v1** | `createV1Host(api)` (`src/host/v1.ts`) | `@opencode-ai/plugin/tui` | **Deprecated** — transition only |

`WlibHost` exposes:

| Member | Purpose |
| --- | --- |
| `kind` | `"v1" \| "v2"` — which generation the adapter targets. |
| `registerCommand(options)` | Palette/slash command (+ optional key binding) → cleanup. |
| `keymapLayer(config)` | Dialog-scoped key layer → cleanup (v2 cleanup is a no-op; disposal is owned by the reactive computation). |
| `dialog` | `show(render, onClose?)`, `set({ size, centered? })`, `clear()`. |
| `renderer` | `read()` → `{ width, height }`; `subscribe(listener)` → unsubscribe. |
| `theme()` | Semantic palette (`fg`, `muted`, `red`, `primary`, `selectedText`, `background`, `panel`); RGBA values preserved. |

Create the host once (v2), then pass it to every helper:

```tsx
import { Plugin } from "@opencode/plugin/tui"
import { createV2Host } from "./wlib/src/host/v2"
import { registerSlashCommand } from "./wlib/src/core/command"
import { DialogShell } from "./wlib/src/ui/dialog"

export default Plugin.define({
  id: "my.plugin",
  setup(context) {
    const host = createV2Host(context)
    const cleanup = registerSlashCommand(host, { name: "my.open", title: "Open", slashName: "my", run: () => {} })
    return cleanup
  },
})
```

## Modules

### `system` — system prompt snapshot contract

Solves the plugin-hook-ordering problem for system-prompt observers. opencode fires `experimental.chat.system.transform` hooks in plugin registration order, and plugins mutate the same `system` array sequentially. A plugin that mutates the system (e.g. persona-injector) always sees the FINAL text; an observer (e.g. model-usage) may run before the mutation and capture a stale snapshot.

**The contract:** the mutator persists the final system prompt it produced, keyed by session, to a canonical sidecar file. Observers read it at analyze time and prefer it over their own (potentially pre-mutation) capture. Both sides share this module, so the file path, schema, and throttling never drift.

- **Writer:** persona-injector — `experimental.chat.system.transform`, after injecting
- **Reader:** model-usage — `/analyze`, System tab + raw visor

**Sidecar file:** `~/.config/opencode/plugins/persona-injector/system-snapshots.json`

```jsonc
{
  "ses_abc123": {
    "ts": 1786612122553,        // epoch ms of the last write
    "rawText": "Instructions from: persona-injector\n## ...\n\nYou are opencode..." // final system as sent
  }
}
```

**API:**

| Function | Description |
|---|---|
| `writeSystemSnapshot(sessionID, rawText, file?, opts?)` | Persist the final system for a session. Throttled: no rewrite when the token drift is ≤ 32 (only the timestamp refreshes after 5 min). Serialized writes, FIFO eviction (1000 entries cap / 100 purge). No-ops on missing session or empty text (title-gen must not clobber the last real snapshot). |
| `readSystemSnapshot(sessionID, file?)` | Read the last persisted final system for a session, or `null`. |
| `isTitleGenerator(system)` | Detects the tiny "You are a title generator" system prompt — must be excluded from snapshots. |
| `estimateTokens(text)` | char/4 token estimate. |

`file` and `opts` (`driftThreshold`, `maxEntries`, `purgeCount`, `tsRefreshMs`, `now`) are injectable for tests.

### `clipboard` — system clipboard writes

Writes text to the system clipboard via native commands (pbcopy / wl-copy / xclip / xsel / powershell.exe) with an OSC 52 escape-sequence fallback (tmux/screen wrapping included) for terminal-only environments.

**API:** `writeClipboard(text)` → `Promise<boolean>`, `resolveClipboardCandidates(platform)` (pure), `buildOsc52Sequence(text)` (pure).

### `scroll` — scrollbox state for dialogs

Solid-agnostic scroll state (`makeScrollState(createSignal)`) tracking overflow/position with up/down/page-up/page-down handlers. This is the canonical full version — plugin-local trimmed copies drift (e.g. missing page up/down).

**API:** `makeScrollState(createSignal)` → `ScrollState` (`scrollRef`, `isScrolled`, `isAtBottom`, `hasOverflow`, `handleUp`, `handleDown`, `handlePageUp`, `handlePageDown`, `checkOverflow`, `scrollToTop`).

### `keys` — dialog key layer

Host-agnostic wrapper for dialog-scoped key layers (bindings + commands). The
host adapter registers them through the active host's keymap API (v1
`keymap.registerLayer`, v2 `keymap.layer`).

**API:** `registerDialogKeyLayer(host, { bindings, commands, priority?, mode? })` → cleanup.

On v2 the layer is registered with `mode: "global"` by default. On OpenCode
2.0.27 the host defaults a layer to `base` while an open dialog pushes the
active mode to `modal`, so without this the layer (and its key bindings) would
be inactive exactly when the dialog is visible. Pass `mode` explicitly to scope
a layer to one mode; the v1 adapter ignores it (v1 has no mode concept).

### `theme` — normalized theme palette

Two resolvers feed the same `ThemePalette`, so dialogs stop drifting:

- `resolveSemanticTheme(theme)` — **v2**: maps the resolved `ResolvedTheme` (`context.theme`) semantic tokens (`text.base`, `text.muted`, `text.feedback.error.base`, `background.action.primary.focused`/`selected`/`.base`, `text.action.primary.focused`/`selected`/`.base`, `background.base`, `background.raised.high`). Resolved action states carry **no `$` sigil** — `focused`/`selected` here are the *resolved* keys, whereas the raw theme definitions a plugin authors spell them `$focused`/`$selected` (the host's resolver strips the `$`). Selection tokens resolve from the **focused** state first (then `selected`, then `base`) because the default v2 theme leaves the base/selected surface `transparent` and only paints the accent on focus. Transparent values (`"transparent"` or zero-alpha RGBA) are treated as absent for surfaces *and* for `selectedText` (zero-alpha text would be invisible), so a theme without a visible focused state cannot paint an invisible chip or label; RGBA values otherwise pass through untouched.
- `resolveThemeColors(theme, fallbacks?)` — **v1 / loose**: normalizes drifting property names (`text`/`foreground`, `textMuted`/`muted`, `error`/`red`).

**API:** `resolveSemanticTheme(theme)` / `resolveThemeColors(theme, fallbacks?)` → `{ fg, muted, red, primary, selectedText, background, panel }`.

### `log` — unified debug logging

One logging pattern for every plugin: a `DEBUG` flag (env `OPENCODE_WLIB_DEBUG` or explicit), a per-plugin log file, and a `log()` that no-ops when debugging is off.

**API:** `createLog({ debug?, dir?, fileName? })` → `{ log, debug }`.

### `reload` — stale-fetch guard

Prevents out-of-order async responses from clobbering newer data.

**API:** `createLoadGuard()` → `{ invalidate(), isCurrent(gen) }`.

### `command` — palette slash commands

Every plugin registers the same shape: a palette command (`category: "Plugin"`
in v1 / `group: "Plugin"` + `palette: true` in v2, with slash completion) plus
an optional key binding. The host adapter maps the fields to the active host.
On v2 the command's layer is registered `mode: "global"` so the palette/slash
entry and its binding stay reachable while a dialog is open (2.0.27 defaults a
layer to `base`, inactive under the dialog's `modal` mode).

**API:** `registerSlashCommand(host, { name, title, slashName, key?, run })` → cleanup.

### `dialog` — responsive dialogs

Desired size/height with graceful fallback: the dialog picks the largest width tier (`medium` 60 / `large` 88 / `xlarge` 116 — mirroring opencode's widths) and the tallest scrollbox that fit the terminal, shrinking when the terminal is smaller so dialogs are never cut off (mirrors opencode's own `DialogSelect` behaviour).

**API:**
- `resolveDialogSize(terminalWidth, desired?)` → largest tier ≤ desired that fits (floor: `medium`)
- `resolveDialogMaxHeight(terminalHeight, desired?, chrome?)` → `max(8, min(desired, ⌊0.75·H⌋ − chrome))` (chrome = title/indicators/footer rows, default 8)
- `resolveDialogFit(terminal, desired?)` → `{ size, maxHeight }` (pure — test this; lives in `dialog-fit.ts`)
- `useDialogSizing(host, desired?)` → reactive `{ size, maxHeight }` from the host adapter's terminal dimensions (host-only import — keep out of unit tests)
- `<DialogShell host title subtitle fg muted scroll footer desired onSizeChange>` → the common dialog frame; applies the responsive sizing automatically and keeps the host dialog in sync via `host.dialog.set({ size })` (the optional `onSizeChange` is a notification hook)

### `instance` / `owned-instance` — dialog-scoped stable instance (core + UI)

A dialog's render callback re-runs whenever a signal read directly in its body
changes. Creating a stateful controller inside it replaces the instance on every
re-run and disposes its effects (the confirmed export-popup bug: the priority-2
key layer dropped and the overlay rendered against a fresh, closed instance).
These two modules keep one instance alive for the whole dialog.

- `instance` (**core**, pure): `createInstanceSlot(factory, disposeInstance?)` →
  `InstanceSlot<T>` with `created()`, `get()` (creates on first call; throws
  after dispose), `dispose()` (runs the optional disposer once, idempotent).
- `owned-instance` (**UI**): `createOwnedInstance(factory)` → `{ instance, dispose() }`.
  Runs the factory exactly once inside a stable Solid `createRoot` owner and
  returns the same `instance` across render-callback re-runs; effects/`onCleanup`
  the factory registers belong to that root. Call `dispose()` from the dialog's
  `onClose` (escape, replacement, close) so the controller's priority-2 key layer
  and flash timeout are torn down exactly once.

Owner guarantee: `createRoot` called with a dispose-taking callback creates a
standalone owner that is **not** registered in the calling computation's `owned`
list, so a re-run or teardown of the transient dialog render computation cannot
dispose it — only the returned `dispose()` can (verified against Solid 1.9.12,
`createRoot`/`cleanNode`).

```tsx
// Create BEFORE host.dialog.show (e.g. from the keymap command); it stays alive
// until the dialog's onClose disposes it.
const exporterOwner = createOwnedInstance(() =>
  createExportController(host, exportable, { name: "usage" }),
)
const exporter = exporterOwner.instance

host.dialog.show(() => {
  // …render using exporter (same instance on every re-run)…
}, () => {
  exporterOwner.dispose()
})
```

**API:**

| Export | Kind | Description |
|---|---|---|
| `createInstanceSlot(factory, disposeInstance?)` | core | Create-once / dispose-once slot; `get()` throws after `dispose()`. |
| `InstanceSlot<T>` | core | `{ created(): boolean, get(): T, dispose(): void }`. |
| `createOwnedInstance(factory)` | UI | Factory-once value in a stable `createRoot` owner → `{ instance, dispose() }`. |
| `OwnedInstance<T>` | UI | `{ readonly instance: T, dispose(): void }`. |

### `export` — export pipeline (core + UI)

A reusable export flow shared by every plugin that needs to dump data (usage, analyze, …). The **contract and pure helpers live in core** (`export`, `export-state`, `file`, `open-folder`); the **SolidJS/TUI pieces live in UI** (`export-controller`, `export-overlay`, `export-result-overlay`). The actual serializers (`build(format)`) are implemented by the host plugin, NOT here.

**Contract (`export`, core):**

| Export | Description |
|---|---|
| `ExportFormat` | `"markdown" \| "csv" \| "json" \| "text"` |
| `ExportFormatOption` | `{ id: ExportFormat, label: string }` |
| `EXPORT_FORMATS` | The four supported formats, in display order. |
| `formatToExtension(format)` | Map a format to its file extension (`md`/`csv`/`json`/`txt`). |
| `Exportable` | Contract each implementer satisfies: `{ formats: ExportFormatOption[], build(format): string }`. |

**State (`export-state`, core):**

| Function | Description |
|---|---|
| `ExportKeyAction` | `"navigate-up" \| "navigate-down" \| "confirm" \| "close" \| "none"` |
| `exportKeyAction(key, isOpen)` | Map a key to an export action (`none` when closed/unrelated). |
| `cycleExportIndex(current, delta, count)` | Move selection by ±1 with wraparound (0 for empty list). |

**File helpers (`file`, core):** path builders are pure; `writeFile` swallows errors and returns a boolean.

| Function | Description |
|---|---|
| `EXPORT_BASE_DIR` | Default save dir `~/.config/opencode/export`. |
| `timestamp()` | Local `YYYYMMDD-HHmmssNNN` stamp for filenames. |
| `exportFilePath(name, ext, ts, base?)` | Build the full destination path (defaults to `EXPORT_BASE_DIR`). |
| `writeFile(filePath, content)` | Best-effort write (creates parent dirs) → `Promise<boolean>`. |

**Open folder (`open-folder`, core):** `resolveOpenFolderCommand(platform, dir)` (pure) → `{ cmd, args } \| null` for `open`/`xdg-open`/`explorer`; `openFolder(dir)` → `Promise<boolean>` spawns detached, ignores result.

**Controller (`export-controller`, UI):** `createExportController(host, exportable, opts)` → `ExportController`. Because it registers a `createEffect` (priority-2 key layer) and `onCleanup` (flash timeout), it must be owned by a stable Solid owner: create it **once** through `createOwnedInstance` (see above) and keep that instance for the whole dialog — creating it inside the render callback replaces it on every re-run. Owns the format → destination → result state machine, the priority-2 key layer (registered through the host adapter), clipboard/disk writes, and the "copied!" flash.

`renderOverlay()`/`renderResultOverlay()` each return a persistently mounted `JSX.Element` (`<Show>` wrapper) driven by internal `showExport`/`showResult` signals — never `null`. Because the host renders the JSX expression once, a conditional `null` would establish no reactive dependency; keeping the `Show` mounted lets the overlay react to `open()`/`close()` regardless.

- `ExportControllerOptions`: `{ name: string, exportDir?: string }`
- `ExportController`: `open()`, `handleKey(key) → boolean`, `renderOverlay() → JSX.Element` (persistent `<Show>`, not nullable), `renderResultOverlay() → JSX.Element` (persistent `<Show>`, not nullable), `copiedFlash() → boolean`, `onCopied(listener) → cleanup`

**Overlays (`export-overlay`, `export-result-overlay`, UI):** fully presentational popups (no key handling, no side effects). `ExportOverlay(props)` lists format/destination options (`ExportOverlayOption`, `ExportOverlayProps`); `ExportResultOverlay(props)` reports the saved path (or error) with `Close`/`Open` buttons (`ExportResultOverlayProps`).

### `help` — shortcut help (core + UI)

**Builder (`help`, core):** pure, framework-free source of truth for the shortcuts table.

| Function | Description |
|---|---|
| `HelpRow` | `{ key: string, action: string }` (combined key label + description). |
| `buildHelpRows(bindings)` | One row per `cmd`; merges aliased keys into a combined label (e.g. `← / h`). |
| `buildFooter(name?, version?)` | `"name vX powered by wlib"` (parts hidden when absent). |

**Overlay (`help-overlay`, UI):** `HelpOverlay(props)` — absolutely-positioned popup rendering `HelpRow`s (from `buildHelpRows`) with an optional bottom-right `name`/`version` footer (`HelpOverlayProps`).

### `copied-flash` — reactive "copied!" footer flash (UI)

`CopiedFlash(props)` renders `hint` normally and swaps to `copied!` (in primary) while `copied` is true. Reactive via `<Show>`; caller passes the evaluated value (e.g. `controller.copiedFlash()`).

| Prop | Description |
|---|---|
| `CopiedFlashProps` | `{ copied: boolean, hint: string, muted: ThemeColorValue, primary: ThemeColorValue }` |

## Usage as a git submodule

```bash
# add to a plugin repo (wlib/ inside the plugin folder — never inside an
# existing shared/ dir, those hold plugin-local helpers)
git submodule add https://github.com/Wikijito7/opencode-wlib <plugin-folder>/wlib

# after cloning / pulling a repo that uses it
git submodule update --init --recursive

# update to the latest wlib commit
git submodule update --remote --merge
git commit -m "chore: bump opencode-wlib"
```

Import from plugins:

```ts
// v2 host adapter (create once from the plugin context)
import { createV2Host } from "./wlib/src/host/v2"

// persona-injector-server.ts (server side — system snapshot writer)
import { writeSystemSnapshot, isTitleGenerator } from "./persona-injector/wlib/src/core/system"

// model-usage/analyze-domain.ts (TUI side — system snapshot reader)
import { readSystemSnapshot } from "./wlib/src/core/system"

// any dialog
import { makeScrollState } from "./wlib/src/core/scroll"
import { registerSlashCommand } from "./wlib/src/core/command"
import { registerDialogKeyLayer } from "./wlib/src/core/keys"
import { resolveSemanticTheme } from "./wlib/src/core/theme"
import { createOwnedInstance } from "./wlib/src/ui/owned-instance"
import { DialogShell } from "./wlib/src/ui/dialog"
```

## Development

```bash
bun test
```

## v2 migration

The library targets OpenCode **2.0.27+**. See [MIGRATION.md](./MIGRATION.md) for
the v1 → v2 import/API mapping and the coordinated consumer migration order.

## License

MIT — see [LICENSE](LICENSE).
