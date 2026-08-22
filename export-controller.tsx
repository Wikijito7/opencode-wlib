/** @jsxImportSource @opentui/solid */
/**
 * opencode-wlib — reusable export controller.
 *
 * Host-agnostic controller that owns the export flow state machine: the
 * format step, the destination step (clipboard vs file), the "copied!" flash,
 * and the file-write result popup. It registers a priority-2 key layer, writes
 * to the clipboard or disk, and exposes overlay renderers. Host plugins call
 * `renderOverlay()` for the format/destination popup, `renderResultOverlay()`
 * for the file-save result popup, and `copiedFlash()`/`onCopied` to render
 * the footer flash.
 *
 * Must be created inside a Solid owner (i.e. from within a dialog render)
 * because it registers a `createEffect` + `onCleanup` for the key layer
 * and the flash timeout.
 */

import { createEffect, createSignal, onCleanup, type JSX } from "solid-js"
import { dirname } from "node:path"
import type { TuiPluginApi } from "@opencode-ai/plugin/tui"
import { formatToExtension, type Exportable } from "./export"
import { ExportOverlay, type ExportOverlayOption } from "./export-overlay"
import { ExportResultOverlay } from "./export-result-overlay"
import { exportKeyAction, cycleExportIndex } from "./export-state"
import { writeClipboard } from "./clipboard"
import { exportFilePath, writeFile, timestamp, EXPORT_BASE_DIR } from "./file"
import { openFolder } from "./open-folder"
import { registerDialogKeyLayer } from "./keys"
import { resolveThemeColors } from "./theme"

export interface ExportController {
  open(): void
  handleKey(key: string): boolean
  renderOverlay(): JSX.Element | null
  renderResultOverlay(): JSX.Element | null
  copiedFlash(): boolean
  onCopied(listener: () => void): () => void
}

export interface ExportControllerOptions {
  /** Dialog name used to prefix exported filenames (e.g. "usage", "analyze"). */
  name: string
  /** Directory to save files to. Defaults to `~/.config/opencode/export`. */
  exportDir?: string
}

const FLASH_MS = 2000
const DEST_OPTIONS: ExportOverlayOption[] = [
  { id: "clipboard", label: "Clipboard" },
  { id: "file", label: "File" },
]

type ExportStep = "format" | "destination" | "result"

export function createExportController(api: TuiPluginApi, exportable: Exportable, opts: ExportControllerOptions): ExportController {
  const [showExport, setShowExport] = createSignal(false)
  const [showResult, setShowResult] = createSignal(false)
  const [step, setStep] = createSignal<ExportStep>("format")
  const [exportSel, setExportSel] = createSignal(0)
  const [destSel, setDestSel] = createSignal(0)
  const [resultPath, setResultPath] = createSignal<string | null>(null)
  const [resultError, setResultError] = createSignal(false)
  const [resultFocus, setResultFocus] = createSignal<0 | 1>(0)
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

  function close() {
    setShowExport(false)
    setShowResult(false)
  }

  async function doClipboard() {
    if (!exportable.formats.length) return
    const format = exportable.formats[exportSel()].id
    const text = exportable.build(format)
    if (!text) return
    const ok = await writeClipboard(text)
    if (ok) {
      flashCopied()
      close()
    }
  }

  async function doFile() {
    if (!exportable.formats.length) return
    const format = exportable.formats[exportSel()].id
    const text = exportable.build(format)
    if (!text) return
    const ext = formatToExtension(format)
    const ts = timestamp()
    const filePath = exportFilePath(opts.name, ext, ts, opts.exportDir ?? EXPORT_BASE_DIR)
    const ok = await writeFile(filePath, text)
    if (ok) {
      setResultPath(filePath)
      setResultError(false)
    } else {
      setResultPath(null)
      setResultError(true)
    }
    setResultFocus(0)
    setStep("result")
    setShowResult(true)
    setShowExport(false)
  }

  async function openFolderAndClose() {
    const p = resultPath()
    if (p) await openFolder(dirname(p))
    close()
  }

  function handleKey(key: string): boolean {
    if (step() === "format") {
      const action = exportKeyAction(key, true)
      switch (action) {
        case "navigate-up":
          setExportSel(cycleExportIndex(exportSel(), -1, exportable.formats.length))
          return true
        case "navigate-down":
          setExportSel(cycleExportIndex(exportSel(), 1, exportable.formats.length))
          return true
        case "confirm":
          setStep("destination")
          setDestSel(0)
          return true
        case "close":
          close()
          return true
        case "none":
          return false
      }
    }

    if (step() === "destination") {
      if (key === "up" || key === "k") {
        setDestSel(cycleExportIndex(destSel(), -1, 2))
        return true
      }
      if (key === "down" || key === "j") {
        setDestSel(cycleExportIndex(destSel(), 1, 2))
        return true
      }
      if (key === "enter") {
        if (destSel() === 0) void doClipboard()
        else void doFile()
        return true
      }
      if (key === "escape") {
        setStep("format")
        return true
      }
      if (key === "e") {
        close()
        return true
      }
      return false
    }

    if (step() === "result") {
      if (key === "left" || key === "h") {
        setResultFocus(0)
        return true
      }
      if (key === "right" || key === "l") {
        setResultFocus(1)
        return true
      }
      if (key === "enter") {
        if (resultFocus() === 1) void openFolderAndClose()
        else close()
        return true
      }
      if (key === "escape") {
        close()
        return true
      }
      if (key === "o") {
        void openFolderAndClose()
        return true
      }
      return false
    }

    return false
  }

  createEffect(() => {
    if (!(showExport() || showResult())) return
    const cleanup = registerDialogKeyLayer(api, {
      priority: 2,
      bindings: [
        { key: "up",     cmd: "export.up",     desc: "Previous" },
        { key: "down",   cmd: "export.down",   desc: "Next" },
        { key: "left",   cmd: "export.left",   desc: "Close result" },
        { key: "right",  cmd: "export.right",  desc: "Open result" },
        { key: "enter", cmd: "export.confirm", desc: "Confirm" },
        { key: "escape", cmd: "export.close",  desc: "Cancel" },
        { key: "e",      cmd: "export.toggle", desc: "Close" },
        { key: "o",      cmd: "export.open",   desc: "Open folder" },
      ],
      commands: [
        { name: "export.up",      title: "Previous",     run: async () => { handleKey("up") } },
        { name: "export.down",    title: "Next",         run: async () => { handleKey("down") } },
        { name: "export.left",    title: "Close result", run: async () => { handleKey("left") } },
        { name: "export.right",   title: "Open result",  run: async () => { handleKey("right") } },
        { name: "export.confirm", title: "Confirm",      run: async () => { handleKey("enter") } },
        { name: "export.close",   title: "Cancel",       run: async () => { handleKey("escape") } },
        { name: "export.toggle",  title: "Close",        run: async () => { handleKey("e") } },
        { name: "export.open",    title: "Open folder",  run: async () => { handleKey("o") } },
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
    if (step() !== "format" && step() !== "destination") return null
    return (
      <ExportOverlay
        title={step() === "format" ? "Export" : "Export to"}
        formats={step() === "format" ? exportable.formats : DEST_OPTIONS}
        selectedIndex={step() === "format" ? exportSel() : destSel()}
        footer={step() === "format" ? "↑↓ choose · enter continue" : "↑↓ choose · enter confirm · esc back"}
        fg={colors.fg}
        muted={colors.muted}
        primary={colors.primary}
        selectedText={colors.selectedText}
        bg={colors.panel}
      />
    )
  }

  function renderResultOverlay(): JSX.Element | null {
    if (!showResult()) return null
    return (
      <ExportResultOverlay
        path={resultPath()}
        error={resultError()}
        focus={resultFocus()}
        fg={colors.fg}
        muted={colors.muted}
        primary={colors.primary}
        selectedText={colors.selectedText}
        bg={colors.panel}
      />
    )
  }

  return {
    open: () => {
      setStep("format")
      setExportSel(0)
      setDestSel(0)
      setShowExport(true)
      setShowResult(false)
    },
    handleKey,
    renderOverlay,
    renderResultOverlay,
    copiedFlash: copied,
    onCopied: (l) => { listeners.add(l); return () => listeners.delete(l) },
  }
}