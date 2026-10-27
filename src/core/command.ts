/**
 * opencode-wlib — palette slash command registration.
 *
 * Every plugin registers the same shape: a palette command
 * (`category: "Plugin"` / `group: "Plugin"`, slash completion) plus an
 * optional key binding. This helper forwards that shape to the host adapter,
 * which maps it onto the active host's keymap API.
 */

import type { WlibHost } from "../host/types"

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
 * Register a palette slash command (+ optional key binding) through the host
 * adapter. Returns a cleanup function.
 */
export function registerSlashCommand(
  host: WlibHost,
  opts: SlashCommandOptions,
): () => void {
  return host.registerCommand({
    name: opts.name,
    title: opts.title,
    slashName: opts.slashName,
    group: "Plugin",
    key: opts.key,
    run: opts.run,
  })
}
