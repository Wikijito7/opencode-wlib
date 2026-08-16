/** @jsxImportSource @opentui/solid */
/**
 * opencode-wlib — export format overlay.
 *
 * A small, fully presentational popup for picking an export format. It floats
 * OVER the dialog content via `position="absolute"` + a high `zIndex`,
 * mirroring `HelpOverlay`'s styling conventions. It is deliberately decoupled:
 * it does NOT import from `./export`, does NOT know about the clipboard, and
 * does NOT handle key presses. The parent dialog owns selection state
 * (`selectedIndex`) and key handling, exactly like the usage dialog owns
 * `showHelp` and toggles it.
 */

import type { JSX } from "solid-js"
import type { ThemeColorValue } from "./theme"
import { DIALOG_WIDTHS } from "./dialog-fit"

export interface ExportOverlayOption {
  id: string
  label: string
}

export interface ExportOverlayProps {
  /** Available export formats, in display order. */
  formats: ExportOverlayOption[]
  /** Index of the currently highlighted format (owned by the parent dialog). */
  selectedIndex: number
  /** Title shown in the header bar. Defaults to "Export". */
  title?: string
  /** Foreground color for the title and unselected option labels. */
  fg: ThemeColorValue
  /** Muted color for the `esc` label, spacing, and the footer line. */
  muted: ThemeColorValue
  /** Accent color used to highlight the selected option. */
  primary: ThemeColorValue
  /** Text color used on the selected option chip (may be undefined). */
  selectedText: ThemeColorValue | undefined
  /** Opaque background color of the popup surface. */
  bg: ThemeColorValue
}

/**
 * Popup-style overlay listing the available export formats. The outer `<box>`
 * is absolutely positioned with a high `zIndex`, pinned exactly to the
 * parent's bounds via `left`/`top`/`right`/`bottom`, and centers the small
 * medium-width inner box (which carries the opaque `bg` and a border) over the
 * dialog content behind it.
 */
export function ExportOverlay(props: ExportOverlayProps): JSX.Element {
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
        border
        borderStyle="rounded"
        borderColor={props.muted}
      >
        {/* Title bar */}
        <box flexDirection="row" justifyContent="space-between">
          <text fg={props.fg}><b>{props.title ?? "Export"}</b></text>
          <text fg={props.muted}>esc</text>
        </box>

        {/* Spacer row between header and format list */}
        <text> </text>

        {/* Format rows */}
        {props.formats.map((option, index) => {
          const selected = index === props.selectedIndex
          return (
            <box
              flexDirection="row"
              backgroundColor={selected ? props.primary : undefined}
            >
              <text fg={selected ? props.selectedText : props.muted}>
                {option.label}
              </text>
            </box>
          )
        })}

        {/* Footer */}
        <box flexDirection="row" justifyContent="flex-end">
          <text fg={props.muted}>↑↓ choose · enter export</text>
        </box>
      </box>
    </box>
  )
}
