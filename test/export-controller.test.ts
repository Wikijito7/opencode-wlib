/**
 * opencode-wlib — export controller regression tests.
 *
 * These tests exercise the REAL `createExportController` state machine
 * (`src/ui/export-controller.tsx`) with an injected fake `WlibHost`, mocked
 * Solid primitives, and a mocked JSX runtime. No production module is edited.
 *
 * Why the mocks exist:
 *  - wlib has no `package.json`/`node_modules`, and `bun test` cannot resolve
 *    `solid-js`, `@opentui/solid`, or `@opentui/core`, so those are virtualized.
 *  - The presentational overlays are replaced with inert stubs so loading the
 *    controller never pulls in `@opentui/core` (their real import). The
 *    controller's render decisions are read off the elements it builds.
 *  - The clipboard/file/open-folder side effects are replaced so no clipboard,
 *    disk, or child-process IO happens during the run.
 *
 * Regression under test (src/ui/export-controller.tsx):
 *  Each renderer now returns a PERSISTENT `Show` wrapper driven by the
 *  controller's `showExport`/`showResult` signals instead of an opaque
 *  `return null` that the host evaluated once. This file asserts the wrapper is
 *  returned even while closed, that its `when` tracks the controller's live
 *  state across open/step/close, and that the wrapped overlay receives the
 *  right props at each step.
 *
 * LIMITATION (documented at the bottom too): the `bun` JSX transform used by
 * `bun test` does NOT apply `babel-preset-solid`'s getter wrapping, so
 * `when={...}` is evaluated eagerly at each render call (verified: the prop is
 * a plain value, not a getter). The tests therefore re-invoke the renderers
 * after each state change rather than proving that a single mounted wrapper
 * updates in place; that in-place reactivity is a property of the production
 * Solid build. The seam required to test the latter is documented at the end.
 */

import { afterEach, describe, expect, it, mock } from "bun:test"
import type { KeyLayerConfig } from "../src/core/keys"
import type { Exportable } from "../src/core/export"

// ─── Mock capture state ──────────────────────────────────────────────────────

let writeClipboardImpl: (text: string) => Promise<boolean> = async () => true
let writeFileImpl: (filePath: string, content: string) => Promise<boolean> = async () => true
const clipboardWrites: string[] = []
const fileWrites: Array<{ path: string; content: string }> = []
const openFolderCalls: string[] = []

// ─── Minimal Solid-compatible reactive core ──────────────────────────────────
// Faithful enough to run the controller's `createSignal`/`createEffect`/
// `onCleanup`/`Show` logic (dependency tracking + re-run on write).

type Observer = { fn: () => void; cleanups: Array<() => void> }
let activeObserver: Observer | null = null
const rootCleanups: Array<() => void> = []

function runObserver(observer: Observer) {
  for (const cleanup of observer.cleanups.splice(0)) cleanup()
  const previous = activeObserver
  activeObserver = observer
  try {
    observer.fn()
  } finally {
    activeObserver = previous
  }
}

function createSignal<T>(initial: T): [() => T, (next: T) => void] {
  let value = initial
  const observers = new Set<Observer>()
  const read = () => {
    if (activeObserver) observers.add(activeObserver)
    return value
  }
  const write = (next: T) => {
    if (Object.is(value, next)) return
    value = next
    for (const observer of [...observers]) runObserver(observer)
  }
  return [read, write]
}

function createEffect(fn: () => void) {
  runObserver({ fn, cleanups: [] })
}

function onCleanup(fn: () => void) {
  if (activeObserver) activeObserver.cleanups.push(fn)
  else rootCleanups.push(fn)
}

/** The wrapper the controller renders; tests identify it by identity. */
function Show(props: { when?: boolean; children?: unknown }): unknown {
  return props
}

// ─── Mock registrations (must run before the controller is imported) ─────────

function makeJsxRuntime() {
  // Mirrors the automatic-runtime shape: `<Show>` and `<ExportOverlay>` become
  // { type, props }; intrinsic elements are left unrendered.
  return {
    jsx: (type: unknown, props: unknown) => ({ type, props }),
    jsxs: (type: unknown, props: unknown) => ({ type, props }),
    jsxDEV: (type: unknown, props: unknown) => ({ type, props }),
    Fragment: (props: { children?: unknown }) => props.children,
  }
}

mock.module("@opentui/solid/jsx-dev-runtime", makeJsxRuntime)
mock.module("@opentui/solid/jsx-runtime", makeJsxRuntime)

mock.module("solid-js", () => ({
  createSignal,
  createEffect,
  onCleanup,
  Show,
}))

// Inert overlay stubs: they must exist so the controller never loads the real
// presentational modules (which import `@opentui/core`), but they are never
// invoked — the tests read the props off the element the controller builds.
mock.module("../src/ui/export-overlay", () => ({
  ExportOverlay: () => null,
}))

mock.module("../src/ui/export-result-overlay", () => ({
  ExportResultOverlay: () => null,
}))

mock.module("../src/core/clipboard", () => ({
  writeClipboard: (text: string) => {
    clipboardWrites.push(text)
    return writeClipboardImpl(text)
  },
}))

mock.module("../src/core/file", () => ({
  EXPORT_BASE_DIR: "/base/export",
  timestamp: () => "20260101-000000000",
  exportFilePath: (name: string, ext: string, ts: string, base: string) => `${base}/${name}_${ts}.${ext}`,
  writeFile: (filePath: string, content: string) => {
    fileWrites.push({ path: filePath, content })
    return writeFileImpl(filePath, content)
  },
}))

mock.module("../src/core/open-folder", () => ({
  openFolder: async (dir: string) => {
    openFolderCalls.push(dir)
    return true
  },
}))

// Import AFTER the mocks so every dependency below is the virtualized one.
const { createExportController } = await import("../src/ui/export-controller")

// ─── Fake host + fixtures ────────────────────────────────────────────────────

interface FakeHost {
  layers: KeyLayerConfig[]
}

function makeHost(): FakeHost & { host: unknown } {
  const layers: KeyLayerConfig[] = []
  const host = {
    kind: "v2",
    registerCommand: () => () => {},
    keymapLayer: (config: KeyLayerConfig) => {
      layers.push(config)
      return () => {}
    },
    dialog: {
      show: () => {},
      set: () => {},
      clear: () => {},
    },
    renderer: {
      read: () => ({ width: 80, height: 24 }),
      subscribe: () => () => {},
    },
    theme: () => ({
      fg: "#ffffff",
      muted: "#888888",
      red: "#ef4444",
      primary: "#4f46e5",
      background: "#000000",
      panel: "#101010",
      selectedText: "#ffffff",
    }),
  }
  return { host, layers } as FakeHost & { host: unknown }
}

const exportable: Exportable = {
  formats: [
    { id: "markdown", label: "Markdown" },
    { id: "csv", label: "CSV" },
  ],
  build: (format) => `export:${format}`,
}

type Controller = ReturnType<typeof createExportController>

function makeController(host: unknown): Controller {
  return createExportController(host as never, exportable, { name: "usage" })
}

/** A tick long enough to settle the controller's `void doFile()/doClipboard()`. */
function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

/** Read the element props the JSX runtime recorded: { type, props } | null. */
function elementProps(node: unknown): Record<string, unknown> | null {
  const props = (node as { props?: Record<string, unknown> } | null)?.props
  return props ?? null
}

/** True when the `Show` wrapper the controller returned is active. */
function isVisible(node: unknown): boolean {
  return elementProps(node)?.when === true
}

/** Invoke the wrapper's render thunk and return the overlay element it builds. */
function unwrap(node: unknown): unknown {
  const props = elementProps(node)
  const children = props?.children
  expect(typeof children).toBe("function")
  return (children as (v: boolean) => unknown)(true)
}

/** Props passed to the format/destination `ExportOverlay`. */
function overlayProps(controller: Controller): Record<string, unknown> {
  const node = controller.renderOverlay()
  expect(isVisible(node)).toBe(true)
  const inner = elementProps(unwrap(node))
  expect(inner).not.toBeNull()
  return inner as Record<string, unknown>
}

/** Props passed to the `ExportResultOverlay`. */
function resultProps(controller: Controller): Record<string, unknown> {
  const node = controller.renderResultOverlay()
  expect(isVisible(node)).toBe(true)
  const inner = elementProps(unwrap(node))
  expect(inner).not.toBeNull()
  return inner as Record<string, unknown>
}

afterEach(() => {
  // Run the controller's flash-timeout cleanup and drop any leftover observers.
  for (const cleanup of rootCleanups.splice(0)) cleanup()
  activeObserver = null
  clipboardWrites.length = 0
  fileWrites.length = 0
  openFolderCalls.length = 0
  writeClipboardImpl = async () => true
  writeFileImpl = async () => true
})

// ─── Regression: renderers return a persistent wrapper while CLOSED ──────────

describe("createExportController — closed→open popup reactivity", () => {
  it("renderOverlay returns a non-null wrapper while closed (regression: was null)", () => {
    const { host } = makeHost()
    const controller = makeController(host)

    const node = controller.renderOverlay()
    expect(node).not.toBeNull()
    expect(node).not.toBeUndefined()
    // The wrapper is present but inactive: `when` is false and the overlay is
    // not built, which is exactly what the host mounts when the dialog opens.
    expect(isVisible(node)).toBe(false)
  })

  it("renderResultOverlay returns a non-null wrapper while closed (regression: was null)", () => {
    const { host } = makeHost()
    const controller = makeController(host)

    const node = controller.renderResultOverlay()
    expect(node).not.toBeNull()
    expect(node).not.toBeUndefined()
    expect(isVisible(node)).toBe(false)
  })

  it("open() flips the overlay wrapper active and mounts the format overlay", () => {
    const { host } = makeHost()
    const controller = makeController(host)

    controller.open()

    const node = controller.renderOverlay()
    expect(isVisible(node)).toBe(true)
    expect(overlayProps(controller)).toMatchObject({
      title: "Export",
      formats: exportable.formats,
      selectedIndex: 0,
    })
  })

  it("close() hides both overlays again", () => {
    const { host } = makeHost()
    const controller = makeController(host)

    controller.open()
    expect(isVisible(controller.renderOverlay())).toBe(true)

    // escape from the format step closes the whole flow.
    controller.handleKey("escape")

    expect(isVisible(controller.renderOverlay())).toBe(false)
    expect(isVisible(controller.renderResultOverlay())).toBe(false)
  })

  it("registers the dialog key layer once the overlay opens (createEffect reactivity)", () => {
    const { host, layers } = makeHost()
    const controller = makeController(host)

    expect(layers).toHaveLength(0)
    controller.open()
    expect(layers).toHaveLength(1)
    expect(layers[0].priority).toBe(2)
    expect(layers[0].bindings.map((b) => b.key)).toContain("escape")
  })

  it("handleKey returns false while the overlay is closed", () => {
    const { host } = makeHost()
    const controller = makeController(host)
    expect(controller.handleKey("enter")).toBe(false)
    expect(controller.handleKey("up")).toBe(false)
  })
})

// ─── Format → destination transition ─────────────────────────────────────────

describe("createExportController — format→destination transition", () => {
  it("moves into the destination step on enter and renders clipboard/file options", () => {
    const { host } = makeHost()
    const controller = makeController(host)

    controller.open()
    expect(controller.handleKey("enter")).toBe(true)

    expect(overlayProps(controller)).toMatchObject({
      title: "Export to",
      formats: [
        { id: "clipboard", label: "Clipboard" },
        { id: "file", label: "File" },
      ],
      selectedIndex: 0,
    })
  })

  it("cycles the format selection with up/down before confirming", () => {
    const { host } = makeHost()
    const controller = makeController(host)

    controller.open()
    expect(controller.handleKey("down")).toBe(true)
    expect(overlayProps(controller).selectedIndex).toBe(1)

    expect(controller.handleKey("up")).toBe(true)
    expect(overlayProps(controller).selectedIndex).toBe(0)
  })

  it("escape from the destination step returns to the format step (no close)", () => {
    const { host } = makeHost()
    const controller = makeController(host)

    controller.open()
    controller.handleKey("enter") // → destination
    expect(controller.handleKey("escape")).toBe(true) // → back to format

    const node = controller.renderOverlay()
    expect(isVisible(node)).toBe(true)
    expect(overlayProps(controller).title).toBe("Export")
  })
})

// ─── Destination → result transition (clipboard + file) ──────────────────────

describe("createExportController — destination→result transition", () => {
  it("clipboard export writes the built text, flashes 'copied', and closes", async () => {
    const { host } = makeHost()
    const controller = makeController(host)
    writeClipboardImpl = async () => true

    controller.open()
    controller.handleKey("enter") // → destination (clipboard selected)
    expect(controller.handleKey("enter")).toBe(true) // → confirm clipboard
    await flush()

    expect(clipboardWrites).toEqual(["export:markdown"])
    expect(controller.copiedFlash()).toBe(true)
    // Successful clipboard export closes the popup entirely.
    expect(isVisible(controller.renderOverlay())).toBe(false)
    expect(isVisible(controller.renderResultOverlay())).toBe(false)
  })

  it("file export transitions to the result popup with the saved path", async () => {
    const { host } = makeHost()
    const controller = makeController(host)
    writeFileImpl = async () => true

    controller.open()
    controller.handleKey("enter") // → destination
    controller.handleKey("down") // select "File"
    expect(controller.handleKey("enter")).toBe(true) // → confirm file
    await flush()

    expect(fileWrites).toHaveLength(1)
    expect(fileWrites[0]?.path).toBe("/base/export/usage_20260101-000000000.md")
    expect(fileWrites[0]?.content).toBe("export:markdown")

    // Format popup hidden; result popup shown with the success payload.
    expect(isVisible(controller.renderOverlay())).toBe(false)
    expect(resultProps(controller)).toMatchObject({
      path: "/base/export/usage_20260101-000000000.md",
      error: false,
      focus: 0,
    })
  })

  it("a failed file write shows the error result and no saved path", async () => {
    const { host } = makeHost()
    const controller = makeController(host)
    writeFileImpl = async () => false

    controller.open()
    controller.handleKey("enter") // → destination
    controller.handleKey("down") // → File
    controller.handleKey("enter") // → confirm file
    await flush()

    expect(resultProps(controller)).toMatchObject({ path: null, error: true })
    // The error popup stays up: it is dismissed only by an explicit enter/escape.
    expect(isVisible(controller.renderResultOverlay())).toBe(true)
    expect(isVisible(controller.renderOverlay())).toBe(false)
  })

  it("error result handles every registered key — o/arrows/e are swallowed, enter/escape close", async () => {
    // The export layer registers exactly these bindings: up, down, left,
    // right, enter, escape, e, o. Only keys that ARE registered are dispatched
    // to the controller; a truly unbound key (e.g. `q`) never reaches
    // `handleKey` through the real host, so it is deliberately NOT asserted
    // here — the overlay is not claimed to swallow arbitrary input.
    async function openErrorResult(): Promise<Controller> {
      const { host } = makeHost()
      const controller = makeController(host)
      writeFileImpl = async () => false

      controller.open()
      controller.handleKey("enter") // → destination
      controller.handleKey("down") // → File
      controller.handleKey("enter") // → confirm file
      await flush()
      expect(isVisible(controller.renderResultOverlay())).toBe(true)
      return controller
    }

    // The error state offers Close only. Every registered key other than
    // enter/escape (`o`, the arrows, `e`) is swallowed: `handleKey` returns
    // true as the layer owns it, no open-folder side effect fires, and the
    // error popup stays visible — none may reach Open/open-folder or close via
    // the "o"/"e" shortcuts.
    const swallowedKeys = ["o", "up", "down", "left", "right", "e"]
    const controller = await openErrorResult()
    for (const key of swallowedKeys) {
      expect(controller.handleKey(key)).toBe(true)
      await flush()

      // Per-key: no open-folder side effect and the error modal still stands.
      expect(openFolderCalls).toHaveLength(0)
      expect(isVisible(controller.renderResultOverlay())).toBe(true)
      expect(isVisible(controller.renderOverlay())).toBe(false)
    }

    // After the whole sequence the state is unchanged: error result, Close
    // focused, no folder opened, no partial close.
    expect(openFolderCalls).toHaveLength(0)
    expect(resultProps(controller)).toMatchObject({ path: null, error: true, focus: 0 })
    expect(isVisible(controller.renderResultOverlay())).toBe(true)
    expect(isVisible(controller.renderOverlay())).toBe(false)

    // The remaining registered keys — enter and escape — both dismiss the
    // error popup without opening a folder (fresh instance per close key).
    for (const key of ["enter", "escape"]) {
      const closing = await openErrorResult()
      expect(closing.handleKey(key)).toBe(true)
      expect(openFolderCalls).toHaveLength(0)
      expect(isVisible(closing.renderResultOverlay())).toBe(false)
      expect(isVisible(closing.renderOverlay())).toBe(false)
    }
  })

  it("does not write an empty build result", async () => {
    const { host } = makeHost()
    const empty: Exportable = { formats: exportable.formats, build: () => "" }
    const controller = createExportController(host as never, empty, { name: "usage" })

    controller.open()
    controller.handleKey("enter") // → destination
    controller.handleKey("down") // → File
    controller.handleKey("enter")
    await flush()

    expect(fileWrites).toHaveLength(0)
    // Nothing happened: still in the destination step, result not shown.
    expect(isVisible(controller.renderResultOverlay())).toBe(false)
    expect(controller.handleKey("escape")).toBe(true) // destination→format
  })
})

// ─── Result popup navigation + close ─────────────────────────────────────────

describe("createExportController — result popup navigation and close", () => {
  async function exportToFile(host: unknown): Promise<Controller> {
    const controller = makeController(host)
    controller.open()
    controller.handleKey("enter") // → destination
    controller.handleKey("down") // → File
    controller.handleKey("enter")
    await flush()
    return controller
  }

  it("moves focus between Close and Open with left/right", async () => {
    const { host } = makeHost()
    const controller = await exportToFile(host)

    controller.handleKey("right")
    expect(resultProps(controller).focus).toBe(1)

    controller.handleKey("left")
    expect(resultProps(controller).focus).toBe(0)
  })

  it("enter on Close dismisses the result popup", async () => {
    const { host } = makeHost()
    const controller = await exportToFile(host)

    expect(controller.handleKey("enter")).toBe(true)
    expect(isVisible(controller.renderResultOverlay())).toBe(false)
    expect(openFolderCalls).toHaveLength(0)
  })

  it("'o' opens the containing folder and closes", async () => {
    const { host } = makeHost()
    const controller = await exportToFile(host)

    expect(controller.handleKey("o")).toBe(true)
    await flush()
    expect(openFolderCalls).toEqual(["/base/export"])
    expect(isVisible(controller.renderResultOverlay())).toBe(false)
  })

  it("escape closes the result popup", async () => {
    const { host } = makeHost()
    const controller = await exportToFile(host)

    expect(controller.handleKey("escape")).toBe(true)
    expect(isVisible(controller.renderResultOverlay())).toBe(false)
    expect(isVisible(controller.renderOverlay())).toBe(false)
  })
})

// ─── Testability seam (documentation, not executable) ────────────────────────
//
// To test the IN-PLACE reactivity this file cannot (the production fix: a
// wrapper mounted once while closed must later render when `open()` flips the
// signal), one of these non-production edits is required:
//
//  1. Run the suite with a Solid JSX transform. `bun test` here uses Bun's
//     built-in JSX transform, which evaluates `when={showExport()}` eagerly
//     (verified: the prop is a plain value, not a getter). Applying
//     `babel-preset-solid` (e.g. via a `bunfig.toml` preloading
//     `@opentui/solid/preload`) would emit getters; combined with a package.json
//     so `solid-js`/`@opentui/solid`/`@opentui/core` resolve from node_modules,
//     a test could mount the wrapper once inside a Solid root and assert it
//     re-renders on `open()`.
//
//  2. Alternatively, expose a small testable seam on the controller — e.g. the
//     internal `showExport`/`showResult` signals, or a pure `overlayVisible`
//     predicate — so a test can assert the transition without a JSX runtime.
//     This is a production change and was NOT made.
