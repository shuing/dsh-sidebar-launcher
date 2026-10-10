import type { SidebarRightFace } from './context-types.ts';
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
export declare function hasMenuRows(): boolean;
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
export declare function hasTabInventory(sidebarRight: SidebarRightFace): boolean;
/**
 * Whether `sidebarRight` is of the modern generation, i.e. whether `mounted` is
 * an observable snapshot source.
 *
 * @param sidebarRight - the right-Sidebar navigation face.
 * @returns true when `mounted` is an observable snapshot source.
 */
export declare function hasMountedObservable(sidebarRight: SidebarRightFace): boolean;
/** The service-backed capability set, read once per injection. */
export interface SidebarCapabilities {
    /** See {@link hasTabInventory}. */
    readonly hasTabInventory: boolean;
    /** See {@link hasMountedObservable}. */
    readonly hasMountedObservable: boolean;
    /** Whether `split()` exists, so the two-step new-pane path can be attempted. */
    readonly hasSplit: boolean;
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
export declare function detectCapabilities(sidebarRight: SidebarRightFace): SidebarCapabilities;
