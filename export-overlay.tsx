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
  /** Opaque background color that masks the parent dialog behind the popup. */
  bg: ThemeColorValue
}

/**
 * Popup-style overlay listing the available export formats. The outer `<box>`
 * is absolutely positioned with a high `zIndex` and pinned exactly to the
 * parent's bounds via `left`/`top`/`right`/`bottom`, so it spans the dialog
 * area and fills it with `bg` to hide what's behind.
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
      flexDirection="column"
      paddingLeft={2}
      paddingRight={2}
      paddingTop={1}
      paddingBottom={1}
      backgroundColor={props.bg}
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
          <box flexDirection="row">
            <text fg={selected ? props.primary : props.muted}>{selected ? ">" : " "}</text>
            <text fg={selected ? props.primary : props.fg} bold={selected}>
              {option.label}
            </text>
          </box>
        )
      })}

      {/* Footer */}
      <box flexGrow={1} />
      <box flexDirection="row" justifyContent="flex-end">
        <text fg={props.muted}>↑↓ choose · enter export</text>
      </box>
    </box>
  )
}
