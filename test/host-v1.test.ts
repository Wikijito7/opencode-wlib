import { describe, expect, it } from "bun:test"
import { createV1Host, type V1HostApi } from "../src/host/v1"
import type { KeyLayerConfig } from "../src/core/keys"

// ─── fake v1 TuiPluginApi ────────────────────────────────────────────────────

interface RegisteredLayer {
  commands: Array<Record<string, unknown>>
  bindings: Array<{ key: string; cmd: string; desc: string }>
  priority?: number
}

function makeApi(overrides: {
  theme?: { current?: Record<string, unknown> }
  renderer?: Partial<{ width: number; height: number }>
  withRenderer?: boolean
} = {}) {
  const layers: RegisteredLayer[] = []
  const cleanup = () => { /* sentinel */ }
  const dialog = {
    replaced: [] as Array<{ render: () => unknown; onClose?: () => void }>,
    sizes: [] as string[],
    cleared: 0,
  }
  const resizeHandlers: Array<(w: number, h: number) => void> = []
  const offHandlers: Array<(w: number, h: number) => void> = []

  const api: V1HostApi = {
    keymap: {
      registerLayer(config: RegisteredLayer) {
        layers.push(config)
        return cleanup
      },
    },
    ui: {
      dialog: {
        replace(render: () => unknown, onClose?: () => void) {
          dialog.replaced.push({ render, onClose })
        },
        setSize(size: string) {
          dialog.sizes.push(size)
        },
        clear() {
          dialog.cleared++
        },
      },
    },
    theme: overrides.theme,
    renderer:
      overrides.withRenderer === false
        ? undefined
        : {
            width: overrides.renderer?.width ?? 100,
            height: overrides.renderer?.height ?? 40,
            on(_event: "resize", listener: (w: number, h: number) => void) {
              resizeHandlers.push(listener)
            },
            off(_event: "resize", listener: (w: number, h: number) => void) {
              offHandlers.push(listener)
            },
          },
  }
  return { api, layers, cleanup, dialog, resizeHandlers, offHandlers }
}

// ─── createV1Host ────────────────────────────────────────────────────────────

describe("createV1Host", () => {
  it("reports kind v1", () => {
    const { api } = makeApi()
    expect(createV1Host(api).kind).toBe("v1")
  })

  describe("registerCommand", () => {
    it("maps to the v1 palette command shape (category/namespace/slashName)", () => {
      const { api, layers } = makeApi()
      const run = () => {}
      createV1Host(api).registerCommand({
        name: "analyze.show",
        title: "Analyze Session Tokens",
        slashName: "analyze",
        run,
      })

      expect(layers).toHaveLength(1)
      expect(layers[0].commands).toEqual([
        {
          name: "analyze.show",
          title: "Analyze Session Tokens",
          category: "Plugin",
          namespace: "palette",
          slashName: "analyze",
          run,
        },
      ])
      expect(layers[0].bindings).toEqual([])
    })

    it("defaults category to Plugin and honors a custom group", () => {
      const { api, layers } = makeApi()
      const host = createV1Host(api)
      host.registerCommand({ name: "a", title: "A", run: () => {} })
      host.registerCommand({ name: "b", title: "B", group: "Custom", run: () => {} })
      expect(layers[0].commands[0].category).toBe("Plugin")
      expect(layers[1].commands[0].category).toBe("Custom")
    })

    it("omits slashName when none was provided", () => {
      const { api, layers } = makeApi()
      createV1Host(api).registerCommand({ name: "a", title: "A", run: () => {} })
      expect("slashName" in layers[0].commands[0]).toBe(false)
    })

    it("adds a binding whose desc defaults to the title", () => {
      const { api, layers } = makeApi()
      createV1Host(api).registerCommand({
        name: "analyze.show",
        title: "Analyze Session Tokens",
        slashName: "analyze",
        key: "ctrl+shift+a",
        run: () => {},
      })
      expect(layers[0].bindings).toEqual([
        { key: "ctrl+shift+a", cmd: "analyze.show", desc: "Analyze Session Tokens" },
      ])
    })

    it("adds a binding with a custom desc", () => {
      const { api, layers } = makeApi()
      createV1Host(api).registerCommand({
        name: "persona.select",
        title: "Select Persona",
        slashName: "persona",
        key: { key: "ctrl+shift+m", desc: "Pick a persona" },
        run: () => {},
      })
      expect(layers[0].bindings).toEqual([
        { key: "ctrl+shift+m", cmd: "persona.select", desc: "Pick a persona" },
      ])
    })

    it("keeps the raw (v1) key spelling — no enter→return translation", () => {
      const { api, layers } = makeApi()
      createV1Host(api).registerCommand({ name: "a", title: "A", key: "enter", run: () => {} })
      expect(layers[0].bindings[0].key).toBe("enter")
    })

    it("returns the registerLayer cleanup", () => {
      const { api, cleanup } = makeApi()
      const returned = createV1Host(api).registerCommand({ name: "a", title: "A", run: () => {} })
      expect(returned).toBe(cleanup)
    })
  })

  describe("keymapLayer", () => {
    const config: KeyLayerConfig = {
      priority: 3,
      bindings: [{ key: "up", cmd: "nav.up", desc: "Up" }],
      commands: [{ name: "nav.up", title: "Up", run: () => {} }],
    }

    it("forwards the config verbatim to registerLayer and returns the cleanup", () => {
      const { api, layers, cleanup } = makeApi()
      const returned = createV1Host(api).keymapLayer(config)
      expect(layers).toHaveLength(1)
      expect(layers[0]).toBe(config)
      expect(returned).toBe(cleanup)
    })
  })

  describe("dialog", () => {
    it("show delegates to ui.dialog.replace", () => {
      const { api, dialog } = makeApi()
      const render = () => null
      const onClose = () => {}
      createV1Host(api).dialog.show(render, onClose)
      expect(dialog.replaced).toEqual([{ render, onClose }])
    })

    it("set forwards only the size to setSize", () => {
      const { api, dialog } = makeApi()
      createV1Host(api).dialog.set({ size: "xlarge", centered: true })
      expect(dialog.sizes).toEqual(["xlarge"])
    })

    it("set is a no-op when only centered was provided (v1 ignores it)", () => {
      const { api, dialog } = makeApi()
      createV1Host(api).dialog.set({ centered: false })
      expect(dialog.sizes).toEqual([])
    })

    it("clear delegates to ui.dialog.clear", () => {
      const { api, dialog } = makeApi()
      createV1Host(api).dialog.clear()
      expect(dialog.cleared).toBe(1)
    })
  })

  describe("renderer", () => {
    it("read returns the host dimensions", () => {
      const { api } = makeApi({ renderer: { width: 120, height: 50 } })
      expect(createV1Host(api).renderer.read()).toEqual({ width: 120, height: 50 })
    })

    it("read defaults to 0/0 when the renderer is absent", () => {
      const { api } = makeApi({ withRenderer: false })
      expect(createV1Host(api).renderer.read()).toEqual({ width: 0, height: 0 })
    })

    it("subscribe unwraps (width, height) and unsubscribe detaches the same handler", () => {
      const { api, resizeHandlers, offHandlers } = makeApi()
      const seen: Array<{ width: number; height: number }> = []
      const unsubscribe = createV1Host(api).renderer.subscribe((d) => seen.push(d))

      resizeHandlers[0](90, 30)
      expect(seen).toEqual([{ width: 90, height: 30 }])

      unsubscribe()
      expect(offHandlers).toHaveLength(1)
      expect(offHandlers[0]).toBe(resizeHandlers[0])
    })

    it("subscribe is a safe no-op when the renderer is absent", () => {
      const { api } = makeApi({ withRenderer: false })
      const unsubscribe = createV1Host(api).renderer.subscribe(() => {})
      expect(() => unsubscribe()).not.toThrow()
    })
  })

  describe("theme", () => {
    it("resolves the loose v1 theme conventions", () => {
      const { api } = makeApi({
        theme: { current: { text: "#111111", textMuted: "#222222", error: "#333333", backgroundPanel: "#444444" } },
      })
      const palette = createV1Host(api).theme()
      expect(palette.fg).toBe("#111111")
      expect(palette.muted).toBe("#222222")
      expect(palette.red).toBe("#333333")
      expect(palette.panel).toBe("#444444")
    })

    it("falls back to defaults when the theme is absent", () => {
      const { api } = makeApi()
      const palette = createV1Host(api).theme()
      expect(palette.fg).toBe("#ffffff")
      expect(palette.background).toBe("#000000")
    })

    it("passes RGBA objects through untouched", () => {
      const rgba = { r: 0.1, g: 0.2, b: 0.3, a: 1 }
      const { api } = makeApi({ theme: { current: { primary: rgba } } })
      expect(createV1Host(api).theme().primary).toBe(rgba)
    })
  })
})
