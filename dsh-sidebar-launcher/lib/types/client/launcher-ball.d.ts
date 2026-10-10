import { type BallPosition } from './anchor.ts';
import './launcher.css';
/** The ball's square edge in px. Exported so the menu can decide which side to
 * open on from the same number the ball is actually drawn with. */
export declare const BALL_SIZE = 36;
/** The interaction state the ball is in. */
export type BallPhase = 'idle' | 'pressed' | 'dragging';
/** What {@link useLauncherBall} hands back. */
export interface LauncherBall {
    /** Ref for the button element; the menu measures it for placement. */
    readonly ref: React.RefObject<HTMLButtonElement>;
    /** The current top-left corner, already clamped. */
    readonly position: BallPosition;
    /** The live interaction phase, for styling and for the menu's suppression. */
    readonly phase: BallPhase;
    /** Whether the hover menu should be showing. */
    readonly menuOpen: boolean;
    /** Open or close the hover menu. */
    readonly setMenuOpen: (open: boolean) => void;
    /** Whether the right-click actions menu should be showing. */
    readonly actionsOpen: boolean;
    /** Open or close the actions menu. */
    readonly setActionsOpen: (open: boolean) => void;
    /**
     * Put the ball back on its anchor and forget the stored position.
     *
     * Exposed on the ball rather than performed by the caller because both halves
     * of the reset — the state and the storage — belong to the hook that owns the
     * position, and splitting them is exactly the bug the second half exists to
     * prevent: see {@link clearStoredPosition}.
     */
    readonly resetPosition: () => void;
    /** Pointer handlers, spread onto the button. */
    readonly handlers: {
        readonly onPointerDown: React.PointerEventHandler<HTMLButtonElement>;
        readonly onPointerMove: React.PointerEventHandler<HTMLButtonElement>;
        readonly onPointerUp: React.PointerEventHandler<HTMLButtonElement>;
        readonly onPointerCancel: React.PointerEventHandler<HTMLButtonElement>;
        readonly onPointerEnter: React.PointerEventHandler<HTMLButtonElement>;
        readonly onPointerLeave: React.PointerEventHandler<HTMLButtonElement>;
        readonly onContextMenu: React.MouseEventHandler<HTMLButtonElement>;
        readonly onClick: React.MouseEventHandler<HTMLButtonElement>;
        readonly onKeyDown: React.KeyboardEventHandler<HTMLButtonElement>;
    };
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
export declare function useLauncherBall(): LauncherBall;
/** The ball's button SVG, sized by CSS. */
export declare function BallGlyph(): JSX.Element;
