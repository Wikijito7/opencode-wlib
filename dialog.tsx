/** @jsxImportSource @opentui/solid */
/**
 * opencode-wlib — reusable dialog frame.
 *
 * The common dialog skeleton shared by every plugin: title bar with
 * `esc`, scrollable content with `▲ more above` / `▼ more below`
 * indicators, and a footer. Responsive by default — the scrollbox height
 * and the dialog width tier follow the terminal size (desired values with
 * graceful fallback), so dialogs never get cut off on small terminals.
 *
 * Pair with `makeScrollState` + `registerDialogKeyLayer`.
 */

import { createEffect } from "solid-js"
import { useDialogSizing } from "./dialog"
import type { DialogDesired, DialogSize } from "./dialog-fit"

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
