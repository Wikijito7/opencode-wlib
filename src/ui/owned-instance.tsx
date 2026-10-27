/**
 * opencode-wlib — stable Solid owner for a single instance.
 *
 * A dialog's render callback re-runs whenever any signal read directly in its
 * body changes, so creating a controller inside it replaces the instance on
 * every re-render: the old controller's effects are disposed and the overlay
 * renders against a fresh, closed instance (the confirmed export-popup bug).
 *
 * `createOwnedInstance` creates the value exactly once inside a `createRoot`
 * owner that outlives those re-runs. Effects/`onCleanup` the factory registers
 * (e.g. the export controller's priority-2 key layer + flash timeout) belong to
 * that root, and `dispose()` tears it down exactly once — call it from the
 * dialog's `onClose` so escape, replacement, and close all clean up.
 *
 * ## Lazy creation (why `get()`, not an eager `instance`)
 *
 * The factory is **not** run at construction. A Solid `createRoot` captures the
 * context of the owner present at its call site, and the export controller's
 * `createEffect` reads `context.keymap.layer` — which only exists once the
 * dialog's `Keymap.Provider` is on the owner chain, i.e. inside the dialog's
 * render callback. Creating the root eagerly (e.g. before `host.dialog.show`)
 * captures an owner above the provider, so the effect logs
 * "Keymap.Provider is missing" and the priority-2 layer never registers.
 *
 * So the caller may construct `createOwnedInstance(factory)` wherever it likes,
 * but the root + factory run on the FIRST `get()`, which must happen from inside
 * the dialog's render callback (before the export wrappers render). Later
 * `get()` calls — one per render-callback re-run — return the identical
 * instance. `dispose()` is idempotent; `get()` after `dispose()` throws; a
 * `dispose()` before the first `get()` never runs the factory.
 *
 * Owner-propagation guarantee (verified against solid-js 1.9.12 source,
 * `createRoot` in `dist/solid.js`): called with a callback that takes the
 * `dispose` argument (`fn.length !== 0`), `createRoot` builds a standalone
 * owner whose `owned`/`cleanups` lists hang off *itself*; it is NOT pushed into
 * the calling computation's `owned` array. Disposal walks only a node's
 * `owned`/`cleanups` (`cleanNode`), so when the transient dialog render
 * computation re-runs or is torn down it cannot dispose this root. Only the
 * `dispose` handle returned here does. Context (keymap provider, theme, etc.)
 * is still inherited from the calling owner because the root keeps it as its
 * `owner` reference — that reference is for context/error fan-out, not for
 * disposal. The dispose-taking callback shape is required: a zero-arg callback
 * makes `createRoot` build the shared `UNOWNED` root, whose null owner carries
 * no inherited context.
 */

import { createRoot } from "solid-js"
import { createInstanceSlot, type InstanceSlot } from "../core/instance"

export interface OwnedInstance<T> {
  /**
   * Return the single live instance, creating it (and its stable root) on the
   * first call. Call it from inside the dialog render callback so the root
   * inherits the dialog's context (e.g. `Keymap.Provider`). Repeated calls
   * return the identical instance; a call after `dispose()` throws.
   */
  get(): T
  /**
   * Dispose the owner and its effects. Idempotent. A no-op before the first
   * `get()` (the factory is never invoked in that case).
   */
  dispose(): void
}

export function createOwnedInstance<T>(factory: () => T): OwnedInstance<T> {
  let slot: InstanceSlot<T> | undefined
  let disposeRoot: (() => void) | undefined
  let instance: T | undefined
  let created = false
  let disposed = false

  return {
    get(): T {
      if (disposed) throw new Error("owned instance has been disposed")
      if (created) return instance as T
      // First get: create the standalone root HERE — at the call site, inside
      // the dialog render callback — so it inherits the current owner's context
      // (the dialog's Keymap.Provider). The instance is created inside that root
      // so the factory's effects/onCleanup are owned by it, not by the transient
      // render computation. The dispose-taking callback shape is required for
      // the root to be context-inheriting rather than the UNOWNED root.
      disposeRoot = createRoot((dispose) => {
        slot = createInstanceSlot(factory)
        instance = slot.get()
        created = true
        return dispose
      })
      return instance as T
    },
    dispose() {
      if (disposed) return
      disposed = true
      // If get() never ran, `slot`/`disposeRoot` are undefined and the factory
      // is never invoked.
      if (slot) slot.dispose()
      if (disposeRoot) disposeRoot()
      slot = undefined
      disposeRoot = undefined
      instance = undefined
    },
  }
}
