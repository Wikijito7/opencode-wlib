import { describe, expect, it } from "bun:test"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { exportFilePath, timestamp, writeFile } from "../src/core/file"

describe("timestamp", () => {
  it("matches YYYYMMDD-HHmmssNNN structure", () => {
    const t = timestamp()
    expect(t).toMatch(/^\d{8}-\d{9}$/)
  })

  it("has length 18 with a date part and a time part separated by a dash", () => {
    const t = timestamp()
    expect(t.length).toBe(18)
    const [date, time] = t.split("-")
    expect(date.length).toBe(8)
    expect(time.length).toBe(9)
    // Date must be a real calendar date.
    const year = Number(date.slice(0, 4))
    const month = Number(date.slice(4, 6))
    const day = Number(date.slice(6, 8))
    expect(month).toBeGreaterThanOrEqual(1)
    expect(month).toBeLessThanOrEqual(12)
    expect(day).toBeGreaterThanOrEqual(1)
    expect(day).toBeLessThanOrEqual(31)
    expect(year).toBeGreaterThanOrEqual(2000)
  })
})

describe("exportFilePath", () => {
  it("builds a path under .config/opencode/export", () => {
    const p = exportFilePath("usage", "json", "20260101-123000")
    expect(p.endsWith("usage_20260101-123000.json")).toBe(true)
    expect(p).toContain("opencode/export")
    expect(p.includes("export" + "/" + "usage_20260101-123000.json")).toBe(true)
  })

  it("honors an explicit base dir", () => {
    const p = exportFilePath("usage", "json", "20260101-123000", "/tmp/custom")
    expect(p).toBe("/tmp/custom/usage_20260101-123000.json")
  })
})

describe("writeFile", () => {
  it("writes content to disk and returns true", async () => {
    const dir = mkdtempSync(join(tmpdir(), "wlib-test-"))
    try {
      const f = join(dir, "report.json")
      const ok = await writeFile(f, "hello")
      expect(ok).toBe(true)
      expect(readFileSync(f, "utf8")).toBe("hello")
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it("returns false when the path cannot be created", async () => {
    const dir = mkdtempSync(join(tmpdir(), "wlib-test-"))
    try {
      // Use the temp dir itself as a "file" so its child path is invalid.
      const bad = join(dir, "parent", "child.json")
      rmSync(join(dir, "parent"), { recursive: true, force: true })
      // Create a regular file named "parent" so dirname(bad) cannot be a dir.
      const { writeFileSync } = await import("node:fs")
      writeFileSync(join(dir, "parent"), "i am a file")
      const ok = await writeFile(bad, "hello")
      expect(ok).toBe(false)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})