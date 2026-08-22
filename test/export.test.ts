import { describe, expect, it } from "bun:test"
import { EXPORT_FORMATS, formatToExtension } from "../src/core/export"

describe("formatToExtension", () => {
  it("maps markdown to md", () => {
    expect(formatToExtension("markdown")).toBe("md")
  })

  it("maps csv to csv", () => {
    expect(formatToExtension("csv")).toBe("csv")
  })

  it("maps json to json", () => {
    expect(formatToExtension("json")).toBe("json")
  })

  it("maps text to txt", () => {
    expect(formatToExtension("text")).toBe("txt")
  })
})

describe("EXPORT_FORMATS", () => {
  it("defines exactly the four supported formats", () => {
    expect(EXPORT_FORMATS).toHaveLength(4)
    expect(EXPORT_FORMATS.map((f) => f.id)).toEqual(["markdown", "csv", "json", "text"])
  })
})