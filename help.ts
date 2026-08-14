/**
 * opencode-wlib — pure shortcut-help row builder.
 *
 * Single source of truth for the shortcuts table: `buildHelpRows` derives one
 * row per command from the dialog's key bindings, merging aliases that share a
 * `cmd` into a single key label. Pure and framework-free (no JSX, no solid-js,
 * no @opentui) so it can be unit-tested in isolation.
 */

import type { KeyBinding } from "./keys"

export interface HelpRow {
  /** Combined key label for a command, e.g. `"← / h"` or `"left / h"`. */
  key: string
  /** Human-readable action description (the binding's `desc`). */
  action: string
}

/** Maps key names to friendly DISPLAY labels (arrows instead of words). */
const KEY_LABELS: Record<string, string> = {
  left: "←",
  right: "→",
  up: "↑",
  down: "↓",
  pageup: "PgUp",
  pagedown: "PgDn",
  escape: "esc",
}

/** Resolve a binding key to its display label; single-char keys pass through unchanged. */
function keyLabel(key: string): string {
  return KEY_LABELS[key] ?? key
}

/**
 * Derive the shortcut help rows from a dialog's key bindings.
 *
 * Groups bindings by their `cmd`: keys that map to the same command are
 * merged into a single row with a combined key label (e.g. `"← / h"`).
 * Each key is mapped to its friendly display label (arrows, `PgUp`/`PgDn`,
 * `esc`) before joining. The array preserves the order of the first binding
 * per command, and is the single source of truth for the shortcuts table.
 */
export function buildHelpRows(bindings: KeyBinding[]): HelpRow[] {
  const byCmd = new Map<string, { keys: string[]; desc: string }>()

  for (const binding of bindings) {
    const entry = byCmd.get(binding.cmd)
    if (entry) {
      entry.keys.push(binding.key)
    } else {
      byCmd.set(binding.cmd, { keys: [binding.key], desc: binding.desc })
    }
  }

  return [...byCmd.values()].map(({ keys, desc }) => ({
    key: keys.map(keyLabel).join(" / "),
    action: desc,
  }))
}

/**
 * Build the footer line for the help overlay.
 *
 * Composes an optional `name` and `version` (each hidden when absent/empty)
 * followed by the always-present `"powered by wlib"` suffix. Pure and
 * framework-free so it can be unit-tested in isolation.
 */
export function buildFooter(name?: string, version?: string): string {
  const parts: string[] = []
  if (name) parts.push(name)
  if (version) parts.push(`v${version}`)
  parts.push("powered by wlib")
  return parts.join(" ")
}
