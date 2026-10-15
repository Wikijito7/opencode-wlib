/**
 * opencode-wlib — owned instance lifetime tests (UI).
 *
 * `createOwnedInstance` is the Solid half of the stable export-controller
 * lifetime fix. Its only Solid dependency is `createRoot`, so this file
 * virtualizes `solid-js` and exercises the REAL `createOwnedInstance` logic
 * against it.
 *
 * The virtual module models the three `createRoot` guarantees the fix relies
 * on, read off solid-js 1.9.12 (`dist/solid.js`, `createRoot` + `cleanNode`):
 *   1. A root created with a `fn.length !== 0` callback (the `dispose` form)
 *      is a STANDALONE owner. `createRoot` gives it `owner = current` for
 *      context/error fan-out, but does NOT push it into the calling owner's
 *      `owned` list — so the calling computation's teardown cannot reach it.
 *      Only the returned `dispose` handle can.
 *   2. Context flows up the `owner` chain (`useContext`). Because the root
 *      keeps the call-site owner as its `owner` reference, a factory run
 *      inside the root can still read a provider that is on that chain —
 *      even though the root is not disposable by it.
 *   3. Disposal walks a node's `owned` children depth-first (reverse order)
 *      and then its own `cleanups` (reverse order), running each exactly once.
 *
 * WHAT THIS PROVES: construction is inert (no root, no factory call until the
 * first `get()`), the first `get()` creates the instance — and, when it runs
 * inside a simulated dialog provider, the instance is created with THAT
 * context — repeated `get()` calls (one per render-callback re-run) return the
 * identical instance, dispose-once, that a factory cleanup (and cleanups of
 * computations the factory owns) run exactly once on dispose, that disposing
 * the calling render computation does NOT tear the root down, that disposal on
 * close tears the root down once, and that `get()` after dispose throws.
 *
 * WHAT IT DOES NOT PROVE (needs the real Solid runtime): that a genuinely
 * rerunning dialog render computation cannot tear the root down, that a real
 * `Keymap.Provider`'s context reaches the effect, and that a real `createRoot`
 * captures the owner at the `get()` call site rather than at construction.
 * Those are covered by the later real OpenCode PTY test. No packages are
 * installed here and no source-text assertions are made.
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
  context: Map<symbol, unknown>
}

let currentOwner: OwnerNode | null = null

/** Count of `createRoot` calls — lets a test prove construction made no root. */
let rootCreates = 0

function newOwner(): OwnerNode {
  return { owned: [], cleanups: [], owner: currentOwner, context: new Map() }
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

/**
 * Mirrors Solid's `useContext`: walk the owner chain looking for the providing
 * owner. Returns `undefined` when no owner on the chain supplies the key.
 */
function readContext<T>(key: symbol): T | undefined {
  let node = currentOwner
  while (node) {
    if (node.context.has(key)) return node.context.get(key) as T
    node = node.owner
  }
  return undefined
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
  rootCreates += 1
  const owner = currentOwner
  const unowned = fn.length === 0
  // A standalone root is deliberately NOT pushed into `owner.owned` (Solid's
  // createRoot attaches it only via the `owner` reference, not for disposal),
  // but it keeps that reference so context still flows up the chain.
  const root: OwnerNode = { owned: [], cleanups: [], owner, context: new Map() }
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

/**
 * Run `fn` under a provider owner that supplies `key = value` to its subtree,
 * i.e. the `Keymap.Provider` the dialog render callback sits inside.
 */
function runInProvider<T>(key: symbol, value: unknown, fn: () => T): T {
  const provider = newOwner()
  provider.context.set(key, value)
  if (currentOwner) currentOwner.owned.push(provider)
  const previous = currentOwner
  currentOwner = provider
  try {
    return fn()
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

const KEYMAP = Symbol("keymap")

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("createOwnedInstance — lazy create-once / dispose-once", () => {
  it("is inert at construction — the factory and root appear only on first get()", () => {
    let calls = 0
    const rootsBefore = rootCreates

    const owned = createOwnedInstance(() => {
      calls += 1
      return { id: calls }
    })

    // Construction alone must not run the factory nor create a Solid root.
    expect(calls).toBe(0)
    expect(rootCreates).toBe(rootsBefore)

    owned.get()
    expect(calls).toBe(1)
    expect(rootCreates).toBe(rootsBefore + 1)
  })

  it("never runs the factory when dispose() happens before the first get()", () => {
    let calls = 0
    const rootsBefore = rootCreates

    const owned = createOwnedInstance(() => {
      calls += 1
      return {}
    })

    owned.dispose()
    expect(calls).toBe(0)
    expect(rootCreates).toBe(rootsBefore)
  })

  it("creates the instance once and returns the same instance across render re-runs", () => {
    let calls = 0
    const rootsBefore = rootCreates
    const owned = createOwnedInstance(() => {
      calls += 1
      return { id: calls }
    })

    const first = owned.get()
    expect(calls).toBe(1)
    expect(rootCreates).toBe(rootsBefore + 1)

    // Reading via `.get()` repeatedly (as the dialog render callback re-runs)
    // must never replace the instance nor create another root.
    for (let i = 0; i < 5; i++) {
      expect(owned.get()).toBe(first)
    }
    expect(calls).toBe(1)
    expect(rootCreates).toBe(rootsBefore + 1)
  })

  it("creates the instance with the dialog provider's context on first get()", () => {
    // Constructed OUTSIDE the provider — inert, exactly what the buggy call
    // site did before the fix.
    let seen = "unset"
    const owned = createOwnedInstance(() => {
      seen = readContext<string>(KEYMAP) ?? "unset"
      return { layer: seen }
    })

    // Construction captured no context and ran no factory.
    expect(seen).toBe("unset")

    // The FIRST get() runs inside the provider, so the root it creates inherits
    // the provider on its owner chain and the factory reads the layer.
    const instance = runInProvider(KEYMAP, "priority-2", () => owned.get())
    expect(instance).toEqual({ layer: "priority-2" })
    expect(seen).toBe("priority-2")
  })

  it("captures no context when the first get() runs outside any provider", () => {
    let seen = "unset"
    const owned = createOwnedInstance(() => {
      seen = readContext<string>(KEYMAP) ?? "unset"
      return {}
    })

    owned.get()
    expect(seen).toBe("unset")
  })

  it("owns the factory's onCleanup and runs it exactly once on dispose", () => {
    let cleaned = 0
    const owned = createOwnedInstance(() => {
      onCleanup(() => {
        cleaned += 1
      })
      return {}
    })

    owned.get()
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
      const owned = createOwnedInstance(() => {
        onCleanup(() => order.push("root"))
        return { id: 1 }
      })
      // First get inside the computation: root created here, inheriting it.
      owned.get()
      return owned
    })

    expect(order).toEqual([])

    // The dialog's render computation re-runs / is torn down...
    disposeComputation()

    // ...its sibling is cleaned, but the standalone root is untouched.
    expect(order).toEqual(["sibling"])
    expect(owned.get()).toEqual({ id: 1 })

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

    owned.get()
    owned.dispose()
    owned.dispose()

    // cleanNode walks owned depth-first in reverse, then cleanups in reverse.
    expect(order).toEqual(["effect-child", "effect", "root-2", "root-1"])
  })

  it("disposing on close tears the root down once — repeated dispose is idempotent", () => {
    let cleaned = 0
    const rootsBefore = rootCreates
    const owned = createOwnedInstance(() => {
      onCleanup(() => {
        cleaned += 1
      })
      return {}
    })

    owned.get()
    expect(rootCreates).toBe(rootsBefore + 1)

    // A dialog can call onClose more than once (escape, replacement, close).
    owned.dispose()
    owned.dispose()
    owned.dispose()
    expect(cleaned).toBe(1)
  })

  it("throws a clear error when get() is called after dispose()", () => {
    const owned = createOwnedInstance(() => ({}))
    owned.get()
    owned.dispose()

    expect(() => owned.get()).toThrow("owned instance has been disposed")
  })
})
