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
import type { GuideBox } from './context-types.ts'
import type { RecentStore } from './recent.ts'

/** One renderable row: a guide entry, ready to draw. */
export interface LauncherRow {
  /** The kind passed to `openTab`; also the row's React key. */
  readonly kind: string
  /** The entry id, kept for diagnostics and to disambiguate duplicate kinds. */
  readonly id: string
  /** Reads the entry's title in the current language. */
  readonly title: () => string
  /** Reads the entry's one-line description in the current language, if it has one. */
  readonly description?: () => string
  /** The entry's glyph, or undefined for the host's placeholder. */
  readonly icon?: GuideBox['icon']
}

/** The two sections the menu draws, already resolved and de-duplicated. */
export interface LauncherSections {
  /** The recent kinds that still resolve to a live guide entry, most recent first. */
  readonly recent: readonly LauncherRow[]
  /** Every guide entry, in the registry's own order. */
  readonly all: readonly LauncherRow[]
}

/**
 * Map a guide box to a row.
 * @param box - one entry from `guide()`.
 * @returns the row, or undefined when the box cannot be opened.
 */
function toRow(box: GuideBox): LauncherRow | undefined {
  // A box with no kind cannot be passed to `openTab`; dropping it keeps a
  // malformed registration from producing a row that does nothing.
  if (box.kind === '') return undefined
  return {
    kind: box.kind,
    id: box.id,
    title: box.title,
    ...(box.description === undefined ? {} : { description: box.description }),
    ...(box.icon === undefined ? {} : { icon: box.icon }),
  }
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
export function resolveSections(
  guide: readonly GuideBox[],
  recentKinds: readonly string[],
): LauncherSections {
  const all: LauncherRow[] = []
  const byKind = new Map<string, LauncherRow>()

  for (const box of guide) {
    const row = toRow(box)
    if (row === undefined) continue
    all.push(row)
    // First registration wins for a duplicated kind, matching the registry's
    // own ordering authority rather than inventing a second one.
    if (!byKind.has(row.kind)) byKind.set(row.kind, row)
  }

  const recent: LauncherRow[] = []
  const seen = new Set<string>()
  for (const kind of recentKinds) {
    if (seen.has(kind)) continue
    seen.add(kind)
    const row = byKind.get(kind)
    if (row !== undefined) recent.push(row)
  }

  return { recent, all }
}

/**
 * Read the two sections from the live services.
 * @param guide - a `guide()` thunk, read fresh so a registry change is picked up.
 * @param store - the recent store.
 * @returns the resolved sections.
 */
export function readSections(guide: () => readonly GuideBox[], store: RecentStore): LauncherSections {
  return resolveSections(guide(), store.get())
}
