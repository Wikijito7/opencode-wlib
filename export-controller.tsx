/** @jsxImportSource @opentui/solid */
/**
 * opencode-wlib — reusable export controller.
 *
 * Host-agnostic controller that owns the export-overlay state machine: the
 * open/close signals, format selection, the priority-2 key layer, the
 * clipboard write, and the "copied!" flash. This is the exact inline flow
 * the usage dialog used to embed, extracted so any dialog can reuse it by
 * supplying an `Exportable`. Host plugins call `renderOverlay()` for the
 * popup and `copiedFlash()`/`onCopied` to render the footer flash.
 *
 * Must be created inside a Solid owner (i.e. from within a dialog render)
 * because it registers a `createEffect` + `onCleanup` for the key layer
 * and the flash timeout.
 */

import { createEffect, createSignal, onCleanup, type JSX } from "solid-js"
import type { TuiPluginApi } from "@opencode-ai/plugin/tui"
import type { Exportable } from "./export"
import { ExportOverlay } from "./export-overlay"
import { writeClipboard } from "./clipboard"
import { registerDialogKeyLayer } from "./keys"
import { resolveThemeColors } from "./theme"

export interface ExportController {
  open(): void
  handleKey(key: string): boolean
  renderOverlay(): JSX.Element | null
  copiedFlash(): boolean
  onCopied(listener: () => void): () => void
}

const FLASH_MS = 2000

export function createExportController(api: TuiPluginApi, exportable: Exportable): ExportController {
  const [showExport, setShowExport] = createSignal(false)
  const [exportSel, setExportSel] = createSignal(0)
  const [copied, setCopied] = createSignal(false)
  let timeout: ReturnType<typeof setTimeout> | null = null
  const listeners = new Set<() => void>()

  const colors = resolveThemeColors(api.theme?.current)

  function flashCopied() {
    setCopied(true)
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => { setCopied(false); timeout = null }, FLASH_MS)
    for (const l of [...listeners]) l()
  }

  async function confirm() {
    const format = exportable.formats[exportSel()].id
    const text = exportable.build(format)
    if (!text) return
    const ok = await writeClipboard(text)
    if (ok) {
      flashCopied()
      setShowExport(false)
    }
  }

  function handleKey(key: string): boolean {
    if (!showExport()) return false
    const n = exportable.formats.length
    if (key === "up") { setExportSel((exportSel() + n - 1) % n); return true }
    if (key === "down") { setExportSel((exportSel() + 1) % n); return true }
    if (key === "enter") { void confirm(); return true }
    if (key === "escape") { setShowExport(false); return true }
    if (key === "e") { setShowExport(false); return true }
    return false
  }

  createEffect(() => {
    if (!showExport()) return
    const cleanup = registerDialogKeyLayer(api, {
      priority: 2,
      bindings: [
        { key: "up",     cmd: "export.up",     desc: "Previous format" },
        { key: "down",   cmd: "export.down",   desc: "Next format" },
        { key: "enter", cmd: "export.confirm", desc: "Copy" },
        { key: "escape", cmd: "export.close",  desc: "Cancel" },
        { key: "e",      cmd: "export.toggle", desc: "Close" },
      ],
      commands: [
        { name: "export.up",      title: "Previous format", run: async () => { handleKey("up") } },
        { name: "export.down",    title: "Next format",     run: async () => { handleKey("down") } },
        { name: "export.confirm", title: "Copy",            run: async () => { handleKey("enter") } },
        { name: "export.close",   title: "Cancel",          run: async () => { handleKey("escape") } },
        { name: "export.toggle",  title: "Close",           run: async () => { handleKey("e") } },
      ],
    })
    onCleanup(cleanup)
  })

  onCleanup(() => {
    if (timeout) {
      clearTimeout(timeout)
      timeout = null
    }
  })

  function renderOverlay(): JSX.Element | null {
    if (!showExport()) return null
    return (
      <ExportOverlay
        formats={exportable.formats}
        selectedIndex={exportSel()}
        fg={colors.fg}
        muted={colors.muted}
        primary={colors.primary}
        selectedText={colors.selectedText}
        bg={colors.panel}
      />
    )
  }

  return {
    open: () => { setExportSel(0); setShowExport(true) },
    handleKey,
    renderOverlay,
    copiedFlash: copied,
    onCopied: (l) => { listeners.add(l); return () => listeners.delete(l) },
  }
}