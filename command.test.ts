import { describe, expect, it } from "bun:test"
import { registerSlashCommand } from "./command"

// Minimal TUI API mock capturing registerLayer calls.
function makeApiMock() {
  const layers: unknown[] = []
  const api = {
    keymap: {
      registerLayer(config: unknown) {
        layers.push(config)
        return () => { /* cleanup no-op */ }
      },
    },
  }
  return { api: api as never, layers }
}

describe("registerSlashCommand", () => {
  it("registers a palette command with category/namespace/slashName", () => {
    const { api, layers } = makeApiMock()
    registerSlashCommand(api, {
      name: "analyze.show",
      title: "Analyze Session Tokens",
      slashName: "analyze",
      run: () => {},
    })

    const layer = layers[0] as { commands: Array<Record<string, unknown>>; bindings: unknown[] }
    expect(layer.commands).toHaveLength(1)
    const cmd = layer.commands[0]
    expect(cmd.name).toBe("analyze.show")
    expect(cmd.title).toBe("Analyze Session Tokens")
    expect(cmd.category).toBe("Plugin")
    expect(cmd.namespace).toBe("palette")
    expect(cmd.slashName).toBe("analyze")
    expect(typeof cmd.run).toBe("function")
    expect(layer.bindings).toEqual([])
  })

  it("adds a key binding with title as default desc", () => {
    const { api, layers } = makeApiMock()
    registerSlashCommand(api, {
      name: "analyze.show",
      title: "Analyze Session Tokens",
      slashName: "analyze",
      key: "ctrl+shift+a",
      run: () => {},
    })

    const layer = layers[0] as { bindings: Array<{ key: string; cmd: string; desc: string }> }
    expect(layer.bindings).toEqual([
      { key: "ctrl+shift+a", cmd: "analyze.show", desc: "Analyze Session Tokens" },
    ])
  })

  it("adds a key binding with custom desc", () => {
    const { api, layers } = makeApiMock()
    registerSlashCommand(api, {
      name: "persona.select",
      title: "Select Persona",
      slashName: "persona",
      key: { key: "ctrl+shift+m", desc: "Pick a persona" },
      run: () => {},
    })

    const layer = layers[0] as { bindings: Array<{ key: string; cmd: string; desc: string }> }
    expect(layer.bindings).toEqual([
      { key: "ctrl+shift+m", cmd: "persona.select", desc: "Pick a persona" },
    ])
  })

  it("returns a cleanup function", () => {
    const { api } = makeApiMock()
    const cleanup = registerSlashCommand(api, {
      name: "x",
      title: "X",
      slashName: "x",
      run: () => {},
    })
    expect(typeof cleanup).toBe("function")
  })
})
