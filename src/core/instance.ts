/**
 * opencode-wlib — single-instance slot (pure, framework-free).
 *
 * Identity/lifecycle bookkeeping for a value that must be created at most once
 * per dialog and torn down at most once. Kept free of Solid/OpenTUI so the
 * create-once / dispose-once contract is unit-testable in isolation; the UI
 * wrapper `createOwnedInstance` (ui/owned-instance) drives it from a
 * `createRoot` owner so a controller's `createEffect`/`onCleanup` live inside a
 * stable owner that survives re-runs of the dialog render callback.
 */

export interface InstanceSlot<T> {
  /** True once the factory has produced a live instance. */
  created(): boolean
  /** Return the instance, creating it on first call. Throws after dispose. */
  get(): T
  /** Run the optional disposer, then forget the instance. Idempotent. */
  dispose(): void
}

/**
 * Wrap a factory in a create-once / dispose-once slot.
 *
 * The factory runs on the first `get()` only. `dispose()` invokes the optional
 * `disposeInstance` callback (guarded so it can never run twice) and marks the
 * slot dead, so a later `get()` fails loudly instead of silently resurrecting a
 * torn-down instance.
 */
export function createInstanceSlot<T>(
  factory: () => T,
  disposeInstance?: (instance: T) => void,
): InstanceSlot<T> {
  let instance: T | undefined
  let disposed = false
  let created = false

  return {
    created: () => created,
    get() {
      if (disposed) throw new Error("instance slot has been disposed")
      if (!created) {
        instance = factory()
        created = true
      }
      return instance as T
    },
    dispose() {
      if (disposed) return
      disposed = true
      if (created) {
        disposeInstance?.(instance as T)
        instance = undefined
      }
    },
  }
}
