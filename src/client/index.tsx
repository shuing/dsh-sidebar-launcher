/**
 * Client half of dsh-sidebar-launcher.
 *
 * Mounts one launcher ball into the host's `shell.overlay` layer and gives it a
 * dropdown of the right column's tab types.
 *
 * ## Service arrival
 *
 * The slot registry arrives with the client runtime, but `sidebarRight` and
 * `sidebarRightTabs` are published by the right-Sidebar package, which may load
 * after this one. The menu's data is therefore read inside
 * `ctx.inject([...], callback)`, whose callback runs when — and only when — both
 * services exist, and re-runs if either is replaced. Reading them with `ctx.get()`
 * from inside the slot callback instead would capture `undefined` once and never
 * retry, because the slot registration is not re-evaluated when a service appears.
 *
 * ## Why the hover grace lives here
 *
 * The grace has to span two elements that are not in the same subtree: the ball,
 * and the portaled menu card. `Menu`'s own `closeOnPointerLeave` wires its grace
 * to the trigger wrapper only, so it cannot see a portaled card and would close
 * the menu the moment the pointer left the ball. The grace is owned here instead,
 * where both elements can be observed.
 */
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { ComponentType, ReactNode } from 'react'
import { LOCALE_NS, en, zh } from './locales.ts'
import { createRecentStore, createRecentTracker, type RecentMode } from './recent.ts'
import { readSections, type LauncherSections } from './entries.ts'
import { BALL_SIZE, BallGlyph, useLauncherBall } from './launcher-ball.tsx'
import { CARD_CLASS, LauncherMenu } from './launcher-menu.tsx'
import { ACTION_CARD_CLASS, SidebarActionMenu, buildActionRows, type SidebarActionId } from './sidebar-action-menu.tsx'
import {
  allTabIds,
  closeTabs,
  collapseIfExpanded,
  dockGroups,
  floatedTabIds,
  readActionState,
  type SidebarActionState,
} from './sidebar-actions.ts'
import { detectCapabilities, hasMenuRows, type SidebarCapabilities } from './capabilities.ts'
import { mountedSessionId } from './host-access.ts'
import type { BallPosition } from './anchor.ts'
import { openKind, type PlacementPanes, type PlacementTarget } from './placement.ts'
import './launcher.css'
import type { GuideBox, LauncherContext, SidebarRightTabsFace, SidebarRightFace } from './context-types.ts'

/** Services required before the menu can be built. */
export const inject = ['slots', 'locale']

/** The slot the ball mounts into. */
const SLOT_KEY = 'shell.overlay'

/** How long the pointer may leave both the ball and the card before closing. */
const POINTER_GRACE_MS = 200

/**
 * C3 — which side of the ball the card opens on, from the ball's live position.
 *
 * The ball already carries its position in React state, so the ballpark answer
 * costs nothing and needs no measuring: below the viewport's midline the card
 * opens upward (`top`), above it downward (`bottom`, the default). Both host
 * generations take `side` as a `Menu` prop.
 *
 * This is a HINT, not a guarantee. When the card is long enough to hit its
 * scroll ceiling and the ball is low, the host's own viewport clamp can push a
 * `top` card back down over the ball. The frame-by-frame nudge in
 * `useAvoidAnchor` is what actually closes that case, and it runs on both
 * paths.
 *
 * @param position - the ball's current top-left corner, in viewport px.
 * @returns the side the card should prefer.
 */
function preferredSide(position: BallPosition): 'top' | 'bottom' {
  const viewportHeight = typeof window === 'undefined' ? 0 : window.innerHeight
  return position.top + BALL_SIZE / 2 > viewportHeight / 2 ? 'top' : 'bottom'
}

/** A tiny observable for the current recent-source mode. */
interface ModeSource {
  get(): RecentMode
  subscribe(listener: () => void): () => void
  set(mode: RecentMode): void
}

/**
 * Create the mode observable the menu's notice subscribes to.
 * @returns the source, initially the preferred mode.
 */
function createModeSource(): ModeSource {
  let current: RecentMode = 'b1'
  const listeners = new Set<() => void>()
  return {
    get: () => current,
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    set(mode) {
      if (mode === current) return
      current = mode
      for (const listener of [...listeners]) listener()
    },
  }
}

/** The service-backed data the mounted component draws from. */
interface LauncherData {
  /** The current guide, read fresh so a registry change is picked up. */
  guide(): readonly GuideBox[]
  /** The recent store. */
  readonly recent: ReturnType<typeof createRecentStore>
  /** The tracker, for recording launcher-opened kinds in the degraded mode. */
  readonly tracker: ReturnType<typeof createRecentTracker>
  /** The current recent-source mode. */
  readonly mode: ModeSource
  /** Observe guide-registry changes, when the host offers it. */
  readonly tabsSubscribe?: SidebarRightTabsFace['subscribe']
  /** Open a kind into the pane a gesture asked for. See `openKind`. */
  open(kind: string, gesture: 'left' | 'right'): void
  /** Whether the host renders component menu rows (a capability, not a version). */
  readonly hasMenuRows: boolean
  /** The right-Sidebar navigation face, for the operations menu. */
  readonly sidebarRight: SidebarRightFace
  /** The mounted session id, when this host publishes one. */
  readonly sessionId: () => string | undefined
}

/**
 * Read the launcher's copy for the active locale.
 *
 * The title and description of every row come from the tab type's own thunks, so
 * this only covers chrome the host does not own.
 *
 * @param locale - the locale service face.
 * @returns a key-to-text resolver bound to the active locale.
 */
function useCopy(locale: LauncherContext['locale']): (key: string) => string {
  // Re-render on a locale switch; the thunks and this resolver both read the
  // active value at call time, so re-rendering is all that is needed.
  //
  // The subscriptions are wrapped rather than passed bare: `getSnapshot` and
  // `subscribe` are class methods that read `this`, so handing them to
  // `useSyncExternalStore` directly would call them with no receiver.
  const subscribe = useCallback((listener: () => void) => locale.subscribe(listener), [locale])
  const getSnapshot = useCallback(() => locale.getSnapshot(), [locale])
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  return useCallback((key: string) => {
    const dict = locale.getSnapshot().active.toLowerCase().startsWith('zh') ? zh : en
    return dict[key] ?? key
  }, [locale])
}

/**
 * Build the ball and its menu over the live services.
 *
 * @param data - the service-backed data the menu draws from.
 * @param locale - the locale service face.
 * @returns the component to register into the slot.
 */
function createLauncher(data: LauncherData, locale: LauncherContext['locale']): ComponentType<Record<string, unknown>> {
  return function Launcher(): ReactNode {
    const ball = useLauncherBall()
    const copy = useCopy(locale)
    const mode = useSyncExternalStore(data.mode.subscribe, data.mode.get, data.mode.get)

    // The recent list is outside React; re-read it when it changes.
    const recentKinds = useSyncExternalStore(data.recent.subscribe, data.recent.get, data.recent.get)
    const [sections, setSections] = useState<LauncherSections>(() => readSections(data.guide, data.recent))
    /**
     * The rows and card side frozen for the life of one open, or null while shut.
     *
     * Clicking a row no longer closes the card, so the card outlives the click
     * that changed the recent list. Without freezing, the clicked row would
     * immediately jump into the recent section *under the pointer*, and the next
     * click would land on a different tab than the one the user aimed at. Freezing
     * the order (and the side, so the card cannot flip sides mid-interaction) is
     * therefore a precondition for "clicking a row does not close the menu", not
     * a cosmetic extra.
     *
     * Held in state, not a ref, because the rendered rows must come from it; it is
     * set exactly once per open and cleared when the card closes.
     */
    const [frozen, setFrozen] = useState<{ readonly sections: LauncherSections; readonly side: 'top' | 'bottom' } | null>(null)

    const resyncSections = useCallback(() => {
      setSections(readSections(data.guide, data.recent))
    }, [])

    // Re-resolve whenever the card opens or the stored list changes.
    useEffect(() => {
      if (!ball.menuOpen) return
      resyncSections()
    }, [ball.menuOpen, recentKinds, resyncSections])

    // A registry change (a tab type arriving or leaving) must refresh an open
    // menu too; without this, disabling another plugin leaves stale rows.
    useEffect(() => {
      const subscribeTabs = data.tabsSubscribe
      if (subscribeTabs === undefined) return
      return subscribeTabs(() => {
        resyncSections()
      })
    }, [resyncSections])

    // Snapshot on open, release on close. Reading the live values here rather
    // than inside the set-state updater keeps the freeze to one honest read of
    // what is actually on screen at the instant the card appears.
    useEffect(() => {
      if (!ball.menuOpen) {
        setFrozen(null)
        return
      }
      setFrozen({
        sections: readSections(data.guide, data.recent),
        side: preferredSide(ball.position),
      })
      // Only the open edge is a dependency: the whole point is to NOT re-read
      // when the position, the guide, or the recent list changes underneath an
      // open card. The lint rule is suppressed with that reason rather than
      // listing dependencies that would defeat the freeze.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ball.menuOpen])

    // ---- the operations menu ----
    //
    // One snapshot per open, read at the moment the right-click renders. Both
    // menus re-read their data on open (the hover menu re-runs `readSections`),
    // and this follows that same mechanism so the disabled rows and the action the
    // user then picks describe one instant.
    //
    // It is computed during the render rather than in an effect, and that is a
    // correctness point rather than a preference: effects run *after* the browser
    // could have painted, so an effect-filled snapshot would let the card's first
    // frame draw with `rows = []` — an empty card that visibly snaps to six rows.
    // `useMemo` keyed on the open flag makes the read happen once, in the same
    // commit as the open, so the first painted frame is the finished card.
    //
    // The read is a pure DOM/API query (see `sidebar-actions.ts`); it mutates
    // nothing, which is what makes it safe to run in a render.
    const actionState = useMemo<SidebarActionState | null>(
      () => (ball.actionsOpen ? readActionState(data.sidebarRight, data.sessionId()) : null),
      [ball.actionsOpen],
    )

    /**
     * Run one of the six actions and dismiss the card.
     *
     * Every branch reads its ids from the snapshot or re-reads once, up front, and
     * only then closes: a close does not commit to the DOM until this handler
     * returns, so a loop that re-read between closes would act on stale markup. See
     * `sidebar-actions.ts`.
     */
    const onRunAction = useCallback((id: SidebarActionId) => {
      const faces = data.sidebarRight
      const sessionId = data.sessionId()
      switch (id) {
        case 'clearDocked':
          closeTabs(faces, dockGroups(sessionId).all, sessionId)
          collapseIfExpanded(faces)
          break
        case 'clearAll':
          closeTabs(faces, allTabIds(faces, sessionId), sessionId)
          collapseIfExpanded(faces)
          break
        case 'clearLeft':
          closeTabs(faces, dockGroups(sessionId).left, sessionId)
          break
        case 'clearRight':
          closeTabs(faces, dockGroups(sessionId).right, sessionId)
          break
        case 'clearFloats': {
          const all = allTabIds(faces, sessionId)
          closeTabs(faces, floatedTabIds(all, dockGroups(sessionId).all), sessionId)
          break
        }
        case 'resetBall':
          ball.resetPosition()
          break
      }
      ball.setActionsOpen(false)
    }, [ball])

    /**
     * Open one row and leave the menu up.
     *
     * The menu deliberately does NOT close here (a left or right click on a row
     * keeps it open; only the pointer leaving both the ball and the card closes
     * it). Two consequences are load-bearing:
     *
     * 1. The target pane is read from the live DOM *per activation* rather than
     *    from the render that drew the rows, because a row click may itself have
     *    created a pane a moment ago.
     * 2. `sections` and `side` are frozen for as long as the card is up, so the
     *    row the pointer is over cannot move to the recent section underneath it
     *    (which would make a double click land on a different tab).
     */
    const onActivate = useCallback((kind: string, gesture: 'left' | 'right') => {
      data.open(kind, gesture)
      // Only meaningful in the degraded mode; in b1 the host's strip is the
      // authority and recording here would double-count.
      data.tracker.recordLauncherOpen(kind)
    }, [])

    // ---- hover grace, spanning the ball and the portaled card ----
    const closeTimer = useRef(0)

    // The pointer's last known viewport position, kept so the grace can hit-test
    // at the moment it fires. See `armClose` for why the timer needs it.
    const pointer = useRef({ x: -1, y: -1 })

    // A window-level move listener, because the two surfaces the grace spans (the
    // ball and the portaled card) are not in one subtree, and a pointer that goes
    // from one to the other crosses whichever element sits between them.
    useEffect(() => {
      const onMove = (event: PointerEvent) => {
        pointer.current = { x: event.clientX, y: event.clientY }
      }
      window.addEventListener('pointermove', onMove)
      return () => {
        window.removeEventListener('pointermove', onMove)
      }
    }, [])

    const cancelClose = useCallback(() => {
      if (closeTimer.current === 0) return
      window.clearTimeout(closeTimer.current)
      closeTimer.current = 0
    }, [])

    const armClose = useCallback(() => {
      cancelClose()
      closeTimer.current = window.setTimeout(() => {
        closeTimer.current = 0
        //
        // ## Why the grace hit-tests when it FIRES, not when it is armed
        //
        // The card is positioned by the host, which clamps it to a 12px viewport
        // margin. When the ball sits at a left/right edge, that clamp can land the
        // card ON the ball — and the card can appear under a pointer that has not
        // moved since. Browsers are not obliged to synthesise a `pointerenter`
        // for an element that appears beneath a stationary pointer, so the card's
        // `pointerenter` (the link that cancels the close) may never fire even
        // though the pointer is on the card. At the four corners the card and the
        // ball do not overlap, which is why the defect showed up at the left and
        // right MIDDLE only. Lengthening the grace would only shrink the window;
        // the honest fix is to re-check, at fire time, what is under the pointer.
        const { x, y } = pointer.current
        const under = x >= 0 && y >= 0 ? document.elementFromPoint(x, y) : null
        if (under !== null && (
          ball.ref.current?.contains(under) === true
          || document.querySelector('.' + (ball.actionsOpen ? ACTION_CARD_CLASS : CARD_CLASS))?.contains(under) === true
        )) {
          return // still on the ball or the card: cancel the close
        }
        // Either card can be the one under the grace; both are dismissed, and the
        // one that was not open is unaffected.
        ball.setMenuOpen(false)
        ball.setActionsOpen(false)
      }, POINTER_GRACE_MS)
    }, [ball, cancelClose])

    useEffect(() => () => {
      cancelClose()
    }, [cancelClose])

    // The card is portaled to `document.body`, so it is found by class rather
    // than by ref. The menu commits its card in the same pass, but a retry frame
    // covers a host that mounts it one frame later.
    //
    // Both menus are watched, and the two classes are distinct, so this grace
    // always finds the card that is actually up and can never clear the other
    // one's transform.
    const cardClass = ball.actionsOpen ? ACTION_CARD_CLASS : CARD_CLASS
    useEffect(() => {
      if (!ball.menuOpen && !ball.actionsOpen) return
      let frame = 0
      let card: Element | null = null

      const enter = () => {
        cancelClose()
      }
      const leave = () => {
        armClose()
      }

      const attach = () => {
        card = document.querySelector(`.${cardClass}`)
        if (card === null) {
          frame = requestAnimationFrame(attach)
          return
        }
        card.addEventListener('pointerenter', enter)
        card.addEventListener('pointerleave', leave)
      }
      attach()

      return () => {
        if (frame !== 0) cancelAnimationFrame(frame)
        if (card === null) return
        card.removeEventListener('pointerenter', enter)
        card.removeEventListener('pointerleave', leave)
      }
    }, [ball.menuOpen, ball.actionsOpen, cardClass, armClose, cancelClose])

    const onBallLeave = useCallback(() => {
      if (!ball.menuOpen && !ball.actionsOpen) return
      armClose()
    }, [armClose, ball.menuOpen, ball.actionsOpen])

    const ballElement = (
      <button
        ref={ball.ref}
        type="button"
        className="dsh-sl-ball"
        style={{ left: `${ball.position.left}px`, top: `${ball.position.top}px` }}
        data-dragging={ball.phase === 'dragging'}
        aria-label={copy('ballAria')}
        aria-haspopup="menu"
        aria-expanded={ball.menuOpen || ball.actionsOpen}
        title={copy('ballTitle')}
        onPointerEnter={(event) => {
          ball.handlers.onPointerEnter(event)
          cancelClose()
        }}
        onPointerLeave={(event) => {
          ball.handlers.onPointerLeave(event)
          onBallLeave()
        }}
        onPointerDown={ball.handlers.onPointerDown}
        onPointerMove={ball.handlers.onPointerMove}
        onPointerUp={ball.handlers.onPointerUp}
        onPointerCancel={ball.handlers.onPointerCancel}
        onContextMenu={ball.handlers.onContextMenu}
        onClick={ball.handlers.onClick}
        onKeyDown={ball.handlers.onKeyDown}
      >
        <BallGlyph />
      </button>
    )

    // The two cards hang off one ball, so the ball is rendered by whichever menu
    // is up and stays the same element across the swap: passing it as the anchor
    // to two `Menu`s at once would mount two trigger wrappers around one button.
    // Whichever is chosen, the card is closed before the other opens (see the
    // ball's state machine), so exactly one is ever in the document.
    const rows = actionState === null ? [] : buildActionRows(actionState, copy)

    // While the card is up, the rows and the side are the frozen snapshot; only
    // a closed card follows the live values (and it cannot be seen then anyway).
    // This is what keeps a double click landing on the same tab: see `frozen`.
    const shown = frozen
    const shownSections = shown?.sections ?? sections
    const shownSide = shown?.side ?? preferredSide(ball.position)

    return ball.actionsOpen
      ? (
        <SidebarActionMenu
          open
          anchorRef={ball.ref}
          rows={rows}
          hasMenuRows={data.hasMenuRows}
          side={preferredSide(ball.position)}
          onRun={onRunAction}
          onClose={() => {
            ball.setActionsOpen(false)
          }}
        >
          {ballElement}
        </SidebarActionMenu>
      )
      : (
        <LauncherMenu
          open={ball.menuOpen}
          anchorRef={ball.ref}
          recent={shownSections.recent}
          all={shownSections.all}
          degradedNote={mode === 'b2' ? copy('degraded') : undefined}
          emptyText={copy('empty')}
          emptyHint={copy('emptyHint')}
          hasMenuRows={data.hasMenuRows}
          side={shownSide}
          onActivate={onActivate}
          onClose={() => {
            ball.setMenuOpen(false)
          }}
        >
          {ballElement}
        </LauncherMenu>
      )
  }
}

/**
 * Client plugin body.
 * @param ctx - the client root context.
 */
export function apply(ctx: LauncherContext): void {
  ctx.effect(() => {
    const offZh = ctx.locale.register(LOCALE_NS, 'zh', zh)
    const offEn = ctx.locale.register(LOCALE_NS, 'en', en)
    return () => {
      offZh()
      offEn()
    }
  })

  ctx.inject(['sidebarRight', 'sidebarRightTabs'], (injected: LauncherContext) => {
    const sidebarRight = injected.get('sidebarRight') as SidebarRightFace | undefined
    const tabs = injected.get('sidebarRightTabs') as SidebarRightTabsFace | undefined
    if (sidebarRight === undefined || tabs === undefined) return

    const recent = createRecentStore()
    const mode = createModeSource()
    // Read the host's shape once, from the live service, and share that one
    // answer between the tracker and the menu: a branch taken while recording
    // cannot then disagree with the branch taken while drawing.
    const capabilities = detectCapabilities(sidebarRight)
    // Capture the method once, then bind it: `SidebarRightTabRegistry.subscribe`
    // is a class method that reads `this`, so passing the reference through
    // would lose its receiver, and `subscribe` returns the matching disposer.
    const subscribeTabs = tabs.subscribe === undefined ? undefined : tabs.subscribe.bind(tabs)
    const tracker = createRecentTracker({
      sidebarRight,
      capabilities,
      store: recent,
      onModeChange: (next) => {
        mode.set(next)
      },
    })

    // Owned by this fiber: unloading the plugin stops every observer.
    injected.effect(() => {
      tracker.start()
      return () => {
        tracker.stop()
      }
    })

    /**
     * Turn a row's gesture into a concrete pane target, from the layout as it is
     * at the instant of the click.
     *
     * The read happens per activation, not per render: a click can create a pane,
     * so a value frozen at render time would aim a second click at a pane that
     * has since moved. `single` is what a collapsed column resolves to, which is
     * what keeps "both gestures open the sidebar" true — see `openKind`, whose
     * `single` branch deliberately never checks `isExpanded` itself.
     */
    const data: LauncherData = {
      guide: () => tabs.guide(),
      recent,
      tracker,
      mode,
      tabsSubscribe: subscribeTabs,
      hasMenuRows: hasMenuRows(),
      sidebarRight,
      sessionId: () => mountedSessionId(capabilities, sidebarRight),
      open(kind, gesture) {
        // Per activation, not per render: a click can create a pane, so a value
        // captured at render time could aim the next click at a stale pane.
        // `single` is what a collapsed column resolves to, which is what keeps
        // "both gestures open the sidebar" true — see `openKind`, whose `single`
        // branch deliberately never checks `isExpanded` itself.
        if (!sidebarRight.isExpanded()) {
          openKind(capabilities, sidebarRight, kind, 'single', {})
          return
        }
        const groups = dockGroups(mountedSessionId(capabilities, sidebarRight))
        const panes: PlacementPanes = {
          ...(groups.leftPaneId === undefined ? {} : { leftPaneId: groups.leftPaneId }),
          ...(groups.rightPaneId === undefined ? {} : { rightPaneId: groups.rightPaneId }),
        }
        // The host owns the two-pane budget on every path; see `openKind`.
        openKind(capabilities, sidebarRight, kind, gesture, panes)
      },
    }

    const Launcher = createLauncher(data, ctx.locale)

    injected.effect(() => ctx.slots.inject(SLOT_KEY, () => ctx.slots.register(
      // No `locale` seat is declared: the component resolves copy through the
      // locale service itself, and declaring a namespace would make this entry's
      // rendering depend on the framework's `t` seat for no gain.
      { name: SLOT_KEY, id: 'sidebar-launcher:ball', order: 100 },
      Launcher,
    )))
  })
}
