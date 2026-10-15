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
 * Owner-propagation guarantee (verified against solid-js 1.9.12 source,
 * `createRoot` in `dist/solid.js`): called with a callback that takes the
 * `dispose` argument (`fn.length !== 0`), `createRoot` builds a standalone
 * owner whose `owned`/`cleanups` lists hang off *itself*; it is NOT pushed into
 * the calling computation's `owned` array. Disposal walks only a node's
 * `owned`/`cleanups` (`cleanNode`), so when the transient dialog render
 * computation re-runs or is torn down it cannot dispose this root. Only the
 * `dispose` handle returned here does. Context (theme, etc.) is still inherited
 * from the calling owner because the root keeps it as its `owner` reference —
 * that reference is for context/error fan-out, not for disposal.
 */

import { createRoot } from "solid-js"
import { createInstanceSlot, type InstanceSlot } from "../core/instance"

export interface OwnedInstance<T> {
  /** The single live instance — identical across every render re-run. */
  readonly instance: T
  /** Dispose the owner and its effects. Idempotent. */
  dispose(): void
}

export function createOwnedInstance<T>(factory: () => T): OwnedInstance<T> {
  let slot!: InstanceSlot<T>
  const disposeRoot = createRoot((dispose) => {
    slot = createInstanceSlot(factory)
    // Create the instance *inside* the owner so effects/onCleanup it registers
    // are owned by this root rather than by the calling render computation.
    slot.get()
    return dispose
  })
  let disposed = false

  return {
    get instance() {
      return slot.get()
    },
    dispose() {
      if (disposed) return
      disposed = true
      slot.dispose()
      disposeRoot()
    },
  }
}
