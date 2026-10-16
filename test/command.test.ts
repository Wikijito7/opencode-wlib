import { describe, expect, it } from "bun:test"
import { registerSlashCommand, type SlashCommandOptions } from "../src/core/command"
import type { HostCommandOptions, WlibHost } from "../src/host/types"

// Minimal host mock capturing registerCommand calls and returning a sentinel
// cleanup. The core helper is host-agnostic, so no v1/v2 specifics leak here.
function makeHostMock() {
  const calls: HostCommandOptions[] = []
  const cleanup = () => { /* sentinel */ }
  const host = {
    kind: "v2",
    registerCommand(options: HostCommandOptions) {
      calls.push(options)
      return cleanup
    },
  }
  return { host: host as unknown as WlibHost, calls, cleanup }
}

describe("registerSlashCommand", () => {
  it("forwards name/title/slashName/group/run to the host", () => {
    const { host, calls } = makeHostMock()
    const run = () => {}
    registerSlashCommand(host, {
      name: "analyze.show",
      title: "Analyze Session Tokens",
      slashName: "analyze",
      run,
    })

    expect(calls).toHaveLength(1)
    expect(calls[0]).toEqual({
      name: "analyze.show",
      title: "Analyze Session Tokens",
      slashName: "analyze",
      group: "Plugin",
      key: undefined,
      run,
    })
  })

  it("defaults the group to Plugin", () => {
    const { host, calls } = makeHostMock()
    registerSlashCommand(host, {
      name: "x.open",
      title: "X",
      slashName: "x",
      run: () => {},
    })
    expect(calls[0].group).toBe("Plugin")
  })

  it("forwards a string key binding untouched", () => {
    const { host, calls } = makeHostMock()
    registerSlashCommand(host, {
      name: "analyze.show",
      title: "Analyze Session Tokens",
      slashName: "analyze",
      key: "ctrl+shift+a",
      run: () => {},
    })
    expect(calls[0].key).toBe("ctrl+shift+a")
  })

  it("forwards an explicit key binding object with custom desc", () => {
    const { host, calls } = makeHostMock()
    registerSlashCommand(host, {
      name: "persona.select",
      title: "Select Persona",
      slashName: "persona",
      key: { key: "ctrl+shift+m", desc: "Pick a persona" },
      run: () => {},
    })
    expect(calls[0].key).toEqual({ key: "ctrl+shift+m", desc: "Pick a persona" })
  })

  it("returns the cleanup supplied by the host", () => {
    const { host, cleanup } = makeHostMock()
    const returned = registerSlashCommand(host, {
      name: "x",
      title: "X",
      slashName: "x",
      run: () => {},
    })
    expect(returned).toBe(cleanup)
    expect(typeof returned).toBe("function")
  })

  it("never touches the host's command metadata conventions itself", () => {
    // The core helper must not fabricate v1/v2-specific fields (category,
    // namespace, id, palette, slash). Those belong to the adapter.
    const { host, calls } = makeHostMock()
    const opts: SlashCommandOptions = {
      name: "analyze.show",
      title: "Analyze Session Tokens",
      slashName: "analyze",
      run: () => {},
    }
    registerSlashCommand(host, opts)
    const forwarded = calls[0] as Record<string, unknown>
    expect("category" in forwarded).toBe(false)
    expect("namespace" in forwarded).toBe(false)
    expect("id" in forwarded).toBe(false)
    expect("palette" in forwarded).toBe(false)
    expect("slash" in forwarded).toBe(false)
  })
})
