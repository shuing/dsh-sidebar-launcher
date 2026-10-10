/**
 * Capability probes for the two DSH client generations this plugin runs on.
 *
 * ## Why probing, and not a version check
 *
 * The launcher ships as a source `link:` into more than one host profile, and the
 * two hosts differ in *shape*, not in name: 0.1.7-rc.2 exports `MenuItemButton`
 * and gives `sidebarRight` an observable `mounted` plus a `tabsIn(sessionId)`
 * lookup; 0.1.5-rc.2 has neither — its `mounted` is a plain method and its `Menu`
 * is `items`-driven. (`split()` and `openTab` exist on both, so placement no
 * longer branches by generation; see `placement.ts`.)
 *
 * A version string cannot be read from inside a browser bundle: `package.json`
 * is not in the client module table, and the host publishes no version on the
 * context. Even if it did, a *number* would be the wrong question — what matters
 * is which members and props actually exist on the objects this plugin was handed.
 * So every branch in this plugin is chosen by asking the live value a `typeof`
 * question, which is what this module centralizes. Nothing here reads a version.
 *
 * ## Why there is no `preferNewPane` probe
 *
 * There used to be one, aliased onto {@link hasTabInventory} because
 * `preferNewPane` is an *option value* inside an options object and `typeof`
 * cannot see inside one without calling `openTab` — a call that opens a real tab
 * in the user's UI and is therefore unthinkable as a probe. That alias was the
 * one known-weak branch in this layer.
 *
 * It is gone because the option itself is no longer used. `openTab({ preferNewPane: true })`
 * cannot split for a page kind that is already open in the target pane — the
 * host's `openContent` short circuits to `focusTab` before the split branch is
 * reached — so both generations now place a new pane with `split()` +
 * `openTab({ paneId })`. See `placement.ts` for the reducer excerpt. Removing
 * the option removes the need to guess at it, and with it the assumption.
 */
import { MenuItemButton } from '@deepseek-ai/dsh-client-ui-primitives'
import type { SidebarRightFace } from './context-types.ts'
import { isMountedObservableShape } from './host-access.ts'

/**
 * Whether the host's `Menu` renders component rows (`children` +
 * `listClassName`) rather than only data rows.
 *
 * `MenuItemButton` is the marker: it is the primitive that exists precisely to
 * let an owner render a `role="menuitem"` row as a component, and it arrived in
 * the same release as `Menu`'s `children` and `listClassName` props. On
 * 0.1.5-rc.2 the import resolves to `undefined` inside the module-table factory
 * rather than throwing, so this probe is a plain `typeof` check at module scope.
 *
 * @returns true when the modern, component-row menu path is available.
 */
export function hasMenuRows(): boolean {
  return typeof MenuItemButton === 'function'
}

/**
 * Whether `sidebarRight` exposes `tabsIn(sessionId)`.
 *
 * The method signature of the 0.1.5 controller has no `tabsIn`; 0.1.7 added it
 * as the cross-session tab inventory. When absent, the mounted surface's own
 * `layout.tabs` carries the same records — see `recent.ts`.
 *
 * @param sidebarRight - the right-Sidebar navigation face.
 * @returns true when the tab inventory lookup exists.
 */
export function hasTabInventory(sidebarRight: SidebarRightFace): boolean {
  return typeof sidebarRight.tabsIn === 'function'
}

/**
 * Whether `sidebarRight` is of the modern generation, i.e. whether `mounted` is
 * an observable snapshot source.
 *
 * @param sidebarRight - the right-Sidebar navigation face.
 * @returns true when `mounted` is an observable snapshot source.
 */
export function hasMountedObservable(sidebarRight: SidebarRightFace): boolean {
  return isMountedObservableShape(sidebarRight)
}

/** The service-backed capability set, read once per injection. */
export interface SidebarCapabilities {
  /** See {@link hasTabInventory}. */
  readonly hasTabInventory: boolean
  /** See {@link hasMountedObservable}. */
  readonly hasMountedObservable: boolean
  /** Whether `split()` exists, so the two-step new-pane path can be attempted. */
  readonly hasSplit: boolean
}

/**
 * Read every service-backed capability at once.
 *
 * Called once where `sidebarRight` is resolved (not per render), so a branch
 * taken while opening cannot disagree with the branch taken while drawing: both
 * read one object captured from one service instance.
 *
 * @param sidebarRight - the right-Sidebar navigation face.
 * @returns the capability set for this host generation.
 */
export function detectCapabilities(sidebarRight: SidebarRightFace): SidebarCapabilities {
  const hasTabInventoryCapability = hasTabInventory(sidebarRight)
  return {
    hasTabInventory: hasTabInventoryCapability,
    hasMountedObservable: hasMountedObservable(sidebarRight),
    hasSplit: typeof sidebarRight.split === 'function',
  }
}