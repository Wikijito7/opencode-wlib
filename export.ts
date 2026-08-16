/**
 * opencode-wlib — pure usage-data export serializers.
 *
 * Turns a usage summary (`ExportData`) into Markdown / CSV / JSON / plain-text
 * strings. Pure and deterministic: no side effects, no imports from any host
 * plugin, no Node/runtime dependencies. Named exports only so it can be
 * unit-tested in isolation.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

/** Supported serialization formats for a usage export. */
export type ExportFormat = "markdown" | "csv" | "json" | "text"

/** Time bucket for a usage export. */
export type ExportGranularity = "month" | "week" | "day"

/** Inclusive date range (`YYYY-MM-DD`) covered by an export. */
export interface ExportPeriod {
  start: string
  end: string
  granularity: ExportGranularity
}

/** A single provider/model usage row. `cost` is USD as a raw number. */
export interface ExportRow {
  provider: string
  model: string
  input: number
  output: number
  totalTokens: number
  sharePct: number
  cost: number
}

/** A complete usage summary ready to be serialized to any export format. */
export interface ExportData {
  period: ExportPeriod
  rows: ExportRow[]
  totalInput: number
  totalOutput: number
  totalTokens: number
  totalCost: number
}

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

// ─── Formatting helpers ───────────────────────────────────────────────────────

/**
 * Format an integer-like count with thousands separators (e.g. `1,234,567`).
 * Deterministic and locale-independent.
 */
function formatThousands(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",")
}

/**
 * Format a USD cost as a `$`-prefixed string with at least two decimals and up
 * to six (trailing zeros trimmed). Keeps meaningful precision without surfacing
 * float noise, e.g. `$0.0102`, `$12.50`, `$0.00001`.
 */
function formatCost(cost: number): string {
  let fixed = cost.toFixed(6).replace(/0+$/, "")
  const dot = fixed.indexOf(".")
  if (dot === -1) {
    fixed += ".00"
  } else {
    const decimals = fixed.length - dot - 1
    if (decimals < 2) fixed += "0".repeat(2 - decimals)
  }
  return `$${fixed}`
}

/**
 * Escape a cell value so it cannot break a Markdown table: backslashes first,
 * then pipes, then newlines (rendered as a literal `\n`).
 */
function escapeMarkdownCell(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\|/g, "\\|")
    .replace(/\n/g, "\\n")
}

/**
 * RFC 4180 quoting: wrap the field in double quotes when it contains a comma,
 * double quote, or newline; double any embedded double quotes. Fields without
 * those characters (including all raw numbers) pass through unchanged.
 */
function csvField(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

// ─── Builders ────────────────────────────────────────────────────────────────

/**
 * Serialize `data` to a Markdown table with a leading metadata line, one row
 * per `ExportRow`, and a bold totals row. Empty `rows` still produce the
 * metadata line, header, separator, and a zeroed totals row.
 */
export function buildMarkdown(data: ExportData): string {
  const lines: string[] = [
    `## Usage · ${data.period.start} → ${data.period.end} (${data.period.granularity})`,
    "",
    "| Provider | Model | Input | Output | Total tokens | Share % | Cost |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: |",
  ]
  for (const row of data.rows) {
    lines.push(
      `| ${escapeMarkdownCell(row.provider)} | ${escapeMarkdownCell(row.model)} | ` +
        `${formatThousands(row.input)} | ${formatThousands(row.output)} | ` +
        `${formatThousands(row.totalTokens)} | ${row.sharePct}% | ${formatCost(row.cost)} |`
    )
  }
  lines.push(
    `|  | **Total** | ${formatThousands(data.totalInput)} | ${formatThousands(data.totalOutput)} | ` +
      `${formatThousands(data.totalTokens)} | 100% | ${formatCost(data.totalCost)} |`
  )
  return lines.join("\n")
}

/**
 * Serialize `data` to CSV (RFC 4180 quoting). Numbers are emitted as raw
 * full-precision values; `sharePct` as a bare number; `cost` as a raw number.
 * A `TOTAL` row always follows the data rows (zeroed when `rows` is empty).
 */
export function buildCsv(data: ExportData): string {
  const lines: string[] = [
    "period_start,period_end,provider,model,input,output,total_tokens,share_pct,cost",
  ]
  for (const row of data.rows) {
    lines.push(
      [
        csvField(data.period.start),
        csvField(data.period.end),
        csvField(row.provider),
        csvField(row.model),
        String(row.input),
        String(row.output),
        String(row.totalTokens),
        String(row.sharePct),
        String(row.cost),
      ].join(",")
    )
  }
  lines.push(
    [
      csvField(data.period.start),
      csvField(data.period.end),
      "",
      "TOTAL",
      String(data.totalInput),
      String(data.totalOutput),
      String(data.totalTokens),
      "100",
      String(data.totalCost),
    ].join(",")
  )
  return lines.join("\n")
}

/**
 * Serialize `data` to pretty-printed JSON (2-space indent). Raw numbers, no
 * string coercion. Empty `rows` yield `models: []` with `totals` still present.
 */
export function buildJson(data: ExportData): string {
  return JSON.stringify(
    {
      period: {
        start: data.period.start,
        end: data.period.end,
        granularity: data.period.granularity,
      },
      totals: {
        input: data.totalInput,
        output: data.totalOutput,
        tokens: data.totalTokens,
        cost: data.totalCost,
      },
      models: data.rows.map((row) => ({
        provider: row.provider,
        model: row.model,
        input: row.input,
        output: row.output,
        totalTokens: row.totalTokens,
        sharePct: row.sharePct,
        cost: row.cost,
      })),
    },
    null,
    2
  )
}

/**
 * Serialize `data` to a human-readable plain-text dump (no Markdown syntax).
 * Empty `rows` yield header + totals only.
 */
export function buildText(data: ExportData): string {
  const lines: string[] = [
    `Usage · ${data.period.start} → ${data.period.end} (${data.period.granularity})`,
    `Total: ${formatThousands(data.totalTokens)} tokens · ${formatCost(data.totalCost)}`,
    `↑ Input  ${formatThousands(data.totalInput)}`,
    `↓ Output ${formatThousands(data.totalOutput)}`,
  ]
  for (const row of data.rows) {
    lines.push(
      `${row.provider}/${row.model} — ${formatThousands(row.totalTokens)} tokens · ` +
        `${row.sharePct}% · ${formatCost(row.cost)}`
    )
  }
  return lines.join("\n")
}

// ─── Dispatcher ──────────────────────────────────────────────────────────────

/**
 * Dispatch to the builder matching `format` and return its serialized output.
 */
export function buildExport(format: ExportFormat, data: ExportData): string {
  switch (format) {
    case "markdown":
      return buildMarkdown(data)
    case "csv":
      return buildCsv(data)
    case "json":
      return buildJson(data)
    case "text":
      return buildText(data)
  }
}
