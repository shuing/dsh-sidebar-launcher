/**
 * Card plumbing shared by the two menus the launcher owns.
 *
 * The hover menu (tab kinds) and the operations menu (sidebar actions) are
 * different cards, but they hang off the same ball, are portaled the same way, and
 * need the same two pieces of host-generation reconciliation: locating the
 * portaled card so it can be branded, and keeping it off the ball frame by frame.
 * Both were written once, in the hover menu; this module is that code moved out
 * unchanged so the second menu reuses it rather than growing a copy.
 *
 * ## Why the card class is a parameter and not a shared constant
 *
 * The two cards deliberately do NOT share one class. Both are portaled to
 * `document.body`, and several effects reach a card by class alone — the hover
 * grace in `index.tsx`, `useAvoidAnchor`'s residue cleanup, `useLegacyCard`'s
 * branding. Those lookups take the *first* match, so one class for two cards would
 * make each effect guess which card it found, and the hover menu's close could
 * clear the operations menu's transform. Distinct classes, each passed in here,
 * keep every lookup unambiguous. The shared *skin* is a CSS concern and lives in
 * `launcher.css`, where one selector list covers both classes.
 */
import { useEffect, useLayoutEffect, useRef } from 'react'

/** The portaled list, whichever generation rendered it. */
export const LIST_SELECTOR = 'div[role=menu]'

/** Props shape shared by both callers: anything with a nullable element ref. */
export interface ElementRef {
  readonly current: HTMLElement | null
}

/**
 * Find the menu card this launcher just opened.
 *
 * The portaled list renders under `document.body`, so it is not reachable by
 * walking down from the ball. The only reliable handle is the difference between
 * the menus on screen now and the ones that were there before this one opened —
 * which is what keeps another plugin's menu from being mistaken for ours.
 *
 * @param known - the menu elements observed before the open.
 * @returns the newest menu that was not in `known`, or undefined when none yet.
 */
function findOpenedCard(known: ReadonlySet<Element>): Element | undefined {
  const candidates = Array.from(document.querySelectorAll(LIST_SELECTOR))
    .filter(element => !known.has(element))
  // Newest last: a card appended by this open is the last one in document order.
  return candidates[candidates.length - 1]
}

/**
 * Keep a menu off the ball, frame by frame.
 *
 * ## Why this exists even though the card opens on the far side of the ball
 *
 * Choosing `side` from the ball's half of the viewport (see the owners) removes
 * the overlap in the ordinary case, but it does NOT make overlap impossible.
 * When the card is at its scroll ceiling and the ball sits low, `side='top'`
 * computes `y = ballTop - cardHeight - 4`, which is negative; the host clamps that
 * to its 12px viewport margin, so the card is pushed back down over the ball. The
 * host also re-aims the card on its own whenever the ball moves, so this has to be
 * re-checked rather than decided once.
 *
 * ## Why it writes `transform` and never `left`/`top`
 *
 * 0.1.7's host runs a `requestAnimationFrame` loop that recomputes the card's
 * position with `setFixedPos` every frame. Anything written to `left` or `top` is
 * overwritten on the next frame; `transform` is never touched by either host,
 * which makes it the one channel that survives. A bonus falls out of the same
 * mechanism: that loop keeps running while the card is open, so dragging the ball
 * with the menu up moves the card out of the way live.
 *
 * ## How the nudge is chosen
 *
 * Horizontal first, because it is the cheaper move: with `align='end'` the card's
 * right edge sits on the ball's right edge, so pushing left clears it in one step.
 * If that would take the card past the viewport's left edge, or the ball is to the
 * card's left, the vertical nudge is used instead. Exactly one axis is ever
 * written, so the two nudges cannot compound into a drift; the transform is cleared
 * the moment there is no overlap.
 *
 * @param open - whether the card is showing.
 * @param anchorRef - the ball element.
 * @param cardClass - the class this menu's card carries once branded.
 * @returns a ref holding the card element once the owner has branded it.
 */
export function useAvoidAnchor(open: boolean, anchorRef: ElementRef, cardClass: string): { readonly current: HTMLElement | null } {
  const cardRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) {
      // Closing must leave no residue: a stale transform would offset the next
      // open, and the host would have no reason to undo it.
      const stale = document.querySelector<HTMLElement>('.' + cardClass)
      if (stale !== null) stale.style.transform = ''
      return
    }

    let frame = 0
    let card: HTMLElement | null = null

    const step = () => {
      frame = requestAnimationFrame(step)
      // Re-resolve while the card is missing or has been replaced: on the
      // legacy path it is branded a frame later, and a host re-render of the
      // portal swaps the element out from under us.
      if (card === null || !card.isConnected) card = document.querySelector<HTMLElement>('.' + cardClass)
      const ball = anchorRef.current
      if (card === null || ball === null) return

      if (card.style.transform !== '') {
        // Measuring a transformed element yields the TRANSFORMED box, which
        // would feed the nudge back into itself. Clear, measure, then decide.
        card.style.transform = ''
      }

      const c = card.getBoundingClientRect()
      const b = ball.getBoundingClientRect()
      // Nothing to avoid when either box is collapsed (unmounted or hidden).
      if (c.width === 0 || c.height === 0 || b.width === 0 || b.height === 0) return
      const overlaps = c.left < b.right && c.right > b.left && c.top < b.bottom && c.bottom > b.top
      if (!overlaps) return

      const GAP = 8
      const MARGIN = 4

      // Horizontal: slide past the ball's right edge, or clear of its left.
      const dx = c.left >= b.left ? b.right - c.left + GAP : b.left - c.right - GAP
      if (c.left + dx >= MARGIN && c.right + dx <= window.innerWidth - MARGIN) {
        card.style.transform = 'translateX(' + Math.round(dx) + 'px)'
        return
      }

      // Vertical fallback: drop the card clear below the ball. On a very short
      // window the host may still clamp it back into an overlap, but the
      // horizontal attempt above already covers the ordinary low-ball case;
      // this is the last legal move rather than a guarantee.
      const dy = b.bottom - c.top + GAP
      card.style.transform = 'translateY(' + Math.round(dy) + 'px)'
    }

    frame = requestAnimationFrame(step)

    return () => {
      cancelAnimationFrame(frame)
      // Cleared unconditionally, and deliberately NOT guarded by isConnected.
      // The host removes the card in the same commit that closes the menu, so
      // by the time this cleanup runs the element is usually already detached —
      // a connectivity guard would skip exactly the case it was written for and
      // leave the nudge on the node. (The next open clears it on its first tick
      // anyway, so this is about never leaving the residue, not about it being
      // visible.)
      if (card !== null) card.style.transform = ''
      const live = document.querySelector<HTMLElement>('.' + cardClass)
      if (live !== null) live.style.transform = ''
    }
  }, [open, anchorRef, cardClass])

  return cardRef
}

/**
 * Track a legacy (data-row) card: brand it, and expose it for hit-testing.
 *
 * 0.1.5 has no `listClassName`, so the class has to be added after the fact, and
 * any right-click mapper needs the same element to scope its button sweep. Both
 * therefore read one ref, resolved once per open — rather than each running its own
 * query, which could disagree about which menu is ours.
 *
 * `footerClasses` names one launcher class per footer entry, in order. The host
 * builds those entries itself from `{type:'label'}` data, so they cannot carry our
 * classes at construction; tagging them here is what lets one stylesheet draw the
 * same chrome on both hosts.
 *
 * A retry frame covers a host that mounts the card one frame later.
 *
 * @param open - whether the card should be showing.
 * @param footerClasses - launcher class per footer entry, in emitted order.
 * @param cardClass - the class to brand the card with.
 * @param footerClass - the class to brand the footer region with, or undefined.
 * @returns a ref holding the card element, or null while it is unresolved.
 */
export function useLegacyCard(
  open: boolean,
  footerClasses: readonly string[],
  cardClass: string,
  footerClass?: string,
): { readonly current: Element | null } {
  const cardRef = useRef<Element | null>(null)
  // Snapshot the menus present *before* this one opens, so the diff cannot pick
  // up a menu owned by another plugin.
  //
  // The snapshot is taken on the CLOSED render, not the open one, and that
  // ordering is load-bearing. React runs layout effects after committing the DOM,
  // so on the open render the card this component just rendered is already in the
  // document — snapshotting there would put our own card into `known` and the
  // diff below would find nothing. Taking it while closed means it describes the
  // document as it was immediately before our card appeared, which is exactly the
  // set to subtract.
  const knownRef = useRef<ReadonlySet<Element>>(new Set())
  // Read through a ref so the attach effect does not restart on every render:
  // the caller rebuilds this array inline, and re-running on its identity would
  // cancel the retry frame each time.
  const footerClassesRef = useRef(footerClasses)
  footerClassesRef.current = footerClasses

  useLayoutEffect(() => {
    if (open) return
    knownRef.current = new Set(document.querySelectorAll(LIST_SELECTOR))
    cardRef.current = null
  }, [open])

  useEffect(() => {
    if (!open) return
    let frame = 0
    let branded: Element | null = null
    let tagged: readonly Element[] = []

    const attach = () => {
      const card = findOpenedCard(knownRef.current)
      if (card === undefined) {
        frame = requestAnimationFrame(attach)
        return
      }
      card.classList.add(cardClass)
      cardRef.current = card
      branded = card

      if (footerClass === undefined) return
      // The host renders the items viewport and the footer as two sibling
      // `div[role=presentation]` children, so the footer is the *second* one —
      // taking "the last" alone would brand the items viewport whenever no footer
      // was emitted.
      const regions = Array.from(card.children)
        .filter(child => child.getAttribute('role') === 'presentation')
      const footer = regions[1]
      if (footer === undefined) return
      footer.classList.add(footerClass)

      const entries = Array.from(footer.children)
      const classes = footerClassesRef.current
      tagged = entries
      entries.forEach((entry, index) => {
        const className = classes[index]
        if (className !== undefined) entry.classList.add(className)
      })
    }
    attach()

    return () => {
      if (frame !== 0) cancelAnimationFrame(frame)
      cardRef.current = null
      // The host removes the card with the menu; clearing the classes keeps the
      // DOM honest in case the same element is ever reused.
      if (branded !== null && branded.isConnected) {
        branded.classList.remove(cardClass)
        if (footerClass !== undefined) branded.classList.remove(footerClass)
        for (const entry of tagged) entry.classList.remove(...footerClassesRef.current)
      }
    }
  }, [open, cardClass, footerClass])

  return cardRef
}
