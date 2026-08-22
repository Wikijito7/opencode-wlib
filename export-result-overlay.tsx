/** @jsxImportSource @opentui/solid */
/**
 * opencode-wlib — export result overlay.
 *
 * A small, fully presentational popup shown after an export is written to
 * disk. It reports the destination path (or an error), and offers `Close`
 * and `Open` buttons. It does NOT handle key presses and has no side effects —
 * the parent controller owns `focus` and the navigation.
 */

import type { JSX } from "solid-js"
import { RGBA } from "@opentui/core"
import type { ThemeColorValue } from "./theme"
import { DIALOG_WIDTHS } from "./dialog-fit"

export interface ExportResultOverlayProps {
  /** Absolute path of the written file, or null when the write failed. */
  path: string | null
  /** True when the file could not be saved (path will be null). */
  error: boolean
  /** Focused button: 0 = Close, 1 = Open. */
  focus: number
  /** Override for the title bar text. Defaults to "Exported". */
  title?: string
  /** Foreground color. */
  fg: ThemeColorValue
  /** Muted color for secondary text, the `esc` label and the footer line. */
  muted: ThemeColorValue
  /** Accent color used to highlight the focused button. */
  primary: ThemeColorValue
  /** Text color used on the focused button (may be undefined). */
  selectedText: ThemeColorValue | undefined
  /** Opaque background color of the popup surface. */
  bg: ThemeColorValue
}

/**
 * Presentational result popup. Absolutely positioned with a high `zIndex`,
 * pinned to the parent's bounds and centering a `DIALOG_WIDTHS.medium` box
 * over the dialog content, mirroring `ExportOverlay`'s styling conventions.
 */
export function ExportResultOverlay(props: ExportResultOverlayProps): JSX.Element {
  return (
    <box
      position="absolute"
      zIndex={10}
      left={0}
      top={0}
      right={0}
      bottom={0}
      alignItems="center"
      justifyContent="center"
      backgroundColor={RGBA.fromInts(0, 0, 0, 150)}
    >
      <box
        width={DIALOG_WIDTHS.medium}
        flexDirection="column"
        gap={1}
        paddingLeft={2}
        paddingRight={2}
        paddingTop={1}
        paddingBottom={1}
        backgroundColor={props.bg}
      >
        {/* Title bar */}
        <box flexDirection="row" justifyContent="space-between">
          <text fg={props.fg}><b>{props.title ?? "Exported"}</b></text>
          <text fg={props.muted}>esc</text>
        </box>

        {/* Body */}
        <box flexDirection="column" gap={1}>
          {props.error ? (
            <text fg={props.muted}>Could not save file (check permissions/free space).</text>
          ) : (
            <box flexDirection="column">
              <text fg={props.muted}>Saved to:</text>
              <text fg={props.fg}>{props.path ?? ""}</text>
            </box>
          )}
        </box>

        {/* Footer hint */}
        <box flexDirection="row" justifyContent="flex-end">
          <text fg={props.muted}>←→ choose · enter open/close · esc close</text>
        </box>

        {/* Button row */}
        <box flexDirection="row" gap={1}>
          <box
            flex={1}
            flexDirection="row"
            alignItems="center"
            justifyContent="center"
            paddingTop={1}
            paddingBottom={1}
            backgroundColor={props.focus === 0 ? props.primary : undefined}
          >
            <text fg={props.focus === 0 ? props.selectedText : props.muted}>Close</text>
          </box>
          <box
            flex={1}
            flexDirection="row"
            alignItems="center"
            justifyContent="center"
            paddingTop={1}
            paddingBottom={1}
            backgroundColor={!props.error && props.focus === 1 ? props.primary : undefined}
          >
            <text fg={!props.error && props.focus === 1 ? props.selectedText : props.muted}>Open</text>
          </box>
        </box>
      </box>
    </box>
  )
}