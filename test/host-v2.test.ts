import { describe, expect, it } from "bun:test"
import { createV2Host, toV2Key, toV2Layer } from "../src/host/v2"
import type { KeyLayerConfig } from "../src/core/keys"

// ─── fake v2 plugin context ──────────────────────────────────────────────────

interface LayerCall {
  layer: unknown
}

function makeContext(overrides: {
  renderer?: Partial<{ terminalWidth: number; terminalHeight: number }>
  theme?: unknown
} = {}) {
  const layers: LayerCall[] = []
  const dialogCalls = {
    shown: [] as Array<{ render: () => unknown; onClose?: () => void }>,
    set: [] as unknown[],
    cleared: 0,
  }
  // `Context.renderer` is required in OpenCode 2.0.27 and its geometry is
  // exposed as `terminalWidth`/`terminalHeight`. Its `resize` event carries no
  // dimensions, so listeners take no arguments and must re-read the geometry.
  const resizeHandlers: Array<[string, () => void]> = []
  const offCalls: Array<[string, () => void]> = []

  // Mutable so a test can change the live geometry between resize emissions.
  const renderer = {
    terminalWidth: overrides.renderer?.terminalWidth ?? 100,
    terminalHeight: overrides.renderer?.terminalHeight ?? 40,
    on(event: string, listener: () => void) {
      resizeHandlers.push([event, listener])
    },
    off(event: string, listener: () => void) {
      offCalls.push([event, listener])
    },
  }

  const context = {
    keymap: {
      layer(factory: () => unknown) {
        // The real host validates by running the factory untracked, then
        // tracks it; capture the produced layer for assertions.
        layers.push({ layer: factory() })
      },
    },
    ui: {
      dialog: {
        show(render: () => unknown, onClose?: () => void) {
          dialogCalls.shown.push({ render, onClose })
        },
        set(options: unknown) {
          dialogCalls.set.push(options)
        },
        clear() {
          dialogCalls.cleared++
        },
      },
    },
    renderer,
    theme: overrides.theme,
  }
  return { context, layers, dialogCalls, renderer, resizeHandlers, offCalls }
}

// ─── toV2Key ─────────────────────────────────────────────────────────────────

describe("toV2Key", () => {
  it("maps the enter key to the v2 'return' spelling", () => {
    expect(toV2Key("enter")).toBe("return")
  })

  it("passes every other wlib key name through unchanged", () => {
    for (const key of [
      "escape",
      "up",
      "down",
      "left",
      "right",
      "pageup",
      "pagedown",
      "tab",
      "shift+tab",
      "ctrl+shift+a",
      "a",
      "z",
    ]) {
      expect(toV2Key(key)).toBe(key)
    }
  })
})

// ─── toV2Layer ───────────────────────────────────────────────────────────────

describe("toV2Layer", () => {
  it("maps wlib commands to v2 commands (name → id, run forwarded)", () => {
    const runs: string[] = []
    const layer = toV2Layer({
      commands: [
        { name: "export.up", title: "Previous", run: () => { runs.push("up") } },
        { name: "export.down", title: "Next", run: () => { runs.push("down") } },
      ],
      bindings: [],
    })

    expect(layer.commands).toHaveLength(2)
    expect(layer.commands?.[0]).toMatchObject({ id: "export.up", title: "Previous" })
    expect(layer.commands?.[0].bind).toBeUndefined()
    layer.commands?.[1].run()
    expect(runs).toEqual(["down"])
  })

  it("omits the layer priority when it is not defined", () => {
    const layer = toV2Layer({ commands: [], bindings: [] })
    expect("priority" in layer).toBe(false)
  })

  it("forwards a defined priority (including zero)", () => {
    expect(toV2Layer({ commands: [], bindings: [], priority: 2 }).priority).toBe(2)
    expect(toV2Layer({ commands: [], bindings: [], priority: 0 }).priority).toBe(0)
  })

  it("defaults mode to global when the caller does not set one", () => {
    // 2.0.27 defaults a layer to `base`, which is inactive while a dialog
    // pushes the active mode to `modal`; wlib must emit `global` explicitly.
    expect(toV2Layer({ commands: [], bindings: [] }).mode).toBe("global")
  })

  it("emits global mode even for a non-empty dialog layer", () => {
    const layer = toV2Layer({
      commands: [{ name: "export.close", title: "Close", run: () => {} }],
      bindings: [{ key: "escape", cmd: "export.close", desc: "Close" }],
      priority: 1,
    })
    expect(layer.mode).toBe("global")
  })

  it("lets an explicit mode override the global default", () => {
    expect(toV2Layer({ commands: [], bindings: [], mode: "modal" }).mode).toBe("modal")
    expect(toV2Layer({ commands: [], bindings: [], mode: "base" }).mode).toBe("base")
    expect(toV2Layer({ commands: [], bindings: [], mode: "composer" }).mode).toBe("composer")
  })

  it("puts a single binding's key on the owning command as `bind`", () => {
    const layer = toV2Layer({
      commands: [{ name: "export.up", title: "Previous", run: () => {} }],
      bindings: [{ key: "up", cmd: "export.up", desc: "Previous" }],
    })
    expect(layer.commands?.[0].bind).toBe("up")
  })

  it("merges aliases sharing a cmd into a comma-separated bind spec", () => {
    const layer = toV2Layer({
      commands: [{ name: "export.down", title: "Next", run: () => {} }],
      bindings: [
        { key: "down", cmd: "export.down", desc: "Next" },
        { key: "j", cmd: "export.down", desc: "Next" },
        { key: "pagedown", cmd: "export.down", desc: "Next" },
      ],
    })
    expect(layer.commands?.[0].bind).toBe("down,j,pagedown")
  })

  it("translates enter to return inside bind specs", () => {
    const layer = toV2Layer({
      commands: [{ name: "export.confirm", title: "Confirm", run: () => {} }],
      bindings: [
        { key: "enter", cmd: "export.confirm", desc: "Confirm" },
        { key: "space", cmd: "export.confirm", desc: "Confirm" },
      ],
    })
    expect(layer.commands?.[0].bind).toBe("return,space")
  })

  it("only binds commands that have a matching binding", () => {
    const layer = toV2Layer({
      commands: [
        { name: "a", title: "A", run: () => {} },
        { name: "b", title: "B", run: () => {} },
      ],
      bindings: [{ key: "x", cmd: "b", desc: "B" }],
    })
    expect(layer.commands?.[0].bind).toBeUndefined()
    expect(layer.commands?.[1].bind).toBe("x")
  })

  it("ignores bindings whose cmd matches no command", () => {
    const layer = toV2Layer({
      commands: [{ name: "a", title: "A", run: () => {} }],
      bindings: [{ key: "x", cmd: "ghost", desc: "Ghost" }],
    })
    expect(layer.commands?.[0].bind).toBeUndefined()
  })

  it("keeps command order and never emits palette/slash/group on a dialog layer", () => {
    const layer = toV2Layer({
      commands: [
        { name: "second", title: "Second", run: () => {} },
        { name: "first", title: "First", run: () => {} },
      ],
      bindings: [],
    })
    expect(layer.commands?.map((c) => c.id)).toEqual(["second", "first"])
    for (const command of layer.commands ?? []) {
      expect("palette" in command).toBe(false)
      expect("slash" in command).toBe(false)
      expect("group" in command).toBe(false)
    }
  })

  it("invokes an async run fire-and-forget (returns undefined synchronously)", () => {
    let called = false
    const layer = toV2Layer({
      commands: [
        {
          name: "async.cmd",
          title: "Async",
          run: async () => {
            called = true
          },
        },
      ],
      bindings: [],
    })
    // The v2 wrapper does `void command.run()`, so dispatch never awaits it.
    const result = layer.commands?.[0].run()
    expect(result).toBeUndefined()
    expect(called).toBe(true)
  })
})

// ─── createV2Host ────────────────────────────────────────────────────────────

describe("createV2Host", () => {
  it("reports kind v2", () => {
    const { context } = makeContext()
    expect(createV2Host(context as never).kind).toBe("v2")
  })

  describe("registerCommand", () => {
    it("registers a palette+slash command through keymap.layer", () => {
      const { context, layers } = makeContext()
      const host = createV2Host(context as never)
      host.registerCommand({
        name: "analyze.show",
        title: "Analyze Session Tokens",
        slashName: "analyze",
        run: () => {},
      })

      expect(layers).toHaveLength(1)
      const layer = layers[0].layer as { commands: Array<Record<string, unknown>> }
      expect(layer.commands).toHaveLength(1)
      expect(layer.commands[0]).toMatchObject({
        id: "analyze.show",
        title: "Analyze Session Tokens",
        group: "Plugin",
        palette: true,
        slash: { name: "analyze" },
      })
    })

    it("defaults group to Plugin and omits slash when no slashName", () => {
      const { context, layers } = makeContext()
      const host = createV2Host(context as never)
      host.registerCommand({ name: "x.open", title: "X", run: () => {} })
      const cmd = (layers[0].layer as any).commands[0]
      expect(cmd.group).toBe("Plugin")
      expect("slash" in cmd).toBe(false)
      expect("bind" in cmd).toBe(false)
    })

    it("honors a custom group", () => {
      const { context, layers } = makeContext()
      createV2Host(context as never).registerCommand({
        name: "x.open",
        title: "X",
        group: "Custom",
        run: () => {},
      })
      expect((layers[0].layer as any).commands[0].group).toBe("Custom")
    })

    it("maps a string key to bind via toV2Key", () => {
      const { context, layers } = makeContext()
      createV2Host(context as never).registerCommand({
        name: "x.open",
        title: "X",
        key: "ctrl+shift+a",
        run: () => {},
      })
      expect((layers[0].layer as any).commands[0].bind).toBe("ctrl+shift+a")
    })

    it("translates the enter key to return in the command bind", () => {
      const { context, layers } = makeContext()
      createV2Host(context as never).registerCommand({
        name: "x.confirm",
        title: "Confirm",
        key: "enter",
        run: () => {},
      })
      expect((layers[0].layer as any).commands[0].bind).toBe("return")
    })

    it("uses the object key's key field (desc is not part of the v2 command shape)", () => {
      const { context, layers } = makeContext()
      createV2Host(context as never).registerCommand({
        name: "x.open",
        title: "X",
        key: { key: "ctrl+shift+m", desc: "Pick one" },
        run: () => {},
      })
      const cmd = (layers[0].layer as any).commands[0]
      expect(cmd.bind).toBe("ctrl+shift+m")
      expect("desc" in cmd).toBe(false)
    })

    it("forwards the command run handler", () => {
      const { context, layers } = makeContext()
      let ran = false
      createV2Host(context as never).registerCommand({
        name: "x.open",
        title: "X",
        run: () => {
          ran = true
        },
      })
      ;(layers[0].layer as any).commands[0].run()
      expect(ran).toBe(true)
    })

    it("returns a no-op cleanup (disposal is owned by the reactive computation)", () => {
      const { context } = makeContext()
      const cleanup = createV2Host(context as never).registerCommand({
        name: "x.open",
        title: "X",
        run: () => {},
      })
      expect(typeof cleanup).toBe("function")
      expect(() => cleanup()).not.toThrow()
    })

    it("registers the command layer with mode global by default", () => {
      // The palette/slash entry and its binding must stay reachable while a
      // dialog is open (2.0.27 pushes the active mode to `modal`).
      const { context, layers } = makeContext()
      createV2Host(context as never).registerCommand({
        name: "analyze.show",
        title: "Analyze Session Tokens",
        slashName: "analyze",
        key: "ctrl+shift+a",
        run: () => {},
      })
      const layer = layers[0].layer as { mode?: string }
      expect(layer.mode).toBe("global")
    })
  })

  describe("keymapLayer", () => {
    const config: KeyLayerConfig = {
      priority: 2,
      bindings: [
        { key: "up", cmd: "nav.up", desc: "Up" },
        { key: "down", cmd: "nav.down", desc: "Down" },
      ],
      commands: [
        { name: "nav.up", title: "Up", run: () => {} },
        { name: "nav.down", title: "Next", run: () => {} },
      ],
    }

    it("registers the mapped layer through keymap.layer", () => {
      const { context, layers } = makeContext()
      createV2Host(context as never).keymapLayer(config)
      expect(layers).toHaveLength(1)
      const layer = layers[0].layer as any
      expect(layer.priority).toBe(2)
      expect(layer.commands.map((c: any) => c.id)).toEqual(["nav.up", "nav.down"])
      expect(layer.commands[0].bind).toBe("up")
      expect(layer.commands[1].bind).toBe("down")
    })

    it("returns a no-op cleanup", () => {
      const { context } = makeContext()
      const cleanup = createV2Host(context as never).keymapLayer(config)
      expect(typeof cleanup).toBe("function")
      expect(() => cleanup()).not.toThrow()
    })

    it("emits mode global by default", () => {
      const { context, layers } = makeContext()
      createV2Host(context as never).keymapLayer(config)
      expect((layers[0].layer as { mode?: string }).mode).toBe("global")
    })

    it("honors a custom mode when the caller sets one", () => {
      const { context, layers } = makeContext()
      createV2Host(context as never).keymapLayer({ ...config, mode: "modal" })
      expect((layers[0].layer as { mode?: string }).mode).toBe("modal")
    })
  })

  describe("dialog lifecycle", () => {
    it("show delegates to ui.dialog.show with render + onClose", () => {
      const { context, dialogCalls } = makeContext()
      const render = () => null
      const onClose = () => {}
      createV2Host(context as never).dialog.show(render, onClose)
      expect(dialogCalls.shown).toEqual([{ render, onClose }])
    })

    it("set forwards size and centered", () => {
      const { context, dialogCalls } = makeContext()
      createV2Host(context as never).dialog.set({ size: "xlarge", centered: true })
      expect(dialogCalls.set).toEqual([{ size: "xlarge", centered: true }])
    })

    it("set forwards centered:false (not treated as absent)", () => {
      const { context, dialogCalls } = makeContext()
      createV2Host(context as never).dialog.set({ centered: false })
      expect(dialogCalls.set).toEqual([{ centered: false }])
    })

    it("set omits undefined options", () => {
      const { context, dialogCalls } = makeContext()
      createV2Host(context as never).dialog.set({})
      expect(dialogCalls.set).toEqual([{}])
    })

    it("clear delegates to ui.dialog.clear", () => {
      const { context, dialogCalls } = makeContext()
      createV2Host(context as never).dialog.clear()
      expect(dialogCalls.cleared).toBe(1)
    })
  })

  describe("renderer", () => {
    it("read returns the host's current dimensions", () => {
      const { context } = makeContext({ renderer: { terminalWidth: 120, terminalHeight: 50 } })
      expect(createV2Host(context as never).renderer.read()).toEqual({ width: 120, height: 50 })
    })

    it("subscribe wires a zero-argument resize handler that re-reads the live geometry", () => {
      const { context, renderer, resizeHandlers } = makeContext()
      const seen: Array<{ width: number; height: number }> = []
      createV2Host(context as never).renderer.subscribe((d) => seen.push(d))

      expect(resizeHandlers).toHaveLength(1)
      const [event, handler] = resizeHandlers[0]
      expect(event).toBe("resize")
      // The 2.0.27 resize event carries no dimensions — the adapter's handler
      // must be callable with no arguments and read the geometry itself.
      expect(handler.length).toBe(0)

      // Mutate the renderer BEFORE emitting; the adapter must report the
      // freshly read geometry, not a stale/captured payload.
      renderer.terminalWidth = 140
      renderer.terminalHeight = 60
      handler()
      expect(seen).toEqual([{ width: 140, height: 60 }])

      // A later resize re-reads again rather than caching the first payload.
      renderer.terminalWidth = 80
      renderer.terminalHeight = 24
      handler()
      expect(seen).toEqual([
        { width: 140, height: 60 },
        { width: 80, height: 24 },
      ])
    })

    it("the unsubscribe function detaches the same handler", () => {
      const { context, resizeHandlers, offCalls } = makeContext()
      const unsubscribe = createV2Host(context as never).renderer.subscribe(() => {})
      unsubscribe()
      expect(offCalls).toHaveLength(1)
      expect(offCalls[0][0]).toBe("resize")
      expect(offCalls[0][1]).toBe(resizeHandlers[0][1])
    })
  })

  describe("theme", () => {
    it("prefers the focused v2 action tokens over selected and base", () => {
      const { context } = makeContext({
        theme: {
          text: {
            base: "#aaaaaa",
            muted: "#bbbbbb",
            feedback: { error: { base: "#cc0000" } },
            action: { primary: { focused: "#eeeeee", selected: "#dddddd", base: "#111111" } },
          },
          background: {
            base: "#000000",
            raised: { high: "#222222" },
            action: { primary: { focused: "#5f56f6", selected: "#4f46e5", base: "#333333" } },
          },
        },
      })
      const palette = createV2Host(context as never).theme()
      expect(palette).toEqual({
        fg: "#aaaaaa",
        muted: "#bbbbbb",
        red: "#cc0000",
        primary: "#5f56f6",
        selectedText: "#eeeeee",
        background: "#000000",
        panel: "#222222",
      })
    })

    it("uses the selected action token when focused is absent", () => {
      const { context } = makeContext({
        theme: {
          text: { action: { primary: { selected: "#dddddd" } } },
          background: { action: { primary: { selected: "#4f46e5" } } },
        },
      })
      const palette = createV2Host(context as never).theme()
      expect(palette.primary).toBe("#4f46e5")
      expect(palette.selectedText).toBe("#dddddd")
    })

    it("ignores transparent action tokens and keeps the default accent", () => {
      const { context } = makeContext({
        theme: {
          text: { action: { primary: { focused: "transparent" } } },
          background: {
            action: { primary: { focused: "transparent", selected: { r: 0, g: 0, b: 0, a: 0 }, base: "transparent" } },
          },
        },
      })
      const palette = createV2Host(context as never).theme()
      expect(palette.primary).toBe("#4f46e5")
      // Transparent selection text is skipped and v2 falls back to the resolved
      // fg (default here, since text.base is absent) so a chip never renders invisible text.
      expect(palette.fg).toBe("#ffffff")
      expect(palette.selectedText).toBe("#ffffff")
    })

    it("falls back to the resolved fg for transparent selection text", () => {
      const { context } = makeContext({
        theme: {
          text: {
            base: "#ababab",
            action: { primary: { focused: "transparent", selected: { r: 0, g: 0, b: 0, a: 0 }, base: "transparent" } },
          },
          background: { action: { primary: { focused: "#4f46e5" } } },
        },
      })
      const palette = createV2Host(context as never).theme()
      expect(palette.fg).toBe("#ababab")
      expect(palette.selectedText).toBe("#ababab")
    })

    it("preserves non-transparent RGBA action tokens untouched", () => {
      const rgba = { r: 0.5, g: 0.25, b: 0.75, a: 1 }
      const { context } = makeContext({
        theme: {
          text: { base: rgba, action: { primary: { focused: rgba } } },
          background: { action: { primary: { focused: rgba } } },
        },
      })
      const palette = createV2Host(context as never).theme()
      expect(palette.fg).toBe(rgba)
      expect(palette.primary).toBe(rgba)
      expect(palette.selectedText).toBe(rgba)
    })

    it("falls back to defaults for a missing theme", () => {
      const { context } = makeContext()
      const palette = createV2Host(context as never).theme()
      expect(palette.fg).toBe("#ffffff")
      expect(palette.muted).toBe("#888888")
      expect(palette.red).toBe("#ef4444")
      expect(palette.primary).toBe("#4f46e5")
      expect(palette.background).toBe("#000000")
      expect(palette.panel).toBe("#000000")
      expect(palette.selectedText).toBe("#ffffff")
    })
  })
})
