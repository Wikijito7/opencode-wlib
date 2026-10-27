/** @jsxImportSource @opentui/solid */
/**
 * opencode-wlib — responsive dialog sizing + reusable dialog frame.
 *
 * Single entry point for the `dialog` module: provides the reactive
 * `useDialogSizing` hook backed by the host adapter's terminal geometry, plus
 * the `DialogShell` component. The pure fit logic lives in `dialog-fit.ts`
 * (the only pure/testable module — `@opentui/solid` is only resolvable inside
 * the opencode TUI host).
 *
 * The host adapter owns the terminal dimensions and the dialog lifecycle
 * (`dialog.set({ size })`), so this module never touches the raw host API.
 *
 * NOTE: no `export … from "../core/dialog-fit"` re-exports — the plugin runtime
 * transpiler drops them and the names end up undefined. Import directly.
 * Also do not add a sibling `dialog.ts` — the host resolver may pick
 * `dialog.tsx` for `./wlib/dialog` imports and named exports would break.
 */

import { createEffect, createSignal, onMount, onCleanup } from "solid-js"
import { resolveDialogFit } from "../core/dialog-fit"
import type { DialogDesired, DialogFit, DialogSize } from "../core/dialog-fit"
import type { ThemeColorValue } from "../core/theme"
import type { HostDimensions, WlibHost } from "../host/types"
import { createLog } from "../core/log"

// Debug logging for dialog sizing — gated by the OPENCODE_WLIB_DEBUG env var.
const dlog = createLog({ fileName: "log_wlib_dialog_sizing.log" }).log

/**
 * Reactive dialog sizing driven by the host adapter's terminal geometry.
 * The adapter subscribes to host resize events, so reads inside JSX or a
 * `createEffect` react to terminal resizes.
 *
 * Returns an accessor function: `sizing()` → `{ size, maxHeight }`. When the
 * host reports no geometry yet, falls back to the DESIRED size/height.
 */
export function useDialogSizing(host: WlibHost, desired: DialogDesired = {}): () => DialogFit {
  const [dimensions, setDimensions] = createSignal<HostDimensions>(host.renderer.read())

  dlog(
    `[wlib:dialog] init kind=${host.kind} ` +
      `desired=${JSON.stringify(desired)} ` +
      `geometry w=${dimensions().width} h=${dimensions().height}`,
  )

  onMount(() => {
    const unsubscribe = host.renderer.subscribe((next) => {
      setDimensions(next)
      dlog(`[wlib:dialog] resize w=${next.width} h=${next.height}`)
    })
    onCleanup(() => {
      unsubscribe()
      dlog(`[wlib:dialog] cleanup (dialog closed)`)
    })
  })

  return () => {
    const { width, height } = dimensions()
    const w = width > 0 ? width : Number.POSITIVE_INFINITY
    const h = height > 0 ? height : Number.POSITIVE_INFINITY
    return resolveDialogFit({ width: w, height: h }, desired)
  }
}

// ─── DialogShell ──────────────────────────────────────────────────────────────

export interface DialogShellProps {
  /** Host adapter — used for terminal dimensions and dialog lifecycle. */
  host: WlibHost
  title: string
  subtitle?: string
  /** Theme color — hex string or OpenCode RGBA object (see `ThemeColorValue`). */
  fg: ThemeColorValue
  /** Theme color — hex string or OpenCode RGBA object (see `ThemeColorValue`). */
  muted: ThemeColorValue
  scroll: {
    scrollRef: any
    isScrolled: () => boolean
    isAtBottom: () => boolean
    hasOverflow: () => boolean
  }
  footer?: any
  /** Desired size/height (defaults: large / 40) — falls back to fit the terminal. */
  desired?: DialogDesired
  /** Called with the resolved width tier (host sizing is applied internally). */
  onSizeChange?: (size: DialogSize) => void
  children: any
}

export function DialogShell(props: DialogShellProps) {
  const sizing = useDialogSizing(props.host, props.desired)

  // Keep the host dialog width in sync with the terminal (reactive resize).
  createEffect(() => {
    const size = sizing().size
    props.host.dialog.set({ size })
    props.onSizeChange?.(size)
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
