/**
 * opencode-wlib — export contract.
 *
 * The pure, host-agnostic contract every export feature satisfies. Defines
 * the supported formats and the `Exportable` interface implementers plug
 * into the shared export controller (`export-controller.tsx`). The actual
 * serializers (usage, etc.) live in the host plugins, NOT here. Pure and
 * deterministic: no side effects, no imports from any host plugin, no
 * Node/runtime dependencies. Named exports only so it can be unit-tested in
 * isolation.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

/** Supported serialization formats for an export. */
export type ExportFormat = "markdown" | "csv" | "json" | "text"

/** A selectable export format option. */
export interface ExportFormatOption {
  id: ExportFormat
  label: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** The four supported export formats, in display order. */
export const EXPORT_FORMATS: ExportFormatOption[] = [
  { id: "markdown", label: "Markdown" },
  { id: "csv", label: "CSV" },
  { id: "json", label: "JSON" },
  { id: "text", label: "Plain text" },
]

/** Map an export format to its file extension. */
export function formatToExtension(format: ExportFormat): string {
  switch (format) {
    case "markdown": return "md"
    case "csv": return "csv"
    case "json": return "json"
    case "text": return "txt"
  }
}

// ─── Contract ─────────────────────────────────────────────────────────────────

/** The contract each export implementer satisfies. */
export interface Exportable {
  formats: ExportFormatOption[]
  build(format: ExportFormat): string
}