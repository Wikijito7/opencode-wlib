import { describe, expect, it } from "bun:test"
import {
  EXPORT_FORMATS,
  buildMarkdown,
  buildCsv,
  buildJson,
  buildText,
  buildExport,
  type ExportData,
} from "./export"

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeData(): ExportData {
  return {
    period: { start: "2026-01-01", end: "2026-01-31", granularity: "month" },
    rows: [
      {
        provider: "Anthropic",
        model: "claude-3-5-sonnet",
        input: 1234,
        output: 5678,
        totalTokens: 6912,
        sharePct: 62.5,
        cost: 0.5,
      },
      {
        provider: "OpenAI",
        model: "gpt-4o",
        input: 200,
        output: 300,
        totalTokens: 500,
        sharePct: 37.5,
        cost: 0.25,
      },
    ],
    totalInput: 1434,
    totalOutput: 5978,
    totalTokens: 7412,
    totalCost: 0.75,
  }
}

function makeEmptyData(): ExportData {
  return {
    period: { start: "2026-02-01", end: "2026-02-28", granularity: "month" },
    rows: [],
    totalInput: 0,
    totalOutput: 0,
    totalTokens: 0,
    totalCost: 0,
  }
}

// ─── buildMarkdown ───────────────────────────────────────────────────────────

describe("buildMarkdown", () => {
  it("renders metadata, header, per-row values, and totals row", () => {
    const out = buildMarkdown(makeData())
    const expected = [
      "## Usage · 2026-01-01 → 2026-01-31 (month)",
      "",
      "| Provider | Model | Input | Output | Total tokens | Share % | Cost |",
      "| --- | --- | ---: | ---: | ---: | ---: | ---: |",
      "| Anthropic | claude-3-5-sonnet | 1,234 | 5,678 | 6,912 | 62.5% | $0.50 |",
      "| OpenAI | gpt-4o | 200 | 300 | 500 | 37.5% | $0.25 |",
      "|  | **Total** | 1,434 | 5,978 | 7,412 | 100% | $0.75 |",
    ].join("\n")
    expect(out).toBe(expected)
  })

  it("escapes pipes, backslashes, and newlines in provider/model cells", () => {
    const data = makeData()
    data.rows = [
      {
        provider: "Pipe|Co",
        model: "back\\slash\nmodel",
        input: 1,
        output: 2,
        totalTokens: 3,
        sharePct: 100,
        cost: 1,
      },
    ]
    data.totalInput = 1
    data.totalOutput = 2
    data.totalTokens = 3
    data.totalCost = 1

    const out = buildMarkdown(data)
    const expected = [
      "## Usage · 2026-01-01 → 2026-01-31 (month)",
      "",
      "| Provider | Model | Input | Output | Total tokens | Share % | Cost |",
      "| --- | --- | ---: | ---: | ---: | ---: | ---: |",
      "| Pipe\\|Co | back\\\\slash\\nmodel | 1 | 2 | 3 | 100% | $1.00 |",
      "|  | **Total** | 1 | 2 | 3 | 100% | $1.00 |",
    ].join("\n")
    expect(out).toBe(expected)

    // The whole table must be a single markdown block: the escaped newline must
    // not create an extra physical line in the output.
    expect(out.split("\n")).toHaveLength(expected.split("\n").length)
  })

  it("emits metadata, header, and zeroed totals row when there are no rows", () => {
    const out = buildMarkdown(makeEmptyData())
    const expected = [
      "## Usage · 2026-02-01 → 2026-02-28 (month)",
      "",
      "| Provider | Model | Input | Output | Total tokens | Share % | Cost |",
      "| --- | --- | ---: | ---: | ---: | ---: | ---: |",
      "|  | **Total** | 0 | 0 | 0 | 100% | $0.00 |",
    ].join("\n")
    expect(out).toBe(expected)
  })
})

// ─── buildCsv ────────────────────────────────────────────────────────────────

describe("buildCsv", () => {
  it("emits header, raw-number data rows, and TOTAL row", () => {
    const out = buildCsv(makeData())
    const expected = [
      "period_start,period_end,provider,model,input,output,total_tokens,share_pct,cost",
      "2026-01-01,2026-01-31,Anthropic,claude-3-5-sonnet,1234,5678,6912,62.5,0.5",
      "2026-01-01,2026-01-31,OpenAI,gpt-4o,200,300,500,37.5,0.25",
      "2026-01-01,2026-01-31,,TOTAL,1434,5978,7412,100,0.75",
    ].join("\n")
    expect(out).toBe(expected)
  })

  it("RFC 4180 quotes fields containing comma, double-quote, or newline", () => {
    const data = makeData()
    data.rows = [
      {
        provider: "Co, Inc.",
        model: 'he said "hi"\nbye',
        input: 10,
        output: 20,
        totalTokens: 30,
        sharePct: 50,
        cost: 0.1,
      },
    ]
    data.totalInput = 10
    data.totalOutput = 20
    data.totalTokens = 30
    data.totalCost = 0.1

    const out = buildCsv(data)
    const expected = [
      "period_start,period_end,provider,model,input,output,total_tokens,share_pct,cost",
      // The model field contains an actual newline inside the quoted field (valid RFC 4180).
      '2026-01-01,2026-01-31,"Co, Inc.","he said ""hi""\nbye",10,20,30,50,0.1',
      "2026-01-01,2026-01-31,,TOTAL,10,20,30,100,0.1",
    ].join("\n")
    expect(out).toBe(expected)
    // Quoted fields must start and end with a double quote and have doubled inner quotes.
    expect(out).toContain('"Co, Inc."')
    expect(out).toContain('"he said ""hi""')
  })

  it("never quotes raw numeric fields", () => {
    const out = buildCsv(makeData())
    const dataLine = out.split("\n")[1]
    expect(dataLine).toContain("1234")
    expect(dataLine).not.toContain('"1234"')
    expect(dataLine).not.toContain('"0.5"')
    expect(dataLine).not.toContain('"62.5"')
  })

  it("emits header and TOTAL row when there are no rows", () => {
    const out = buildCsv(makeEmptyData())
    const expected = [
      "period_start,period_end,provider,model,input,output,total_tokens,share_pct,cost",
      "2026-02-01,2026-02-28,,TOTAL,0,0,0,100,0",
    ].join("\n")
    expect(out).toBe(expected)
  })
})

// ─── buildJson ───────────────────────────────────────────────────────────────

describe("buildJson", () => {
  it("produces valid JSON with period, totals, and raw-number models", () => {
    const parsed = JSON.parse(buildJson(makeData())) as {
      period: { start: string; end: string; granularity: string }
      totals: { input: number; output: number; tokens: number; cost: number }
      models: Array<Record<string, unknown>>
    }
    expect(parsed.period).toEqual({
      start: "2026-01-01",
      end: "2026-01-31",
      granularity: "month",
    })
    expect(parsed.totals).toEqual({
      input: 1434,
      output: 5978,
      tokens: 7412,
      cost: 0.75,
    })
    expect(parsed.models).toHaveLength(2)
    expect(parsed.models[0]).toEqual({
      provider: "Anthropic",
      model: "claude-3-5-sonnet",
      input: 1234,
      output: 5678,
      totalTokens: 6912,
      sharePct: 62.5,
      cost: 0.5,
    })
  })

  it("returns empty models array but keeps totals when no rows exist", () => {
    const parsed = JSON.parse(buildJson(makeEmptyData())) as {
      models: unknown[]
      totals: { input: number; output: number; tokens: number; cost: number }
    }
    expect(parsed.models).toEqual([])
    expect(parsed.totals).toEqual({ input: 0, output: 0, tokens: 0, cost: 0 })
  })
})

// ─── buildText ───────────────────────────────────────────────────────────────

describe("buildText", () => {
  it("renders period line, totals lines, and one line per model", () => {
    const out = buildText(makeData())
    const expected = [
      "Usage · 2026-01-01 → 2026-01-31 (month)",
      "Total: 7,412 tokens · $0.75",
      "↑ Input  1,434",
      "↓ Output 5,978",
      "Anthropic/claude-3-5-sonnet — 6,912 tokens · 62.5% · $0.50",
      "OpenAI/gpt-4o — 500 tokens · 37.5% · $0.25",
    ].join("\n")
    expect(out).toBe(expected)
  })

  it("renders header + totals only when there are no rows", () => {
    const out = buildText(makeEmptyData())
    const expected = [
      "Usage · 2026-02-01 → 2026-02-28 (month)",
      "Total: 0 tokens · $0.00",
      "↑ Input  0",
      "↓ Output 0",
    ].join("\n")
    expect(out).toBe(expected)
  })
})

// ─── buildExport dispatcher ──────────────────────────────────────────────────

describe("buildExport dispatcher", () => {
  const data = makeData()

  it("dispatches markdown to buildMarkdown", () => {
    expect(buildExport("markdown", data)).toBe(buildMarkdown(data))
  })

  it("dispatches csv to buildCsv", () => {
    expect(buildExport("csv", data)).toBe(buildCsv(data))
  })

  it("dispatches json to buildJson", () => {
    expect(buildExport("json", data)).toBe(buildJson(data))
  })

  it("dispatches text to buildText", () => {
    expect(buildExport("text", data)).toBe(buildText(data))
  })

  it("returns undefined for an unknown format (no default case)", () => {
    expect(buildExport("xml" as never, data)).toBeUndefined()
  })
})

// ─── EXPORT_FORMATS ──────────────────────────────────────────────────────────

describe("EXPORT_FORMATS", () => {
  it("contains 4 entries", () => {
    expect(EXPORT_FORMATS).toHaveLength(4)
  })

  it("has the expected ids in order", () => {
    expect(EXPORT_FORMATS.map((f) => f.id)).toEqual([
      "markdown",
      "csv",
      "json",
      "text",
    ])
  })

  it("has the expected labels in order", () => {
    expect(EXPORT_FORMATS.map((f) => f.label)).toEqual([
      "Markdown",
      "CSV",
      "JSON",
      "Plain text",
    ])
  })
})
