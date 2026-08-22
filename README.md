# opencode-wlib

A custom middle-man library for all duplicated logic in opencode plugins.

Wokis Lib centralises the behaviour shared across Wokis-branded opencode plugins (persona-injector, model-usage, and future ones) so the same logic is handled in a single, simple library instead of being copy-pasted per plugin. Distributed as a git submodule — no npm dependency.

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

Typed wrapper over `api.keymap.registerLayer` for dialog-scoped key layers (bindings + commands) with a cleanup function.

**API:** `registerDialogKeyLayer(api, { bindings, commands })` → cleanup.

### `theme` — normalized theme palette

OpenCode themes expose colors under different property names across plugin code (`text` vs `foreground`, `textMuted` vs `muted`, `error` vs `red`). This helper normalizes them into one typed palette so dialogs stop drifting.

**API:** `resolveThemeColors(theme, fallbacks?)` → `{ fg, muted, red, primary, selectedText }`.

### `log` — unified debug logging

One logging pattern for every plugin: a `DEBUG` flag (env `OPENCODE_WLIB_DEBUG` or explicit), a per-plugin log file, and a `log()` that no-ops when debugging is off.

**API:** `createLog({ debug?, dir?, fileName? })` → `{ log, debug }`.

### `reload` — stale-fetch guard

Prevents out-of-order async responses from clobbering newer data.

**API:** `createLoadGuard()` → `{ invalidate(), isCurrent(gen) }`.

### `command` — palette slash commands

Every plugin registers the same shape: a `keymap.registerLayer` with a palette command (`category: "Plugin"`, `namespace: "palette"`, `slashName`) plus an optional key binding.

**API:** `registerSlashCommand(api, { name, title, slashName, key?, run })` → cleanup.

### `dialog` — responsive dialogs

Desired size/height with graceful fallback: the dialog picks the largest width tier (`medium` 60 / `large` 88 / `xlarge` 116 — mirroring opencode's widths) and the tallest scrollbox that fit the terminal, shrinking when the terminal is smaller so dialogs are never cut off (mirrors opencode's own `DialogSelect` behaviour).

**API:**
- `resolveDialogSize(terminalWidth, desired?)` → largest tier ≤ desired that fits (floor: `medium`)
- `resolveDialogMaxHeight(terminalHeight, desired?, chrome?)` → `max(8, min(desired, ⌊0.75·H⌋ − chrome))` (chrome = title/indicators/footer rows, default 8)
- `resolveDialogFit(terminal, desired?)` → `{ size, maxHeight }` (pure — test this; lives in `dialog-fit.ts`)
- `useDialogSizing(desired?)` → reactive `{ size, maxHeight }` from the host terminal dimensions (host-only import — keep out of unit tests)
- `<DialogShell title subtitle fg muted scroll footer desired onSizeChange>` → the common dialog frame; applies the responsive sizing automatically (pass `onSizeChange` → `api.ui.dialog.setSize` to keep the host in sync)

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

**Controller (`export-controller`, UI):** `createExportController(api, exportable, opts)` → `ExportController`, created inside a Solid owner (dialog render). Owns the format → destination → result state machine, a priority-2 key layer, clipboard/disk writes, and the "copied!" flash.

- `ExportControllerOptions`: `{ name: string, exportDir?: string }`
- `ExportController`: `open()`, `handleKey(key) → boolean`, `renderOverlay() → JSX.Element | null`, `renderResultOverlay() → JSX.Element | null`, `copiedFlash() → boolean`, `onCopied(listener) → cleanup`

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
// persona-injector-server.ts (server side — system snapshot writer)
import { writeSystemSnapshot, isTitleGenerator } from "./persona-injector/wlib/src/core/system"

// model-usage/analyze-domain.ts (TUI side — system snapshot reader)
import { readSystemSnapshot } from "./wlib/src/core/system"

// any dialog
import { makeScrollState } from "./wlib/src/core/scroll"
import { registerDialogKeyLayer } from "./wlib/src/core/keys"
import { resolveThemeColors } from "./wlib/src/core/theme"
import { DialogShell } from "./wlib/src/ui/dialog"
```

## Development

```bash
bun test
```

## License

MIT — see [LICENSE](LICENSE).
