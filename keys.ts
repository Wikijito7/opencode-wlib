/**
 * opencode-wlib — dialog-scoped key layer registration.
 *
 * Thin, typed wrapper over the TUI `keymap.registerLayer` used by every
 * dialog: bindings (up/down/enter/esc…) + commands, with a cleanup
 * function for `onCleanup`.
 */

import type { TuiPluginApi } from "@opencode-ai/plugin/tui"

export interface KeyBinding {
  key: string
  cmd: string
  desc: string
}

export interface KeyCommand {
  name: string
  title: string
  run: () => Promise<void> | void
}

export interface KeyLayerConfig {
  bindings: KeyBinding[]
  commands: KeyCommand[]
  /**
   * Layer priority — forwarded to `api.keymap.registerLayer`. Higher
   * priorities take precedence over lower ones. The TUI API defaults to 0
   * when omitted.
   */
  priority?: number
}

/**
 * Register a dialog-scoped key layer on the TUI API.
 * Returns a cleanup function — call it in onCleanup to unregister.
 */
export function registerDialogKeyLayer(
  api: TuiPluginApi,
  config: KeyLayerConfig,
): () => void {
  return api.keymap.registerLayer(config)
}
