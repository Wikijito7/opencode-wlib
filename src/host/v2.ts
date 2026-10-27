/**
 * opencode-wlib — OpenCode v2 host adapter (PRODUCTION).
 *
 * Built on the OpenCode 2.0.27 CLI plugin context (`@opencode/plugin/tui`).
 * This is the supported path going forward: consumers obtain the plugin
 * `Context` in `setup(context)` (or `usePlugin()`) and wrap it once with
 * `createV2Host(context)`, then hand that host to every wlib helper.
 *
 * The v1 adapter lives in `./v1` and is deprecated — do not import both.
 */

import type { Plugin } from "@opencode/plugin/tui"
import type { KeymapLayer } from "@opencode/plugin/tui/context"
import type {
  HostCommandOptions,
  HostDialog,
  HostDialogOptions,
  HostDimensions,
  HostRenderer,
  WlibHost,
} from "./types"
import type { KeyLayerConfig } from "../core/keys"
import type { SemanticThemePalette } from "../core/theme"
import { resolveSemanticTheme } from "../core/theme"

/**
 * v1 key names that differ from their v2 `bind` spelling.
 * v2 uses `return` for the enter key (see the host's own bindings, e.g.
 * `bind: "return"` in the TUI feature plugins); every other name wlib emits
 * (`escape`, arrows, `pageup`/`pagedown`, single letters) is identical.
 */
const V2_KEY_ALIASES: Record<string, string> = {
  enter: "return",
}

/** Normalize a wlib/v1 key spec to the v2 `bind` spelling. */
export function toV2Key(key: string): string {
  return V2_KEY_ALIASES[key] ?? key
}

/** Resolve the optional key binding (inline desc defaults to the title). */
function resolveKey(
  options: HostCommandOptions,
): { key: string; desc: string } | undefined {
  if (!options.key) return undefined
  return typeof options.key === "string"
    ? { key: options.key, desc: options.title }
    : options.key
}

/**
 * Map a wlib key layer config onto the v2 `KeymapLayer` shape.
 * Each wlib command becomes a v2 command carrying its `bind`; aliases that
 * share a `cmd` are merged into a comma-separated bind spec (v2 supports e.g.
 * `bind: "down,j,right,l"`). The layer's `bindings` ID list is unnecessary
 * because the commands own their bindings.
 *
 * `mode` defaults to `"global"`: on OpenCode 2.0.27 the active mode is `modal`
 * while a dialog is open and the host layer default is `base`, so a layer left
 * at that default is inactive exactly when its dialog is visible. An explicit
 * `config.mode` still wins, preserving the caller's override.
 */
export function toV2Layer(config: KeyLayerConfig): KeymapLayer {
  const keysByCmd = new Map<string, string[]>()
  for (const binding of config.bindings) {
    const keys = keysByCmd.get(binding.cmd) ?? []
    keys.push(toV2Key(binding.key))
    keysByCmd.set(binding.cmd, keys)
  }
  return {
    mode: config.mode ?? "global",
    ...(config.priority !== undefined ? { priority: config.priority } : {}),
    commands: config.commands.map((command) => {
      const keys = keysByCmd.get(command.name)
      return {
        id: command.name,
        title: command.title,
        ...(keys && keys.length ? { bind: keys.join(",") } : {}),
        run: () => {
          void command.run()
        },
      }
    }),
  }
}

/** Create the v2 host adapter from a plugin `Context`. */
export function createV2Host(context: Plugin.Context): WlibHost<SemanticThemePalette> {
  // `context.renderer` is required on the v2 Context (see `Plugin.Context`).
  // `CliRenderer` exposes the live geometry as `terminalWidth`/`terminalHeight`;
  // its `resize` event carries no width/height payload, so a listener must
  // re-read the current geometry when it fires.
  const readDimensions = (): HostDimensions => ({
    width: context.renderer.terminalWidth,
    height: context.renderer.terminalHeight,
  })

  const renderer: HostRenderer = {
    read: readDimensions,
    subscribe: (listener) => {
      const handler = () => listener(readDimensions())
      context.renderer.on("resize", handler)
      return () => context.renderer.off("resize", handler)
    },
  }

  const dialog: HostDialog = {
    show: (render, onClose) => context.ui.dialog.show(render, onClose),
    set: (options: HostDialogOptions) =>
      context.ui.dialog.set({
        ...(options.size ? { size: options.size } : {}),
        ...(options.centered !== undefined ? { centered: options.centered } : {}),
      }),
    clear: () => context.ui.dialog.clear(),
  }

  return {
    kind: "v2",
    registerCommand: (options: HostCommandOptions) => {
      const binding = resolveKey(options)
      // `keymap.layer` is reactive: the layer belongs to the computation that
      // created it and is disposed automatically, so there is no cleanup handle.
      // `mode: "global"` keeps palette/slash commands and their key bindings
      // reachable in every input mode — without it the 2.0.27 host defaults the
      // layer to `base`, which is inactive while a dialog pushes `modal`.
      context.keymap.layer(() => ({
        mode: "global",
        commands: [
          {
            id: options.name,
            title: options.title,
            group: options.group ?? "Plugin",
            palette: true,
            ...(options.slashName ? { slash: { name: options.slashName } } : {}),
            ...(binding ? { bind: toV2Key(binding.key) } : {}),
            run: () => {
              void options.run()
            },
          },
        ],
      }))
      return () => {}
    },
    keymapLayer: (config: KeyLayerConfig) => {
      context.keymap.layer(() => toV2Layer(config))
      return () => {}
    },
    dialog,
    renderer,
    theme: (): SemanticThemePalette => resolveSemanticTheme(context.theme),
  }
}
