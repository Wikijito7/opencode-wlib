/** @jsxImportSource @opentui/solid */
/**
 * opencode-wlib — shortcut help overlay.
 *
 * Renders `HelpRow`s (built by the pure `buildHelpRows` in `./help`) as an
 * absolutely-positioned popup that floats OVER the dialog content via
 * `position="absolute"` + a high `zIndex`. Percentage `width`/`height` are
 * supported by @opentui's box (see RenderableOptions), so `100%` reliably
 * covers the parent dialog area.
 */

import type { JSX } from "solid-js"
import type { HelpRow } from "./help"
import type { ThemeColorValue } from "./theme"

/**
 * Opaque background used when no `bg` prop is supplied, so the dialog
 * content behind the overlay is always fully covered (alpha = 1).
 */
const DEFAULT_BG: ThemeColorValue = "#0b0b0f"

export interface HelpOverlayProps {
  rows: HelpRow[]
  fg: unknown
  muted: unknown
  title?: string
  /**
   * Opaque background color for the overlay box (hex string or OpenCode RGBA
   * with alpha 1). Defaults to {@link DEFAULT_BG} so the dialog behind is
   * never visible through the popup.
   */
  bg?: ThemeColorValue
}

/**
 * Popup-style overlay that floats OVER the dialog content.
 *
 * The outer `<box>` is absolutely positioned with a high `zIndex`, so it
 * covers the parent dialog box regardless of scroll state. It spans the
 * dialog area via `width`/`height` + `flexGrow`.
 */
export function HelpOverlay(props: HelpOverlayProps): JSX.Element {
  return (
    <box
      position="absolute"
      zIndex={10}
      width="100%"
      height="100%"
      flexGrow={1}
      flexDirection="column"
      alignItems="center"
      padding={2}
      backgroundColor={props.bg ?? DEFAULT_BG}
    >
      <box
        borderStyle="round"
        borderColor={props.fg}
        width="100%"
        flexGrow={1}
        flexDirection="column"
        gap={1}
        paddingLeft={2}
        paddingRight={2}
        paddingTop={1}
        paddingBottom={1}
      >
        {props.title ? (
          <text fg={props.fg}><b>{props.title}</b></text>
        ) : null}

        {/* Header */}
        <box flexDirection="row" gap={3}>
          <text fg={props.fg}><b>Key</b></text>
          <text fg={props.fg}><b>Action</b></text>
        </box>

        {/* Rows */}
        {props.rows.map((row) => (
          <box flexDirection="row" gap={3}>
            <text fg={props.fg}>{row.key}</text>
            <text fg={props.muted}>{row.action}</text>
          </box>
        ))}
      </box>
    </box>
  )
}
