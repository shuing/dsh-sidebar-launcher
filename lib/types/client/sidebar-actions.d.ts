import type { SidebarRightFace, TabRecordLike } from './context-types.ts';
/** A tab's identity and kind, as the close guard needs them. */
export interface TabIdentity {
    readonly id: string;
    readonly kind: string;
}
/** The docked panes, read from the DOM. See the module header. */
export interface DockGroups {
    /** How many docked panes are on screen (0, 1, or 2 under the host's budget). */
    readonly count: number;
    /** The tab ids of the leftmost docked pane, or `[]`. */
    readonly left: readonly string[];
    /** The tab ids of the rightmost docked pane, or `[]` when there is only one. */
    readonly right: readonly string[];
    /** Every docked tab id, pane order preserved. */
    readonly all: readonly string[];
    /**
     * The paneIds of every docked pane, left to right, matching {@link left} /
     * {@link right} / {@link all} index for index.
     *
     * Kept apart from the tab-id groups on purpose: those answer "what is open,
     * and where" for the menu's enabled/disabled rows, while a paneId is what
     * `openTab` needs in order to *place* a tab. Both come from the same DOM
     * read, so the two views can never describe a different layout.
     */
    readonly paneIds: readonly string[];
    /** The id of the leftmost docked pane, or undefined when no pane is on screen. */
    readonly leftPaneId?: string;
    /** The id of the rightmost docked pane, or undefined when there is only one. */
    readonly rightPaneId?: string;
}
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
export declare function tabRecords(faces: SidebarRightFace, sessionId?: string): readonly TabRecordLike[];
/**
 * Every open tab id of the mounted session, docked and floating alike. API only.
 *
 * @param faces - the right-Sidebar navigation face.
 * @param sessionId - the mounted session on a modern host.
 * @returns the ids, in the host's own record order.
 */
export declare function allTabIds(faces: SidebarRightFace, sessionId?: string): readonly string[];
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
export declare function dockGroups(sessionId?: string): DockGroups;
/**
 * The floating tab ids: everything the API reports, minus every docked tab.
 *
 * @param all - every open tab id, from {@link allTabIds}.
 * @param docked - every docked tab id, from {@link DockGroups.all}.
 * @returns the floating ids, in the API's order.
 */
export declare function floatedTabIds(all: readonly string[], docked: readonly string[]): readonly string[];
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
export declare function closeTabs(faces: SidebarRightFace, ids: readonly string[], sessionId?: string): number;
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
export declare function collapseIfExpanded(faces: SidebarRightFace): boolean;
/**
 * The full picture the action menu needs, read once per open.
 *
 * Everything is snapshotted together so the enabled/disabled state, the labels'
 * targets, and the run itself all describe the same instant.
 */
export interface SidebarActionState {
    /** The docked groups. */
    readonly dock: DockGroups;
    /** Every tab id, docked and floating. */
    readonly all: readonly string[];
    /** The floating tab ids. */
    readonly floated: readonly string[];
    /** Whether the column is currently showing its panel. */
    readonly expanded: boolean;
}
/**
 * Snapshot the sidebar's state for one menu open.
 * @param faces - the right-Sidebar navigation face.
 * @param sessionId - the mounted session id, when known.
 * @returns the snapshot the menu draws its enabled/disabled rows from.
 */
export declare function readActionState(faces: SidebarRightFace, sessionId?: string): SidebarActionState;
