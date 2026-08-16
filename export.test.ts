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
    sortMode: "tokens",
    rows: [
      {
        provider: "Anthropic",
        model: "claude-3-5-sonnet",
        input: 1234,
        output: 5678,
        totalTokens: 6912,
        sharePct: 62.5,
        cost: 0.5,
        costPerMillion: 2.5,
      },
      {
        provider: "OpenAI",
        model: "gpt-4o",
        input: 200,
        output: 300,
        totalTokens: 500,
        sharePct: 37.5,
        cost: 0.25,
        costPerMillion: 0,
      },
      {
        provider: "OpenAI",
        model: "gpt-4o-mini",
        input: 0,
        output: 0,
        totalTokens: 0,
        sharePct: 0,
        cost: 0,
        costPerMillion: null,
      },
    ],
    totalInput: 1434,
    totalOutput: 5978,
    totalTokens: 7412,
    totalCost: 0.75,
    projection: null,
    periodStats: null,
  }
}

function makeEmptyData(): ExportData {
  return {
    period: { start: "2026-02-01", end: "2026-02-28", granularity: "month" },
    sortMode: "tokens",
    rows: [],
    totalInput: 0,
    totalOutput: 0,
    totalTokens: 0,
    totalCost: 0,
    projection: null,
    periodStats: null,
  }
}

function makeProjectedData(): ExportData {
  return {
    ...makeData(),
    projection: { projectedCost: 1.25, elapsedDays: 21, totalDays: 31 },
  }
}

function makeStatsData(): ExportData {
  return {
    ...makeData(),
    periodStats: { sessions: 42, messages: 1337 },
  }
}

// ─── buildMarkdown ───────────────────────────────────────────────────────────

describe("buildMarkdown", () => {
  it("renders metadata, header, per-row values, and totals row", () => {
    const out = buildMarkdown(makeData())
    const expected = [
      "## Usage · 2026-01-01 → 2026-01-31 (month) · sorted by tokens",
      "",
      "| Provider | Model | Input | Output | Total tokens | Share % | Cost | Cost/1M |",
      "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |",
      "| Anthropic | claude-3-5-sonnet | 1,234 | 5,678 | 6,912 | 62.5% | $0.50 | $2.50/1M |",
      "| OpenAI | gpt-4o | 200 | 300 | 500 | 37.5% | $0.25 | free |",
      "| OpenAI | gpt-4o-mini | 0 | 0 | 0 | 0% | $0.00 |  |",
      "|  | **Total** | 1,434 | 5,978 | 7,412 | 100% | $0.75 |  |",
    ].join("\n")
    expect(out).toBe(expected)
  })

  it("renders Cost/1M cell as free, $X.XX/1M, or blank appropriately", () => {
    const out = buildMarkdown(makeData())
    const lines = out.split("\n")

    // Header and separator include the Cost/1M column.
    expect(lines[2]).toBe(
      "| Provider | Model | Input | Output | Total tokens | Share % | Cost | Cost/1M |"
    )
    // Paid model → $X.XX/1M.
    expect(lines[4]).toContain("| $2.50/1M |")
    // Free (zero-cost) model → free.
    expect(lines[5]).toContain("| free |")
    // Zero-token model → blank cell.
    expect(lines[6]).toContain("| $0.00 |  |")
    // Totals row leaves Cost/1M blank.
    expect(lines[7]).toContain("| $0.75 |  |")
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
        costPerMillion: 3,
      },
    ]
    data.totalInput = 1
    data.totalOutput = 2
    data.totalTokens = 3
    data.totalCost = 1

    const out = buildMarkdown(data)
    const expected = [
      "## Usage · 2026-01-01 → 2026-01-31 (month) · sorted by tokens",
      "",
      "| Provider | Model | Input | Output | Total tokens | Share % | Cost | Cost/1M |",
      "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |",
      "| Pipe\\|Co | back\\\\slash\\nmodel | 1 | 2 | 3 | 100% | $1.00 | $3.00/1M |",
      "|  | **Total** | 1 | 2 | 3 | 100% | $1.00 |  |",
    ].join("\n")
    expect(out).toBe(expected)

    // The whole table must be a single markdown block: the escaped newline must
    // not create an extra physical line in the output.
    expect(out.split("\n")).toHaveLength(expected.split("\n").length)
  })

  it("emits metadata, header, and zeroed totals row when there are no rows", () => {
    const out = buildMarkdown(makeEmptyData())
    const expected = [
      "## Usage · 2026-02-01 → 2026-02-28 (month) · sorted by tokens",
      "",
      "| Provider | Model | Input | Output | Total tokens | Share % | Cost | Cost/1M |",
      "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |",
      "|  | **Total** | 0 | 0 | 0 | 100% | $0.00 |  |",
    ].join("\n")
    expect(out).toBe(expected)
  })

  it("appends an On pace line only when a projection is present", () => {
    const without = buildMarkdown(makeData())
    expect(without).not.toContain("On pace:")

    const withProjection = buildMarkdown(makeProjectedData())
    expect(withProjection).toContain(
      "On pace: $1.25 by end of month"
    )
  })

  it("omits sessions/messages suffix when periodStats is null", () => {
    expect(buildMarkdown(makeData())).not.toContain("sessions")
    expect(buildMarkdown(makeData())).not.toContain("messages")
    expect(buildMarkdown(makeData()).split("\n")[0]).toBe(
      "## Usage · 2026-01-01 → 2026-01-31 (month) · sorted by tokens"
    )
  })

  it("appends sessions/messages suffix when periodStats is present", () => {
    const meta = buildMarkdown(makeStatsData()).split("\n")[0]
    expect(meta).toBe(
      "## Usage · 2026-01-01 → 2026-01-31 (month) · sorted by tokens · 42 sessions · 1,337 messages"
    )
  })
})

// ─── buildCsv ────────────────────────────────────────────────────────────────

describe("buildCsv", () => {
  it("emits header, raw-number data rows, and TOTAL row", () => {
    const out = buildCsv(makeData())
    const expected = [
      "period_start,period_end,provider,model,input,output,total_tokens,share_pct,sort_mode,cost,cost_per_1m,projected_cost,sessions,messages",
      "2026-01-01,2026-01-31,Anthropic,claude-3-5-sonnet,1234,5678,6912,62.5,tokens,0.50,2.50,,,",
      "2026-01-01,2026-01-31,OpenAI,gpt-4o,200,300,500,37.5,tokens,0.25,0,,,",
      "2026-01-01,2026-01-31,OpenAI,gpt-4o-mini,0,0,0,0,tokens,0.00,,,,",
      "2026-01-01,2026-01-31,,TOTAL,1434,5978,7412,100,tokens,0.75,,,,",
    ].join("\n")
    expect(out).toBe(expected)
  })

  it("emits cost_per_1m as 0 for free, X.XX for positive, empty for null", () => {
    const out = buildCsv(makeData())
    const lines = out.split("\n")
    // Paid model → two-decimal CPM.
    expect(lines[1]).toContain("2.50,")
    expect(lines[1]).not.toContain('"2.50"')
    // Free (zero-cost) model → 0.
    expect(lines[2]).toContain("0.25,0,")
    // Zero-token model → empty cost_per_1m.
    expect(lines[3]).toContain("0.00,,")
    // Totals row → empty cost_per_1m and empty projected_cost.
    expect(lines[4]).toContain("0.75,,")
  })

  it("fills projected_cost on the totals row when a projection is present", () => {
    const out = buildCsv(makeProjectedData())
    const lines = out.split("\n")
    // Data rows keep projected_cost empty.
    expect(lines[1]).toMatch(/,\s*$/)
    // Totals row carries the projected cost (cost_per_1m is empty before it).
    expect(lines[4]).toContain("0.75,,1.25")
    // Without a projection the totals row projected_cost stays empty.
    expect(buildCsv(makeData()).split("\n")[4]).toContain("0.75,,")
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
        costPerMillion: 1.5,
      },
    ]
    data.totalInput = 10
    data.totalOutput = 20
    data.totalTokens = 30
    data.totalCost = 0.1

    const out = buildCsv(data)
    const expected = [
      "period_start,period_end,provider,model,input,output,total_tokens,share_pct,sort_mode,cost,cost_per_1m,projected_cost,sessions,messages",
      // The model field contains an actual newline inside the quoted field (valid RFC 4180).
      '2026-01-01,2026-01-31,"Co, Inc.","he said ""hi""\nbye",10,20,30,50,tokens,0.10,1.50,,,',
      "2026-01-01,2026-01-31,,TOTAL,10,20,30,100,tokens,0.10,,,,",
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
    expect(dataLine).not.toContain('"0.50"')
    expect(dataLine).not.toContain('"62.5"')
  })

  it("emits header and TOTAL row when there are no rows", () => {
    const out = buildCsv(makeEmptyData())
    const expected = [
      "period_start,period_end,provider,model,input,output,total_tokens,share_pct,sort_mode,cost,cost_per_1m,projected_cost,sessions,messages",
      "2026-02-01,2026-02-28,,TOTAL,0,0,0,100,tokens,0.00,,,,",
    ].join("\n")
    expect(out).toBe(expected)
  })

  it("header ends with sessions,messages; model rows leave them empty", () => {
    const lines = buildCsv(makeStatsData()).split("\n")
    expect(lines[0]).toBe(
      "period_start,period_end,provider,model,input,output,total_tokens,share_pct,sort_mode,cost,cost_per_1m,projected_cost,sessions,messages"
    )
    expect(lines[0]).toMatch(/sessions,messages$/)
    // Model rows keep sessions and messages empty.
    expect(lines[1]).toMatch(/2\.50,,,$/)
    expect(lines[2]).toMatch(/0,,,$/)
  })

  it("totals row fills sessions and messages when periodStats is present", () => {
    const out = buildCsv(makeStatsData())
    const totalLine = out.split("\n")[4]
    expect(totalLine).toBe(
      "2026-01-01,2026-01-31,,TOTAL,1434,5978,7412,100,tokens,0.75,,,42,1337"
    )
    // When null, the totals row keeps sessions/messages empty.
    const nullTotal = buildCsv(makeData()).split("\n")[4]
    expect(nullTotal).toBe(
      "2026-01-01,2026-01-31,,TOTAL,1434,5978,7412,100,tokens,0.75,,,,"
    )
  })
})

// ─── buildJson ───────────────────────────────────────────────────────────────

describe("buildJson", () => {
  it("produces valid JSON with period, totals, and models incl. costPerMillion", () => {
    const parsed = JSON.parse(buildJson(makeData())) as {
      period: { start: string; end: string; granularity: string }
      sortMode: string
      totals: { input: number; output: number; tokens: number; cost: number }
      projection: unknown
      periodStats: unknown
      models: Array<Record<string, unknown>>
    }
    expect(parsed.sortMode).toBe("tokens")
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
    expect(parsed.projection).toBeNull()
    expect(parsed.periodStats).toBeNull()
    expect(parsed.models).toHaveLength(3)
    expect(parsed.models[0]).toEqual({
      provider: "Anthropic",
      model: "claude-3-5-sonnet",
      input: 1234,
      output: 5678,
      totalTokens: 6912,
      sharePct: 62.5,
      cost: 0.5,
      costPerMillion: 2.5,
    })
    expect(parsed.models[1]).toMatchObject({ costPerMillion: 0 })
    expect(parsed.models[2]).toMatchObject({ costPerMillion: null })
  })

  it("emits costPerMillion as number/0/null and projection as object/null", () => {
    const parsed = buildJson(makeData())
    const parsedJson = JSON.parse(parsed) as {
      projection: unknown
      periodStats: unknown
      models: Array<{ costPerMillion: number | null }>
    }
    // Without projection → null.
    expect(parsedJson.projection).toBeNull()
    // Without periodStats → null.
    expect(parsedJson.periodStats).toBeNull()
    // Paid → rounded number.
    expect(parsedJson.models[0].costPerMillion).toBe(2.5)
    // Free → 0.
    expect(parsedJson.models[1].costPerMillion).toBe(0)
    // Zero-token → null.
    expect(parsedJson.models[2].costPerMillion).toBeNull()

    const withProjection = JSON.parse(buildJson(makeProjectedData())) as {
      projection: {
        projectedCost: number
        elapsedDays: number
        totalDays: number
      } | null
      periodStats: unknown
    }
    expect(withProjection.projection).toEqual({
      projectedCost: 1.25,
      elapsedDays: 21,
      totalDays: 31,
    })
    expect(withProjection.periodStats).toBeNull()
  })

  it("returns empty models array but keeps totals when no rows exist", () => {
    const parsed = JSON.parse(buildJson(makeEmptyData())) as {
      sortMode: string
      models: unknown[]
      projection: unknown
      periodStats: unknown
      totals: { input: number; output: number; tokens: number; cost: number }
    }
    expect(parsed.sortMode).toBe("tokens")
    expect(parsed.models).toEqual([])
    expect(parsed.projection).toBeNull()
    expect(parsed.periodStats).toBeNull()
    expect(parsed.totals).toEqual({ input: 0, output: 0, tokens: 0, cost: 0 })
  })

  it("emits periodStats as null when absent and object when present", () => {
    expect(
      (JSON.parse(buildJson(makeData())) as { periodStats: unknown }).periodStats
    ).toBeNull()

    const withStats = JSON.parse(buildJson(makeStatsData())) as {
      periodStats: { sessions: number; messages: number }
    }
    expect(withStats.periodStats).toEqual({ sessions: 42, messages: 1337 })
  })
})

// ─── buildText ───────────────────────────────────────────────────────────────

describe("buildText", () => {
  it("renders period line, totals lines, and one line per model", () => {
    const out = buildText(makeData())
    const expected = [
      "Usage · 2026-01-01 → 2026-01-31 (month) · sorted by tokens",
      "Total: 7,412 tokens · $0.75",
      "↑ Input  1,434",
      "↓ Output 5,978",
      "Anthropic/claude-3-5-sonnet — 6,912 tokens · 62.5% · $0.50 · $2.50/1M",
      "OpenAI/gpt-4o — 500 tokens · 37.5% · $0.25 · free",
      "OpenAI/gpt-4o-mini — 0 tokens · 0% · $0.00",
    ].join("\n")
    expect(out).toBe(expected)
  })

  it("renders header + totals only when there are no rows", () => {
    const out = buildText(makeEmptyData())
    const expected = [
      "Usage · 2026-02-01 → 2026-02-28 (month) · sorted by tokens",
      "Total: 0 tokens · $0.00",
      "↑ Input  0",
      "↓ Output 0",
    ].join("\n")
    expect(out).toBe(expected)
  })

  it("appends an On pace line only when a projection is present", () => {
    expect(buildText(makeData())).not.toContain("On pace:")
    expect(buildText(makeProjectedData())).toContain(
      "On pace: $1.25 by end of month"
    )
  })

  it("omits sessions/messages suffix when periodStats is null", () => {
    expect(buildText(makeData())).not.toContain("sessions")
    expect(buildText(makeData())).not.toContain("messages")
    expect(buildText(makeData()).split("\n")[0]).toBe(
      "Usage · 2026-01-01 → 2026-01-31 (month) · sorted by tokens"
    )
  })

  it("appends sessions/messages suffix when periodStats is present", () => {
    const first = buildText(makeStatsData()).split("\n")[0]
    expect(first).toBe(
      "Usage · 2026-01-01 → 2026-01-31 (month) · sorted by tokens · 42 sessions · 1,337 messages"
    )
  })
})

// ─── sortMode "cost" vs "tokens" vs "price" ─────────────────────────────────

describe("sortMode reflection", () => {
  function makeSortedData(mode: "tokens" | "cost" | "price"): ExportData {
    const data = makeData()
    data.sortMode = mode
    return data
  }

  it("CSV sort_mode column reflects the mode", () => {
    for (const mode of ["tokens", "cost", "price"] as const) {
      const lines = buildCsv(makeSortedData(mode)).split("\n")
      expect(lines).toContain(
        `2026-01-01,2026-01-31,Anthropic,claude-3-5-sonnet,1234,5678,6912,62.5,${mode},0.50,2.50,,,`
      )
      expect(lines).toContain(
        `2026-01-01,2026-01-31,,TOTAL,1434,5978,7412,100,${mode},0.75,,,,`
      )
    }
  })

  it("JSON sortMode field reflects the mode", () => {
    for (const mode of ["tokens", "cost", "price"] as const) {
      expect(JSON.parse(buildJson(makeSortedData(mode)))).toMatchObject({
        sortMode: mode,
      })
    }
  })

  it("Markdown and Text sorted-by lines reflect the mode", () => {
    for (const mode of ["tokens", "cost", "price"] as const) {
      expect(buildMarkdown(makeSortedData(mode))).toContain(
        `sorted by ${mode}`
      )
      expect(buildText(makeSortedData(mode))).toContain(`sorted by ${mode}`)
    }
  })
})

// ─── Rounding ────────────────────────────────────────────────────────────────

describe("rounding to two decimals", () => {
  function makeRoundingData(): ExportData {
    const data = makeEmptyData()
    data.rows = [
      {
        provider: "Anthropic",
        model: "claude-round",
        input: 1,
        output: 1,
        totalTokens: 100,
        sharePct: 62.525,
        cost: 0.0102,
        costPerMillion: 5.345,
      },
    ]
    data.totalInput = 1
    data.totalOutput = 1
    data.totalTokens = 100
    data.totalCost = 0.0102
    return data
  }

  it("buildMarkdown rounds cost and sharePct to two decimals", () => {
    const out = buildMarkdown(makeRoundingData())
    expect(out).toContain("| 62.53% |")
    expect(out).toContain("| $0.01 |")
    expect(out).toContain("| $5.35/1M |")
  })

  it("buildCsv rounds cost, sharePct, and cost_per_1m to two decimals", () => {
    const out = buildCsv(makeRoundingData())
    expect(out).toContain(",100,62.53,tokens,0.01,5.35,")
  })

  it("buildJson rounds cost, sharePct, and costPerMillion to two decimals", () => {
    const parsed = JSON.parse(buildJson(makeRoundingData())) as {
      models: Array<{ cost: number; sharePct: number; costPerMillion: number }>
      totals: { cost: number }
    }
    expect(parsed.models[0]).toMatchObject({
      cost: 0.01,
      sharePct: 62.53,
      costPerMillion: 5.35,
    })
    expect(parsed.totals.cost).toBe(0.01)
  })

  it("buildText rounds cost and sharePct to two decimals", () => {
    const out = buildText(makeRoundingData())
    expect(out).toContain("· 62.53% · $0.01 · $5.35/1M")
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

  it("throws for an unsupported format", () => {
    expect(() => buildExport("xml" as never, data)).toThrow()
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
