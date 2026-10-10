/**
 * The ball: geometry, drag, and the interaction state machine.
 *
 * The machine exists because four gestures share one 36px target and must not
 * bleed into each other:
 *
 * | gesture            | rule                                                        |
 * |--------------------|-------------------------------------------------------------|
 * | drag               | primary button only; commits on `pointerup`                  |
 * | click              | primary button, total travel < 4px                           |
 * | hover              | suppressed from `pointerdown` until the pointer truly leaves |
 * | context menu       | never participates in a drag; opens the actions menu instead  |
 *
 * The load-bearing details:
 *
 * - `setPointerCapture` is what makes the drag survive the pointer leaving the
 *   ball, and `pointerup`/`pointercancel` both end it — a cancelled pointer (a
 *   browser gesture taking over) must not leave the ball stuck in `dragging`.
 * - Travel is accumulated from `pointerdown`, and the threshold is applied on
 *   release, not during the move: a sub-threshold move must still follow the
 *   pointer (so the ball feels attached) while still counting as a click.
 * - Position is written through React state and persisted only on release, so a
 *   drag costs one write per frame and the stored value is never a mid-drag one.
 * - `window` resize re-clamps, because a stored position can end up outside a
 *   viewport that later shrank.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { clampToViewport, measureInitialPosition, type BallPosition } from './anchor.ts'
import './launcher.css'

/** The ball's square edge in px. Exported so the menu can decide which side to
 * open on from the same number the ball is actually drawn with. */
export const BALL_SIZE = 36

/** Travel at or above this many px is a drag; below it, a click. */
const DRAG_THRESHOLD = 4

/** `localStorage` key holding the ball's committed position. */
const POSITION_KEY = 'dsh-sidebar-launcher:position'

/** Read the stored position, or undefined when absent or malformed. */
function readStoredPosition(): BallPosition | undefined {
  try {
    const raw = window.localStorage.getItem(POSITION_KEY)
    if (raw === null) return undefined
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return undefined
    const { left, top } = parsed as { left?: unknown; top?: unknown }
    if (typeof left !== 'number' || typeof top !== 'number') return undefined
    if (!Number.isFinite(left) || !Number.isFinite(top)) return undefined
    return { left, top }
  } catch {
    return undefined
  }
}

/** Persist the committed position; a refusal must not break the ball. */
function writeStoredPosition(position: BallPosition): void {
  try {
    window.localStorage.setItem(POSITION_KEY, JSON.stringify(position))
  } catch {
    // Private mode or a full quota: the on-screen position still stands.
  }
}

/**
 * Forget the stored position.
 *
 * This is what makes "reset position" survive a reload, and it is not optional.
 * The hook initializes from `readStoredPosition() ?? measureInitialPosition()`, so
 * setting the state alone would snap the ball back to the anchor only until the
 * next paint of a reloaded page, at which point the old stored corner would win
 * and the reset would look like it had never happened.
 *
 * A refusal is swallowed for the same reason {@link writeStoredPosition}'s is: the
 * on-screen result is already correct, and storage is best-effort on this host.
 */
function clearStoredPosition(): void {
  try {
    window.localStorage.removeItem(POSITION_KEY)
  } catch {
    // Private mode: nothing was readable there anyway.
  }
}

/** The interaction state the ball is in. */
export type BallPhase = 'idle' | 'pressed' | 'dragging'

/** What {@link useLauncherBall} hands back. */
export interface LauncherBall {
  /** Ref for the button element; the menu measures it for placement. */
  readonly ref: React.RefObject<HTMLButtonElement>
  /** The current top-left corner, already clamped. */
  readonly position: BallPosition
  /** The live interaction phase, for styling and for the menu's suppression. */
  readonly phase: BallPhase
  /** Whether the hover menu should be showing. */
  readonly menuOpen: boolean
  /** Open or close the hover menu. */
  readonly setMenuOpen: (open: boolean) => void
  /** Whether the right-click actions menu should be showing. */
  readonly actionsOpen: boolean
  /** Open or close the actions menu. */
  readonly setActionsOpen: (open: boolean) => void
  /**
   * Put the ball back on its anchor and forget the stored position.
   *
   * Exposed on the ball rather than performed by the caller because both halves
   * of the reset — the state and the storage — belong to the hook that owns the
   * position, and splitting them is exactly the bug the second half exists to
   * prevent: see {@link clearStoredPosition}.
   */
  readonly resetPosition: () => void
  /** Pointer handlers, spread onto the button. */
  readonly handlers: {
    readonly onPointerDown: React.PointerEventHandler<HTMLButtonElement>
    readonly onPointerMove: React.PointerEventHandler<HTMLButtonElement>
    readonly onPointerUp: React.PointerEventHandler<HTMLButtonElement>
    readonly onPointerCancel: React.PointerEventHandler<HTMLButtonElement>
    readonly onPointerEnter: React.PointerEventHandler<HTMLButtonElement>
    readonly onPointerLeave: React.PointerEventHandler<HTMLButtonElement>
    readonly onContextMenu: React.MouseEventHandler<HTMLButtonElement>
    readonly onClick: React.MouseEventHandler<HTMLButtonElement>
    readonly onKeyDown: React.KeyboardEventHandler<HTMLButtonElement>
  }
}

/**
 * Own the ball's position, drag, hover, and menu-open state.
 *
 * Hover-open lives inside this hook rather than in a caller callback, so the
 * suppression flag and the open state are the same piece of state and cannot be
 * driven out of step.
 *
 * @returns the ball's state and handlers.
 */
export function useLauncherBall(): LauncherBall {
  const ref = useRef<HTMLButtonElement>(null)
  const [position, setPosition] = useState<BallPosition>(() => {
    const stored = readStoredPosition()
    return clampToViewport(stored ?? measureInitialPosition(BALL_SIZE).position, BALL_SIZE)
  })
  const [phase, setPhase] = useState<BallPhase>('idle')
  const [menuOpen, setMenuOpen] = useState(false)
  const [actionsOpen, setActionsOpen] = useState(false)

  /**
   * Live drag bookkeeping, kept in a ref so moves never re-render for it.
   *
   * The latest offset is stored here too, which is what lets the release commit
   * from a ref instead of from inside a state updater.
   */
  const drag = useRef<{
    pointerId: number
    startX: number
    startY: number
    originLeft: number
    originTop: number
    travel: number
    moved: boolean
    dx: number
    dy: number
  } | null>(null)

  /** True while the pointer is over the ball; drives the hover-open decision. */
  const hovering = useRef(false)
  /** Suppresses hover while a press is in flight, per the mutual exclusion rule. */
  const hoverSuppressed = useRef(false)

  const endDrag = useCallback((pointerId: number, cancelled: boolean) => {
    const active = drag.current
    if (active === null || active.pointerId !== pointerId) return
    drag.current = null

    const element = ref.current
    if (element !== null && element.hasPointerCapture(pointerId)) {
      element.releasePointerCapture(pointerId)
    }

    setPhase('idle')
    // A cancelled pointer must not count as a click even if it barely moved.
    if (cancelled) return

    // Commit from the drag ref rather than from inside a state updater: React may
    // invoke an updater more than once, and a storage write is not idempotent.
    const committed = clampToViewport(
      { left: active.originLeft + active.dx, top: active.originTop + active.dy },
      BALL_SIZE,
    )
    writeStoredPosition(committed)
    setPosition(committed)
  }, [])

  const onPointerDown = useCallback<React.PointerEventHandler<HTMLButtonElement>>((event) => {
    // Right (and middle) button: leave it entirely alone so the menu's own
    // right-click handling owns the gesture.
    if (event.button !== 0) return

    // Pressing always suppresses hover, so the menu does not pop while dragging,
    // and dismisses whichever menu was up.
    hoverSuppressed.current = true
    setMenuOpen(false)
    setActionsOpen(false)

    drag.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originLeft: position.left,
      originTop: position.top,
      travel: 0,
      moved: false,
      dx: 0,
      dy: 0,
    }
    setPhase('pressed')
    // Capture so moves keep arriving after the pointer leaves the 36px target.
    event.currentTarget.setPointerCapture(event.pointerId)
  }, [position.left, position.top])

  const onPointerMove = useCallback<React.PointerEventHandler<HTMLButtonElement>>((event) => {
    const active = drag.current
    if (active === null || active.pointerId !== event.pointerId) return

    const dx = event.clientX - active.startX
    const dy = event.clientY - active.startY
    active.dx = dx
    active.dy = dy
    active.travel = Math.hypot(dx, dy)
    if (active.travel >= DRAG_THRESHOLD && !active.moved) {
      active.moved = true
      setPhase('dragging')
    }
    // Follow the pointer from the press, even below the threshold, so the ball
    // never lags behind the cursor; the threshold only decides click vs drag.
    setPosition(clampToViewport(
      { left: active.originLeft + dx, top: active.originTop + dy },
      BALL_SIZE,
    ))
  }, [])

  const onPointerUp = useCallback<React.PointerEventHandler<HTMLButtonElement>>((event) => {
    const active = drag.current
    if (active === null || active.pointerId !== event.pointerId) return

    const wasDrag = active.moved
    endDrag(event.pointerId, false)

    // Under the threshold the gesture is a click. `onClick` cannot be used for
    // this: the pointer may have been released far from the ball, and the click
    // event would then be dispatched on whatever is under the pointer instead.
    if (!wasDrag) setMenuOpen(true)

    // Re-arm hover only once the pointer has genuinely left; if it is still on
    // the ball, keeping it suppressed avoids reopening the menu a click closed.
    if (!hovering.current) hoverSuppressed.current = false
  }, [endDrag])

  const onPointerCancel = useCallback<React.PointerEventHandler<HTMLButtonElement>>((event) => {
    endDrag(event.pointerId, true)
    hoverSuppressed.current = false
  }, [endDrag])

  const onPointerEnter = useCallback<React.PointerEventHandler<HTMLButtonElement>>(() => {
    hovering.current = true
    // A press suppresses hover; otherwise entering the ball reveals the menu —
    // but never while the actions menu is up, or the two would draw at once.
    if (hoverSuppressed.current || actionsOpen) return
    setMenuOpen(true)
  }, [actionsOpen])

  const onPointerLeave = useCallback<React.PointerEventHandler<HTMLButtonElement>>(() => {
    hovering.current = false
    // Leaving always lifts the suppression: the gesture is over either way, and
    // a stale flag would kill hover for the rest of the session.
    hoverSuppressed.current = false
  }, [])

  const onContextMenu = useCallback<React.MouseEventHandler<HTMLButtonElement>>((event) => {
    event.preventDefault()
    // The two menus never stack. The hover menu is closed first, in the same
    // batch, so only one card is ever in the document; hover is suppressed for
    // the rest of the gesture for the same reason a click suppresses it.
    hoverSuppressed.current = true
    setMenuOpen(false)
    setActionsOpen(true)
  }, [])

  const onClick = useCallback<React.MouseEventHandler<HTMLButtonElement>>((event) => {
    // Click is handled on pointerup so a drag never opens the menu; this also
    // stops a stray click from reaching anything behind the overlay layer.
    event.preventDefault()
  }, [])

  const onKeyDown = useCallback<React.KeyboardEventHandler<HTMLButtonElement>>((event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      // The keyboard gesture is the hover menu's; a key press also dismisses the
      // actions menu so the two cannot be up together.
      setActionsOpen(false)
      setMenuOpen(open => !open)
    }
    if (event.key === 'Escape') {
      setMenuOpen(false)
      setActionsOpen(false)
    }
  }, [])

  // A stored position can fall outside a viewport that shrank since it was
  // written, so re-clamp whenever the window resizes.
  useEffect(() => {
    const onResize = () => {
      setPosition(current => clampToViewport(current, BALL_SIZE))
    }
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
    }
  }, [])

  // The first measurement runs before the sidebar has necessarily mounted, so if
  // it fell back to the corner, keep re-measuring until the anchor appears.
  //
  // ## Why this retries instead of firing once, measured rather than assumed
  //
  // A single 250ms retry is not enough on 0.1.7-rc.2. Measured on the live host,
  // with the column expanded, the host's chrome button does not exist in the
  // document until **~1.8s** after load:
  //
  //   600ms  anchors: []
  //   1200ms anchors: []
  //   1800ms anchors: [toggle right=1570 bottom=38]   <- first sighting
  //
  // A ball that lost its stored position (a first run, or a reset the user has not
  // yet dragged away from) is therefore still on the fallback corner at the moment
  // the one-shot retry gives up, and stays there. That is the visible defect the
  // §8 "reset survives a refresh" acceptance point describes, so the retry polls.
  //
  // ## Why polling is safe here, and where it stops
  //
  // The effect only runs when there is no stored position AND the first measure
  // missed. Both conditions are re-checked on every tick, and the poll stops at the
  // first tick that satisfies either of them:
  //
  // - a stored position appearing means the user has since dragged the ball, so
  //   their choice must win and is never overwritten;
  // - an anchored measurement is adopted once and the poll ends.
  //
  // A user-chosen position is never overwritten, which is the invariant the old
  // one-shot version was written to protect; the difference is only that the
  // "wait for the host" window is now long enough to cover the host.
  useEffect(() => {
    if (readStoredPosition() !== undefined) return
    if (measureInitialPosition(BALL_SIZE).anchored) return

    let timer = 0
    let elapsed = 0
    const POLL_MS = 250
    // The measured first sighting is ~1.8s; 8s leaves the same order of margin for
    // a slower machine while still ending, so a host that never renders an anchor
    // cannot leave a timer running for the life of the page.
    const DEADLINE_MS = 8000

    const tick = () => {
      elapsed += POLL_MS
      if (readStoredPosition() !== undefined) return
      const measured = measureInitialPosition(BALL_SIZE)
      if (measured.anchored) {
        setPosition(clampToViewport(measured.position, BALL_SIZE))
        return
      }
      if (elapsed >= DEADLINE_MS) return
      timer = window.setTimeout(tick, POLL_MS)
    }
    timer = window.setTimeout(tick, POLL_MS)

    return () => {
      window.clearTimeout(timer)
    }
  }, [])

  /**
   * Send the ball back to its measured anchor and forget the stored position.
   *
   * The measure is re-run rather than cached: the anchor button is the host's own
   * collapse/expand control, and the two are different elements at different
   * offsets (one sits in the expanded header, one in the collapsed rail), so a
   * position measured at mount can name a control that is no longer on screen.
   * Both halves are required — see {@link clearStoredPosition}.
   */
  const resetPosition = useCallback(() => {
    setPosition(clampToViewport(measureInitialPosition(BALL_SIZE).position, BALL_SIZE))
    clearStoredPosition()
  }, [])

  const handlers = useMemo(() => ({
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onPointerEnter,
    onPointerLeave,
    onContextMenu,
    onClick,
    onKeyDown,
  }), [
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onPointerEnter,
    onPointerLeave,
    onContextMenu,
    onClick,
    onKeyDown,
  ])

  return { ref, position, phase, menuOpen, setMenuOpen, actionsOpen, setActionsOpen, resetPosition, handlers }
}

/** The ball's button SVG, sized by CSS. */
export function BallGlyph(): JSX.Element {
  return (
    <svg className="dsh-sl-ball-glyph" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <rect x="1.75" y="1.75" width="6" height="6" fill="currentColor" />
      <rect x="10.25" y="1.75" width="6" height="6" fill="currentColor" />
      <rect x="1.75" y="10.25" width="6" height="6" fill="currentColor" />
      <rect x="10.25" y="10.25" width="6" height="6" fill="currentColor" />
    </svg>
  )
}
