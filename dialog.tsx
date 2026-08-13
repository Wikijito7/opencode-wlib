/** @jsxImportSource @opentui/solid */
/**
 * opencode-wlib — responsive dialog sizing + reusable dialog frame.
 *
 * Single entry point for the `dialog` module: re-exports the pure fit
 * logic (from `dialog-fit.ts`) and provides the reactive `useDialogSizing`
 * hook backed by the host's terminal dimensions, plus the `DialogShell`
 * component. Keep `dialog-fit.ts` as the only pure/testable module —
 * `@opentui/solid` is only resolvable inside the opencode TUI host.
 *
 * NOTE: do not add a sibling `dialog.ts` — the host resolver may pick
 * `dialog.tsx` for `./wlib/dialog` imports and named exports would break.
 */

import { createMemo, createEffect } from "solid-js"
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

// ─── DialogShell ──────────────────────────────────────────────────────────────

export interface DialogShellProps {
  title: string
  subtitle?: string
  fg: string
  muted: string
  scroll: {
    scrollRef: any
    isScrolled: () => boolean
    isAtBottom: () => boolean
    hasOverflow: () => boolean
  }
  footer?: any
  /** Desired size/height (defaults: large / 40) — falls back to fit the terminal. */
  desired?: DialogDesired
  /** Called with the resolved width tier so the host dialog size stays in sync. */
  onSizeChange?: (size: DialogSize) => void
  children: any
}

export function DialogShell(props: DialogShellProps) {
  const sizing = useDialogSizing(props.desired)

  // Keep the host dialog width in sync with the terminal (reactive resize).
  createEffect(() => {
    props.onSizeChange?.(sizing().size)
  })

  return (
    <box paddingLeft={2} paddingRight={2} paddingBottom={1} flexDirection="column" gap={1}>
      {/* Title bar */}
      <box flexDirection="row" justifyContent="space-between">
        <box flexDirection="row" gap={1}>
          <text fg={props.fg}><b>{props.title}</b></text>
          {props.subtitle ? <text fg={props.muted}>{props.subtitle}</text> : null}
        </box>
        <text fg={props.muted}>esc</text>
      </box>

      {/* "more above" indicator */}
      <text fg={props.muted}>
        {props.scroll.hasOverflow() && props.scroll.isScrolled() ? "▲ more above" : " "}
      </text>

      <scrollbox
        ref={(el) => (props.scroll.scrollRef = el)}
        flexDirection="column"
        gap={1}
        maxHeight={sizing().maxHeight}
        scrollbarOptions={{ visible: false }}
      >
        {props.children}
      </scrollbox>

      {/* "more below" indicator */}
      <text fg={props.muted}>
        {props.scroll.hasOverflow() && !props.scroll.isAtBottom() ? "▼ more below" : " "}
      </text>

      {/* Footer hints */}
      {props.footer ?? null}
    </box>
  )
}
