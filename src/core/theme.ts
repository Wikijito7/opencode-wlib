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
  /**
   * Text color used on the selected list item. Optional in the legacy/v1
   * shape: the v1 loose resolver (`resolveThemeColors`) may leave it
   * `undefined`. The v2 semantic resolver (`resolveSemanticTheme`) always
   * yields a visible value and returns {@link SemanticThemePalette}, whose
   * `selectedText` is required.
   */
  selectedText: ThemeColorValue | undefined
  /** Background color of the app/surface. */
  background: ThemeColorValue
  /** Dialog/panel surface background color. */
  panel: ThemeColorValue
}

/**
 * v2-specific resolved palette: every field of {@link ThemePalette}, but
 * `selectedText` is **required**. `resolveSemanticTheme` (v2) never yields
 * `undefined` for it — when every selection-text state is absent or
 * transparent it falls back to the resolved, visible `fg` — so v2 chip/label
 * consumers get non-optional, always-visible text without a `?? fallback`.
 *
 * Extends {@link ThemePalette}, so it is a drop-in wherever the legacy shape is
 * expected (e.g. `createV2Host` returns `WlibHost<SemanticThemePalette>`, which
 * remains assignable to `WlibHost`).
 */
export interface SemanticThemePalette extends ThemePalette {
  /** Text color used on the selected list item. Always defined and visible (v2). */
  selectedText: ThemeColorValue
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
 * - `fg`          ← `text.base` (must itself be visible: a transparent/zero-alpha
 *                   `text.base` is skipped and falls through to
 *                   `THEME_DEFAULTS.fg`, so the `selectedText` fallback below can
 *                   never inherit invisible text)
 * - `muted`       ← `text.muted`
 * - `red`         ← `text.feedback.error.base`
 * - `primary`     ← `background.action.primary.focused`, then `selected`,
 *                   then `.base` (selected-row background). The default v2
 *                   theme leaves `.base`/`selected` `transparent` and only
 *                   paints the accent on `focused`, so focused wins.
 * - `selectedText`← `text.action.primary.focused`, then `selected`, then
 *                   `.base` (text on the primary background), and finally the
 *                   resolved `fg`. v2 chip consumers always need *visible*
 *                   text, so when every selection text state is absent or
 *                   transparent this never yields `undefined` — it falls back
 *                   to the resting foreground. (The v1 loose resolver,
 *                   {@link resolveThemeColors}, deliberately keeps its legacy
 *                   `undefined` behavior.)
 * - `background`  ← `background.base`
 * - `panel`       ← `background.raised.base`, then `background.raised.high`.
 *                   `.base` wins for 1:1 overlay-surface parity with the v1
 *                   plugin scheme: the v1→v2 theme migrator maps legacy
 *                   `backgroundPanel` to resolved `background.raised.base`,
 *                   while `.high` is a lighter menu surface.
 *
 * Resolved keys carry no `$` sigil (unlike the raw `$focused`/`$selected`
 * definition keys), matching the host's `ResolvedTheme`.
 *
 * Transparent values (`"transparent"` or zero-alpha RGBA) are treated as absent
 * so a theme cannot paint an invisible surface or label: for the selection
 * background and app/panel surfaces a see-through value would render nothing,
 * and for `selectedText` it would render invisible text — so a transparent
 * selected-text token is *skipped* rather than preserved. Unlike v1, v2 then
 * lands on the resolved foreground instead of `undefined` so a chip can never
 * render invisible text; the resolved foreground is itself drawn only from a
 * visible `text.base` (a transparent one falls through to `THEME_DEFAULTS.fg`).
 * Non-transparent RGBA objects are preserved by identity.
 *
 * Returns the v2-specific {@link SemanticThemePalette} — the legacy
 * {@link ThemePalette} shape with `selectedText` narrowed to required.
 */
export function resolveSemanticTheme(
  theme: SemanticThemeLike | null | undefined,
): SemanticThemePalette {
  const actionBackground = theme?.background?.action?.primary
  const actionText = theme?.text?.action?.primary
  const fg = visibleColor(theme?.text?.base) ?? THEME_DEFAULTS.fg
  return {
    fg,
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
      visibleColor(actionText?.base) ??
      fg,
    background: visibleColor(theme?.background?.base) ?? THEME_DEFAULTS.background,
    panel:
      visibleColor(theme?.background?.raised?.base) ??
      visibleColor(theme?.background?.raised?.high) ??
      THEME_DEFAULTS.panel,
  }
}
