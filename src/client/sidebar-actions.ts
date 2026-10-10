/**
 * The sidebar-operations menu's *mechanics*: what is open, and how to close it.
 *
 * Everything in this module is deliberately free of React and of the host
 * primitives, so it can be unit-tested under jsdom against both host generations'
 * markup without mounting anything. The component that draws the menu
 * (`sidebar-action-menu.tsx`) and the owner that wires it (`index.tsx`) both go
 * through here, which is what keeps the "which tabs am I about to close" question
 * answered in exactly one place.
 *
 * ## Why the docked/floating split is computed the way it is
 *
 * The host exposes `ISidebarRight.close(tabId)` and nothing else: no `closeAll`,
 * no `closePane`, no `mergePane`, and no layout tree on the public face.
 * `tabsIn(sessionId)` returns flat `{sessionId, tabId, kind, contentId}` records
 * with **no pane ownership**, so "the left pane" cannot be read from the API at
 * all. Two consequences shape this file:
 *
 * 1. **Docked grouping is the one and only DOM dependency.** It comes from
 *    `[data-dockkit-pane]`, ordered left to right by the host's own
 *    `data-dockkit-column` (falling back to measured geometry when that is
 *    absent). Document order is deliberately *not* used: on 0.1.7+ the grid
 *    renderer emits panes sorted by active tab id, which has nothing to do with
 *    left and right. See {@link orderPanesLeftToRight}. Only the two "clear one
 *    pane" rows depend on the order; the other four do not.
 * 2. **Floating tabs are a set difference, never a DOM scan.** A float's header
 *    carries `data-dockkit-float-grip` / `-title` / `-dock` / `-close` but **no**
 *    `data-dockkit-tab`, so a floating tab's id is not recoverable from its own
 *    markup. It is recoverable as *API total minus docked*, which is also the
 *    honest definition: a tab is floating exactly when it is open somewhere other
 *    than a docked pane.
 *
 * ## A live-measured correction to the brief's DOM contract
 *
 * The brief's §5.4 table lists `[data-sidebar-right-session]` as the session
 * container. **That attribute exists only on 0.1.7-rc.2.** A live probe of the
 * running Tavern host (0.1.5-rc.2), with the column expanded and tabs open, found
 * zero such elements; there the panel itself carries
 * `[data-sidebar-right-panel]` + `[data-sidebar-right-open]` and the panes hang
 * under `[data-dockkit-surface]`. So the root resolver below accepts **either**
 * container attribute and is not tied to a version; see {@link paneRoot}.
 *
 * ## Closing is not atomic, so the id list is snapshotted first
 *
 * `close(tabId)` runs the tab kind's own `closeHandler` and only then commits
 * (`removeAfterCleanup`). Both current hosts commit synchronously, but React
 * batches the resulting render, so **the DOM does not reflect a close until the
 * handler that triggered it returns**. Any loop that re-read the layout between
 * closes would therefore re-close the same tabs, or miss the ones after it. Every
 * entry point here reads its ids once, up front, and only then closes.
 */
import { isMountedObservableShape } from './host-access.ts'
import type { SidebarRightFace, TabRecordLike } from './context-types.ts'

/** A tab's identity and kind, as the close guard needs them. */
export interface TabIdentity {
  readonly id: string
  readonly kind: string
}

/** The docked panes, read from the DOM. See the module header. */
export interface DockGroups {
  /** How many docked panes are on screen (0, 1, or 2 under the host's budget). */
  readonly count: number
  /** The tab ids of the leftmost docked pane, or `[]`. */
  readonly left: readonly string[]
  /** The tab ids of the rightmost docked pane, or `[]` when there is only one. */
  readonly right: readonly string[]
  /** Every docked tab id, pane order preserved. */
  readonly all: readonly string[]
  /**
   * The paneIds of every docked pane, left to right, matching {@link left} /
   * {@link right} / {@link all} index for index.
   *
   * Kept apart from the tab-id groups on purpose: those answer "what is open,
   * and where" for the menu's enabled/disabled rows, while a paneId is what
   * `openTab` needs in order to *place* a tab. Both come from the same DOM
   * read, so the two views can never describe a different layout.
   */
  readonly paneIds: readonly string[]
  /** The id of the leftmost docked pane, or undefined when no pane is on screen. */
  readonly leftPaneId?: string
  /** The id of the rightmost docked pane, or undefined when there is only one. */
  readonly rightPaneId?: string
}

/** The containers a docked pane can hang under, either host generation. */
const PANE_ROOT_SELECTORS = [
  // 0.1.7-rc.2: the panel and the outer Session seat both carry this.
  '[data-sidebar-right-session]',
  // 0.1.5-rc.2: only the panel carries this; the seat does not exist there.
  '[data-sidebar-right-panel]',
] as const

/** Inside a collapsed or inactive seat: not the surface the user is looking at. */
const HIDDEN_ANCESTOR = '[hidden], [aria-hidden="true"]'

/** A docked pane. Floating panes carry `data-dockkit-float` and are excluded. */
const DOCKED_PANE = '[data-dockkit-pane]'

/** The chip attribute whose value is the tab's own id. */
const TAB_CHIP = '[data-dockkit-tab]'

/** The `dataset` key carrying the tab id on a chip. */
const TAB_ID_KEY = 'dockkitTab'

/** The `dataset` key carrying a pane's own id on a `[data-dockkit-pane]` node. */
const PANE_ID_KEY = 'dockkitPane'

/** The attribute name a chip's tab id is actually read from, derived once. */
const TAB_ID_ATTRIBUTE = 'data-' + TAB_ID_KEY.replace(/[A-Z]/g, letter => '-' + letter.toLowerCase())

/**
 * The attribute a pane's own id is read from, derived once from the `dataset`
 * key. The host reads the same attribute as `container.dataset.dockkitPane`,
 * so this is the host's own spelling of the value rather than a second guess.
 */
const PANE_ID_ATTRIBUTE = 'data-' + PANE_ID_KEY.replace(/[A-Z]/g, letter => '-' + letter.toLowerCase())

/**
 * The attribute a pane's own grid column is read from. The 0.1.7+ grid renderer
 * writes `data-dockkit-column` on both the tab cell and the pane section; the
 * 0.1.5 flex renderer writes neither, which is exactly why the fallback below
 * must stay.
 */
const PANE_COLUMN_KEY = 'dockkitColumn'

/** The attribute name a pane's column is actually read from, derived once. */
const PANE_COLUMN_ATTRIBUTE = 'data-' + PANE_COLUMN_KEY.replace(/[A-Z]/g, letter => '-' + letter.toLowerCase())

/**
 * Read the mounted session's tab records, whichever generation published them.
 *
 * This is the same two-route lookup `host-access.mountedTabRecords` performs, and
 * it is restated rather than imported for one structural reason: `capabilities.ts`
 * value-imports the host primitives package, so anything importing it for a value
 * drags the primitives bundle into this module and out of plain-jsdom reach. The
 * *predicate* is shared — {@link isMountedObservableShape} comes from
 * `host-access.ts`, which imports `capabilities.ts` as a type only — so the two
 * copies cannot drift in the way that matters.
 *
 * @param faces - the right-Sidebar navigation face.
 * @param sessionId - the mounted session on a modern host; unused on a legacy one.
 * @returns the records, or `[]` when no seat is mounted.
 */
export function tabRecords(
  faces: SidebarRightFace,
  sessionId?: string,
): readonly TabRecordLike[] {
  // Modern: the host's own inventory lookup, keyed by session.
  if (typeof faces.tabsIn === 'function') {
    const target = sessionId ?? observableSessionId(faces)
    if (target !== undefined) return faces.tabsIn(target)
    // No session id yet: the active tab is still worth reporting, so the action
    // menu and the hover menu agree about what is on screen.
    const active = faces.active()
    return active === undefined ? [] : [active]
  }
  // Legacy: `mounted` is a plain method returning the render snapshot. The call
  // is made with an explicit receiver because 0.1.5's implementation destructures
  // `this`, so a detached reference would throw.
  const mounted: unknown = faces.mounted
  if (typeof mounted === 'function') {
    const surface = (mounted as () => { layout: { tabs: Readonly<Record<string, TabRecordLike>> } } | undefined).call(faces)
    if (surface === undefined) return []
    return Object.values(surface.layout.tabs)
  }
  return []
}

/**
 * The mounted session id, when the host publishes one as an observable.
 * @param faces - the right-Sidebar navigation face.
 * @returns the id, or undefined on a legacy host.
 */
function observableSessionId(faces: SidebarRightFace): string | undefined {
  if (!isMountedObservableShape(faces)) return undefined
  return faces.mounted.getSnapshot()
}

/**
 * Every open tab id of the mounted session, docked and floating alike. API only.
 *
 * @param faces - the right-Sidebar navigation face.
 * @param sessionId - the mounted session on a modern host.
 * @returns the ids, in the host's own record order.
 */
export function allTabIds(faces: SidebarRightFace, sessionId?: string): readonly string[] {
  return tabRecords(faces, sessionId).map(record => record.id)
}

/**
 * Resolve the container whose docked panes are the ones on screen.
 *
 * ## Why "visible first, then id, then anything"
 *
 * A modern host keeps a **retained** right Sidebar per session and hides the ones
 * that are not selected, so several pane containers can exist at once and only one
 * of them belongs to the mounted session. The session id, when the caller has one,
 * is the precise answer; the hidden-ancestor test is the fallback that works on a
 * host which publishes no id at all (0.1.5).
 *
 * The final fallback — the first container in document order even while a hidden
 * ancestor hides it — is deliberate: a collapsed column still holds real tabs, and
 * "clear the docked tabs" should work with the column shut. Closing a tab does not
 * depend on its pane being painted.
 *
 * @param sessionId - the mounted session id, when known.
 * @returns the container, or null when no right Sidebar is in the document.
 */
function paneRoot(sessionId?: string): Element | null {
  const candidates: Element[] = []
  for (const selector of PANE_ROOT_SELECTORS) {
    for (const element of document.querySelectorAll(selector)) {
      if (!candidates.includes(element)) candidates.push(element)
    }
  }
  if (candidates.length === 0) return null

  const visible = candidates.filter(element => element.closest(HIDDEN_ANCESTOR) === null)
  if (sessionId !== undefined) {
    const owned = candidates.filter(element => element.getAttribute('data-sidebar-right-session') === sessionId)
    const ownedVisible = owned.find(element => visible.includes(element))
    if (ownedVisible !== undefined) return ownedVisible
    if (owned[0] !== undefined) return owned[0]
  }
  return visible[0] ?? candidates[0] ?? null
}

/**
 * Order docked panes left to right by the column the host itself wrote.
 *
 * Document order is **not** left-to-right on the 0.1.7+ grid renderer, which is
 * why this function exists. That renderer emits its tab cells in ascending *tab
 * id* order — verbatim, `Object.values(n.tabs).sort((a, b) => a.id.localeCompare(b.id))`
 * — and only then places each one with `gridColumn: column * 2 + 1`. Neither the
 * sort nor the DOM knows about columns, so `querySelectorAll` order is the
 * dictionary order of each pane's active tab id, unrelated to left/right. The
 * real column is the host's own `data-dockkit-column`, written on the tab cell
 * and on the pane section inside it.
 *
 * Two fallbacks, in order, because a missing column is not a rare shape:
 *
 * - **Any pane without a column** drops the whole batch to measured geometry
 *   (`getBoundingClientRect().left`). A modern host renders *empty* panes from a
 *   separate branch (`div[data-dockkit-empty]` wrapping the pane section) that
 *   writes **no** column and always sorts after every occupied cell, so trusting
 *   document order for it would put a left-hand empty pane on the right. The
 *   geometry read is per-pane rather than all-or-nothing: mixing a column with a
 *   measurement is the same unit mismatch this fallback exists to avoid.
 * - **Non-finite column** (absent or non-numeric) also falls back to geometry,
 *   so a malformed attribute degrades instead of sorting as NaN.
 *
 * The 0.1.5 flex renderer writes no column anywhere and already lays its panes
 * out left to right, so geometry reproduces its document order exactly — this is
 * a live regression path (Tavern), not dead code.
 *
 * @param panes - the docked panes, in whatever order the DOM reported them.
 * @returns the same panes, left to right.
 */
function orderPanesLeftToRight(panes: readonly Element[]): readonly Element[] {
  if (panes.length < 2) return panes
  const columns = panes.map(pane => {
    const raw = pane.getAttribute(PANE_COLUMN_ATTRIBUTE)
    return raw === null ? Number.NaN : Number.parseInt(raw, 10)
  })
  const scores = columns.every(Number.isFinite)
    ? columns
    : panes.map(pane => pane.getBoundingClientRect().left)
  return panes
    .map((pane, index) => ({ pane, score: scores[index] ?? 0 }))
    .sort((a, b) => a.score - b.score)
    .map(entry => entry.pane)
}

/**
 * Read the docked panes and their tabs, left to right.
 *
 * "Left to right" is {@link orderPanesLeftToRight}'s answer, not document order:
 * see that function for why the two differ on every 0.1.7+ host and agree on
 * 0.1.5. This is the batch's only non-API dependency.
 *
 * A single docked pane reports itself in `left` and leaves `right` empty, which is
 * what lets the menu disable both pane rows on one pane rather than offering a
 * no-op right-hand clear. More than two panes cannot happen under the host's
 * two-pane budget, but if it ever did, the middle panes would still be closed by
 * {@link DockGroups.all} while `left` and `right` kept meaning "first" and "last".
 *
 * @param sessionId - the mounted session id, when known.
 * @returns the groups; all-empty when no right Sidebar is in the document.
 */
export function dockGroups(sessionId?: string): DockGroups {
  const root = paneRoot(sessionId)
  if (root === null) return { count: 0, left: [], right: [], all: [], paneIds: [] }

  const panes = orderPanesLeftToRight(Array.from(root.querySelectorAll(DOCKED_PANE)))
  const groups = panes.map(pane =>
    Array.from(pane.querySelectorAll(TAB_CHIP))
      .map(chip => chip.getAttribute(TAB_ID_ATTRIBUTE) ?? '')
      .filter(id => id !== ''))
  // The pane's own id, straight off the attribute dockkit writes it to. A pane
  // without one still contributes an entry (an empty string) so `paneIds` and
  // `left`/`right` stay index-aligned even on malformed markup; the optional
  // `leftPaneId`/`rightPaneId` accessors are what callers test.
  const paneIds = panes.map(pane => pane.getAttribute(PANE_ID_ATTRIBUTE) ?? '')

  const all = groups.flat()
  const first = groups[0]
  if (first === undefined) return { count: 0, left: [], right: [], all, paneIds }
  const firstPaneId = paneIds[0]
  const lastPaneId = paneIds[paneIds.length - 1]
  if (groups.length === 1) {
    return {
      count: 1,
      left: first,
      right: [],
      all,
      paneIds,
      ...(firstPaneId === undefined || firstPaneId === '' ? {} : { leftPaneId: firstPaneId }),
    }
  }
  return {
    count: groups.length,
    left: first,
    right: groups[groups.length - 1] ?? [],
    all,
    paneIds,
    ...(firstPaneId === undefined || firstPaneId === '' ? {} : { leftPaneId: firstPaneId }),
    ...(lastPaneId === undefined || lastPaneId === '' ? {} : { rightPaneId: lastPaneId }),
  }
}

/**
 * The floating tab ids: everything the API reports, minus every docked tab.
 *
 * @param all - every open tab id, from {@link allTabIds}.
 * @param docked - every docked tab id, from {@link DockGroups.all}.
 * @returns the floating ids, in the API's order.
 */
export function floatedTabIds(
  all: readonly string[],
  docked: readonly string[],
): readonly string[] {
  const dockedSet = new Set(docked)
  return all.filter(id => !dockedSet.has(id))
}

/**
 * Close each named tab, skipping the one the host would refuse anyway.
 *
 * The skip reproduces the host's own `canCloseTab` rule for the single case that
 * matters — the last docked tab when it is the guide page:
 *
 *     tab.kind === "guide" && soleDockedTab(layout, tabId)
 *     soleDockedTab = pane.host === "dock" && pane.tabs.length === 1
 *                     && dockPaneIds(layout).length === 1
 *
 * Read against the docked set, that reduces to "the whole docked surface holds
 * exactly one tab and it is this guide", which is computable without the layout
 * tree. A guide **inside a float is not protected** — `soleDockedTab` requires
 * `host === "dock"` — and this rule leaves it closable, matching the host.
 *
 * The host still applies its own guard as a backstop (`close` then `closeIn` then
 * `canCloseTab` on 0.1.7, the `closeTab` reducer on 0.1.5), so this duplicates a
 * rule rather than depending on one: if a future host relaxed it, the menu would
 * simply skip one tab it could now have closed.
 *
 * @param faces - the right-Sidebar navigation face.
 * @param ids - the tab ids to close, snapshotted by the caller before any close.
 * @param sessionId - the mounted session id, when known.
 * @returns how many tabs were actually handed to the host.
 */
export function closeTabs(
  faces: SidebarRightFace,
  ids: readonly string[],
  sessionId?: string,
): number {
  if (ids.length === 0) return 0
  // One read, before any close: see the module header on batching.
  const kinds = new Map(tabRecords(faces, sessionId).map(record => [record.id, record.kind]))
  const docked = new Set(dockGroups(sessionId).all)
  const soleDocked = docked.size === 1 ? [...docked][0] : undefined

  let closed = 0
  for (const id of ids) {
    const isSoleGuide = kinds.get(id) === 'guide' && id === soleDocked
    if (isSoleGuide) continue
    faces.close(id)
    closed += 1
  }
  return closed
}

/**
 * Collapse the column when it is showing its panel.
 *
 * `isExpanded` is asked first rather than toggling blind: `toggleExpanded` is an
 * *expand or collapse* control, so calling it unconditionally would pop the panel
 * open on a host where the user had it shut.
 *
 * @param faces - the right-Sidebar navigation face.
 * @returns whether a collapse was requested.
 */
export function collapseIfExpanded(faces: SidebarRightFace): boolean {
  if (!faces.isExpanded()) return false
  faces.toggleExpanded()
  return true
}

/**
 * The full picture the action menu needs, read once per open.
 *
 * Everything is snapshotted together so the enabled/disabled state, the labels'
 * targets, and the run itself all describe the same instant.
 */
export interface SidebarActionState {
  /** The docked groups. */
  readonly dock: DockGroups
  /** Every tab id, docked and floating. */
  readonly all: readonly string[]
  /** The floating tab ids. */
  readonly floated: readonly string[]
  /** Whether the column is currently showing its panel. */
  readonly expanded: boolean
}

/**
 * Snapshot the sidebar's state for one menu open.
 * @param faces - the right-Sidebar navigation face.
 * @param sessionId - the mounted session id, when known.
 * @returns the snapshot the menu draws its enabled/disabled rows from.
 */
export function readActionState(
  faces: SidebarRightFace,
  sessionId?: string,
): SidebarActionState {
  const dock = dockGroups(sessionId)
  const all = allTabIds(faces, sessionId)
  return {
    dock,
    all,
    floated: floatedTabIds(all, dock.all),
    expanded: faces.isExpanded(),
  }
}
