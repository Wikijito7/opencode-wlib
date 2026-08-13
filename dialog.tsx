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

import { createEffect, createSignal, onMount, onCleanup } from "solid-js"
import type { TuiPluginApi } from "@opencode-ai/plugin/tui"
import { resolveDialogFit } from "./dialog-fit"
import type { DialogDesired, DialogFit, DialogSize } from "./dialog-fit"
import type { ThemeColorValue } from "./theme"
import { createLog } from "./log"

// Debug logging for dialog sizing — gated by the OPENCODE_WLIB_DEBUG env var.
const dlog = createLog({ fileName: "log_wlib_dialog_sizing.log" }).log

/**
 * Reactive dialog sizing driven by the terminal dimensions via the plugin
 * API's renderer (`api.renderer`) — no context dependency, so it works in
 * plugin dialogs where `useTerminalDimensions` is unavailable.
 *
 * Returns an accessor function: `sizing()` → `{ size, maxHeight }`. The
 * renderer's `resize` event updates internal signals, so reads inside JSX
 * or a `createEffect` (e.g. `api.ui.dialog.setSize(sizing().size)`) react
 * to terminal resizes. When the renderer reports no size yet, falls back
 * to the DESIRED size/height.
 */
export function useDialogSizing(api: TuiPluginApi, desired: DialogDesired = {}): () => DialogFit {
  const renderer = api.renderer

  // Log 1 — initial read at hook creation (before signals are seeded)
  dlog(
    `[wlib:dialog] init renderer=${renderer ? "present" : "missing"} ` +
      `desired=${JSON.stringify(desired)} ` +
      `geometry w=${renderer?.width} h=${renderer?.height} ` +
      `terminal w=${renderer?.terminalWidth} h=${renderer?.terminalHeight} ` +
      `stdout w=${process.stdout.columns} h=${process.stdout.rows}`,
  )

  const [width, setWidth] = createSignal(renderer?.width ?? 0)
  const [height, setHeight] = createSignal(renderer?.height ?? 0)

  const onResize = (w: number, h: number) => {
    setWidth(w)
    setHeight(h)

    // Log 2 — resize event payload vs live re-read
    dlog(
      `[wlib:dialog] resize payload w=${w} h=${h} | live ` +
        `geometry w=${renderer?.width} h=${renderer?.height} ` +
        `terminal w=${renderer?.terminalWidth} h=${renderer?.terminalHeight}`,
    )
  }

  onMount(() => {
    renderer?.on("resize", onResize)

    // Log 3 — post-mount state (first render result)
    const fit = resolveDialogFit(
      {
        width: width() > 0 ? width() : Number.POSITIVE_INFINITY,
        height: height() > 0 ? height() : Number.POSITIVE_INFINITY,
      },
      desired,
    )
    dlog(
      `[wlib:dialog] mounted signals w=${width()} h=${height()} ` +
        `=> size=${fit.size} maxHeight=${fit.maxHeight}`,
    )
  })
  onCleanup(() => {
    renderer?.off("resize", onResize)
    dlog(`[wlib:dialog] cleanup (dialog closed)`)
  })

  return () => {
    const w = width() > 0 ? width() : Number.POSITIVE_INFINITY
    const h = height() > 0 ? height() : Number.POSITIVE_INFINITY
    return resolveDialogFit({ width: w, height: h }, desired)
  }
}

// ─── DialogShell ──────────────────────────────────────────────────────────────

export interface DialogShellProps {
  /** Plugin API — used for terminal dimensions via `api.renderer`. */
  api: TuiPluginApi
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
  /** Called with the resolved width tier so the host dialog size stays in sync. */
  onSizeChange?: (size: DialogSize) => void
  children: any
}

export function DialogShell(props: DialogShellProps) {
  const sizing = useDialogSizing(props.api, props.desired)

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
