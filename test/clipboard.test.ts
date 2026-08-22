import { describe, expect, it, beforeAll, afterAll } from "bun:test"
import { resolveClipboardCandidates, buildOsc52Sequence } from "../src/core/clipboard"

// ─── resolveClipboardCandidates ──────────────────────────────────────────────

describe("resolveClipboardCandidates", () => {
  it("returns correct candidates for darwin", () => {
    expect(resolveClipboardCandidates("darwin")).toEqual([
      { cmd: "pbcopy", args: [] },
      { cmd: "osascript", args: ["-e", "set the clipboard to (read \"/dev/stdin\" as «class utf8»)" ] }
    ])
  })

  it("returns correct candidates for linux", () => {
    expect(resolveClipboardCandidates("linux")).toEqual([
      { cmd: "wl-copy", args: [] },
      { cmd: "xclip", args: ["-selection", "clipboard"] },
      { cmd: "xsel", args: ["--clipboard", "--input"] }
    ])
  })

  it("returns correct candidates for win32", () => {
    expect(resolveClipboardCandidates("win32")).toEqual([
      {
        cmd: "powershell.exe",
        args: [
          "-NonInteractive",
          "-NoProfile",
          "-Command",
          "[Console]::InputEncoding = [System.Text.Encoding]::UTF8; Set-Clipboard -Value ([Console]::In.ReadToEnd())"
        ]
      }
    ])
  })

  it("returns empty array for unrecognized platforms", () => {
    expect(resolveClipboardCandidates("freebsd")).toEqual([])
    expect(resolveClipboardCandidates("sunos")).toEqual([])
    expect(resolveClipboardCandidates("openbsd")).toEqual([])
  })
})

// ─── buildOsc52Sequence ───────────────────────────────────────────────────────

describe("buildOsc52Sequence", () => {
  const originalTmux = process.env.TMUX
  const originalSty = process.env.STY

  it("produces expected OSC 52 sequence without TMUX or STY", () => {
    delete process.env.TMUX
    delete process.env.STY

    const text = "hello monke"
    const base64 = Buffer.from(text).toString("base64")
    expect(buildOsc52Sequence(text)).toBe(`\x1b]52;c;${base64}\x07`)

    if (originalTmux) process.env.TMUX = originalTmux
    if (originalSty) process.env.STY = originalSty
  })

  it("produces expected wrapped sequence with TMUX", () => {
    process.env.TMUX = "1"
    delete process.env.STY

    const text = "hello tmux"
    const base64 = Buffer.from(text).toString("base64")
    const expectedInner = `\x1b]52;c;${base64}\x07`
    expect(buildOsc52Sequence(text)).toBe(`\x1bPtmux;\x1b${expectedInner}\x1b\\`)

    if (originalTmux) {
      process.env.TMUX = originalTmux
    } else {
      delete process.env.TMUX
    }
    if (originalSty) process.env.STY = originalSty
  })

  it("produces expected wrapped sequence with STY", () => {
    delete process.env.TMUX
    process.env.STY = "1"

    const text = "hello sty"
    const base64 = Buffer.from(text).toString("base64")
    const expectedInner = `\x1b]52;c;${base64}\x07`
    expect(buildOsc52Sequence(text)).toBe(`\x1bPtmux;\x1b${expectedInner}\x1b\\`)

    if (originalTmux) process.env.TMUX = originalTmux
    if (originalSty) {
      process.env.STY = originalSty
    } else {
      delete process.env.STY
    }
  })

  it("handles empty string", () => {
    delete process.env.TMUX
    delete process.env.STY

    expect(buildOsc52Sequence("")).toBe(`\x1b]52;c;\x07`)

    if (originalTmux) process.env.TMUX = originalTmux
    if (originalSty) process.env.STY = originalSty
  })

  it("handles unicode and multi-byte text input without throwing", () => {
    delete process.env.TMUX
    delete process.env.STY

    const text = "🍌 Monke Valhalla 🦧"
    const base64 = Buffer.from(text).toString("base64")
    expect(buildOsc52Sequence(text)).toBe(`\x1b]52;c;${base64}\x07`)

    if (originalTmux) process.env.TMUX = originalTmux
    if (originalSty) process.env.STY = originalSty
  })
})
