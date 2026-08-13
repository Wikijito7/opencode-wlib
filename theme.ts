/**
 * opencode-wlib — normalized theme palette.
 *
 * OpenCode themes expose color values under different property names
 * across plugin code (e.g. `text` vs `foreground`, `textMuted` vs
 * `muted`, `error` vs `red`). This helper normalizes them into a single
 * typed palette with sensible fallbacks, so dialogs stop drifting.
 */

export interface ThemePalette {
  /** Primary text color. */
  fg: string
  /** Secondary/muted text color. */
  muted: string
  /** Error/danger color. */
  red: string
  /** Selection/active background color. */
  primary: string
  /** Text color used on the selected list item (may be undefined). */
  selectedText: string | undefined
}

export interface ThemePaletteFallbacks {
  fg?: string
  muted?: string
  red?: string
  primary?: string
}

/**
 * Resolve a normalized palette from any theme-like object. Accepts both
 * property-name conventions (`text`/`foreground`, `textMuted`/`muted`,
 * `error`/`red`) and falls back to defaults.
 */
export function resolveThemeColors(
  theme: { [key: string]: unknown } | null | undefined,
  fallbacks: ThemePaletteFallbacks = {},
): ThemePalette {
  const str = (v: unknown) => (typeof v === "string" && v.length > 0 ? v : undefined)
  return {
    fg: str(theme?.text) ?? str(theme?.foreground) ?? fallbacks.fg ?? "#ffffff",
    muted: str(theme?.textMuted) ?? str(theme?.muted) ?? fallbacks.muted ?? "#888888",
    red: str(theme?.error) ?? str(theme?.red) ?? fallbacks.red ?? "#ef4444",
    primary: str(theme?.primary) ?? fallbacks.primary ?? "#4f46e5",
    selectedText: str(theme?.selectedListItemText),
  }
}
