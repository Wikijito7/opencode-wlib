import { describe, expect, it } from "bun:test"
import { cycleExportIndex, exportKeyAction } from "./export-state"

describe("exportKeyAction", () => {
  it('returns "none" for any key when the overlay is closed', () => {
    for (const key of ["up", "down", "enter", "escape", "e", "q", "x"]) {
      expect(exportKeyAction(key, false)).toBe("none")
    }
  })

  it('maps up to "navigate-up" when open', () => {
    expect(exportKeyAction("up", true)).toBe("navigate-up")
  })

  it('maps down to "navigate-down" when open', () => {
    expect(exportKeyAction("down", true)).toBe("navigate-down")
  })

  it('maps enter to "confirm" when open', () => {
    expect(exportKeyAction("enter", true)).toBe("confirm")
  })

  it('maps escape to "close" when open', () => {
    expect(exportKeyAction("escape", true)).toBe("close")
  })

  it('maps e to "close" when open', () => {
    expect(exportKeyAction("e", true)).toBe("close")
  })

  it('returns "none" for an unrelated key when open', () => {
    expect(exportKeyAction("q", true)).toBe("none")
    expect(exportKeyAction("a", true)).toBe("none")
  })
})

describe("cycleExportIndex", () => {
  it("wraps up past zero", () => {
    expect(cycleExportIndex(0, -1, 4)).toBe(3)
  })

  it("wraps down past the last index", () => {
    expect(cycleExportIndex(3, 1, 4)).toBe(0)
  })

  it("moves forward normally", () => {
    expect(cycleExportIndex(1, 1, 4)).toBe(2)
  })

  it("moves backward normally", () => {
    expect(cycleExportIndex(1, -1, 4)).toBe(0)
  })

  it("returns 0 for an empty list", () => {
    expect(cycleExportIndex(0, 1, 0)).toBe(0)
    expect(cycleExportIndex(0, -1, 0)).toBe(0)
  })
})