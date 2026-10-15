/**
 * opencode-wlib — instance slot regression tests (pure).
 *
 * `createInstanceSlot` is the framework-free half of the stable export-controller
 * lifetime fix: it guarantees the factory runs at most once, that every read
 * returns the identical instance, and that the optional disposer runs at most
 * once. No Solid/OpenTUI is involved, so these run without any mocking.
 */

import { describe, expect, it } from "bun:test"
import { createInstanceSlot } from "../src/core/instance"

describe("createInstanceSlot — create-once identity", () => {
  it("runs the factory lazily, on the first get() only", () => {
    let calls = 0
    const slot = createInstanceSlot(() => {
      calls += 1
      return { id: calls }
    })

    expect(slot.created()).toBe(false)
    expect(calls).toBe(0)

    const first = slot.get()
    expect(calls).toBe(1)
    expect(slot.created()).toBe(true)

    // Every later read reuses the same value; the factory never reruns.
    expect(slot.get()).toBe(first)
    expect(slot.get()).toBe(first)
    expect(calls).toBe(1)
  })

  it("returns an instance that is stable across repeated reads", () => {
    const slot = createInstanceSlot(() => ({ tag: "stable" }))
    const first = slot.get()
    for (let i = 0; i < 5; i++) {
      expect(slot.get()).toBe(first)
    }
  })
})

describe("createInstanceSlot — dispose-once", () => {
  it("invokes the disposer exactly once with the created instance", () => {
    const seen: Array<{ id: number }> = []
    const slot = createInstanceSlot(
      () => ({ id: 1 }),
      (instance) => seen.push(instance),
    )
    const instance = slot.get()

    slot.dispose()
    expect(seen).toEqual([instance])
  })

  it("is idempotent — a second dispose() does not run the disposer again", () => {
    let calls = 0
    const slot = createInstanceSlot(
      () => ({}),
      () => {
        calls += 1
      },
    )
    slot.get()

    slot.dispose()
    slot.dispose()
    slot.dispose()
    expect(calls).toBe(1)
  })

  it("does not run the factory or the disposer when disposed before any get()", () => {
    let factoryCalls = 0
    let disposeCalls = 0
    const slot = createInstanceSlot(
      () => {
        factoryCalls += 1
        return {}
      },
      () => {
        disposeCalls += 1
      },
    )

    slot.dispose()
    expect(factoryCalls).toBe(0)
    expect(disposeCalls).toBe(0)
    expect(slot.created()).toBe(false)
  })

  it("works without a disposer", () => {
    const slot = createInstanceSlot(() => ({ ok: true }))
    expect(slot.get()).toEqual({ ok: true })
    expect(() => slot.dispose()).not.toThrow()
  })
})

describe("createInstanceSlot — disposed access fails loudly", () => {
  it("throws a descriptive error when get() is called after dispose()", () => {
    const slot = createInstanceSlot(() => ({}))
    slot.get()
    slot.dispose()

    expect(() => slot.get()).toThrow("instance slot has been disposed")
  })

  it("throws on get() after dispose() even when never created", () => {
    const slot = createInstanceSlot(() => ({}))
    slot.dispose()
    expect(() => slot.get()).toThrow("instance slot has been disposed")
  })

  it("never re-runs the factory on a post-dispose get() — no resurrection", () => {
    let calls = 0
    const slot = createInstanceSlot(() => {
      calls += 1
      return {}
    })
    slot.get()
    slot.dispose()

    // Repeated failed reads must not recreate the instance.
    expect(() => slot.get()).toThrow("instance slot has been disposed")
    expect(() => slot.get()).toThrow("instance slot has been disposed")
    expect(calls).toBe(1)
  })
})
