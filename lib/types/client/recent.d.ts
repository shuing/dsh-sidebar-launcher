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
import type { SidebarCapabilities } from './capabilities.ts';
import type { SidebarRightFace } from './context-types.ts';
/**
 * Where the recent list's contents come from.
 *
 * - `'b1'` — read from the host's tab strip; the host's own record of what the
 *   user activated, which is the intended source.
 * - `'b2'` — no strip was ever found while a session was mounted, so the list is
 *   limited to what the launcher itself opened. Degraded, and reported as such.
 */
export type RecentMode = 'b1' | 'b2';
/** The recent kinds, plus the change notification React subscribes to. */
export interface RecentStore {
    /** The recent kinds, most recent first. Stable reference between changes. */
    get(): readonly string[];
    /** Move a kind to the front, de-duplicating and trimming to the cap. */
    record(kind: string): void;
    /** Subscribe to list changes. */
    subscribe(listener: () => void): () => void;
}
/**
 * Create the store over the persisted list.
 * @returns the store, already holding whatever the last session left behind.
 */
export declare function createRecentStore(): RecentStore;
/** The tracker's public face. */
export interface RecentTracker {
    /** Begin watching. Safe to call once; a second call is ignored. */
    start(): void;
    /** Stop watching and drop every observer and timer. */
    stop(): void;
    /**
     * Record a kind the launcher itself opened.
     *
     * Only meaningful in {@link RecentMode} `'b2'`; in `'b1'` the strip is already
     * the authority and recording here would double-count.
     * @param kind - the kind just opened.
     */
    recordLauncherOpen(kind: string): void;
    /** The mode currently in force. */
    mode(): RecentMode;
}
/** Options for {@link createRecentTracker}. */
export interface RecentTrackerOptions {
    /** The right-Sidebar navigation face, used for tabId → kind lookups. */
    readonly sidebarRight: SidebarRightFace;
    /** The capability set read from this host, choosing the lookup and signal routes. */
    readonly capabilities: SidebarCapabilities;
    /** The list to fill. */
    readonly store: RecentStore;
    /** Called when the mode changes, so the menu can re-render its notice. */
    readonly onModeChange?: (mode: RecentMode) => void;
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
export declare function createRecentTracker(options: RecentTrackerOptions): RecentTracker;
