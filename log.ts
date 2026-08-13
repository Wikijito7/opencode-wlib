/**
 * opencode-wlib — unified debug logging.
 *
 * One logging pattern for every plugin: a `DEBUG` flag (env var or
 * explicit), a per-plugin log file under `<plugin-dir>/logs/`, and a
 * `log()` that no-ops when debugging is off. Server plugins pass their
 * own directory so the log lands next to the plugin.
 */

import { mkdirSync, appendFileSync } from "node:fs"
import { join } from "node:path"

export interface LogOptions {
  /** Enable logging (defaults to the `OPENCODE_WLIB_DEBUG` env var). */
  debug?: boolean
  /** Directory where the log file is written (defaults to `./logs`). */
  dir?: string
  /** Log file name (defaults to `log_wlib_<timestamp>.log`). */
  fileName?: string
}

export interface Logger {
  log: (...args: unknown[]) => void
  debug: boolean
}

function envDebug(): boolean {
  return process.env.OPENCODE_WLIB_DEBUG === "true"
}

/**
 * Create a logger. `log()` appends ISO-timestamped lines to
 * `<dir>/<fileName>` when debugging is enabled and no-ops otherwise.
 */
export function createLog(opts: LogOptions = {}): Logger {
  const debug = opts.debug ?? envDebug()
  const dir = opts.dir ?? "logs"
  const file = join(dir, opts.fileName ?? `log_wlib_${Date.now()}.log`)

  if (debug) {
    try {
      mkdirSync(dir, { recursive: true })
    } catch {
      /* ignore */
    }
  }

  function log(...args: unknown[]) {
    if (!debug) return
    try {
      const line = `[${new Date().toISOString()}] ${args.map(String).join(" ")}\n`
      appendFileSync(file, line)
    } catch {
      /* ignore */
    }
  }

  return { log, debug }
}
