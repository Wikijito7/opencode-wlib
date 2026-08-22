/**
 * opencode-wlib — palette slash command registration.
 *
 * Every plugin registers the same shape: a `keymap.registerLayer` with a
 * palette command (`category: "Plugin"`, `namespace: "palette"`,
 * `slashName`) plus an optional key binding. This helper builds it and
 * returns the cleanup function.
 */

import type { TuiPluginApi } from "@opencode-ai/plugin/tui"

export interface SlashCommandOptions {
  /** Command id, e.g. "analyze.show". */
  name: string
  /** Human-readable title, e.g. "Analyze Session Tokens". */
  title: string
  /** Slash command name, e.g. "analyze" → `/analyze`. */
  slashName: string
  /** Optional key binding, e.g. "ctrl+shift+a" (desc defaults to title). */
  key?: string | { key: string; desc: string }
  /** Command handler. */
  run: () => Promise<void> | void
}

/**
 * Register a palette slash command (+ optional key binding) on the TUI API.
 * Returns a cleanup function.
 */
export function registerSlashCommand(
  api: TuiPluginApi,
  opts: SlashCommandOptions,
): () => void {
  const keySpec = typeof opts.key === "string"
    ? { key: opts.key, desc: opts.title }
    : opts.key

  return api.keymap.registerLayer({
    commands: [
      {
        name: opts.name,
        title: opts.title,
        category: "Plugin",
        namespace: "palette",
        slashName: opts.slashName,
        run: opts.run,
      },
    ],
    bindings: keySpec
      ? [{ key: keySpec.key, cmd: opts.name, desc: keySpec.desc }]
      : [],
  })
}
