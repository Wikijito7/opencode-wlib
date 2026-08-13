/** @jsxImportSource @opentui/solid */
/**
 * opencode-wlib — responsive dialog sizing + reusable dialog frame.
 *
 * Single entry point for the `dialog` module: provides the reactive
 * `useDialogSizing` hook backed by the host's terminal dimensions, plus
 * the `DialogShell` component. The pure fit logic lives in `dialog-fit.ts`
 * (the only pure/testable module — `@opentui/solid` is only resolvable
 * inside the opencode TUI host).
 *
 * NOTE: no `export … from "./dialog-fit"` re-exports — the plugin runtime
 * transpiler drops them and the names end up undefined. Import directly.
 * Also do not add a sibling `dialog.ts` — the host resolver may pick
 * `dialog.tsx` for `./wlib/dialog` imports and named exports would break.
 */

import { createEffect } from "solid-js"
import { useTerminalDimensions } from "@opentui/solid"
import { resolveDialogFit } from "./dialog-fit"
import type { DialogDesired, DialogFit, DialogSize } from "./dialog-fit"

/**
 * Reactive dialog sizing driven by the terminal dimensions. Returns an
 * accessor function: `sizing()` → `{ size, maxHeight }`. Recomputes on
 * terminal resize (the dimensions accessor is a reactive signal) — pair
 * with a `createEffect` calling `api.ui.dialog.setSize(sizing().size)`.
 *
 * Defensive by design: the host terminal-dimensions hook is optional. When
 * it is unavailable or throws, the accessor falls back to the DESIRED
 * size/height (the previous fixed-size behaviour) instead of crashing.
 */
export function useDialogSizing(desired: DialogDesired = {}): () => DialogFit {
  let getDimensions: (() => { width?: number; height?: number }) | undefined
  try {
    const hook = useTerminalDimensions as unknown
    if (typeof hook === "function") {
      getDimensions = (hook as () => { width?: number; height?: number })()
    }
  } catch {
    getDimensions = undefined
  }

  return () => {
    try {
      const d = getDimensions?.() ?? {}
      const width = typeof d.width === "number" && d.width > 0 ? d.width : Number.POSITIVE_INFINITY
      const height = typeof d.height === "number" && d.height > 0 ? d.height : Number.POSITIVE_INFINITY
      return resolveDialogFit({ width, height }, desired)
    } catch {
      return resolveDialogFit({ width: Number.POSITIVE_INFINITY, height: Number.POSITIVE_INFINITY }, desired)
    }
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
