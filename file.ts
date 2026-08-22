/**
 * opencode-wlib — export file writer helpers.
 *
 * Small, defensive helpers for writing an export to disk under
 * `~/.config/opencode/export`. The path builders are pure (unit-testable);
 * `writeFile` wraps Node's fs calls in try/catch and returns a boolean so
 * callers never have to reason about thrown errors.
 */

import { mkdirSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { dirname, join } from "node:path"

// ─── Constants ───────────────────────────────────────────────────────────────

/** Default directory for saved exports. */
export const EXPORT_BASE_DIR = join(homedir(), ".config", "opencode", "export")

// ─── Path builders ───────────────────────────────────────────────────────────

/** Local `YYYYMMDD-HHmmss` timestamp used to uniquify export filenames. */
export function timestamp(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

/** Build the full destination path for an export file. Defaults to `EXPORT_BASE_DIR`. */
export function exportFilePath(name: string, ext: string, ts: string, base: string = EXPORT_BASE_DIR): string {
  return join(base, `${name}_${ts}.${ext}`)
}

// ─── Write ───────────────────────────────────────────────────────────────────

/** Best-effort write of `content` to `filePath` (creates parent dirs). Returns true on success. */
export async function writeFile(filePath: string, content: string): Promise<boolean> {
  try {
    mkdirSync(dirname(filePath), { recursive: true })
    writeFileSync(filePath, content, "utf8")
    return true
  } catch {
    return false
  }
}