/**
 * The menu's row model, built from the host's guide.
 *
 * The entries come from exactly one place — `sidebarRightTabs.guide()` — so the
 * list cannot drift from the host's own `+` menu: whatever a tab type
 * contributes there is what appears here, in the same `order`, with the same
 * `title()`/`description()` thunks (read at render time, so a language change
 * follows) and the same icon component.
 *
 * Two consequences worth stating, because they are the reason this file does so
 * little:
 *
 * - Types that need a seed to open (`editor`, `diff`) never appear, because a
 *   type that recognises resource addresses contributes no `guide` entries. They
 *   are absent by construction, not by a filter list that could fall out of date.
 * - A type that stops being registered disappears from here on the next
 *   `guide()` read, so disabling or upgrading another plugin degrades the menu to
 *   whatever is left rather than leaving dead rows behind.
 */
import type { GuideBox } from './context-types.ts';
import type { RecentStore } from './recent.ts';
/** One renderable row: a guide entry, ready to draw. */
export interface LauncherRow {
    /** The kind passed to `openTab`; also the row's React key. */
    readonly kind: string;
    /** The entry id, kept for diagnostics and to disambiguate duplicate kinds. */
    readonly id: string;
    /** Reads the entry's title in the current language. */
    readonly title: () => string;
    /** Reads the entry's one-line description in the current language, if it has one. */
    readonly description?: () => string;
    /** The entry's glyph, or undefined for the host's placeholder. */
    readonly icon?: GuideBox['icon'];
}
/** The two sections the menu draws, already resolved and de-duplicated. */
export interface LauncherSections {
    /** The recent kinds that still resolve to a live guide entry, most recent first. */
    readonly recent: readonly LauncherRow[];
    /** Every guide entry, in the registry's own order. */
    readonly all: readonly LauncherRow[];
}
/**
 * Resolve the guide and the recent kinds into the menu's two sections.
 *
 * Recent entries are read *through* the current guide rather than from anything
 * stored: a kind that no longer exists is dropped, and a kind whose title or icon
 * changed shows the new one. That is what makes the recent list survive a
 * language switch, a theme switch, and another plugin being disabled.
 *
 * @param guide - the current guide entries.
 * @param recentKinds - stored kinds, most recent first.
 * @returns the recent section and the full section.
 */
export declare function resolveSections(guide: readonly GuideBox[], recentKinds: readonly string[]): LauncherSections;
/**
 * Read the two sections from the live services.
 * @param guide - a `guide()` thunk, read fresh so a registry change is picked up.
 * @param store - the recent store.
 * @returns the resolved sections.
 */
export declare function readSections(guide: () => readonly GuideBox[], store: RecentStore): LauncherSections;
