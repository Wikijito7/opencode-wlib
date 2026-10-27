import { describe, expect, it } from "bun:test"
import { resolveThemeColors, resolveSemanticTheme, THEME_DEFAULTS } from "../src/core/theme"

describe("resolveThemeColors", () => {
  it("uses the text/foreground convention", () => {
    const palette = resolveThemeColors({ text: "#111111", textMuted: "#222222", error: "#333333" })
    expect(palette.fg).toBe("#111111")
    expect(palette.muted).toBe("#222222")
    expect(palette.red).toBe("#333333")
  })

  it("accepts the foreground/muted/red convention (persona-injector style)", () => {
    const palette = resolveThemeColors({ foreground: "#aaaaaa", muted: "#bbbbbb", red: "#cccccc" })
    expect(palette.fg).toBe("#aaaaaa")
    expect(palette.muted).toBe("#bbbbbb")
    expect(palette.red).toBe("#cccccc")
  })

  it("prefers text/textMuted/error over the legacy names", () => {
    const palette = resolveThemeColors({ text: "a", foreground: "b", textMuted: "c", muted: "d", error: "e", red: "f" })
    expect(palette.fg).toBe("a")
    expect(palette.muted).toBe("c")
    expect(palette.red).toBe("e")
  })

  it("falls back to defaults for missing values", () => {
    const palette = resolveThemeColors({})
    expect(palette.fg).toBe("#ffffff")
    expect(palette.muted).toBe("#888888")
    expect(palette.red).toBe("#ef4444")
    expect(palette.success).toBe("#22c55e")
    expect(palette.warning).toBe("#eab308")
    expect(palette.primary).toBe("#4f46e5")
  })

  it("applies caller fallbacks before defaults", () => {
    const palette = resolveThemeColors(
      {},
      {
        fg: "#010101",
        muted: "#020202",
        red: "#030303",
        success: "#050505",
        warning: "#060606",
        primary: "#040404",
      },
    )
    expect(palette.fg).toBe("#010101")
    expect(palette.muted).toBe("#020202")
    expect(palette.red).toBe("#030303")
    expect(palette.success).toBe("#050505")
    expect(palette.warning).toBe("#060606")
    expect(palette.primary).toBe("#040404")
  })

  it("reads success and warning from the v1 loose theme", () => {
    const palette = resolveThemeColors({
      success: "#00aa00",
      warning: "#aa8800",
    })
    expect(palette.success).toBe("#00aa00")
    expect(palette.warning).toBe("#aa8800")
  })

  it("keeps v1 success/warning theme values over caller fallbacks", () => {
    const palette = resolveThemeColors(
      { success: "#00aa00", warning: "#aa8800" },
      { success: "#111111", warning: "#222222" },
    )
    expect(palette.success).toBe("#00aa00")
    expect(palette.warning).toBe("#aa8800")
  })

  it("keeps the theme value over caller fallbacks", () => {
    const palette = resolveThemeColors({ primary: "#ff00ff" }, { primary: "#000000" })
    expect(palette.primary).toBe("#ff00ff")
  })

  it("reads background from theme.background", () => {
    expect(resolveThemeColors({ background: "#0a0a0a" }).background).toBe("#0a0a0a")
  })

  it("falls back to default background when missing", () => {
    expect(resolveThemeColors({}).background).toBe("#000000")
  })

  it("applies caller background fallback before default", () => {
    expect(resolveThemeColors({}, { background: "#123456" }).background).toBe("#123456")
  })

  it("keeps the theme background over caller fallback", () => {
    expect(resolveThemeColors({ background: "#ffffff" }, { background: "#000000" }).background).toBe("#ffffff")
  })

  it("reads panel from theme.backgroundPanel", () => {
    expect(resolveThemeColors({ backgroundPanel: "#0a0a0a" }).panel).toBe("#0a0a0a")
  })

  it("falls back to default panel when missing", () => {
    expect(resolveThemeColors({}).panel).toBe("#000000")
  })

  it("applies caller panel fallback before default", () => {
    expect(resolveThemeColors({}, { panel: "#123456" }).panel).toBe("#123456")
  })

  it("keeps the theme panel over caller fallback", () => {
    expect(resolveThemeColors({ backgroundPanel: "#ffffff" }, { panel: "#000000" }).panel).toBe("#ffffff")
  })

  it("reads selectedListItemText", () => {
    expect(resolveThemeColors({ selectedListItemText: "#123456" }).selectedText).toBe("#123456")
    expect(resolveThemeColors({}).selectedText).toBeUndefined()
  })

  it("handles null/undefined themes", () => {
    expect(resolveThemeColors(null).fg).toBe("#ffffff")
    expect(resolveThemeColors(undefined).fg).toBe("#ffffff")
  })

  it("falls back for junk values but passes RGBA objects through", () => {
    // Junk (numbers, null, empty strings) → fallback.
    const junk = resolveThemeColors({ text: 123 as unknown, muted: null as unknown, primary: "" as unknown })
    expect(junk.fg).toBe("#ffffff")
    expect(junk.muted).toBe("#888888")
    expect(junk.primary).toBe("#4f46e5")

    // RGBA-like objects (OpenCode theme colors) → passed through verbatim.
    const rgba = { r: 0.9, g: 0.4, b: 0.1, a: 1 }
    const success = { r: 0.1, g: 0.8, b: 0.2, a: 1 }
    const warning = { r: 0.9, g: 0.7, b: 0.1 }
    const themed = resolveThemeColors({
      text: rgba,
      primary: { r: 0.1, g: 0.8, b: 0.2 },
      success,
      warning,
      selectedListItemText: { r: 0, g: 0, b: 0 },
    })
    expect(themed.fg).toBe(rgba)
    expect(themed.primary).toEqual({ r: 0.1, g: 0.8, b: 0.2 })
    expect(themed.success).toBe(success)
    expect(themed.warning).toBe(warning)
    expect(themed.selectedText).toEqual({ r: 0, g: 0, b: 0 })
  })

  it("lets RGBA objects win over caller fallbacks", () => {
    const rgba = { r: 1, g: 0, b: 0 }
    const palette = resolveThemeColors({ primary: rgba }, { primary: "#000000" })
    expect(palette.primary).toBe(rgba)
  })

  // v1 is a loose resolver and must stay untouched by the v2 semantic changes:
  // it neither reads `$focused`/`$selected` nor filters see-through colors.
  it("stays unchanged: passes transparent strings and zero-alpha RGBA through verbatim", () => {
    const zeroAlpha = { r: 0, g: 0, b: 0, a: 0 }
    const palette = resolveThemeColors({
      primary: "transparent",
      background: zeroAlpha,
      backgroundPanel: "TRANSPARENT",
    })
    expect(palette.primary).toBe("transparent")
    expect(palette.background).toBe(zeroAlpha)
    expect(palette.panel).toBe("TRANSPARENT")
  })

  // Raw definition data: a plugin-authored theme uses the `$focused`/`$selected`
  // sigil within its nested `action.primary`. The v1 loose resolver must ignore
  // these nested raw keys entirely and read only the flat `primary` slot.
  it("stays unchanged: ignores raw nested $focused/$selected definition keys", () => {
    const rawDefinition = {
      primary: "#abcabc",
      action: { primary: { $focused: "#deadbeef", $selected: "#cafe" } },
    }
    const palette = resolveThemeColors(rawDefinition)
    expect(palette.primary).toBe("#abcabc")
  })
})

// ─── resolveSemanticTheme (v2 ResolvedTheme tokens) ──────────────────────────

describe("THEME_DEFAULTS", () => {
  it("exposes the shared fallback palette", () => {
    expect(THEME_DEFAULTS).toEqual({
      fg: "#ffffff",
      muted: "#888888",
      red: "#ef4444",
      success: "#22c55e",
      warning: "#eab308",
      primary: "#4f46e5",
      background: "#000000",
      panel: "#000000",
    })
  })
})

describe("resolveSemanticTheme", () => {
  it("maps the v2 semantic tokens onto the palette (raised.base wins for panel)", () => {
    const palette = resolveSemanticTheme({
      text: {
        base: "#aaaaaa",
        muted: "#bbbbbb",
        action: { primary: { base: "#c0c0c0" } },
        feedback: { error: { base: "#ff0000" } },
      },
      background: {
        base: "#010101",
        raised: { base: "#020202", high: "#030303" },
        action: { primary: { base: "#4f46e5" } },
      },
    })

    expect(palette).toEqual({
      fg: "#aaaaaa",
      muted: "#bbbbbb",
      red: "#ff0000",
      success: "#22c55e",
      warning: "#eab308",
      primary: "#4f46e5",
      selectedText: "#c0c0c0",
      background: "#010101",
      panel: "#020202",
    })
  })

  it("maps v2 success and warning feedback tokens", () => {
    const palette = resolveSemanticTheme({
      text: {
        feedback: {
          success: { base: "#00aa00" },
          warning: { base: "#aa8800" },
        },
      },
    })
    expect(palette.success).toBe("#00aa00")
    expect(palette.warning).toBe("#aa8800")
  })

  it("preserves success/warning RGBA feedback tokens by identity", () => {
    const success = { r: 0.1, g: 0.8, b: 0.2, a: 1 }
    const warning = { r: 0.9, g: 0.7, b: 0.1 }
    const palette = resolveSemanticTheme({
      text: {
        feedback: {
          success: { base: success },
          warning: { base: warning },
        },
      },
    })
    expect(palette.success).toBe(success)
    expect(palette.warning).toBe(warning)
  })

  it("rejects transparent success/warning tokens and falls back to defaults", () => {
    const zeroAlpha = { r: 0, g: 0, b: 0, a: 0 }
    const first = resolveSemanticTheme({
      text: {
        feedback: {
          success: { base: "transparent" },
          warning: { base: zeroAlpha },
        },
      },
    })
    expect(first.success).toBe(THEME_DEFAULTS.success)
    expect(first.warning).toBe(THEME_DEFAULTS.warning)

    const second = resolveSemanticTheme({
      text: {
        feedback: {
          success: { base: zeroAlpha },
          warning: { base: "TRANSPARENT" },
        },
      },
    })
    expect(second.success).toBe(THEME_DEFAULTS.success)
    expect(second.warning).toBe(THEME_DEFAULTS.warning)
  })

  it("prefers the focused action tokens over selected and base (selected-row state)", () => {
    const palette = resolveSemanticTheme({
      text: { action: { primary: { focused: "#eeeeee", selected: "#dddddd", base: "#cccccc" } } },
      background: { action: { primary: { focused: "#5f56f6", selected: "#4f46e5", base: "#333333" } } },
    })
    expect(palette.primary).toBe("#5f56f6")
    expect(palette.selectedText).toBe("#eeeeee")
  })

  it("falls back to the selected token when focused is absent", () => {
    const palette = resolveSemanticTheme({
      text: { action: { primary: { selected: "#dddddd", base: "#cccccc" } } },
      background: { action: { primary: { selected: "#4f46e5", base: "#333333" } } },
    })
    expect(palette.primary).toBe("#4f46e5")
    expect(palette.selectedText).toBe("#dddddd")
  })

  it("falls back to .base when neither focused nor selected is set", () => {
    const palette = resolveSemanticTheme({
      text: { action: { primary: { base: "#cccccc" } } },
      background: { action: { primary: { base: "#4f46e5" } } },
    })
    expect(palette.primary).toBe("#4f46e5")
    expect(palette.selectedText).toBe("#cccccc")
  })

  it("ignores a transparent focused token and uses the next visible one", () => {
    const palette = resolveSemanticTheme({
      text: { action: { primary: { focused: "transparent", selected: "#dddddd" } } },
      background: {
        action: {
          primary: { focused: "TRANSPARENT", selected: { r: 0, g: 0, b: 0, a: 0 }, base: "#4f46e5" },
        },
      },
    })
    // focused is transparent (case-insensitive) → selected is zero-alpha → base wins.
    expect(palette.primary).toBe("#4f46e5")
    expect(palette.selectedText).toBe("#dddddd")
  })

  it("falls back to the default accent when every action background is transparent", () => {
    const zeroAlpha = { r: 0, g: 0, b: 0, a: 0 }
    const palette = resolveSemanticTheme({
      background: { action: { primary: { focused: zeroAlpha, selected: "transparent", base: zeroAlpha } } },
    })
    expect(palette.primary).toBe(THEME_DEFAULTS.primary)
  })

  it("ignores transparent app-background and panel surfaces and uses their defaults", () => {
    const zeroAlpha = { r: 0, g: 0, b: 0, a: 0 }
    const palette = resolveSemanticTheme({
      background: { base: "transparent", raised: { high: zeroAlpha, base: "transparent" } },
    })
    expect(palette.background).toBe(THEME_DEFAULTS.background)
    expect(palette.panel).toBe(THEME_DEFAULTS.panel)
  })

  it("maps selected text through .focused → .selected → .base, then falls back to fg when all are absent or transparent", () => {
    expect(resolveSemanticTheme({ text: { action: { primary: { focused: "#f" } } } }).selectedText).toBe("#f")
    expect(resolveSemanticTheme({ text: { action: { primary: { selected: "#s" } } } }).selectedText).toBe("#s")
    expect(resolveSemanticTheme({ text: { action: { primary: { base: "#b" } } } }).selectedText).toBe("#b")

    // Every selection-text state transparent → falls back to the *resolved* fg,
    // never `undefined`: a v2 chip must always render visible text.
    expect(
      resolveSemanticTheme({
        text: {
          base: "#ababab",
          action: {
            primary: { focused: "transparent", selected: { r: 0, g: 0, b: 0, a: 0 }, base: "transparent" },
          },
        },
      }).selectedText,
    ).toBe("#ababab")

    // Absent entirely (no text.base) → falls back to the default fg.
    expect(
      resolveSemanticTheme({
        text: {
          action: {
            primary: { focused: "transparent", selected: { r: 0, g: 0, b: 0, a: 0 }, base: "transparent" },
          },
        },
      }).selectedText,
    ).toBe(THEME_DEFAULTS.fg)
  })

  it("preserves non-transparent RGBA action surfaces by identity (incl. no alpha)", () => {
    const focusRgba = { r: 0.4, g: 0.1, b: 0.8, a: 1 }
    const opaqueNoAlpha = { r: 0.3, g: 0.2, b: 0.9 }
    const palette = resolveSemanticTheme({
      text: { action: { primary: { focused: opaqueNoAlpha } } },
      background: { action: { primary: { focused: focusRgba } } },
    })
    expect(palette.primary).toBe(focusRgba)
    expect(palette.selectedText).toBe(opaqueNoAlpha)
  })

  // v1 parity: the v1→v2 migrator maps legacy `backgroundPanel` to resolved
  // `background.raised.base`, while `.high` is a lighter menu surface — so
  // `.base` must win when both exist.
  it("prefers background.raised.base over .high for the panel", () => {
    expect(
      resolveSemanticTheme({ background: { raised: { base: "#baseee", high: "#highhh" } } }).panel,
    ).toBe("#baseee")
  })

  it("falls back to background.raised.high when .base is missing", () => {
    expect(
      resolveSemanticTheme({ background: { raised: { high: "#highhh" } } }).panel,
    ).toBe("#highhh")
  })

  it("treats a transparent .base as missing and falls through to .high", () => {
    const zeroAlpha = { r: 0, g: 0, b: 0, a: 0 }
    expect(
      resolveSemanticTheme({ background: { raised: { base: "transparent", high: "#highhh" } } }).panel,
    ).toBe("#highhh")
    expect(
      resolveSemanticTheme({ background: { raised: { base: zeroAlpha, high: "#highhh" } } }).panel,
    ).toBe("#highhh")
  })

  it("falls back to the default panel when both raised surfaces are absent or transparent", () => {
    expect(resolveSemanticTheme({}).panel).toBe(THEME_DEFAULTS.panel)
    expect(
      resolveSemanticTheme({ background: { raised: { base: "transparent", high: "TRANSPARENT" } } }).panel,
    ).toBe(THEME_DEFAULTS.panel)
  })

  it("falls back to defaults for an empty/absent theme (selectedText lands on default fg)", () => {
    expect(resolveSemanticTheme({})).toEqual({
      fg: "#ffffff",
      muted: "#888888",
      red: "#ef4444",
      success: "#22c55e",
      warning: "#eab308",
      primary: "#4f46e5",
      selectedText: "#ffffff",
      background: "#000000",
      panel: "#000000",
    })
    expect(resolveSemanticTheme(null).fg).toBe("#ffffff")
    expect(resolveSemanticTheme(undefined).background).toBe("#000000")
    expect(resolveSemanticTheme(null).selectedText).toBe("#ffffff")
  })

  it("returns fg (not undefined) for v2 when the selection-text token is absent, but keeps v1 undefined", () => {
    // v2 semantic resolver: an absent selection-text token falls back to fg.
    expect(resolveSemanticTheme({ text: { base: "#fff" } }).selectedText).toBe("#fff")
    // v1 loose resolver deliberately keeps its legacy `undefined` for the same absence.
    expect(resolveThemeColors({}).selectedText).toBeUndefined()
  })

  it("passes RGBA objects through untouched (no string coercion)", () => {
    const fg = { r: 0.9, g: 0.4, b: 0.1, a: 1 }
    const muted = { r: 0.2, g: 0.2, b: 0.2, a: 1 }
    const red = { r: 1, g: 0, b: 0, a: 1 }
    const primary = { r: 0.3, g: 0.2, b: 0.9, a: 1 }
    const selectedText = { r: 1, g: 1, b: 1, a: 1 }
    const background = { r: 0, g: 0, b: 0, a: 1 }
    const panel = { r: 0.1, g: 0.1, b: 0.1, a: 1 }

    const palette = resolveSemanticTheme({
      text: {
        base: fg,
        muted,
        action: { primary: { base: selectedText } },
        feedback: { error: { base: red } },
      },
      background: {
        base: background,
        raised: { base: panel, high: { r: 0.9, g: 0.9, b: 0.9, a: 1 } },
        action: { primary: { base: primary } },
      },
    })

    expect(palette.fg).toBe(fg)
    expect(palette.muted).toBe(muted)
    expect(palette.red).toBe(red)
    expect(palette.primary).toBe(primary)
    expect(palette.selectedText).toBe(selectedText)
    expect(palette.background).toBe(background)
    expect(palette.panel).toBe(panel)
  })

  it("treats junk leaves as missing (numbers, null, empty strings)", () => {
    const palette = resolveSemanticTheme({
      text: { base: 0 as unknown, muted: null, feedback: { error: { base: "" } } },
      background: { base: 3.14 as unknown, raised: { high: "" } },
    })
    expect(palette.fg).toBe("#ffffff")
    expect(palette.muted).toBe("#888888")
    expect(palette.red).toBe("#ef4444")
    expect(palette.background).toBe("#000000")
    expect(palette.panel).toBe("#000000")
  })
})

