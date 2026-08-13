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

  it("reads selectedListItemText", () => {
    expect(resolveThemeColors({ selectedListItemText: "#123456" }).selectedText).toBe("#123456")
    expect(resolveThemeColors({}).selectedText).toBeUndefined()
  })

  it("handles null/undefined themes", () => {
    expect(resolveThemeColors(null).fg).toBe("#ffffff")
    expect(resolveThemeColors(undefined).fg).toBe("#ffffff")
  })

  it("ignores non-string theme values", () => {
    const palette = resolveThemeColors({ text: 123 as unknown, muted: null as unknown })
    expect(palette.fg).toBe("#ffffff")
    expect(palette.muted).toBe("#888888")
  })
})
