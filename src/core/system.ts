/**
 * opencode-wlib — system prompt snapshot contract.
 *
 * Solves the plugin-hook-ordering problem for system-prompt observers:
 * opencode fires `experimental.chat.system.transform` hooks in plugin
 * registration order, and plugins mutate the same `system` array
 * sequentially. A plugin that mutates the system (e.g. persona-injector)
 * always sees the FINAL text; an observer (e.g. model-usage) may run
 * before the mutation and capture a stale snapshot.
 *
 * The contract: the MUTATOR persists the final system prompt it produced,
 * keyed by session, to a canonical sidecar file. Observers read it at
 * analyze time and prefer it over their own (potentially pre-mutation)
 * capture. Both sides share this module so the file path, schema, and
 * throttling never drift.
 *
 * Writer: persona-injector (`experimental.chat.system.transform`, after
 * injecting). Reader: model-usage (`/analyze`, System tab + raw visor).
 */

import { homedir } from "node:os"
import { dirname } from "node:path"
import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs"

/** Canonical sidecar location — single source of truth for both plugins. */
export const SYSTEM_SNAPSHOTS_FILE = `${homedir()}/.config/opencode/plugins/persona-injector/system-snapshots.json`

/** One persisted final system prompt for a session. */
export interface SystemSnapshotEntry {
  /** Epoch ms of the last write. */
  ts: number
  /** The fully-assembled system prompt text as sent to the provider. */
  rawText: string
}

export interface SystemSnapshotWriteOpts {
  /** Skip persisting when the token drift is within this threshold. */
  driftThreshold?: number
  /** FIFO eviction cap. */
  maxEntries?: number
  /** Number of oldest entries evicted once the cap is exceeded. */
  purgeCount?: number
  /** Only refresh the timestamp after this much time has passed. */
  tsRefreshMs?: number
  /** Injectable clock for tests. */
  now?: number
}

const MAX_ENTRIES = 1000
const PURGE_COUNT = 100
const DRIFT_THRESHOLD = 32
const TS_REFRESH_MS = 5 * 60 * 1000

// Serialized writes to prevent race conditions from concurrent API calls.
let writeQueue: Promise<void> = Promise.resolve()

/**
 * Title-generation calls fire `experimental.chat.system.transform` with a
 * tiny "You are a title generator" system. They are NOT the real session
 * system prompt and must be excluded from snapshots.
 */
export function isTitleGenerator(system: string[]): boolean {
  return system.join("\n").toLowerCase().includes("title generator")
}

/** char/4 token estimate (mirrors model-usage's estimator). */
export function estimateTokens(text: string): number {
  if (!text) return 0
  return Math.ceil(text.length / 4)
}

function ensureDir(file: string) {
  try {
    mkdirSync(dirname(file), { recursive: true })
  } catch {
    /* ignore */
  }
}

function load(file: string): Record<string, SystemSnapshotEntry> {
  ensureDir(file)
  try {
    if (existsSync(file)) {
      const parsed = JSON.parse(readFileSync(file, "utf-8"))
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, SystemSnapshotEntry>
      }
    }
  } catch {
    /* ignore — malformed file is treated as empty */
  }
  return {}
}

function save(
  file: string,
  data: Record<string, SystemSnapshotEntry>,
  maxEntries: number,
  purgeCount: number,
): Promise<void> {
  const entries = Object.entries(data)
  if (entries.length > maxEntries) {
    const sorted = entries.sort((a, b) => a[1].ts - b[1].ts)
    data = Object.fromEntries(sorted.slice(purgeCount))
  }
  writeQueue = writeQueue.then(() => {
    ensureDir(file)
    try {
      writeFileSync(file, JSON.stringify(data))
    } catch {
      /* ignore */
    }
  })
  return writeQueue
}

/**
 * Read the last persisted final system prompt for a session.
 * Returns null when the session has no entry (never written, or evicted).
 */
export function readSystemSnapshot(
  sessionID: string,
  file: string = SYSTEM_SNAPSHOTS_FILE,
): SystemSnapshotEntry | null {
  if (!sessionID) return null
  const data = load(file)
  const entry = data[sessionID]
  if (entry && typeof entry.rawText === "string" && entry.rawText.trim().length > 0) {
    return entry
  }
  return null
}

/**
 * Persist the final system prompt for a session.
 *
 * Throttled: when the new text drifts by ≤ `driftThreshold` tokens from the
 * last persisted value, only the timestamp is refreshed (after
 * `tsRefreshMs`) and the text is kept — avoids rewriting the file when
 * nothing material changed. Writes are serialized via a promise chain.
 *
 * No-ops when the session is missing or the text is empty (e.g. skipped
 * title-generator calls must not clobber the last real snapshot).
 */
export function writeSystemSnapshot(
  sessionID: string,
  rawText: string,
  file: string = SYSTEM_SNAPSHOTS_FILE,
  opts: SystemSnapshotWriteOpts = {},
): Promise<void> {
  if (!sessionID || !rawText || rawText.trim().length === 0) return Promise.resolve()

  const now = opts.now ?? Date.now()
  const driftThreshold = opts.driftThreshold ?? DRIFT_THRESHOLD
  const maxEntries = opts.maxEntries ?? MAX_ENTRIES
  const purgeCount = opts.purgeCount ?? PURGE_COUNT
  const tsRefreshMs = opts.tsRefreshMs ?? TS_REFRESH_MS
  const tokens = estimateTokens(rawText)

  const data = load(file)
  const prev = data[sessionID]

  if (prev && typeof prev.ts === "number") {
    // No material change since last persist → keep the text, refresh the
    // timestamp occasionally (throttle I/O).
    if (Math.abs(tokens - estimateTokens(prev.rawText)) <= driftThreshold) {
      if (now - prev.ts >= tsRefreshMs) {
        prev.ts = now
        return save(file, data, maxEntries, purgeCount)
      }
      return Promise.resolve()
    }
  }

  data[sessionID] = { ts: now, rawText: rawText }
  return save(file, data, maxEntries, purgeCount)
}
