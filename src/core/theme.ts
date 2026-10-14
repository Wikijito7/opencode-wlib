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
  /** Background color of the app/surface. */
  background: ThemeColorValue
  /** Dialog/panel surface background color. */
  panel: ThemeColorValue
}

export interface ThemePaletteFallbacks {
  fg?: ThemeColorValue
  muted?: ThemeColorValue
  red?: ThemeColorValue
  primary?: ThemeColorValue
  background?: ThemeColorValue
  panel?: ThemeColorValue
}

/** Default palette values, shared by the v1 loose resolver and the v2 semantic resolver. */
export const THEME_DEFAULTS = {
  fg: "#ffffff",
  muted: "#888888",
  red: "#ef4444",
  primary: "#4f46e5",
  background: "#000000",
  panel: "#000000",
} as const satisfies Record<string, ThemeColorValue>

/**
 * Structural view of the OpenCode v2 `ResolvedTheme` semantic tokens
 * (`@opencode/theme/tui`). Kept structural on purpose: leaves are `unknown`
 * so RGBA objects pass through untouched and the type tracks whatever the
 * host actually resolves, without importing the theme package. Only the
 * tokens wlib maps are declared.
 *
 * NOTE ON KEYS: `context.theme` is already-resolved, so its action states drop
 * the `$` sigil — `focused`, `selected`, `base`, … (see `resolvedKey` in the
 * host's theme resolver). The `$focused`/`$selected` spelling appears only in
 * the *raw* theme definitions a plugin might author, never in the resolved
 * context. This type models the resolved shape.
 */
export interface SemanticThemeLike {
  readonly text?: {
    readonly base?: unknown
    readonly muted?: unknown
    readonly action?: {
      readonly primary?: {
        /** Resting text color on the primary action surface. */
        readonly base?: unknown
        /** Text color while the action is focused — the visible contrast text. */
        readonly focused?: unknown
        /** Text color while the action is selected. */
        readonly selected?: unknown
      }
    }
    readonly feedback?: { readonly error?: { readonly base?: unknown } }
  }
  readonly background?: {
    readonly base?: unknown
    readonly raised?: { readonly base?: unknown; readonly high?: unknown; readonly max?: unknown }
    readonly action?: {
      readonly primary?: {
        /** Resting surface color; the default v2 theme sets this to `transparent`. */
        readonly base?: unknown
        /** Surface color while focused — the visible accent that paints a selected row. */
        readonly focused?: unknown
        /** Surface color while selected; often `transparent` in the default v2 theme. */
        readonly selected?: unknown
      }
    }
  }
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
 * True when a color is explicitly see-through: the literal `"transparent"`
 * string, or an OpenCode `RGBA` whose alpha is zero. An RGBA without an
 * `alpha`-bearing object shape (no `a`) is treated as opaque.
 */
function isTransparent(v: ThemeColorValue): boolean {
  if (typeof v === "string") return v.toLowerCase() === "transparent"
  return v.a === 0
}

/**
 * Like {@link validColor}, but rejects see-through values. Used for the
 * surface tokens (selection background, app background, panel) where a
 * transparent value would render the element invisible rather than fall
 * through to a usable default. Non-transparent RGBA objects are preserved
 * by identity.
 */
function visibleColor(v: unknown): ThemeColorValue | undefined {
  const c = validColor(v)
  return c !== undefined && !isTransparent(c) ? c : undefined
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
    fg: validColor(theme?.text) ?? validColor(theme?.foreground) ?? fallbacks.fg ?? THEME_DEFAULTS.fg,
    muted: validColor(theme?.textMuted) ?? validColor(theme?.muted) ?? fallbacks.muted ?? THEME_DEFAULTS.muted,
    red: validColor(theme?.error) ?? validColor(theme?.red) ?? fallbacks.red ?? THEME_DEFAULTS.red,
    primary: validColor(theme?.primary) ?? fallbacks.primary ?? THEME_DEFAULTS.primary,
    selectedText: validColor(theme?.selectedListItemText),
    background: validColor(theme?.background) ?? fallbacks.background ?? THEME_DEFAULTS.background,
    panel: validColor(theme?.backgroundPanel) ?? fallbacks.panel ?? THEME_DEFAULTS.panel,
  }
}

/**
 * Resolve a normalized palette from the OpenCode v2 semantic theme tokens
 * (`context.theme`, a `ResolvedTheme`). RGBA values are passed through
 * untouched — never string-coerced — so the host's color objects survive.
 *
 * Mapping:
 * - `fg`          ← `text.base`
 * - `muted`       ← `text.muted`
 * - `red`         ← `text.feedback.error.base`
 * - `primary`     ← `background.action.primary.focused`, then `selected`,
 *                   then `.base` (selected-row background). The default v2
 *                   theme leaves `.base`/`selected` `transparent` and only
 *                   paints the accent on `focused`, so focused wins.
 * - `selectedText`← `text.action.primary.focused`, then `selected`, then
 *                   `.base` (text on the primary background).
 * - `background`  ← `background.base`
 * - `panel`       ← `background.raised.high`, then `background.raised.base`
 *
 * Resolved keys carry no `$` sigil (unlike the raw `$focused`/`$selected`
 * definition keys), matching the host's `ResolvedTheme`.
 *
 * Transparent values (`"transparent"` or zero-alpha RGBA) are treated as absent
 * so a theme cannot paint an invisible surface or label: for the selection
 * background and app/panel surfaces a see-through value would render nothing,
 * and for `selectedText` it would render invisible text — so a transparent
 * selected-text token is *skipped* (falls through, ending at `undefined`)
 * rather than preserved, leaving the consumer free to use its resting text
 * color. Non-transparent RGBA objects are preserved by identity.
 */
export function resolveSemanticTheme(
  theme: SemanticThemeLike | null | undefined,
): ThemePalette {
  const actionBackground = theme?.background?.action?.primary
  const actionText = theme?.text?.action?.primary
  return {
    fg: validColor(theme?.text?.base) ?? THEME_DEFAULTS.fg,
    muted: validColor(theme?.text?.muted) ?? THEME_DEFAULTS.muted,
    red: validColor(theme?.text?.feedback?.error?.base) ?? THEME_DEFAULTS.red,
    primary:
      visibleColor(actionBackground?.focused) ??
      visibleColor(actionBackground?.selected) ??
      visibleColor(actionBackground?.base) ??
      THEME_DEFAULTS.primary,
    selectedText:
      visibleColor(actionText?.focused) ??
      visibleColor(actionText?.selected) ??
      visibleColor(actionText?.base),
    background: visibleColor(theme?.background?.base) ?? THEME_DEFAULTS.background,
    panel:
      visibleColor(theme?.background?.raised?.high) ??
      visibleColor(theme?.background?.raised?.base) ??
      THEME_DEFAULTS.panel,
  }
}
