import { describe, expect, it, afterEach } from "bun:test"
import { existsSync, readFileSync, unlinkSync, mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createLog } from "./log"

afterEach(() => {
  delete process.env.OPENCODE_WLIB_DEBUG
})

function tmpDir(): string {
  return mkdtempSync(join(tmpdir(), "wlib-log-test-"))
}

describe("createLog", () => {
  it("no-ops and writes nothing when debug is off", () => {
    const dir = tmpDir()
    try {
      const logger = createLog({ debug: false, dir, fileName: "test.log" })
      logger.log("hello")
      expect(logger.debug).toBe(false)
      expect(existsSync(join(dir, "test.log"))).toBe(false)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it("writes ISO-timestamped lines when debug is on", () => {
    const dir = tmpDir()
    try {
      const logger = createLog({ debug: true, dir, fileName: "test.log" })
      logger.log("monke", "rocks")
      const content = readFileSync(join(dir, "test.log"), "utf-8")
      expect(content).toContain("[")
      expect(content).toContain("monke rocks")
      expect(content).toMatch(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it("appends multiple lines", () => {
    const dir = tmpDir()
    try {
      const logger = createLog({ debug: true, dir, fileName: "test.log" })
      logger.log("one")
      logger.log("two")
      const content = readFileSync(join(dir, "test.log"), "utf-8")
      expect(content.split("\n").filter(Boolean).length).toBe(2)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it("respects the OPENCODE_WLIB_DEBUG env var", () => {
    const dir = tmpDir()
    try {
      process.env.OPENCODE_WLIB_DEBUG = "true"
      const logger = createLog({ dir, fileName: "test.log" })
      logger.log("env driven")
      expect(logger.debug).toBe(true)
      expect(existsSync(join(dir, "test.log"))).toBe(true)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it("never throws on write errors", () => {
    const logger = createLog({ debug: true, dir: "/nonexistent-dir-xyz", fileName: "nope.log" })
    expect(() => logger.log("boom")).not.toThrow()
  })
})
