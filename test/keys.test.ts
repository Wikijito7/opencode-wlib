import { describe, expect, it } from "bun:test"
import { registerDialogKeyLayer } from "../src/core/keys"
import type { KeyLayerConfig } from "../src/core/keys"
import type { WlibHost } from "../src/host/types"

// Minimal host mock capturing keymapLayer calls and returning a sentinel cleanup.
function makeHostMock() {
  const layers: KeyLayerConfig[] = []
  const cleanup = () => { /* sentinel */ }
  const host = {
    kind: "v2",
    keymapLayer(config: KeyLayerConfig) {
      layers.push(config)
      return cleanup
    },
  }
  return { host: host as unknown as WlibHost, layers, cleanup }
}

const config: KeyLayerConfig = {
  priority: 2,
  bindings: [
    { key: "up", cmd: "nav.up", desc: "Up" },
    { key: "down", cmd: "nav.down", desc: "Down" },
    { key: "enter", cmd: "confirm", desc: "Confirm" },
    { key: "escape", cmd: "close", desc: "Close" },
  ],
  commands: [
    { name: "nav.up", title: "Up", run: () => {} },
    { name: "nav.down", title: "Down", run: () => {} },
    { name: "confirm", title: "Confirm", run: () => {} },
    { name: "close", title: "Close", run: () => {} },
  ],
}

describe("registerDialogKeyLayer", () => {
  it("forwards the layer config to the host verbatim", () => {
    const { host, layers } = makeHostMock()
    registerDialogKeyLayer(host, config)
    expect(layers).toHaveLength(1)
    expect(layers[0]).toBe(config)
  })

  it("forwards the priority", () => {
    const { host, layers } = makeHostMock()
    registerDialogKeyLayer(host, { ...config, priority: 5 })
    expect(layers[0].priority).toBe(5)
  })

  it("omits priority when the caller does not set one", () => {
    const { host, layers } = makeHostMock()
    registerDialogKeyLayer(host, { bindings: config.bindings, commands: config.commands })
    expect(layers[0].priority).toBeUndefined()
    expect("priority" in layers[0]).toBe(false)
  })

  it("preserves alias bindings that share a command", () => {
    const { host, layers } = makeHostMock()
    registerDialogKeyLayer(host, {
      bindings: [
        { key: "left", cmd: "nav", desc: "Previous" },
        { key: "h", cmd: "nav", desc: "Previous" },
      ],
      commands: [{ name: "nav", title: "Previous", run: () => {} }],
    })
    expect(layers[0].bindings).toEqual([
      { key: "left", cmd: "nav", desc: "Previous" },
      { key: "h", cmd: "nav", desc: "Previous" },
    ])
  })

  it("returns the cleanup supplied by the host", () => {
    const { host, cleanup } = makeHostMock()
    expect(registerDialogKeyLayer(host, config)).toBe(cleanup)
  })
})
