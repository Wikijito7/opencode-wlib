/**
 * opencode-wlib — responsive dialog fit (pure).
 *
 * Desired size/height with graceful fallback: pick the largest width tier
 * and the tallest scrollbox that fit the terminal, shrinking when the
 * terminal is smaller so dialogs are never cut off. Mirrors opencode's own
 * dialog behaviour (`maxWidth = width - 2` clamp, `DialogSelect`'s
 * terminal-height-aware list height).
 *
 * Pure module — no host imports — so it is fully unit-testable.
 */

export type DialogSize = "medium" | "large" | "xlarge"

/** Width tiers — mirrors opencode's Dialog widths (60/88/116). */
export const DIALOG_WIDTHS: Record<DialogSize, number> = {
  medium: 60,
  large: 88,
  xlarge: 116,
}

export interface DialogDesired {
  /** Desired width tier (default "large"). */
  size?: DialogSize
  /** Desired scrollbox maxHeight (default 40). */
  maxHeight?: number
  /** Rows consumed by title bar, indicators, footer and gaps (default 11). */
  chrome?: number
}

export interface DialogFit {
  size: DialogSize
  maxHeight: number
}

const DEFAULT_MAX_HEIGHT = 40
const DEFAULT_CHROME = 11
const MIN_MAX_HEIGHT = 8
// The dialog backdrop clamps its inner box to `terminalWidth - 2`.
const WIDTH_MARGIN = 2
const TIERS: DialogSize[] = ["xlarge", "large", "medium"]

/**
 * Pick the largest width tier ≤ desired that fits the terminal width.
 * `medium` is the floor — the dialog clamps anything narrower anyway.
 */
export function resolveDialogSize(terminalWidth: number, desired: DialogSize = "large"): DialogSize {
  const start = TIERS.indexOf(desired)
  for (let i = start; i < TIERS.length; i++) {
    if (terminalWidth >= DIALOG_WIDTHS[TIERS[i]] + WIDTH_MARGIN) return TIERS[i]
  }
  return "medium"
}

/**
 * Resolve the scrollbox maxHeight: the desired height, shrunk to the space
 * available below the dialog's top-quarter padding (minus chrome), with a
 * floor of 8 so the dialog always stays visible.
 */
export function resolveDialogMaxHeight(
  terminalHeight: number,
  desired: number = DEFAULT_MAX_HEIGHT,
  chrome: number = DEFAULT_CHROME,
): number {
  const available = Math.floor(terminalHeight * 0.75) - chrome
  return Math.max(MIN_MAX_HEIGHT, Math.min(desired, available))
}

/** Resolve both axes for a terminal size. */
export function resolveDialogFit(
  terminal: { width: number; height: number },
  desired: DialogDesired = {},
): DialogFit {
  return {
    size: resolveDialogSize(terminal.width, desired.size),
    maxHeight: resolveDialogMaxHeight(terminal.height, desired.maxHeight, desired.chrome),
  }
}
