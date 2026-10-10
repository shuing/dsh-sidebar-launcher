/**
 * Placing a tab: how a row's left/right gesture reaches the host's panes.
 *
 * This lives in its own module rather than inside `index.tsx` for two reasons.
 * It is the only part of the plugin that has to *reconcile* two host generations
 * rather than merely read from them, so it is the part most worth reading and
 * testing in isolation; and keeping it out of the component file means the
 * cross-host evidence can drive it directly, without mounting React.
 *
 * ## One placement intent, both generations
 *
 * The caller names the pane it wants — `'left'`, `'right'`, or `'single'` —
 * and this module reaches it the same way on both hosts:
 *
 * 1. **`single`** — one `openTab(kind)`. Used when the right column is
 *    collapsed or only one docked pane exists. The host itself expands the
 *    column and shows the tab, so this path must never be skipped: a collapsed
 *    column that returned early is the "clicked and nothing happened" defect.
 * 2. **`left`** — `openTab(kind, { paneId: leftPaneId })`, falling back to a
 *    plain `openTab(kind)` when the DOM could not name the pane.
 * 3. **`right`** — the right pane if one already exists; otherwise `split()`
 *    and then open into the pane it created.
 *
 * ## Why BOTH generations split now, instead of 0.1.7 using `preferNewPane`
 *
 * 0.1.7's `openTab(kind, { preferNewPane: true })` does not work for a kind that
 * is already open in the target pane, and that is a host-side short circuit,
 * not a misread option. In the host's `openContent` reducer:
 *
 *     const held = page ? panePage(state, paneId ?? activeDockPaneId(state), kind) : void 0
 *     const revealed = page ? held : …
 *     const split = intent.preferNewPane === true && replace === void 0
 *                   && revealed === void 0 ? planSplitPane(…) : []
 *
 * A page kind (`sidebar://<kind>`) already showing in the target pane makes
 * `held` — and therefore `revealed` — non-undefined, so the `split` branch is
 * skipped entirely and the intent collapses to `focusTab`. Requesting
 * "prefer a new pane" for an already-open kind could therefore only ever focus
 * the existing tab; it could not split. `split()` + `openTab(kind, { paneId })`
 * sidesteps that because the new pane is empty when the open runs, so `held` is
 * empty and the tab is genuinely placed there.
 *
 * A dividend of dropping the option: the `hasPreferNewPane` capability probe is
 * gone as well. That probe was the one *known-weak* branch in the compatibility
 * layer — `preferNewPane` is an option value inside an object, so `typeof`
 * cannot see it, and the probe had to stand in the same API wave as
 * `tabsIn`. Removing the branch removes the assumption.
 *
 * ## The seed, and why the lookup is deferred
 *
 * `split()` seeds the pane it creates with the host's default page: the sole
 * guide entry when exactly one type is registered, else the built-in `guide`
 * kind. Left alone, that would leave a stray tab next to the one the user asked
 * for. The seed is therefore identified and replaced via `replaceTab`.
 *
 * The seed is identified as *the page tab the split added*, not by reading a
 * layout tree: the host's public API publishes flat `{id, kind, contentId}`
 * records with no pane ownership (`tabsIn` on 0.1.7-rc.2, the mounted surface
 * on 0.1.5-rc.2 — both handled by `host-access.ts`). Taking the set difference
 * across the split answers "which tab is new" on either generation, which is
 * exactly the seed, without inventing a pane-membership API the host lacks.
 *
 * The lookup is retried once at the microtask checkpoint, after React's event
 * flush has republished the host's view: on 0.1.5, `mounted()` returns the
 * render snapshot the seat captured, and that snapshot is only replaced when the
 * split's render commits. Until some tab the split added is visible, the read is
 * `stale` rather than "no seed".
 *
 * That ordering is the one place this layer depends on a sequence it cannot
 * assert from the host's API, so it is called out plainly: should the publish
 * slip past the checkpoint, the fallback is `{ paneId }` without `replaceTab`,
 * leaving the host's seeded tab in the new pane for that open. The failure is
 * visible and contained — it never closes or replaces content the user chose.
 */
import type { SidebarCapabilities } from './capabilities.ts'
import type { SidebarRightFace } from './context-types.ts'
import { mountedTabRecords } from './host-access.ts'

/**
 * The scheme a *page* address carries, as opposed to a resource's
 * `dsh-resource://`. The host records pages at `sidebar://<kind>`, which is what
 * makes a seeded tab identifiable.
 */
const PAGE_SCHEME = 'sidebar://'

/** The pane a row's gesture asked for. */
export type PlacementTarget = 'left' | 'right' | 'single'

/**
 * The panes on screen at the moment of the open, read from the DOM.
 *
 * Deliberately a per-open value rather than part of `SidebarCapabilities`:
 * capabilities describe the *shape* of the host and are captured once, while
 * which panes exist changes with every split. A stale paneId would place a tab
 * into a pane that no longer exists.
 */
export interface PlacementPanes {
  /** The first docked pane, or undefined when no pane is on screen. */
  readonly leftPaneId?: string
  /** The last docked pane, or undefined when there is only one. */
  readonly rightPaneId?: string
}

/**
 * What one read of the host's tab records can say about the freshly split pane.
 *
 * The three cases are genuinely different and are kept apart, because conflating
 * the last two would defer a decision that was already settled:
 *
 * - `stale` — the split's own tab is not visible yet, so this read is the
 *   pre-split inventory and says nothing about the seed. Retry later.
 * - `ready` — a tab the split added IS visible, so the inventory is post-split:
 *   whatever it holds is the final word, including "no page tab here".
 */
type SeedRead =
  | { readonly state: 'stale' }
  | { readonly state: 'ready'; readonly tabId?: string }

/**
 * Read the seed out of one post-split inventory.
 *
 * `before` is the set of tab ids that were open before the split. Any id not in
 * it was added by the split; the first of those that is a page address is the
 * seed. A non-page tab among the newcomers is deliberately not taken for one: a
 * resource opened from a file carries `dsh-resource://`, and replacing it would
 * close content the user asked to keep.
 *
 * @param capabilities - the capability set read from this host.
 * @param sidebarRight - the right-Sidebar navigation face.
 * @param before - every tab id open before the split.
 * @returns whether the read was usable, and the seed tab's id when there is one.
 */
function readSeed(
  capabilities: SidebarCapabilities,
  sidebarRight: SidebarRightFace,
  before: ReadonlySet<string>,
): SeedRead {
  let sawNewTab = false
  for (const record of mountedTabRecords(capabilities, sidebarRight)) {
    if (before.has(record.id)) continue
    sawNewTab = true
    if (record.contentId.startsWith(PAGE_SCHEME)) return { state: 'ready', tabId: record.id }
  }
  // Nothing new is visible: the inventory predates the split (or the split's
  // commit has not reached this generation's publish point yet). Retry later.
  if (!sawNewTab) return { state: 'stale' }
  // The split added tab(s), none of them a page: a settled "no seed", not a
  // missing answer.
  return { state: 'ready' }
}

/**
 * Every tab id currently open in the mounted session.
 *
 * Read immediately before a `split()` so the difference across the call names
 * the seed. An empty set is a valid answer (nothing was open), not a failure.
 *
 * @param capabilities - the capability set read from this host.
 * @param sidebarRight - the right-Sidebar navigation face.
 * @returns the ids, as a set for a cheap membership test.
 */
function openTabIds(
  capabilities: SidebarCapabilities,
  sidebarRight: SidebarRightFace,
): ReadonlySet<string> {
  return new Set(mountedTabRecords(capabilities, sidebarRight).map(record => record.id))
}

/**
 * Find the tab a fresh split seeded, so it can be replaced.
 *
 * An `undefined` return means either "no page tab" or "cannot tell yet"; a
 * caller that must act differently on those two should use {@link readSeed},
 * which this exposes the positive case of.
 *
 * @param capabilities - the capability set read from this host.
 * @param sidebarRight - the right-Sidebar navigation face.
 * @param before - every tab id open before the split.
 * @returns the seeded tab's id, or undefined when there is none or it is not visible.
 */
export function findSeededTabId(
  capabilities: SidebarCapabilities,
  sidebarRight: SidebarRightFace,
  before: ReadonlySet<string>,
): string | undefined {
  const read = readSeed(capabilities, sidebarRight, before)
  return read.state === 'ready' ? read.tabId : undefined
}

/**
 * Open a kind into the pane the gesture asked for. See the module header for
 * the three targets and the seed deferral.
 *
 * @param capabilities - the capability set read from this host.
 * @param sidebarRight - the right-Sidebar navigation face.
 * @param kind - the tab kind to open.
 * @param target - the pane the gesture wants: the left pane, the right pane, or
 *   the only pane there is (a collapsed column included).
 * @param panes - the pane ids on screen for THIS open, read from the DOM just
 *   before the call; see {@link PlacementPanes}.
 * @returns nothing; the host owns every layout decision.
 */
export function openKind(
  capabilities: SidebarCapabilities,
  sidebarRight: SidebarRightFace,
  kind: string,
  target: PlacementTarget,
  panes: PlacementPanes,
): void {
  if (target === 'single') {
    // Deliberately unconditional: the host expands a collapsed column and
    // reveals the tab itself. Returning early here is the "clicked and nothing
    // happened" defect, so this branch never checks `isExpanded`.
    sidebarRight.openTab(kind)
    return
  }

  if (target === 'left') {
    const paneId = panes.leftPaneId
    if (paneId === undefined) {
      sidebarRight.openTab(kind)
      return
    }
    sidebarRight.openTab(kind, { paneId })
    return
  }

  // ---- target === 'right' ----
  const existingRight = panes.rightPaneId
  if (existingRight !== undefined) {
    sidebarRight.openTab(kind, { paneId: existingRight })
    return
  }

  const split = sidebarRight.split
  if (split === undefined) {
    sidebarRight.openTab(kind)
    return
  }

  const before = openTabIds(capabilities, sidebarRight)
  const paneId = split.call(sidebarRight, panes.leftPaneId)
  if (paneId === undefined) {
    // Refused by the host's budget/room rule: the same silent fallback its own
    // split control takes. No notice — duplicating that rule here would be a
    // second source of truth that could disagree with the host.
    sidebarRight.openTab(kind)
    return
  }

  const read = readSeed(capabilities, sidebarRight, before)
  if (read.state === 'ready') {
    sidebarRight.openTab(kind, read.tabId === undefined
      ? { paneId, revealIfOpened: false }
      : { paneId, revealIfOpened: false, replaceTab: read.tabId })
    return
  }

  // Stale inventory (see the header): retry once the flush has republished the
  // host's records, still before the next paint is scheduled.
  queueMicrotask(() => {
    const late = readSeed(capabilities, sidebarRight, before)
    const tabId = late.state === 'ready' ? late.tabId : undefined
    sidebarRight.openTab(kind, tabId === undefined
      ? { paneId, revealIfOpened: false }
      : { paneId, revealIfOpened: false, replaceTab: tabId })
  })
}
