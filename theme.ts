/**
 * opencode-wlib — normalized theme palette.
 *
 * OpenCode themes expose color values under different property names
 * across plugin code (e.g. `text` vs `foreground`, `textMuted` vs
 * `muted`, `error` vs `red`). This helper normalizes them into a single
 * typed palette with sensible fallbacks, so dialogs stop drifting.
 *
 * Color values are OpenCode `RGBA` objects (from `@opentui/core`), not
 * strings — pass any non-null object through untouched.
 */

/** A theme color value: a hex string, or an OpenCode RGBA object (host-only type, kept structural). */
export type ThemeColorValue = string | { r: number; g: number; b: number; a?: number }

export interface ThemePalette {
  /** Primary text color. */
  fg: ThemeColorValue
  /** Secondary/muted text color. */
  muted: ThemeColorValue
  /** Error/danger color. */
  red: ThemeColorValue
  /** Selection/active background color. */
  primary: ThemeColorValue
  /** Text color used on the selected list item (may be undefined). */
  selectedText: ThemeColorValue | undefined
}

export interface ThemePaletteFallbacks {
  fg?: ThemeColorValue
  muted?: ThemeColorValue
  red?: ThemeColorValue
  primary?: ThemeColorValue
}

/**
 * A valid color value is a non-empty string OR a non-null object (OpenCode
 * theme colors are RGBA instances). Everything else (numbers, null,
 * undefined, empty strings) is treated as missing.
 */
function validColor(v: unknown): ThemeColorValue | undefined {
  if (typeof v === "string") return v.length > 0 ? v : undefined
  if (v !== null && typeof v === "object") return v as ThemeColorValue
  return undefined
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
  return {
    fg: validColor(theme?.text) ?? validColor(theme?.foreground) ?? fallbacks.fg ?? "#ffffff",
    muted: validColor(theme?.textMuted) ?? validColor(theme?.muted) ?? fallbacks.muted ?? "#888888",
    red: validColor(theme?.error) ?? validColor(theme?.red) ?? fallbacks.red ?? "#ef4444",
    primary: validColor(theme?.primary) ?? fallbacks.primary ?? "#4f46e5",
    selectedText: validColor(theme?.selectedListItemText),
  }
}
