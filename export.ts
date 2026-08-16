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

/** The mode used to sort the usage rows: token, cost, or price. */
export type SortMode = "tokens" | "cost" | "price"

/** Inclusive date range (`YYYY-MM-DD`) covered by an export. */
export interface ExportPeriod {
  start: string
  end: string
  granularity: ExportGranularity
}

/**
 * A single provider/model usage row. `cost` is USD as a raw number;
 * `costPerMillion` is dollars per 1M tokens: `null` when the model had zero
 * tokens (no CPM), `0` for a free (zero-cost) model, `>0` otherwise.
 */
export interface ExportRow {
  provider: string
  model: string
  input: number
  output: number
  totalTokens: number
  sharePct: number
  cost: number
  costPerMillion: number | null
}

/** Forward-looking cost projection for the period. `projectedCost` is USD. */
export interface ExportProjection {
  projectedCost: number // USD
  elapsedDays: number
  totalDays: number
}

/** A complete usage summary ready to be serialized to any export format. */
export interface ExportData {
  period: ExportPeriod
  rows: ExportRow[]
  sortMode: SortMode
  totalInput: number
  totalOutput: number
  totalTokens: number
  totalCost: number
  projection: ExportProjection | null
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
 * Round a number to two decimal places (used consistently for cost, sharePct,
 * costPerMillion, and projectedCost).
 */
function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Format a `costPerMillion` value: `null` → empty string, `0` → `free`,
 * otherwise a `$`-prefixed two-decimal `.../1M` string.
 */
function formatCostPerMillion(cpm: number | null): string {
  if (cpm === null) return ""
  if (cpm === 0) return "free"
  return `$${round2(cpm).toFixed(2)}/1M`
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
    `## Usage · ${data.period.start} → ${data.period.end} (${data.period.granularity}) · sorted by ${data.sortMode}`,
    "",
    "| Provider | Model | Input | Output | Total tokens | Share % | Cost | Cost/1M |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |",
  ]
  for (const row of data.rows) {
    lines.push(
      `| ${escapeMarkdownCell(row.provider)} | ${escapeMarkdownCell(row.model)} | ` +
        `${formatThousands(row.input)} | ${formatThousands(row.output)} | ` +
        `${formatThousands(row.totalTokens)} | ${round2(row.sharePct)}% | ` +
        `$${round2(row.cost).toFixed(2)} | ${formatCostPerMillion(row.costPerMillion)} |`
    )
  }
  lines.push(
    `|  | **Total** | ${formatThousands(data.totalInput)} | ${formatThousands(data.totalOutput)} | ` +
      `${formatThousands(data.totalTokens)} | 100% | $${round2(data.totalCost).toFixed(2)} |  |`
  )
  if (data.projection) {
    lines.push("")
    lines.push(
      `On pace: $${round2(data.projection.projectedCost).toFixed(2)} by end of month`
    )
  }
  return lines.join("\n")
}

/**
 * Serialize `data` to CSV (RFC 4180 quoting). `sharePct` is rounded to two
 * decimals; `cost` is rounded to two decimals and emitted with two decimals;
 * `cost_per_1m` is empty (null), `0` (free), or a two-decimal CPM; the
 * `projected_cost` column is only filled on the totals row. A `TOTAL` row
 * always follows the data rows (zeroed when `rows` is empty).
 */
export function buildCsv(data: ExportData): string {
  const lines: string[] = [
    "period_start,period_end,provider,model,input,output,total_tokens,share_pct,sort_mode,cost,cost_per_1m,projected_cost",
  ]
  for (const row of data.rows) {
    const costPerMillion =
      row.costPerMillion === null
        ? ""
        : row.costPerMillion === 0
          ? "0"
          : round2(row.costPerMillion).toFixed(2)
    lines.push(
      [
        csvField(data.period.start),
        csvField(data.period.end),
        csvField(row.provider),
        csvField(row.model),
        String(row.input),
        String(row.output),
        String(row.totalTokens),
        String(round2(row.sharePct)),
        data.sortMode,
        round2(row.cost).toFixed(2),
        costPerMillion,
        "",
      ].join(",")
    )
  }
  const projectedCost = data.projection
    ? round2(data.projection.projectedCost).toFixed(2)
    : ""
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
      data.sortMode,
      round2(data.totalCost).toFixed(2),
      "",
      projectedCost,
    ].join(",")
  )
  return lines.join("\n")
}

/**
 * Serialize `data` to pretty-printed JSON (2-space indent). `cost`, `sharePct`,
 * and `costPerMillion` are rounded to two decimals; `projection` is `null` when
 * absent. Empty `rows` yield `models: []` with `totals` still present.
 */
export function buildJson(data: ExportData): string {
  return JSON.stringify(
    {
      period: {
        start: data.period.start,
        end: data.period.end,
        granularity: data.period.granularity,
      },
      sortMode: data.sortMode,
      totals: {
        input: data.totalInput,
        output: data.totalOutput,
        tokens: data.totalTokens,
        cost: round2(data.totalCost),
      },
      projection: data.projection
        ? {
            projectedCost: round2(data.projection.projectedCost),
            elapsedDays: data.projection.elapsedDays,
            totalDays: data.projection.totalDays,
          }
        : null,
      models: data.rows.map((row) => ({
        provider: row.provider,
        model: row.model,
        input: row.input,
        output: row.output,
        totalTokens: row.totalTokens,
        sharePct: round2(row.sharePct),
        cost: round2(row.cost),
        costPerMillion:
          row.costPerMillion === null ? null : round2(row.costPerMillion),
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
    `Usage · ${data.period.start} → ${data.period.end} (${data.period.granularity}) · sorted by ${data.sortMode}`,
    `Total: ${formatThousands(data.totalTokens)} tokens · $${round2(data.totalCost).toFixed(2)}`,
    `↑ Input  ${formatThousands(data.totalInput)}`,
    `↓ Output ${formatThousands(data.totalOutput)}`,
  ]
  for (const row of data.rows) {
    const suffix =
      row.costPerMillion === null
        ? ""
        : row.costPerMillion === 0
          ? " · free"
          : ` · $${round2(row.costPerMillion).toFixed(2)}/1M`
    lines.push(
      `${row.provider}/${row.model} — ${formatThousands(row.totalTokens)} tokens · ` +
        `${round2(row.sharePct)}% · $${round2(row.cost).toFixed(2)}${suffix}`
    )
  }
  if (data.projection) {
    lines.push(`On pace: $${round2(data.projection.projectedCost).toFixed(2)} by end of month`)
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
    default:
      throw new Error(`Unknown export format: ${String(format)}`)
  }
}
