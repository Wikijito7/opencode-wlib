import { describe, expect, it } from "bun:test"
import type { KeyBinding } from "../src/core/keys"
import { buildFooter, buildHelpRows } from "../src/core/help"

describe("buildHelpRows", () => {
  it("maps each binding to a row with key and desc as action", () => {
    const bindings: KeyBinding[] = [
      { key: "up", cmd: "move.up", desc: "Move up" },
      { key: "enter", cmd: "confirm", desc: "Confirm" },
    ]
    expect(buildHelpRows(bindings)).toEqual([
      { key: "↑", action: "Move up" },
      { key: "enter", action: "Confirm" },
    ])
  })

  it("merges bindings sharing the same cmd into one row with a combined key label", () => {
    const bindings: KeyBinding[] = [
      { key: "left", cmd: "nav", desc: "Previous" },
      { key: "h", cmd: "nav", desc: "Previous" },
    ]
    expect(buildHelpRows(bindings)).toEqual([
      { key: "← / h", action: "Previous" },
    ])
  })

  it("merges more than two aliases in first-seen key order", () => {
    const bindings: KeyBinding[] = [
      { key: "right", cmd: "nav.next", desc: "Next" },
      { key: "l", cmd: "nav.next", desc: "Next" },
      { key: "n", cmd: "nav.next", desc: "Next" },
    ]
    expect(buildHelpRows(bindings)).toEqual([
      { key: "→ / l / n", action: "Next" },
    ])
  })

  it("preserves first-seen order of commands", () => {
    const bindings: KeyBinding[] = [
      { key: "q", cmd: "quit", desc: "Quit" },
      { key: "left", cmd: "nav", desc: "Previous" },
      { key: "h", cmd: "nav", desc: "Previous" },
      { key: "enter", cmd: "confirm", desc: "Confirm" },
      { key: "r", cmd: "quit", desc: "Quit" },
    ]
    expect(buildHelpRows(bindings)).toEqual([
      { key: "q / r", action: "Quit" },
      { key: "← / h", action: "Previous" },
      { key: "enter", action: "Confirm" },
    ])
  })

  it("uses each command's first-seen desc as the action", () => {
    const bindings: KeyBinding[] = [
      { key: "x", cmd: "foo", desc: "First desc" },
      { key: "y", cmd: "foo", desc: "Different desc" },
    ]
    expect(buildHelpRows(bindings)).toEqual([
      { key: "x / y", action: "First desc" },
    ])
  })

  it("maps key names to display labels (arrows, PgUp/PgDn, esc) and leaves single-char keys unchanged", () => {
    const bindings: KeyBinding[] = [
      { key: "left", cmd: "nav.left", desc: "Left" },
      { key: "right", cmd: "nav.right", desc: "Right" },
      { key: "up", cmd: "nav.up", desc: "Up" },
      { key: "down", cmd: "nav.down", desc: "Down" },
      { key: "pageup", cmd: "page.up", desc: "Page up" },
      { key: "pagedown", cmd: "page.down", desc: "Page down" },
      { key: "escape", cmd: "cancel", desc: "Cancel" },
      { key: "r", cmd: "reload", desc: "Reload" },
    ]
    expect(buildHelpRows(bindings)).toEqual([
      { key: "←", action: "Left" },
      { key: "→", action: "Right" },
      { key: "↑", action: "Up" },
      { key: "↓", action: "Down" },
      { key: "PgUp", action: "Page up" },
      { key: "PgDn", action: "Page down" },
      { key: "esc", action: "Cancel" },
      { key: "r", action: "Reload" },
    ])
  })

  it("returns an empty array for no bindings", () => {
    expect(buildHelpRows([])).toEqual([])
  })
})

describe("buildFooter", () => {
  it("composes name and version", () => {
    expect(buildFooter("model-usage", "1.0.0")).toBe(
      "model-usage v1.0.0 powered by wlib",
    )
  })

  it("omits version when name-only is provided", () => {
    expect(buildFooter("model-usage")).toBe("model-usage powered by wlib")
  })

  it("omits name when version-only is provided", () => {
    expect(buildFooter(undefined, "1.0.0")).toBe("v1.0.0 powered by wlib")
  })

  it("renders only the suffix when neither name nor version is provided", () => {
    expect(buildFooter()).toBe("powered by wlib")
  })

  it("treats empty-string name and version as missing", () => {
    expect(buildFooter("", "")).toBe("powered by wlib")
    expect(buildFooter("", "1.0.0")).toBe("v1.0.0 powered by wlib")
    expect(buildFooter("model-usage", "")).toBe("model-usage powered by wlib")
  })
})
