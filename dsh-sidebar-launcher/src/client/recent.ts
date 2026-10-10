/**
 * The recent-tab record, and where it comes from.
 *
 * Two things live here, and they are deliberately separate:
 *
 * 1. {@link createRecentStore} — the persisted list. Only `kind` strings are
 *    stored: a guide entry's icon is a component and its title is a thunk, so
 *    neither can be serialized. Keeping the kind and looking the entry up again
 *    at render time is what lets the list follow a language change, a theme
 *    change, and a tab type that moved between plugins.
 *
 * 2. {@link createRecentTracker} — where the list's contents come from. The
 *    preferred source (D2-B1) is the host's own tab strip: dockkit chips carry
 *    `role="tab"` with `aria-selected` and identify themselves with
 *    `data-dockkit-tab`, inside a `[data-dockkit-strip-tabs]` container. Watching
 *    `aria-selected` flip to `true` is therefore the host telling us, in its own
 *    markup, which tab the user just activated.
 *
 *    An observer only fires on change, so the mount path scans the current strip
 *    once first; and because the seat (and with it the strip) is replaced on a
 *    session switch, the scan is re-run and the observers rebound whenever the
 *    mounted session changes. Missing any one of those three makes the list empty
 *    or stale, so all three are explicit here.
 *
 *    ## Two host generations
 *
 *    The tabId → kind lookup and the session-switch signal both differ between
 *    0.1.7-rc.2 and 0.1.5-rc.2, and neither difference is cosmetic:
 *
 *    - The lookup goes through `host-access.ts`. On 0.1.5 `sidebarRight.mounted`
 *      is a plain method, so the older code's direct `mounted.getSnapshot()`
 *      threw `TypeError: sidebarRight.mounted.getSnapshot is not a function` on
 *      every scan of a non-active tab — which killed the `MutationObserver`
 *      callback mid-flight and left exactly one recorded kind behind. That is the
 *      bug this file's indirection exists to remove.
 *    - The session-switch subscription is skipped when the host publishes no
 *      observable. The `document.body` observer below already sees the seat swap
 *      a session switch performs and routes it through the same `scheduleResync`,
 *      so the legacy path is covered by an existing mechanism rather than left
 *      unwatched.
 *
 *    ## The degrade signal is weaker on the legacy host, and says so
 *
 *    "Is a session on screen" is `mounted.getSnapshot() !== undefined` on 0.1.7
 *    but only `active() !== undefined` on 0.1.5, because that host's `mounted()`
 *    returns nothing until the surface's first open. A collapsed column that was
 *    never opened therefore looks session-less for longer, so the legacy
 *    downgrade to `'b2'` fires **later** than the modern one. That is a real
 *    behaviour difference between the hosts, not a defect to paper over: the
 *    degrade is still sticky, still delayed, and still reported. The notice copy
 *    deliberately does not promise a timing it cannot keep.
 *
 *    Degradation is deliberately *sticky and delayed*, not a per-scan verdict:
 *    the strip only exists while the right column is expanded, so "no strip right
 *    now" is the normal state of a collapsed column and must not be read as "the
 *    host is not a usable source". A downgrade therefore requires that a session
 *    is mounted, that a grace period passes, and that no strip has *ever* been
 *    seen. Seeing one at any point settles the mode on `'b1'` for good. When the
 *    downgrade does happen it is reported, not hidden.
 */
import type { SidebarCapabilities } from './capabilities.ts'
import type { SidebarRightFace } from './context-types.ts'
import { hasMountedSession, mountedTabRecords, subscribeMounted } from './host-access.ts'

/** `localStorage` key holding the recent kinds, most recent first. */
const STORAGE_KEY = 'dsh-sidebar-launcher:recent'

/** How many kinds the list keeps. */
const MAX_RECENT = 3

/** Container whose subtree holds the host's tab chips. */
const STRIP_TABS_SELECTOR = '[data-dockkit-strip-tabs]'

/** The chip attribute carrying the tab's id. */
const TAB_ID_ATTRIBUTE = 'data-dockkit-tab'

/** The chip attribute whose flip means "this tab became the active one". */
const ACTIVE_ATTRIBUTE = 'aria-selected'

/**
 * How long a mounted session may show no strip before the source is declared
 * degraded. Long enough to cover the seat's own mount and first paint.
 */
const DEGRADE_GRACE_MS = 1500

/**
 * Where the recent list's contents come from.
 *
 * - `'b1'` — read from the host's tab strip; the host's own record of what the
 *   user activated, which is the intended source.
 * - `'b2'` — no strip was ever found while a session was mounted, so the list is
 *   limited to what the launcher itself opened. Degraded, and reported as such.
 */
export type RecentMode = 'b1' | 'b2'

/** The recent kinds, plus the change notification React subscribes to. */
export interface RecentStore {
  /** The recent kinds, most recent first. Stable reference between changes. */
  get(): readonly string[]
  /** Move a kind to the front, de-duplicating and trimming to the cap. */
  record(kind: string): void
  /** Subscribe to list changes. */
  subscribe(listener: () => void): () => void
}

/** Read the persisted list, tolerating absent, unparsable, or wrong-shaped data. */
function readStored(): readonly string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw === null) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((value): value is string => typeof value === 'string').slice(0, MAX_RECENT)
  } catch {
    return []
  }
}

/**
 * Create the store over the persisted list.
 * @returns the store, already holding whatever the last session left behind.
 */
export function createRecentStore(): RecentStore {
  let current: readonly string[] = readStored()
  const listeners = new Set<() => void>()

  return {
    // Arrow properties throughout: these are handed to `useSyncExternalStore` as
    // bare functions, so a method relying on `this` would lose its receiver.
    get: () => current,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    record: (kind) => {
      if (kind === '') return
      const next = [kind, ...current.filter(entry => entry !== kind)].slice(0, MAX_RECENT)
      const unchanged = next.length === current.length
        && next.every((value, index) => value === current[index])
      if (unchanged) return
      current = next
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {
        // Storage refused (private mode, quota): the in-memory list still works.
      }
      for (const listener of [...listeners]) listener()
    },
  }
}

/** The tracker's public face. */
export interface RecentTracker {
  /** Begin watching. Safe to call once; a second call is ignored. */
  start(): void
  /** Stop watching and drop every observer and timer. */
  stop(): void
  /**
   * Record a kind the launcher itself opened.
   *
   * Only meaningful in {@link RecentMode} `'b2'`; in `'b1'` the strip is already
   * the authority and recording here would double-count.
   * @param kind - the kind just opened.
   */
  recordLauncherOpen(kind: string): void
  /** The mode currently in force. */
  mode(): RecentMode
}

/** Options for {@link createRecentTracker}. */
export interface RecentTrackerOptions {
  /** The right-Sidebar navigation face, used for tabId → kind lookups. */
  readonly sidebarRight: SidebarRightFace
  /** The capability set read from this host, choosing the lookup and signal routes. */
  readonly capabilities: SidebarCapabilities
  /** The list to fill. */
  readonly store: RecentStore
  /** Called when the mode changes, so the menu can re-render its notice. */
  readonly onModeChange?: (mode: RecentMode) => void
}

/**
 * Resolve a chip's tabId to the tab kind it belongs to.
 *
 * Two routes, cheapest first: the active tab of the active pane is the common
 * case (the user just activated a tab), and the mounted session's full record
 * list covers an inactive pane or a floating panel whose chip also flipped.
 *
 * Both routes go through `host-access.ts`, so this never touches
 * `mounted.getSnapshot` on a host where `mounted` is a method. That call is what
 * used to throw on 0.1.5-rc.2, inside a `MutationObserver` callback, where the
 * exception both aborted this function before `store.record` ran and escaped the
 * tracker's `start()`.
 *
 * @param tabId - the `data-dockkit-tab` value read from the chip.
 * @param capabilities - the capability set read from this host.
 * @param sidebarRight - the navigation face to read records from.
 * @returns the kind, or undefined when the tab is not in the mounted session yet.
 */
function kindForTabId(
  tabId: string,
  capabilities: SidebarCapabilities,
  sidebarRight: SidebarRightFace,
): string | undefined {
  const active = sidebarRight.active()
  if (active !== undefined && active.id === tabId) return active.kind

  return mountedTabRecords(capabilities, sidebarRight).find(record => record.id === tabId)?.kind
}

/**
 * Create the tracker.
 *
 * Nothing is watched until {@link RecentTracker.start} runs, so construction is
 * cheap and safe during a React render.
 *
 * @param options - the navigation face, the store to fill, and a mode listener.
 * @returns the tracker.
 */
export function createRecentTracker(options: RecentTrackerOptions): RecentTracker {
  const { sidebarRight, capabilities, store, onModeChange } = options
  const observers = new Map<Element, MutationObserver>()
  const disposers: Array<() => void> = []
  let currentMode: RecentMode = 'b1'
  let started = false
  /** Once a strip has been seen, the preferred source is settled for this mount. */
  let sawStrip = false
  let degradeTimer = 0
  let scheduled = 0

  function setMode(next: RecentMode): void {
    if (next === currentMode) return
    currentMode = next
    onModeChange?.(next)
  }

  function clearDegradeTimer(): void {
    if (degradeTimer === 0) return
    window.clearTimeout(degradeTimer)
    degradeTimer = 0
  }

  /** Read one chip, if it is a chip and it is the active one. */
  function recordFromChip(chip: Element): void {
    if (chip.getAttribute(ACTIVE_ATTRIBUTE) !== 'true') return
    const tabId = chip.getAttribute(TAB_ID_ATTRIBUTE)
    if (tabId === null || tabId === '') return
    const kind = kindForTabId(tabId, capabilities, sidebarRight)
    if (kind !== undefined && kind !== '') store.record(kind)
  }

  /** Scan every strip currently in the document; this is the mount-time pass. */
  function scanStrips(): boolean {
    const strips = document.querySelectorAll(STRIP_TABS_SELECTOR)
    if (strips.length === 0) return false
    for (const strip of strips) {
      for (const chip of strip.querySelectorAll(`[${TAB_ID_ATTRIBUTE}]`)) recordFromChip(chip)
    }
    return true
  }

  /** Observe every strip's subtree for the active-tab attribute flip. */
  function rebindObservers(): void {
    const strips = new Set(document.querySelectorAll(STRIP_TABS_SELECTOR))
    // Drop observers whose container left the document (a replaced seat), but
    // never the body watcher, which is the strip's discovery mechanism.
    for (const [element, observer] of observers) {
      if (element === document.body) continue
      if (strips.has(element) && element.isConnected) continue
      observer.disconnect()
      observers.delete(element)
    }
    for (const strip of strips) {
      if (observers.has(strip)) continue
      const observer = new MutationObserver(records => {
        for (const record of records) {
          const target = record.target
          if (target instanceof Element) recordFromChip(target)
        }
      })
      observer.observe(strip, { subtree: true, attributes: true, attributeFilter: [ACTIVE_ATTRIBUTE] })
      observers.set(strip, observer)
    }
  }

  /**
   * Arm the delayed downgrade check.
   *
   * Only a mounted session can prove the host *should* be rendering a strip, so
   * the check is skipped entirely while none is mounted — a collapsed column and
   * a session-less window are both normal, and neither is evidence about the host.
   *
   * "Mounted" is answered by `host-access.ts`, which on a legacy host has only
   * `active() !== undefined` to go on. That makes the legacy downgrade fire later
   * than the modern one; the file header records why, and the notice copy is
   * worded to match.
   */
  function scheduleDegradeCheck(): void {
    if (sawStrip || degradeTimer !== 0) return
    if (!hasMountedSession(capabilities, sidebarRight)) return
    degradeTimer = window.setTimeout(() => {
      degradeTimer = 0
      if (sawStrip) return
      // Re-check at fire time: the session may have gone away in the meantime.
      if (!hasMountedSession(capabilities, sidebarRight)) return
      if (!started) return
      setMode('b2')
    }, DEGRADE_GRACE_MS)
  }

  /** Re-derive the whole state: scan what is there, then watch it. */
  function resync(): void {
    const found = scanStrips()
    if (found) {
      sawStrip = true
      clearDegradeTimer()
      setMode('b1')
    }
    rebindObservers()
    if (!found) scheduleDegradeCheck()
  }

  /**
   * Coalesce resyncs to one per frame.
   *
   * The body watcher sees every DOM insertion the whole application makes, and a
   * resync runs a document-wide `querySelectorAll` sweep; without coalescing, a
   * busy render would turn each insertion into its own sweep.
   */
  function scheduleResync(): void {
    if (scheduled !== 0) return
    scheduled = requestAnimationFrame(() => {
      scheduled = 0
      if (started) resync()
    })
  }

  return {
    start() {
      if (started) return
      started = true

      resync()

      // The strip is created with the seat and replaced on every session switch,
      // so the swap is what re-arms the strip observers on that path. This
      // observer is also the *only* session-switch signal on a legacy host,
      // where `mounted` is a method and publishes no subscription.
      const seatObserver = new MutationObserver(() => {
        scheduleResync()
      })
      seatObserver.observe(document.body, { childList: true, subtree: true })
      observers.set(document.body, seatObserver)

      // The mounted-session signal is the reliable edge on a modern host: the
      // seat publishes it even when the strip's own DOM swap produces no useful
      // mutation. A legacy host has no such signal, so this is skipped and the
      // body observer above covers the same transition.
      const unobserve = subscribeMounted(capabilities, sidebarRight, () => {
        scheduleResync()
      })
      if (unobserve !== undefined) disposers.push(unobserve)
    },
    stop() {
      if (!started) return
      started = false
      if (scheduled !== 0) {
        cancelAnimationFrame(scheduled)
        scheduled = 0
      }
      clearDegradeTimer()
      for (const observer of observers.values()) observer.disconnect()
      observers.clear()
      for (const dispose of disposers.splice(0)) dispose()
    },
    recordLauncherOpen: (kind) => {
      if (currentMode !== 'b2') return
      store.record(kind)
    },
    mode: () => currentMode,
  }
}
