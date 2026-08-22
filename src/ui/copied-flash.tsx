/** @jsxImportSource @opentui/solid */
/**
 * opencode-wlib — reusable "copied!" footer flash.
 *
 * Presentational footer piece: renders the hint (e.g. `e export`) normally
 * and swaps to `copied!` in the primary color while `copied` is true.
 * The caller passes the evaluated value (e.g. `controller.copiedFlash()`).
 *
 * @opentui/solid compiles `<CopiedFlash …>` to `createComponent`, which runs
 * the component ONCE (untracked) — a plain function component does NOT
 * re-render when its props change. The reactive `<Show>` below makes the
 * component subscribe to `props.copied` and re-render accordingly.
 */

import { Show, type JSX } from "solid-js"
import type { ThemeColorValue } from "../core/theme"

export interface CopiedFlashProps {
  copied: boolean
  hint: string
  muted: ThemeColorValue
  primary: ThemeColorValue
}

/** Renders `hint` normally, or `copied!` (in primary) while `copied` is true. Reactive via <Show>. */
export function CopiedFlash(props: CopiedFlashProps): JSX.Element {
  return (
    <Show when={props.copied} fallback={<text fg={props.muted}>{props.hint}</text>}>
      <text fg={props.primary}>copied!</text>
    </Show>
  )
}
