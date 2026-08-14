import { describe, expect, it } from "bun:test"
import { resolveThemeColors } from "./theme"

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
    expect(palette.primary).toBe("#4f46e5")
  })

  it("applies caller fallbacks before defaults", () => {
    const palette = resolveThemeColors({}, { fg: "#010101", muted: "#020202", red: "#030303", primary: "#040404" })
    expect(palette.fg).toBe("#010101")
    expect(palette.muted).toBe("#020202")
    expect(palette.red).toBe("#030303")
    expect(palette.primary).toBe("#040404")
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
    const themed = resolveThemeColors({ text: rgba, primary: { r: 0.1, g: 0.8, b: 0.2 }, selectedListItemText: { r: 0, g: 0, b: 0 } })
    expect(themed.fg).toBe(rgba)
    expect(themed.primary).toEqual({ r: 0.1, g: 0.8, b: 0.2 })
    expect(themed.selectedText).toEqual({ r: 0, g: 0, b: 0 })
  })

  it("lets RGBA objects win over caller fallbacks", () => {
    const rgba = { r: 1, g: 0, b: 0 }
    const palette = resolveThemeColors({ primary: rgba }, { primary: "#000000" })
    expect(palette.primary).toBe(rgba)
  })
})
