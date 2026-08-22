import { describe, expect, it } from "bun:test"
import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { estimateTokens, isTitleGenerator, readSystemSnapshot, writeSystemSnapshot } from "../src/core/system"

function tmpFile(): string {
  const dir = mkdtempSync(join(tmpdir(), "wlib-test-"))
  return join(dir, "system-snapshots.json")
}

function cleanup(file: string) {
  try {
    unlinkSync(file)
  } catch {
    /* ignore */
  }
}

// ─── estimateTokens ──────────────────────────────────────────────────────────

describe("estimateTokens", () => {
  it("returns 0 for empty / whitespace", () => {
    expect(estimateTokens("")).toBe(0)
    expect(estimateTokens("   ")).toBe(1)
  })

  it("returns ceil(chars/4)", () => {
    expect(estimateTokens("abcd")).toBe(1)
    expect(estimateTokens("abcde")).toBe(2)
    expect(estimateTokens("a".repeat(400))).toBe(100)
  })
})

// ─── isTitleGenerator ─────────────────────────────────────────────────────────

describe("isTitleGenerator", () => {
  it("detects the title-generator system prompt", () => {
    expect(isTitleGenerator(["You are a title generator. You output ONLY a thread title."])).toBe(true)
    expect(isTitleGenerator(["You are a TITLE GENERATOR"])).toBe(true)
  })

  it("returns false for regular system prompts", () => {
    expect(isTitleGenerator(["You are opencode, an interactive CLI tool."])).toBe(false)
    expect(isTitleGenerator([])).toBe(false)
  })
})

// ─── writeSystemSnapshot / readSystemSnapshot ─────────────────────────────────

describe("writeSystemSnapshot", () => {
  it("round-trips the final system prompt for a session", async () => {
    const file = tmpFile()
    try {
      await writeSystemSnapshot("ses_1", "Instructions from: persona-injector\n## JUNGLE MODE\n\nbase prompt", file)
      const entry = readSystemSnapshot("ses_1", file)
      expect(entry).not.toBeNull()
      expect(entry!.rawText).toContain("persona-injector")
      expect(entry!.rawText).toContain("base prompt")
      expect(typeof entry!.ts).toBe("number")
    } finally {
      cleanup(file)
    }
  })

  it("keys entries per session", async () => {
    const file = tmpFile()
    try {
      await writeSystemSnapshot("ses_a", "system a", file)
      await writeSystemSnapshot("ses_b", "system b", file)
      expect(readSystemSnapshot("ses_a", file)!.rawText).toBe("system a")
      expect(readSystemSnapshot("ses_b", file)!.rawText).toBe("system b")
    } finally {
      cleanup(file)
    }
  })

  it("no-ops on missing session or empty text (title-gen must not clobber)", async () => {
    const file = tmpFile()
    try {
      await writeSystemSnapshot("ses_1", "real system", file)
      await writeSystemSnapshot("", "anything", file)
      await writeSystemSnapshot("ses_1", "   ", file)
      await writeSystemSnapshot("ses_2", "", file)
      expect(readSystemSnapshot("ses_1", file)!.rawText).toBe("real system")
      expect(readSystemSnapshot("ses_2", file)).toBeNull()
    } finally {
      cleanup(file)
    }
  })

  it("keeps the last persisted text when the drift is within the threshold", async () => {
    const file = tmpFile()
    try {
      await writeSystemSnapshot("ses_1", "a".repeat(400), file) // 100 tokens
      // +8 chars = +2 tokens drift → within default threshold (32)
      await writeSystemSnapshot("ses_1", "a".repeat(400) + "extra!", file)
      expect(readSystemSnapshot("ses_1", file)!.rawText).toBe("a".repeat(400))
    } finally {
      cleanup(file)
    }
  })

  it("overwrites when the drift exceeds the threshold", async () => {
    const file = tmpFile()
    try {
      await writeSystemSnapshot("ses_1", "a".repeat(400), file) // 100 tokens
      await writeSystemSnapshot("ses_1", "b".repeat(800), file, { driftThreshold: 10 }) // 200 tokens → drift 100 > 10
      expect(readSystemSnapshot("ses_1", file)!.rawText).toBe("b".repeat(800))
    } finally {
      cleanup(file)
    }
  })

  it("refreshes the timestamp after tsRefreshMs without touching the text", async () => {
    const file = tmpFile()
    try {
      const t0 = 1_000_000
      await writeSystemSnapshot("ses_1", "same text", file, { now: t0 })
      await writeSystemSnapshot("ses_1", "same text", file, { now: t0 + 1000 }) // within refresh window
      expect(readSystemSnapshot("ses_1", file)!.ts).toBe(t0)
      await writeSystemSnapshot("ses_1", "same text", file, { now: t0 + 60_000 * 6 }) // past 5-min refresh
      expect(readSystemSnapshot("ses_1", file)!.ts).toBe(t0 + 60_000 * 6)
      expect(readSystemSnapshot("ses_1", file)!.rawText).toBe("same text")
    } finally {
      cleanup(file)
    }
  })

  it("evicts oldest entries FIFO when the cap is exceeded", async () => {
    const file = tmpFile()
    try {
      const now = 1_000_000
      for (let i = 0; i < 5; i++) {
        await writeSystemSnapshot(`ses_${i}`, `system ${i}`, file, { maxEntries: 4, purgeCount: 2, now: now + i })
      }
      expect(readSystemSnapshot("ses_0", file)).toBeNull()
      expect(readSystemSnapshot("ses_1", file)).toBeNull()
      expect(readSystemSnapshot("ses_4", file)!.rawText).toBe("system 4")
      const data = JSON.parse(readFileSync(file, "utf-8"))
      expect(Object.keys(data).length).toBe(3)
    } finally {
      cleanup(file)
    }
  })

  it("recovers from a malformed file", async () => {
    const file = tmpFile()
    try {
      writeFileSync(file, "{not valid json!!")
      await writeSystemSnapshot("ses_1", "fresh start", file)
      expect(readSystemSnapshot("ses_1", file)!.rawText).toBe("fresh start")
    } finally {
      cleanup(file)
    }
  })

  it("creates the parent directory on demand", async () => {
    const dir = mkdtempSync(join(tmpdir(), "wlib-test-"))
    const file = join(dir, "nested", "deep", "system-snapshots.json")
    try {
      await writeSystemSnapshot("ses_1", "deep text", file)
      expect(existsSync(file)).toBe(true)
      expect(readSystemSnapshot("ses_1", file)!.rawText).toBe("deep text")
    } finally {
      cleanup(file)
    }
  })
})

// ─── readSystemSnapshot ───────────────────────────────────────────────────────

describe("readSystemSnapshot", () => {
  it("returns null for missing sessions and missing files", () => {
    const file = tmpFile()
    try {
      expect(readSystemSnapshot("ses_none", file)).toBeNull()
      expect(readSystemSnapshot("ses_none", join(tmpdir(), "wlib-does-not-exist.json"))).toBeNull()
    } finally {
      cleanup(file)
    }
  })

  it("returns null for empty rawText entries", async () => {
    const file = tmpFile()
    try {
      writeFileSync(file, JSON.stringify({ ses_1: { ts: 1, rawText: "" } }))
      expect(readSystemSnapshot("ses_1", file)).toBeNull()
    } finally {
      cleanup(file)
    }
  })

  it("returns null for malformed files", () => {
    const file = tmpFile()
    try {
      writeFileSync(file, "garbage")
      expect(readSystemSnapshot("ses_1", file)).toBeNull()
    } finally {
      cleanup(file)
    }
  })
})
