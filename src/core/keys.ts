/**
 * opencode-wlib — dialog-scoped key layer registration.
 *
 * Host-agnostic wrapper: a dialog declares its bindings (up/down/enter/esc…)
 * and commands, and the host adapter registers them through whichever keymap
 * API that generation exposes (v1 `keymap.registerLayer`, v2 `keymap.layer`).
 * The returned cleanup is a no-op on v2, where the layer is disposed with the
 * reactive computation that created it.
 */

import type { WlibHost } from "../host/types"

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
   * Layer priority. Higher priorities take precedence over lower ones. The
   * host defaults to 0 when omitted.
   */
  priority?: number
}

/**
 * Register a dialog-scoped key layer through the host adapter.
 * Returns a cleanup function — call it in onCleanup to unregister (a no-op
 * on v2 hosts, where disposal is owned by the reactive computation).
 */
export function registerDialogKeyLayer(
  host: WlibHost,
  config: KeyLayerConfig,
): () => void {
  return host.keymapLayer(config)
}
