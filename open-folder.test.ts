import { describe, expect, it, mock, spyOn } from "bun:test"
import * as cp from "node:child_process"
import * as process from "node:process"
import { openFolder, resolveOpenFolderCommand } from "./open-folder"

describe("resolveOpenFolderCommand", () => {
  it("maps darwin to open", () => {
    expect(resolveOpenFolderCommand("darwin", "/tmp")).toEqual({ cmd: "open", args: ["/tmp"] })
  })

  it("maps linux to xdg-open", () => {
    expect(resolveOpenFolderCommand("linux", "/tmp")).toEqual({ cmd: "xdg-open", args: ["/tmp"] })
  })

  it("maps win32 to explorer", () => {
    expect(resolveOpenFolderCommand("win32", "/tmp")).toEqual({ cmd: "explorer", args: ["/tmp"] })
  })

  it("returns null for an unknown platform", () => {
    expect(resolveOpenFolderCommand("freebsd" as NodeJS.Platform, "/tmp")).toBeNull()
  })
})

describe("openFolder", () => {
  it("spawns the platform command and resolves true", async () => {
    const resolved = resolveOpenFolderCommand(process.platform, "/tmp")
    if (!resolved) {
      // Unknown platform: openFolder should short-circuit to false.
      expect(await openFolder("/tmp")).toBe(false)
      return
    }

    const spawnSpy = spyOn(cp, "spawn").mockImplementation(() => ({ unref() {}, on() {} }) as any)
    try {
      const ok = await openFolder("/tmp")
      expect(ok).toBe(true)
      expect(spawnSpy).toHaveBeenCalled()
      const call = spawnSpy.mock.calls[0]
      expect(call?.[0]).toBe(resolved.cmd)
      expect(call?.[1]).toEqual(["/tmp"])
      // Safety options must be passed through to spawn.
      expect(spawnSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({ stdio: "ignore", detached: true }),
      )
    } finally {
      spawnSpy.mockRestore()
    }
  })

  it("spawns with safety options: ignored stdio and detached", async () => {
    const resolved = resolveOpenFolderCommand(process.platform, "/tmp")
    if (!resolved) {
      expect(await openFolder("/tmp")).toBe(false)
      return
    }

    const spawnSpy = spyOn(cp, "spawn").mockImplementation(() => ({ unref() {}, on() {} }) as any)
    try {
      await openFolder("/tmp")
      expect(spawnSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({ stdio: "ignore", detached: true }),
      )
    } finally {
      spawnSpy.mockRestore()
    }
  })

  it("calls unref on the spawned child", async () => {
    const resolved = resolveOpenFolderCommand(process.platform, "/tmp")
    if (!resolved) {
      expect(await openFolder("/tmp")).toBe(false)
      return
    }

    const unref = mock(() => {})
    const spawnSpy = spyOn(cp, "spawn").mockImplementation(() => ({ unref, on() {} }) as any)
    try {
      await openFolder("/tmp")
      expect(unref).toHaveBeenCalled()
    } finally {
      spawnSpy.mockRestore()
    }
  })

  it("does not throw when the OS command is missing (ENOENT safety)", async () => {
    const resolved = resolveOpenFolderCommand(process.platform, "/tmp")
    if (!resolved) {
      expect(await openFolder("/tmp")).toBe(false)
      return
    }

    // Simulate a missing `open`/`xdg-open`/`explorer` binary: spawn returns a
    // child whose `on` immediately invokes the error callback, and there is no
    // executable to actually run. openFolder must swallow this and NOT throw.
    const badSpawn = spyOn(cp, "spawn").mockImplementation(() => {
      const obj: any = { unref() {}, on(_ev: string, cb: () => void) { cb() } }
      return obj
    })
    try {
      let threw = false
      try {
        await openFolder("/tmp")
      } catch {
        threw = true
      }
      expect(threw).toBe(false)
    } finally {
      badSpawn.mockRestore()
    }
  })
})