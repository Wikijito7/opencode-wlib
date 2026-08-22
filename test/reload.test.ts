import { describe, expect, it } from "bun:test"
import { createLoadGuard } from "../src/core/reload"

describe("createLoadGuard", () => {
  it("invalidates the generation on every call", () => {
    const guard = createLoadGuard()
    const g1 = guard.invalidate()
    const g2 = guard.invalidate()
    expect(g2).toBeGreaterThan(g1)
  })

  it("isCurrent is true only for the latest generation", () => {
    const guard = createLoadGuard()
    const stale = guard.invalidate()
    expect(guard.isCurrent(stale)).toBe(true)

    const latest = guard.invalidate()
    expect(guard.isCurrent(stale)).toBe(false)
    expect(guard.isCurrent(latest)).toBe(true)
  })

  it("starts with generation 0 and no pending fetch", () => {
    const guard = createLoadGuard()
    expect(guard.isCurrent(0)).toBe(true)
    expect(guard.isCurrent(1)).toBe(false)
  })
})
