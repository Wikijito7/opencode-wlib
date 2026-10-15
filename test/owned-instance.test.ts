/**
 * opencode-wlib — owned instance lifetime tests (UI).
 *
 * `createOwnedInstance` is the Solid half of the stable export-controller
 * lifetime fix. Its only Solid dependency is `createRoot`, so this file
 * virtualizes `solid-js` and exercises the REAL `createOwnedInstance` logic
 * against it.
 *
 * The virtual module models the two `createRoot` guarantees the fix relies on,
 * read off solid-js 1.9.12 (`dist/solid.js`, `createRoot` + `cleanNode`):
 *   1. A root created with a `fn.length !== 0` callback (the `dispose` form)
 *      is a STANDALONE owner. `createRoot` gives it `owner = current` for
 *      context/error fan-out, but does NOT push it into the calling owner's
 *      `owned` list — so the calling computation's teardown cannot reach it.
 *      Only the returned `dispose` handle can.
 *   2. Disposal walks a node's `owned` children depth-first (reverse order)
 *      and then its own `cleanups` (reverse order), running each exactly once.
 *
 * WHAT THIS PROVES: factory-once, stable `.instance` across re-reads,
 * dispose-once, that a factory cleanup (and cleanups of computations the
 * factory owns) run exactly once on dispose, that disposing the calling render
 * computation does NOT tear the root down, and that post-dispose access throws.
 *
 * WHAT IT DOES NOT PROVE (needs the real Solid runtime): that a genuinely
 * rerunning dialog render computation cannot tear the root down. That is
 * covered by the later real OpenCode PTY test. No packages are installed here
 * and no source-text assertions are made.
 *
 * WHY THE MOCK EXPORTS MORE THAN IT USES: `bun test` links each mocked module
 * once per process, keyed by the export names requested across every test
 * file. `export-controller.test.ts` also mocks `solid-js`; if this file's mock
 * omits a name that file imports, the other file fails to link. The inert
 * placeholders below exist only to keep the mocked surface a superset — they
 * are never used by the code under test here.
 */

import { describe, expect, it, mock } from "bun:test"

// ─── Minimal Solid owner model (mirrors solid-js 1.9.12 createRoot/cleanNode) ─

interface OwnerNode {
  owned: OwnerNode[]
  cleanups: Array<() => void>
  owner: OwnerNode | null
}

let currentOwner: OwnerNode | null = null

function newOwner(): OwnerNode {
  return { owned: [], cleanups: [], owner: currentOwner }
}

/** Mirrors `cleanNode`: owned children first (reverse), then own cleanups. */
function cleanNode(node: OwnerNode): void {
  for (let i = node.owned.length - 1; i >= 0; i--) cleanNode(node.owned[i])
  node.owned.length = 0
  for (let i = node.cleanups.length - 1; i >= 0; i--) node.cleanups[i]()
  node.cleanups.length = 0
}

function onCleanup(fn: () => void): () => void {
  currentOwner?.cleanups.push(fn)
  return fn
}

/** A child owner, as `createEffect`/`createMemo` create in Solid. */
function createComputation(fn: () => void): OwnerNode {
  const node = newOwner()
  if (currentOwner) currentOwner.owned.push(node)
  const previous = currentOwner
  currentOwner = node
  try {
    fn()
  } finally {
    currentOwner = previous
  }
  return node
}

/** Test-facing alias: an effect is a child computation owned by its parent. */
const createEffect = createComputation

function createRoot<T>(fn: (dispose?: () => void) => T): T {
  const owner = currentOwner
  const unowned = fn.length === 0
  // A standalone root is deliberately NOT pushed into `owner.owned` (Solid's
  // createRoot attaches it only via the `owner` reference, not for disposal).
  const root: OwnerNode = { owned: [], cleanups: [], owner }
  let disposed = false
  const dispose = () => {
    if (disposed) return
    disposed = true
    cleanNode(root)
  }
  const previous = currentOwner
  currentOwner = root
  try {
    // The `dispose` form (`fn.length !== 0`) is what the fix relies on; the
    // zero-arg form would be an unowned root with no teardown handle.
    return unowned ? (fn as () => T)() : fn(dispose)
  } finally {
    currentOwner = previous
  }
}

/**
 * Run `fn` under a fresh owner and return it with a handle that disposes that
 * owner — i.e. exactly what happens when a dialog's render computation re-runs
 * or is torn down.
 */
function runInComputation<T>(fn: () => T): { value: T; dispose: () => void } {
  const owner = newOwner()
  const previous = currentOwner
  currentOwner = owner
  try {
    return { value: fn(), dispose: () => cleanNode(owner) }
  } finally {
    currentOwner = previous
  }
}

// ─── Inert placeholders + mock registration (before importing the subject) ───

function inertSignal<T>(initial: T): [() => T, (next: T) => void] {
  return [() => initial, () => {}]
}

mock.module("solid-js", () => ({
  createRoot,
  onCleanup,
  // Surface-compatibility placeholders (see the header note). Never used here.
  createSignal: inertSignal,
  createEffect: () => {},
  onMount: () => {},
  Show: () => null,
}))

const { createOwnedInstance } = await import("../src/ui/owned-instance")

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("createOwnedInstance — create-once / dispose-once", () => {
  it("runs the factory exactly once and returns a stable instance", () => {
    let calls = 0
    const owned = createOwnedInstance(() => {
      calls += 1
      return { id: calls }
    })

    expect(calls).toBe(1)
    const first = owned.instance
    expect(calls).toBe(1)

    // Reading `.instance` repeatedly (as the dialog render callback re-runs)
    // must never replace the instance.
    for (let i = 0; i < 5; i++) {
      expect(owned.instance).toBe(first)
    }
    expect(calls).toBe(1)
  })

  it("owns the factory's onCleanup and runs it exactly once on dispose", () => {
    let cleaned = 0
    const owned = createOwnedInstance(() => {
      onCleanup(() => {
        cleaned += 1
      })
      return {}
    })

    expect(cleaned).toBe(0)
    owned.dispose()
    expect(cleaned).toBe(1)
  })

  it("is not torn down when the calling render computation is disposed or re-runs", () => {
    const order: string[] = []
    const { value: owned, dispose: disposeComputation } = runInComputation(() => {
      // A sibling computation owned by the calling computation: proof that
      // disposing it really does run its own children.
      createEffect(() => {
        onCleanup(() => order.push("sibling"))
      })
      return createOwnedInstance(() => {
        onCleanup(() => order.push("root"))
        return { id: 1 }
      })
    })

    expect(order).toEqual([])

    // The dialog's render computation re-runs / is torn down...
    disposeComputation()

    // ...its sibling is cleaned, but the standalone root is untouched.
    expect(order).toEqual(["sibling"])
    expect(owned.instance).toEqual({ id: 1 })

    // Only the explicit dispose tears the root down.
    owned.dispose()
    expect(order).toEqual(["sibling", "root"])
  })

  it("disposes the root's own cleanups and its owned computations exactly once", () => {
    const order: string[] = []
    const owned = createOwnedInstance(() => {
      createEffect(() => {
        onCleanup(() => order.push("effect"))
        createEffect(() => {
          onCleanup(() => order.push("effect-child"))
        })
      })
      onCleanup(() => order.push("root-1"))
      onCleanup(() => order.push("root-2"))
      return {}
    })

    owned.dispose()
    owned.dispose()

    // cleanNode walks owned depth-first in reverse, then cleanups in reverse.
    expect(order).toEqual(["effect-child", "effect", "root-2", "root-1"])
  })

  it("dispose() is idempotent — the root is torn down once", () => {
    let cleaned = 0
    const owned = createOwnedInstance(() => {
      onCleanup(() => {
        cleaned += 1
      })
      return {}
    })

    owned.dispose()
    owned.dispose()
    owned.dispose()
    expect(cleaned).toBe(1)
  })

  it("throws a clear error when .instance is read after dispose()", () => {
    const owned = createOwnedInstance(() => ({}))
    owned.dispose()

    expect(() => owned.instance).toThrow("instance slot has been disposed")
  })
})
