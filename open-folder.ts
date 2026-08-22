/**
 * opencode-wlib — open-folder helper.
 *
 * Best-effort helper to open a directory in the OS file manager via native
 * commands (`open` / `xdg-open` / `explorer`). The command resolver is pure
 * and unit-testable; `openFolder` spawns detached and ignores the result.
 */

import { spawn } from "node:child_process"
import * as process from "node:process"

// ─── Resolver ────────────────────────────────────────────────────────────────

/**
 * Pure: return the `{ cmd, args }` pair to open `dir` in the platform's file
 * manager, or `null` for unrecognized platforms.
 */
export function resolveOpenFolderCommand(platform: NodeJS.Platform, dir: string): { cmd: string; args: string[] } | null {
  switch (platform) {
    case "darwin": return { cmd: "open", args: [dir] }
    case "linux": return { cmd: "xdg-open", args: [dir] }
    case "win32": return { cmd: "explorer", args: [dir] }
    default: return null
  }
}

// ─── Execution ────────────────────────────────────────────────────────────────

/**
 * Best-effort open of `dir` in the OS file manager. Spawns detached (so it
 * outlives the host process) and ignores stdio. Returns false when no
 * command exists for the platform or spawning throws.
 */
export async function openFolder(dir: string): Promise<boolean> {
  const cmd = resolveOpenFolderCommand(process.platform, dir)
  if (!cmd) return false
  try {
    const child = spawn(cmd.cmd, cmd.args, { stdio: "ignore", detached: true })
    child.unref()
    return true
  } catch {
    return false
  }
}