import { describe, expect, it } from "bun:test"
import { makeScrollState, type ScrollState } from "./scroll"

// Minimal Solid-like createSignal stand-in.
function mockSignal<T>(initial: T): [() => T, (v: T) => void] {
  let value = initial
  return [() => value, (v: T) => { value = v }]
}

// Fake scrollbox element with a working scrollBy.
function makeFakeElement(opts?: { height?: number; scrollHeight?: number }) {
  let scrollTop = 0
  const el = {
    height: opts?.height ?? 40,
    scrollHeight: opts?.scrollHeight ?? 100,
    scrollTop,
    scrollBy(delta: number) {
      el.scrollTop = Math.max(0, Math.min(el.scrollHeight - (el.height ?? 40), el.scrollTop + delta))
    },
    scrollTo(pos: number) {
      el.scrollTop = pos
    },
  }
  return el
}

describe("makeScrollState", () => {
  it("exposes the required interface", () => {
    const state = makeScrollState(mockSignal)
    expect(typeof state.handleUp).toBe("function")
    expect(typeof state.handleDown).toBe("function")
    expect(typeof state.handlePageUp).toBe("function")
    expect(typeof state.handlePageDown).toBe("function")
    expect(typeof state.checkOverflow).toBe("function")
    expect(typeof state.scrollToTop).toBe("function")
    expect(typeof state.isScrolled).toBe("function")
    expect(typeof state.isAtBottom).toBe("function")
    expect(typeof state.hasOverflow).toBe("function")
  })

  it("detects overflow when content exceeds the viewport", () => {
    const state = makeScrollState(mockSignal)
    state.scrollRef = makeFakeElement({ height: 40, scrollHeight: 200 })
    state.checkOverflow()
    expect(state.hasOverflow()).toBe(true)
  })

  it("reports no overflow when content fits", () => {
    const state = makeScrollState(mockSignal)
    state.scrollRef = makeFakeElement({ height: 40, scrollHeight: 30 })
    state.checkOverflow()
    expect(state.hasOverflow()).toBe(false)
  })

  it("scrolls by 10 on up/down and tracks position flags", () => {
    const state = makeScrollState(mockSignal)
    const el = makeFakeElement({ height: 40, scrollHeight: 200 })
    state.scrollRef = el

    state.handleDown()
    expect(el.scrollTop).toBe(10)
    expect(state.isScrolled()).toBe(true)

    state.handleUp()
    expect(el.scrollTop).toBe(0)
  })

  it("pages by viewport size on page up/down", () => {
    const state = makeScrollState(mockSignal)
    const el = makeFakeElement({ height: 40, scrollHeight: 500 })
    state.scrollRef = el

    state.handlePageDown()
    expect(el.scrollTop).toBe(38) // pageSize = clientHeight - 2

    state.handlePageUp()
    expect(el.scrollTop).toBe(0)
  })

  it("returns false for page handlers without an element", () => {
    const state = makeScrollState(mockSignal)
    expect(state.handlePageUp()).toBe(false)
    expect(state.handlePageDown()).toBe(false)
  })

  it("scrollToTop resets position and flags", () => {
    const state = makeScrollState(mockSignal)
    const el = makeFakeElement({ height: 40, scrollHeight: 200 })
    state.scrollRef = el
    state.handleDown()
    state.scrollToTop()
    expect(el.scrollTop).toBe(0)
    expect(state.isScrolled()).toBe(false)
    expect(state.isAtBottom()).toBe(false)
  })

  it("survives a missing element (optional chaining)", () => {
    const state = makeScrollState(mockSignal)
    expect(state.handleUp()).toBe(true)
    expect(state.handleDown()).toBe(true)
    state.checkOverflow()
    state.scrollToTop()
    expect(state.hasOverflow()).toBe(false)
  })
})
