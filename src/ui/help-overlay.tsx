/** @jsxImportSource @opentui/solid */
/**
 * opencode-wlib — shortcut help overlay.
 *
 * Renders `HelpRow`s (built by the pure `buildHelpRows` in `../core/help`) as an
 * absolutely-positioned popup that floats OVER the dialog content via
 * `position="absolute"` + a high `zIndex`. It pins exactly to the parent's
 * bounds using the `left`/`top`/`right`/`bottom` offsets supported by
 * @opentui's box (see RenderableOptions), so it spans the dialog area without
 * overshooting a couple rows taller than the dialog.
 */

import type { JSX } from "solid-js"
import { buildFooter, type HelpRow } from "../core/help"
import type { ThemeColorValue } from "../core/theme"

export interface HelpOverlayProps {
  rows: HelpRow[]
  fg: unknown
  muted: unknown
  title?: string
  /** Optional overlay name shown in the bottom-right footer (hidden when absent). */
  name?: string
  /** Optional overlay version shown in the bottom-right footer (hidden when absent). */
  version?: string
  /**
   * Opaque background color for the overlay box (hex string or OpenCode RGBA
   * with alpha 1). Pass `resolveThemeColors(api.theme.current).background` so
   * the dialog behind is never visible through the popup.
   */
  bg: ThemeColorValue
}

/**
 * Popup-style overlay that floats OVER the dialog content.
 *
 * The outer `<box>` is absolutely positioned with a high `zIndex`, so it
 * covers the parent dialog box regardless of scroll state. It pins exactly to
 * the parent's bounds via `left`/`top`/`right`/`bottom`, rendering rows
 * tightly and anchoring an optional footer to the bottom-right.
 */
export function HelpOverlay(props: HelpOverlayProps): JSX.Element {
  const maxKey = Math.max(0, ...props.rows.map((r) => r.key.length))
  return (
    <box
      position="absolute"
      zIndex={10}
      left={0}
      top={0}
      right={0}
      bottom={0}
      flexDirection="column"
      paddingLeft={2}
      paddingRight={2}
      paddingTop={1}
      paddingBottom={1}
      backgroundColor={props.bg}
    >
      {/* Title bar */}
      <box flexDirection="row" justifyContent="space-between">
        {props.title ? <text fg={props.fg}><b>{props.title}</b></text> : null}
        <text fg={props.muted}>esc</text>
      </box>

      {/* Spacer row between header and shortcut list */}
      <text> </text>

      {/* Rows */}
      {props.rows.map((row) => (
        <box flexDirection="row">
          <text fg={props.fg}>{row.key.padEnd(maxKey)}</text>
          <text fg={props.muted}>  {row.action}</text>
        </box>
      ))}

      {/* Footer (bottom-right) */}
      <box flexGrow={1} />
      <box flexDirection="row" justifyContent="flex-end">
        <text fg={props.muted}>{buildFooter(props.name, props.version)}</text>
      </box>
    </box>
  )
}
