import { describe, expect, it } from "bun:test"
import { resolveDialogFit, resolveDialogMaxHeight, resolveDialogSize, DIALOG_WIDTHS } from "./dialog-fit"

// ─── resolveDialogSize ───────────────────────────────────────────────────────

describe("resolveDialogSize", () => {
  it("keeps the desired tier when the terminal is wide enough", () => {
    expect(resolveDialogSize(200, "xlarge")).toBe("xlarge")
    expect(resolveDialogSize(200, "large")).toBe("large")
    expect(resolveDialogSize(200, "medium")).toBe("medium")
  })

  it("keeps xlarge at the exact fit boundary", () => {
    expect(resolveDialogSize(DIALOG_WIDTHS.xlarge + 2, "xlarge")).toBe("xlarge")
  })

  it("downgrades xlarge to large when the terminal is narrower", () => {
    expect(resolveDialogSize(DIALOG_WIDTHS.xlarge + 1, "xlarge")).toBe("large")
    expect(resolveDialogSize(100, "xlarge")).toBe("large")
  })

  it("downgrades large to medium when the terminal is narrower", () => {
    expect(resolveDialogSize(DIALOG_WIDTHS.large + 1, "large")).toBe("medium")
    expect(resolveDialogSize(80, "large")).toBe("medium")
    expect(resolveDialogSize(60, "large")).toBe("medium")
  })

  it("downgrades xlarge all the way to medium on narrow terminals", () => {
    expect(resolveDialogSize(80, "xlarge")).toBe("medium")
    expect(resolveDialogSize(50, "xlarge")).toBe("medium")
  })

  it("medium is the floor — never downgrades below it", () => {
    expect(resolveDialogSize(30, "medium")).toBe("medium")
    expect(resolveDialogSize(30, "large")).toBe("medium")
  })

  it("defaults the desired size to large", () => {
    expect(resolveDialogSize(200)).toBe("large")
    expect(resolveDialogSize(80)).toBe("medium")
  })
})

// ─── resolveDialogMaxHeight ──────────────────────────────────────────────────

describe("resolveDialogMaxHeight", () => {
  it("keeps the desired height on tall terminals", () => {
    expect(resolveDialogMaxHeight(80)).toBe(40) // 0.75*80-8 = 52 → cap at 40
    expect(resolveDialogMaxHeight(64)).toBe(40) // 0.75*64-8 = 40
  })

  it("shrinks below the desired height on short terminals", () => {
    expect(resolveDialogMaxHeight(40)).toBe(22) // 30-8
    expect(resolveDialogMaxHeight(30)).toBe(14) // 22-8
    expect(resolveDialogMaxHeight(24)).toBe(10) // 18-8
  })

  it("never goes below the 8-row floor", () => {
    expect(resolveDialogMaxHeight(20)).toBe(8) // 15-8 = 7 → floor
    expect(resolveDialogMaxHeight(10)).toBe(8)
  })

  it("respects a custom desired height", () => {
    expect(resolveDialogMaxHeight(80, 30)).toBe(30)
    expect(resolveDialogMaxHeight(40, 30)).toBe(22) // available space wins
  })

  it("respects a custom chrome estimate", () => {
    expect(resolveDialogMaxHeight(40, 40, 6)).toBe(24) // 30-6
    expect(resolveDialogMaxHeight(40, 40, 12)).toBe(18) // 30-12
  })
})

// ─── resolveDialogFit ────────────────────────────────────────────────────────

describe("resolveDialogFit", () => {
  it("returns desired size + height on a big terminal", () => {
    expect(resolveDialogFit({ width: 200, height: 80 }, { size: "xlarge", maxHeight: 40 })).toEqual({
      size: "xlarge",
      maxHeight: 40,
    })
  })

  it("downgrades both axes on a small terminal", () => {
    expect(resolveDialogFit({ width: 70, height: 25 }, { size: "large", maxHeight: 40 })).toEqual({
      size: "medium",
      maxHeight: 10,
    })
  })

  it("uses defaults when no desired values are given", () => {
    expect(resolveDialogFit({ width: 200, height: 80 })).toEqual({ size: "large", maxHeight: 40 })
  })
})

// ─── small-screen guarantee: never cut off ───────────────────────────────────

describe("small-screen fit never cuts content off", () => {
  // Host layout: content sits at paddingTop = ceil(H / 4) (worst-case
  // rounding) and grows to maxHeight + chrome rows. The fit must keep the
  // dialog bottom inside the terminal for every realistic screen height.
  it("keeps the dialog fully on-screen from 22 rows up", () => {
    for (let h = 22; h <= 80; h++) {
      const { maxHeight } = resolveDialogFit({ width: 200, height: h })
      const bottom = Math.ceil(h / 4) + maxHeight + 8
      expect(bottom).toBeLessThanOrEqual(h)
    }
  })

  it("resolves shrinking fits for typical small screens", () => {
    expect(resolveDialogFit({ width: 90, height: 25 })).toEqual({ size: "large", maxHeight: 10 })
    expect(resolveDialogFit({ width: 90, height: 30 }).maxHeight).toBe(14)
    expect(resolveDialogFit({ width: 90, height: 38 }).maxHeight).toBe(20)
    expect(resolveDialogFit({ width: 90, height: 45 }).maxHeight).toBe(25)
  })

  it("hits the exact-fit boundary on key terminal heights", () => {
    expect(resolveDialogFit({ width: 90, height: 24 }).maxHeight).toBe(10) // 6 + 10 + 8 = 24
    expect(resolveDialogFit({ width: 90, height: 60 }).maxHeight).toBe(37) // 15 + 37 + 8 = 60
    expect(resolveDialogFit({ width: 90, height: 64 }).maxHeight).toBe(40) // 16 + 40 + 8 = 64
  })

  it("only overflows below 22 rows, at the 8-row visibility floor", () => {
    expect(resolveDialogMaxHeight(21)).toBe(8)
    expect(resolveDialogMaxHeight(20)).toBe(8)
    expect(resolveDialogMaxHeight(15)).toBe(8)
  })
})
