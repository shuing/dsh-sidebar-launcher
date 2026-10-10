/** The portaled list, whichever generation rendered it. */
export declare const LIST_SELECTOR = "div[role=menu]";
/** Props shape shared by both callers: anything with a nullable element ref. */
export interface ElementRef {
    readonly current: HTMLElement | null;
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
export declare function useAvoidAnchor(open: boolean, anchorRef: ElementRef, cardClass: string): {
    readonly current: HTMLElement | null;
};
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
export declare function useLegacyCard(open: boolean, footerClasses: readonly string[], cardClass: string, footerClass?: string): {
    readonly current: Element | null;
};
