/**
 * opencode-wlib — host adapter contract.
 *
 * A single, host-agnostic surface the library's command/keymap, dialog,
 * theme, and renderer helpers talk to. Two implementations exist:
 *
 * - `./v2` (`createV2Host`) — OpenCode 2.x (`@opencode/plugin/tui`).
 *   The supported production path.
 * - `./v1` (`createV1Host`) — OpenCode 1.x (`@opencode-ai/plugin/tui`).
 *   DEPRECATED, kept only for a transition window (removed in the v2 cleanup).
 *
 * A runtime adapter must never mix the two host APIs: pick exactly one
 * factory and pass the resulting `WlibHost` into the core/ui modules.
 *
 * Types only — no runtime values, so importing it from pure/testable modules
 * is always erased by the runtime transpiler.
 */

import type { JSX } from "solid-js"
import type { DialogSize } from "../core/dialog-fit"
import type { KeyLayerConfig } from "../core/keys"
import type { ThemePalette } from "../core/theme"

/** Which host generation an adapter targets. */
export type HostKind = "v1" | "v2"

/** Dialog presentation options (v2 `ui.dialog.set`; v1 maps to `setSize`). */
export interface HostDialogOptions {
  /** Width tier. */
  size?: DialogSize
  /** Center the dialog (v2 only; ignored by the v1 adapter). */
  centered?: boolean
}

/** Dialog lifecycle: show a render(), set presentation options, clear. */
export interface HostDialog {
  /** Show a dialog rendering `render`; optional close callback. */
  show(render: () => JSX.Element, onClose?: () => void): void
  /** Set presentation options on the active dialog. */
  set(options: HostDialogOptions): void
  /** Close the active dialog. */
  clear(): void
}

/** Terminal/render geometry, in cells. */
export interface HostDimensions {
  width: number
  height: number
}

/** Reactive terminal geometry source. */
export interface HostRenderer {
  /** Read the current geometry synchronously. */
  read(): HostDimensions
  /** Subscribe to resize events; returns an unsubscribe function. */
  subscribe(listener: (dimensions: HostDimensions) => void): () => void
}

/** A palette/global command registration. */
export interface HostCommandOptions {
  /** Command id, e.g. "analyze.show". */
  name: string
  /** Human-readable title. */
  title: string
  /** Slash completion name, e.g. "analyze" → `/analyze`. */
  slashName?: string
  /** Command group (v1 category / v2 group). Defaults to "Plugin". */
  group?: string
  /** Optional key binding, e.g. "ctrl+shift+a" (inline desc defaults to title). */
  key?: string | { key: string; desc: string }
  /** Command handler. */
  run: () => Promise<void> | void
}

/**
 * The host surface every wlib command/keymap/dialog/theme helper uses.
 * Implemented once per host generation; never mixed within one adapter.
 */
export interface WlibHost {
  /** Which host generation this adapter targets. */
  readonly kind: HostKind
  /** Register a palette command (+ optional key binding). Returns cleanup. */
  registerCommand(options: HostCommandOptions): () => void
  /** Register a dialog-scoped key layer. Returns cleanup. */
  keymapLayer(config: KeyLayerConfig): () => void
  /** Dialog lifecycle for the host. */
  readonly dialog: HostDialog
  /** Reactive terminal geometry. */
  readonly renderer: HostRenderer
  /** Resolve the current semantic theme palette (RGBA values preserved). */
  theme(): ThemePalette
}
