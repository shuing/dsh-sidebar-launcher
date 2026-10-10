/**
 * Where the ball starts, and how it is kept on screen.
 *
 * The ball's position belongs to the user once they have dragged it, so this
 * module only answers the *initial* placement question: pin the ball under the
 * right column's own chrome button and flush with its right edge, which keeps it
 * in the column gutter instead of over the conversation.
 *
 * The two selectors are the host's own attributes on that button — `toggle` is
 * the collapse control the header shows while the column is expanded, `expand`
 * is the one the collapsed rail shows. Exactly one of them is in the document at
 * a time, so probing them in order is enough and no state has to be tracked.
 */
/** A viewport-space position for the ball's top-left corner. */
export interface BallPosition {
    readonly left: number;
    readonly top: number;
}
/** A measured placement, and whether it came from the host's chrome button. */
export interface MeasuredPosition {
    readonly position: BallPosition;
    /** False when the fallback corner was used because no anchor was on screen. */
    readonly anchored: boolean;
}
/**
 * Keep the whole ball inside the viewport.
 *
 * The requirement is that the ball can always be grabbed again after a drag that
 * overshoots the edge. A 36px ball cannot leave "48px" of itself visible, so the
 * stronger rule is applied instead: every pixel of the ball stays on screen. That
 * satisfies the requirement's intent — nothing is ever lost off-screen — and it
 * cannot be satisfied "partially" the way a slack threshold could.
 *
 * @param position - the wanted top-left corner.
 * @param size - the ball's square edge in px.
 * @returns a position clamped into the viewport.
 */
export declare function clampToViewport(position: BallPosition, size: number): BallPosition;
/**
 * Measure the right column's chrome button and return the ball's first position.
 *
 * Called at first render, when the sidebar may not be mounted yet, so the result
 * reports whether it actually measured the anchor: a caller that gets the
 * fallback can re-measure once the frame has settled without losing a
 * user-chosen position.
 *
 * @param size - the ball's square edge in px.
 * @returns the anchor-derived position, or the viewport's bottom-right corner.
 */
export declare function measureInitialPosition(size: number): MeasuredPosition;
