/**
 * tsdown build for dsh-sidebar-launcher.
 *
 * Two artifacts:
 *
 * - `lib/index.js` — the host half, plain ESM for Node.
 * - `lib/client.js` — the browser half, as the client module loader expects it:
 *   a CJS closure registered through `window.__ModuleLoader__.load({ id, factory })`
 *   under the package name. `dsh-client-modules` keys the boot graph on that
 *   name, so it must match `package.json`.
 *
 * The manifest list and the closure shape mirror the platform's own client-bundle
 * preset. Two rules from it are load-bearing here:
 *
 * - Module-table entries stay external (they resolve through the loader at
 *   runtime, shared with every other plugin); everything else is inlined.
 * - The purity gate refuses any other `@deepseek-ai/*` value import, so this
 *   plugin collaborates through cordis services and slot keys only. Type-only
 *   imports are erased before the gate sees them.
 *
 * CSS is compiled to class-name maps and injected as `<style data-plugin>` tags
 * when the factory runs, which is why the stylesheet goes through the virtual
 * module plugin rather than tsdown's own CSS pipeline.
 */
import { readFile } from 'node:fs/promises'
import { builtinModules } from 'node:module'
import { basename } from 'node:path'
import type { UserConfig } from 'tsdown'

/** The plugin id: the loader's factory key, the style-tag owner, and the report name. */
const PLUGIN_ID = 'dsh-sidebar-launcher'

/**
 * Specifiers the web shell shares through its frozen module table. These stay
 * external; a value import of anything else under `@deepseek-ai/*` is a bug this
 * build refuses to ship.
 */
const CLIENT_EXTERNALS = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  'cordis',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
]

/** Node builtins must never reach a browser bundle. */
const NODE_BUILTINS = new Set([
  ...builtinModules,
  ...builtinModules.map(id => `node:${id}`),
])

const CSS_VIRTUAL_PREFIX = '\0dsh-css:'
const CSS_VIRTUAL_SUFFIX = '.mjs'

/** A rolldown plugin as tsdown's config accepts it. */
type BuildPlugin = NonNullable<UserConfig['plugins']>

/**
 * The style-injection prologue for one stylesheet.
 * @param fileId - absolute path of the source stylesheet.
 * @param cssText - its compiled text.
 * @returns the module body that installs the tag once.
 */
function injectTag(fileId: string, cssText: string): string {
  const tagId = `${PLUGIN_ID}/${basename(fileId)}`
  return [
    `const css = ${JSON.stringify(cssText)};`,
    `const tagId = ${JSON.stringify(tagId)};`,
    `if (typeof document !== 'undefined' && document.querySelector('style[data-plugin-css=' + JSON.stringify(tagId) + ']') === null) {`,
    `  const tag = document.createElement('style');`,
    `  tag.dataset.plugin = ${JSON.stringify(PLUGIN_ID)};`,
    `  tag.dataset.pluginCss = tagId;`,
    `  tag.textContent = css;`,
    `  document.head.appendChild(tag);`,
    `}`,
  ].join('\n')
}

/** The shared client-bundle purity gate. */
function purityGatePlugin(): BuildPlugin {
  return {
    name: 'dsh-client-bundle-purity',
    resolveId(source: string) {
      if (NODE_BUILTINS.has(source)) {
        throw new Error(
          `client bundle purity: Node builtin "${source}" cannot run in the browser module table`,
        )
      }
      if (!source.startsWith('@deepseek-ai/')) return null
      if (CLIENT_EXTERNALS.includes(source)) return null
      // Anything else from the platform either belongs in CLIENT_EXTERNALS (a
      // module-table entry) or is a cross-plugin value import, which this plugin
      // must not make: type-only imports never reach this hook.
      throw new Error(
        `client bundle purity: "${source}" is neither a module-table entry nor this plugin's own code — `
        + 'collaborate through cordis services and slot keys (type-only imports are erased and never reach this gate)',
      )
    },
  }
}

/**
 * Inline a stylesheet as an injected `<style>` tag.
 *
 * Class names in this plugin's stylesheet are literal and plugin-prefixed, so
 * there is no class map and no scoping transform: the module resolves to the
 * stylesheet text, installed once per document.
 * @returns the plugin.
 */
function cssPlugin(): BuildPlugin {
  return {
    name: 'dsh-css-inline',
    async resolveId(source: string, importer: string | undefined) {
      if (!source.endsWith('.css')) return null
      const base = importer === undefined ? process.cwd() : importer
      const { createRequire } = await import('node:module')
      const require = createRequire(base)
      const { dirname, resolve: resolvePath } = await import('node:path')
      const abs = source.startsWith('.') || source.startsWith('/') || /^[A-Za-z]:[\\/]/.test(source)
        ? resolvePath(dirname(base), source)
        : require.resolve(source)
      return CSS_VIRTUAL_PREFIX + abs + CSS_VIRTUAL_SUFFIX
    },
    async load(virtualId: string) {
      if (!virtualId.startsWith(CSS_VIRTUAL_PREFIX)) return null
      const fileId = virtualId.slice(CSS_VIRTUAL_PREFIX.length, -CSS_VIRTUAL_SUFFIX.length)
      this.addWatchFile(fileId)
      const raw = await readFile(fileId, 'utf8')
      return { code: injectTag(fileId, raw), moduleSideEffects: true }
    },
  }
}

const config: UserConfig[] = [
  {
    entry: { index: 'src/index.ts' },
    outDir: 'lib',
    format: 'esm',
    platform: 'node',
    dts: false,
    sourcemap: true,
    clean: false,
    outputOptions: {
      // `package.json` points `main`/`exports` at `lib/index.js`; keep the
      // emitted extension in step with it.
      entryFileNames: 'index.js',
    },
  },
  {
    entry: { client: 'src/client/index.tsx' },
    outDir: 'lib',
    format: 'cjs',
    platform: 'browser',
    dts: false,
    sourcemap: true,
    clean: false,
    external: [...CLIENT_EXTERNALS],
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
      'import.meta.env.MODE': JSON.stringify(process.env.NODE_ENV ?? 'production'),
      'import.meta.env': JSON.stringify({ MODE: process.env.NODE_ENV ?? 'production' }),
      'import.meta.resolve': 'undefined',
    },
    inputOptions: {
      resolve: {
        conditionNames: ['browser', 'import', 'require', 'default'],
      },
    },
    noExternal: (id: string) => (CLIENT_EXTERNALS.includes(id) ? undefined : true),
    plugins: [purityGatePlugin(), cssPlugin()],
    outputOptions: {
      entryFileNames: 'client.js',
      // The closure factory shape the loader materializes: `require` resolves
      // module-table entries, and `module.exports` carries `apply`/`inject`.
      banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(PLUGIN_ID)}, factory: (require) => {`,
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
      // The factory's `require` only resolves module-table entries; it cannot
      // fetch relative chunk URLs, so every artifact is one script.
      codeSplitting: false,
    },
  },
]

export default config
