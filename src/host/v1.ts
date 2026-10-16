/**
 * opencode-wlib — OpenCode v1 host adapter (DEPRECATED).
 *
 * The v1 plugin API (`@opencode-ai/plugin/tui`) is not supported by OpenCode
 * v2. This adapter exists only for a transition window so v1 consumers can
 * keep working while they port; it will be removed in the v2 cleanup
 * (opencode-wlib#5). Do not import it alongside `./v2`.
 *
 * It is typed structurally against the subset of the v1 `TuiPluginApi` it
 * needs, rather than importing the (version-drifting) package type. A real
 * `TuiPluginApi` value satisfies `V1HostApi` as-is.
 *
 * @deprecated Use `createV2Host` from `./v2`.
 */

import type { JSX } from "solid-js"
import type { DialogSize } from "../core/dialog-fit"
import type { HostCommandOptions, HostDialog, HostDimensions, HostRenderer, WlibHost } from "./types"
import type { KeyBinding, KeyLayerConfig } from "../core/keys"
import type { ThemePalette } from "../core/theme"
import { resolveThemeColors } from "../core/theme"

/** A v1 palette command (wider than the wlib `KeyCommand`: carries palette metadata). */
interface V1Command {
  name: string
  title: string
  category?: string
  namespace?: string
  slashName?: string
  run: () => Promise<void> | void
}

/** The subset of the v1 `keymap.registerLayer` config this adapter produces. */
interface V1LayerConfig {
  commands: V1Command[]
  bindings: KeyBinding[]
  priority?: number
}

/**
 * The subset of the OpenCode v1 `TuiPluginApi` this adapter needs.
 * Structural on purpose — a real v1 API object is assignable to it.
 */
export interface V1HostApi {
  keymap: {
    registerLayer(config: V1LayerConfig): () => void
  }
  ui: {
    dialog: {
      replace(render: () => JSX.Element, onClose?: () => void): void
      setSize(size: DialogSize): void
      clear(): void
    }
  }
  theme?: { current?: Record<string, unknown> }
  renderer?: {
    width?: number
    height?: number
    on(event: "resize", listener: (width: number, height: number) => void): void
    off(event: "resize", listener: (width: number, height: number) => void): void
  }
}

function resolveKey(
  options: HostCommandOptions,
): { key: string; desc: string } | undefined {
  if (!options.key) return undefined
  return typeof options.key === "string"
    ? { key: options.key, desc: options.title }
    : options.key
}

/**
 * Create the deprecated v1 host adapter from a v1 `TuiPluginApi`.
 * @deprecated Use `createV2Host` from `./v2`.
 */
export function createV1Host(api: V1HostApi): WlibHost<ThemePalette> {
  const renderer: HostRenderer = {
    read: (): HostDimensions => ({
      width: api.renderer?.width ?? 0,
      height: api.renderer?.height ?? 0,
    }),
    subscribe: (listener) => {
      const handler = (width: number, height: number) => listener({ width, height })
      api.renderer?.on("resize", handler)
      return () => api.renderer?.off("resize", handler)
    },
  }

  const dialog: HostDialog = {
    show: (render, onClose) => api.ui.dialog.replace(render, onClose),
    set: (options) => {
      if (options.size) api.ui.dialog.setSize(options.size)
    },
    clear: () => api.ui.dialog.clear(),
  }

  return {
    kind: "v1",
    registerCommand: (options: HostCommandOptions) => {
      const binding = resolveKey(options)
      return api.keymap.registerLayer({
        commands: [
          {
            name: options.name,
            title: options.title,
            category: options.group ?? "Plugin",
            namespace: "palette",
            ...(options.slashName ? { slashName: options.slashName } : {}),
            run: options.run,
          },
        ],
        bindings: binding
          ? [{ key: binding.key, cmd: options.name, desc: binding.desc }]
          : [],
      })
    },
    keymapLayer: (config: KeyLayerConfig) => {
      // v1 has no keymap-mode concept. Pass the config through unchanged
      // (identity preserved for the common, mode-less case) and drop the
      // v2-only `mode` field only when a caller actually set one.
      if (config.mode === undefined) return api.keymap.registerLayer(config)
      const { mode: _mode, ...v1Config } = config
      return api.keymap.registerLayer(v1Config)
    },
    dialog,
    renderer,
    theme: (): ThemePalette => resolveThemeColors(api.theme?.current),
  }
}
