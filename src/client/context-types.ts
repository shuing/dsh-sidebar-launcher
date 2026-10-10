/**
 * Structural types for the client services this plugin consumes.
 *
 * These are deliberately structural mirrors rather than `declare module`
 * augmentations. The installed client packages already augment
 * `@deepseek-ai/cordis`, and a second program that re-declared the same members
 * would fail interface merging. Restating only what this plugin touches keeps
 * the plugin's own compilation independent of another package's augmented shape,
 * and — more importantly — keeps a host rename a type error here instead of a
 * silent `undefined` at runtime.
 *
 * Nothing in this file may import Node types: it is part of the browser bundle's
 * declaration graph.
 */
import type { ComponentType } from 'react'

/** The glyph contract every tab-type icon satisfies (from ui-primitives). */
export interface IconProps {
  /** Square edge in px; defaults to the glyph's own drawn size. */
  size?: number | undefined
  /** Extra class for layout placement; color rides currentColor. */
  className?: string | undefined
}

/**
 * One entry capsule the guide offers, as the registry lists it.
 *
 * `kind` is what an open names, `title`/`description` are thunks read on every
 * use (so a language change needs no re-registration), and `icon` is a component
 * — never data, and never serializable, which is why the recent list stores only
 * `kind` strings.
 */
export interface GuideBox {
  readonly id: string
  readonly order: number
  readonly title: () => string
  readonly description?: () => string
  readonly icon?: ComponentType<IconProps>
  readonly providerId: string
  readonly kind: string
}

/** One open tab's record, narrowed to the fields this plugin reads. */
export interface TabRecordLike {
  readonly id: string
  readonly kind: string
  readonly contentId: string
  readonly title: string
}

/**
 * One pane node of a mounted surface's layout, narrowed to what this plugin
 * needs: the list of tab ids it holds, in order.
 *
 * Only the 0.1.5 path reads this. There the host publishes `mounted()` — the
 * surface itself — and no `tabsIn(sessionId)` lookup, so the mounted session's
 * tab records are recovered from `layout.tabs` instead.
 */
export interface LayoutNodeLike {
  /** The tab ids this pane holds, in display order. */
  readonly tabs: readonly string[]
}

/** The layout half of a mounted surface, narrowed to the fields read here. */
export interface SurfaceLayoutLike {
  /** Every open tab of the mounted session, keyed by tab id. */
  readonly tabs: Readonly<Record<string, TabRecordLike>>
  /** Every node (pane or split) of the layout, keyed by node id. */
  readonly nodes: Readonly<Record<string, LayoutNodeLike>>
}

/** A mounted session's surface, narrowed to the layout this plugin reads. */
export interface MountedSurfaceLike {
  readonly layout: SurfaceLayoutLike
}

/** A snapshot source: read the cached value, subscribe to invalidation. */
export interface ObservableSnapshotLike<T> {
  getSnapshot(): T
  subscribe(fn: () => void): () => void
}

/** Options accepted by {@link SidebarRightFace.openTab}. */
export interface OpenTabOptions {
  /**
   * Target pane for the tab. Set to the pane on screen the gesture asked for
   * (`left`/`right`), or to the pane `split()` just returned. Both hosts
   * understand it, which is why placement no longer needs a per-generation
   * option — see `placement.ts`.
   */
  readonly paneId?: string
  /** Replace this existing tab instead of adding one. */
  readonly replaceTab?: string
  /**
   * Whether an already-open content should be revealed instead of re-placed.
   *
   * `false` is the load-bearing value for the new-pane path: the page kind the
   * user right-clicked is, by definition, already open in the *other* pane, and
   * letting the host "reveal if opened" would focus that copy instead of
   * honouring the `paneId` we just split for.
   */
  readonly revealIfOpened?: boolean
}

/**
 * The right-Sidebar navigation face (`ctx.sidebarRight`).
 *
 * Only the members this plugin actually calls are declared. The two host
 * generations differ in shape, so the members that exist only on one of them are
 * optional here and every use is guarded by a probe from `capabilities.ts`:
 *
 * - `tabsIn` — 0.1.7 only; 0.1.5 recovers the same records from `mounted()`.
 * - `mounted` — an observable on 0.1.7, a plain method returning the surface on
 *   0.1.5. Both shapes are declared and distinguished by
 *   `hasMountedObservable`.
 * - `split` — present on both generations and used on both by `placement.ts`;
 *   optional here because a probe must not assume it.
 *
 * `openTab` is otherwise the whole dispatch surface; the pane layout decision
 * stays the host's, including its two-pane budget rule, which this plugin
 * deliberately does not restate.
 */
export interface SidebarRightFace {
  openTab(kind: string, options?: OpenTabOptions): void
  /** The active tab of the active pane, or undefined with no mounted surface. */
  active(): TabRecordLike | undefined
  /**
   * Every tab record of one session, for tabId → kind lookups. 0.1.7-rc.2 only;
   * see {@link SidebarRightFace.mounted} for the 0.1.5 route.
   */
  tabsIn?(sessionId: string): readonly TabRecordLike[]
  /**
   * The mounted session's surface. An observable snapshot source on
   * 0.1.7-rc.2, a plain method on 0.1.5-rc.2 — the two are told apart with
   * `hasMountedObservable`, never by calling both.
   */
  readonly mounted: ObservableSnapshotLike<string | undefined> | (() => MountedSurfaceLike | undefined)
  /**
   * Split the active (or named) docked pane, returning the new pane's id or
   * `undefined` when the host's budget or room rule refused.
   *
   * Available on both generations and now used on both: it is the only way to
   * ask for a new pane that still works when the kind is already open in the
   * target pane. Optional here because a probe must not assume it exists.
   */
  split?(paneId?: string): string | undefined
  /**
   * Close one tab of the mounted session.
   *
   * The host keeps the sole *docked* guide open regardless (0.1.7 in
   * `canCloseTab`, 0.1.5 in the `closeTab` reducer), so this is a request rather
   * than a guarantee; `sidebar-actions.ts` mirrors the same rule so a batch does
   * not rely on the guard firing.
   */
  close(tabId: string): void
  /** Whether the column is currently showing its panel rather than its rail. */
  isExpanded(): boolean
  /** Collapse the column, or expand it and focus its active dock pane. */
  toggleExpanded(): void
}


/** The tab-type registry face (`ctx.sidebarRightTabs`). */
export interface SidebarRightTabsFace {
  /** Every type in force's guide entries, in `order`, each naming its kind. */
  guide(): readonly GuideBox[]
  /** Observe low-frequency registry changes (a tab type arriving or leaving). */
  subscribe?(listener: () => void): () => void
}

/** The locale face this plugin reads and registers into. */
export interface LocaleFace {
  getSnapshot(): { readonly active: string }
  subscribe(fn: () => void): () => void
  register(ns: string, locale: string, dict: Record<string, string>): () => void
}

/** The slot registry face (`ctx.slots`). */
export interface SlotsFace {
  inject(key: string, callback: () => () => void): () => void
  register(
    options: { name: string; id: string; order?: number; locale?: string },
    component: ComponentType<Record<string, unknown>>,
  ): () => void
}

/**
 * The client context as this plugin uses it.
 *
 * `effect` and `inject` are cordis base members; they are restated here because
 * this plugin's compilation deliberately does not pull the full cordis Context
 * declaration graph into its own program.
 */
export interface LauncherContext {
  readonly slots: SlotsFace
  readonly locale: LocaleFace
  /** Run a setup body whose returned disposer is owned by this context's fiber. */
  effect(body: () => (() => void) | void): () => void
  /** Run `callback` once every named service is available; re-runs on change. */
  inject(deps: readonly string[], callback: (ctx: LauncherContext) => void): unknown
  get(name: string): unknown
}
