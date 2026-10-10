/**
 * Reading the right-Sidebar face across both host generations.
 *
 * `capabilities.ts` answers *which* shape the host has; this module is the only
 * place that then acts on the answer. Keeping the two together in one pair of
 * files means the legacy/modern difference is written down exactly once per
 * member, instead of being re-derived at each call site and drifting.
 *
 * The three members that differ, and the route taken on each generation:
 *
 * | member    | 0.1.7-rc.2                                   | 0.1.5-rc.2                                  |
 * |-----------|----------------------------------------------|---------------------------------------------|
 * | `mounted` | observable: `getSnapshot()` / `subscribe()`  | method: `mounted()` returns the surface      |
 * | tabs      | `tabsIn(sessionId)`                          | `mounted()?.layout.tabs` (same records)      |
 * | `split`   | present, and used by `placement.ts`          | present, and used by `placement.ts`          |
 *
 * Nothing here reads a version string; every branch is driven by the capability
 * set captured from the live service.
 */
import type { SidebarCapabilities } from './capabilities.ts'
import type {
  MountedSurfaceLike,
  ObservableSnapshotLike,
  SidebarRightFace,
  TabRecordLike,
} from './context-types.ts'

/**
 * Narrow `sidebarRight.mounted` to its observable form.
 *
 * This guard lives here rather than in `capabilities.ts` on purpose, and the
 * reason is structural rather than stylistic. `capabilities.ts` must import the
 * host primitives package to answer `hasMenuRows`, so anything importing *it* for
 * a value inherits that dependency. The tracker needs only this narrowing — it
 * never asks about menu rows — and it is the piece most worth unit-testing in
 * isolation, so the guard sits in the module it belongs to and keeps the tracker's
 * import graph free of the primitives bundle.
 *
 * `capabilities.ts` imports the guard back, so there is still exactly one
 * definition of the predicate.
 *
 * @param sidebarRight - the right-Sidebar navigation face.
 * @returns true when `mounted` is an observable snapshot source.
 */
export function isMountedObservableShape(
  sidebarRight: SidebarRightFace,
): sidebarRight is SidebarRightFace & { readonly mounted: ObservableSnapshotLike<string | undefined> } {
  const mounted: unknown = sidebarRight.mounted
  return typeof mounted === 'object'
    && mounted !== null
    && typeof (mounted as { getSnapshot?: unknown }).getSnapshot === 'function'
}

/**
 * The mounted session's id, when a seat is on screen.
 *
 * Modern hosts publish it directly. Legacy hosts have no such member, so the
 * caller's "is a session mounted" question is answered separately by
 * {@link hasMountedSession}, and this returns `undefined` here by design rather
 * than inventing an id the host never exposed.
 *
 * @param caps - the capability set read from this host.
 * @param sidebarRight - the right-Sidebar navigation face.
 * @returns the mounted session id, or undefined on a legacy host or with no seat.
 */
export function mountedSessionId(
  caps: SidebarCapabilities,
  sidebarRight: SidebarRightFace,
): string | undefined {
  if (!caps.hasMountedObservable || !isMountedObservableShape(sidebarRight)) return undefined
  return sidebarRight.mounted.getSnapshot()
}

/**
 * The mounted session's surface, whichever generation published it.
 *
 * The call is made with an explicit receiver, and that is load-bearing rather
 * than defensive. On 0.1.5-rc.2 `mounted` is a **class method** that reads
 * `this.binding`:
 *
 *     mounted() { const { binding } = this; return binding === void 0 ? void 0 : … }
 *
 * Detaching it — `const read = face.mounted; read()` — therefore throws
 * `TypeError: Cannot destructure property 'binding' of 'this' as it is undefined`
 * the moment it is invoked. That failure is not theoretical: it was found by
 * driving the real host, *after* the jsdom harness had passed, precisely because a
 * fake face written as an arrow function has no `this` to lose. `call` is what
 * makes the real host work.
 *
 * @param caps - the capability set read from this host.
 * @param sidebarRight - the right-Sidebar navigation face.
 * @returns the surface, or undefined with no seat or before the first open.
 */
export function mountedSurface(
  caps: SidebarCapabilities,
  sidebarRight: SidebarRightFace,
): MountedSurfaceLike | undefined {
  if (caps.hasMountedObservable) return undefined
  const read: unknown = sidebarRight.mounted
  if (typeof read !== 'function') return undefined
  return (read as () => MountedSurfaceLike | undefined).call(sidebarRight)
}

/**
 * Whether a session's seat is mounted, i.e. whether the right column could be
 * showing a tab strip at all.
 *
 * The two generations cannot answer this identically, and the difference is a
 * real behaviour gap rather than a detail:
 *
 * - Modern: `mounted.getSnapshot() !== undefined`.
 * - Legacy: `active() !== undefined`, because `mounted()` is `undefined` until
 *   the surface's first open stores one — an expanded-but-never-opened column
 *   reports "no session", so this reads "no session" later than the modern one
 *   does.
 *
 * That later signal is the reason the legacy degrade check waits instead of
 * firing early; see `recent.ts`. It is called out here so the caller states the
 * consequence rather than rediscovering it.
 *
 * @param caps - the capability set read from this host.
 * @param sidebarRight - the right-Sidebar navigation face.
 * @returns true when a session is on screen by this host's own definition.
 */
export function hasMountedSession(
  caps: SidebarCapabilities,
  sidebarRight: SidebarRightFace,
): boolean {
  if (caps.hasMountedObservable) return mountedSessionId(caps, sidebarRight) !== undefined
  if (mountedSurface(caps, sidebarRight) !== undefined) return true
  // Legacy: a surface appears only after the first open, so fall back to the
  // active tab, which the seat publishes as soon as one exists.
  return sidebarRight.active() !== undefined
}

/**
 * Every open tab record of the mounted session.
 *
 * The modern route asks the host's own inventory lookup by session id. The
 * legacy route reads the same records out of the surface's `layout.tabs` — the
 * exact object `tabsIn` projects (`Object.values(…layout.tabs ?? {})`), so the
 * two routes return the same shape rather than a lookalike.
 *
 * @param caps - the capability set read from this host.
 * @param sidebarRight - the right-Sidebar navigation face.
 * @returns the records, or an empty list when nothing is mounted.
 */
export function mountedTabRecords(
  caps: SidebarCapabilities,
  sidebarRight: SidebarRightFace,
): readonly TabRecordLike[] {
  if (caps.hasTabInventory) {
    const sessionId = mountedSessionId(caps, sidebarRight)
    if (sessionId === undefined) return []
    return sidebarRight.tabsIn?.(sessionId) ?? []
  }
  const surface = mountedSurface(caps, sidebarRight)
  if (surface === undefined) return []
  return Object.values(surface.layout.tabs)
}

/**
 * Bind a change listener to the mounted-session signal, when the host has one.
 *
 * Legacy hosts have no such signal. The caller already watches `document.body`
 * for the seat swap a session switch causes, so skipping the subscription here
 * is a covered path rather than a missing one — and callers must not treat the
 * absent disposer as an error.
 *
 * @param caps - the capability set read from this host.
 * @param sidebarRight - the right-Sidebar navigation face.
 * @param listener - called on every mounted-session change.
 * @returns a disposer, or undefined when this host publishes no signal.
 */
export function subscribeMounted(
  caps: SidebarCapabilities,
  sidebarRight: SidebarRightFace,
  listener: () => void,
): (() => void) | undefined {
  if (!caps.hasMountedObservable || !isMountedObservableShape(sidebarRight)) return undefined
  return sidebarRight.mounted.subscribe(listener)
}
