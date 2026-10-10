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
import type { SidebarCapabilities } from './capabilities.ts';
import type { SidebarRightFace } from './context-types.ts';
/** The pane a row's gesture asked for. */
export type PlacementTarget = 'left' | 'right' | 'single';
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
    readonly leftPaneId?: string;
    /** The last docked pane, or undefined when there is only one. */
    readonly rightPaneId?: string;
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
export declare function findSeededTabId(capabilities: SidebarCapabilities, sidebarRight: SidebarRightFace, before: ReadonlySet<string>): string | undefined;
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
export declare function openKind(capabilities: SidebarCapabilities, sidebarRight: SidebarRightFace, kind: string, target: PlacementTarget, panes: PlacementPanes): void;
