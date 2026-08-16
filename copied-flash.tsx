/** @jsxImportSource @opentui/solid */
/**
 * opencode-wlib — reusable "copied!" footer flash.
 *
 * Presentational footer piece: renders the hint (e.g. `e export`) normally
 * and swaps to `copied!` in the primary color while `copied()` is true.
 * Wire it to the export controller's `copiedFlash()` signal.
 */

import type { JSX } from "solid-js"
import type { ThemeColorValue } from "./theme"

export interface CopiedFlashProps {
  copied: () => boolean
  hint: string
  muted: ThemeColorValue
  primary: ThemeColorValue
}

/** Renders `hint` normally, or `copied!` (in primary) while `copied()` is true. */
export function CopiedFlash(props: CopiedFlashProps): JSX.Element {
  return props.copied()
    ? <text fg={props.primary}>copied!</text>
    : <text fg={props.muted}>{props.hint}</text>
}