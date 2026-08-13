/** @jsxImportSource @opentui/solid */
/**
 * opencode-wlib — reusable dialog frame.
 *
 * The common dialog skeleton shared by every plugin: title bar with
 * `esc`, scrollable content with `▲ more above` / `▼ more below`
 * indicators, and a footer. Plugins keep their own state (via
 * `makeScrollState`) and pass it in.
 */

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
  children: any
}

export function DialogShell(props: DialogShellProps) {
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
        maxHeight={40}
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
