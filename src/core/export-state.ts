/** The action a keypress maps to while the export overlay is open. */
export type ExportKeyAction =
  | "navigate-up"
  | "navigate-down"
  | "confirm"
  | "close"
  | "none"

/** Map a key to an export action. Returns "none" when the overlay is closed or the key is unrelated. */
export function exportKeyAction(key: string, isOpen: boolean): ExportKeyAction {
  if (!isOpen) return "none"
  if (key === "up") return "navigate-up"
  if (key === "down") return "navigate-down"
  if (key === "enter") return "confirm"
  if (key === "escape" || key === "e") return "close"
  return "none"
}

/** Move the selection by `delta` (±1) with wraparound. Returns 0 for an empty list. */
export function cycleExportIndex(current: number, delta: -1 | 1, count: number): number {
  if (count <= 0) return 0
  return (current + delta + count) % count
}
