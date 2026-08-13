/**
 * opencode-wlib — responsive dialog sizing (host wiring).
 *
 * Re-exports the pure fit logic (see `dialog-fit.ts`) and adds the reactive
 * hook backed by the host's terminal dimensions. `@opentui/solid` is only
 * resolvable inside the opencode TUI host, so keep this module out of unit
 * tests — test `dialog-fit.ts` instead.
 */

import { createMemo } from "solid-js"
import { useTerminalDimensions } from "@opentui/solid"
import type { DialogDesired, DialogSize } from "./dialog-fit"
export {
  resolveDialogFit,
  resolveDialogMaxHeight,
  resolveDialogSize,
  DIALOG_WIDTHS,
} from "./dialog-fit"
export type { DialogDesired, DialogFit, DialogSize } from "./dialog-fit"

export interface DialogSizing {
  size: () => DialogSize
  maxHeight: () => number
}

/**
 * Reactive dialog sizing driven by the terminal dimensions. Recomputes on
 * terminal resize — pair with a `createEffect` calling
 * `api.ui.dialog.setSize(size)` to keep the dialog in sync.
 */
export function useDialogSizing(desired: DialogDesired = {}): DialogSizing {
  const dimensions = useTerminalDimensions()
  const fit = createMemo(() =>
    resolveDialogFit({ width: dimensions().width, height: dimensions().height }, desired),
  )
  return {
    size: () => fit().size,
    maxHeight: () => fit().maxHeight,
  }
}
