import { describe, expect, it, spyOn } from "bun:test"
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

    const spawnSpy = spyOn(cp, "spawn").mockImplementation(() => ({ unref() {} }) as any)
    try {
      const ok = await openFolder("/tmp")
      expect(ok).toBe(true)
      expect(spawnSpy).toHaveBeenCalled()
      const call = spawnSpy.mock.calls[0]
      expect(call?.[0]).toBe(resolved.cmd)
      expect(call?.[1]).toEqual(["/tmp"])
    } finally {
      spawnSpy.mockRestore()
    }
  })
})