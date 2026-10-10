import type { ReactNode } from 'react';
import { type ElementRef } from './menu-card.ts';
import type { SidebarActionState } from './sidebar-actions.ts';
/** Class on the operation card; the only handle that reaches it from CSS. */
export declare const ACTION_CARD_CLASS = "dsh-sl-action-card";
/** The six actions, in their fixed menu order. */
export type SidebarActionId = 'clearDocked' | 'clearAll' | 'clearLeft' | 'clearRight' | 'clearFloats' | 'resetBall';
/** One drawable row of the operations menu. */
export interface SidebarActionRow {
    /** The action to run; also the React key and the legacy data-row id. */
    readonly id: SidebarActionId;
    /** The localized label. */
    readonly label: string;
    /** Whether the row is greyed and unselectable. */
    readonly disabled: boolean;
    /** Whether the row starts a new group (a hairline above it). */
    readonly separatorBefore: boolean;
    /** The leading glyph. */
    readonly icon: ReactNode;
}
/**
 * Build the six rows from one snapshot.
 *
 * Order and grouping are fixed by the brief: the two clear-and-collapse rows,
 * then a hairline, then the two pane rows and the float row, then a hairline, then
 * the ball's own reset. The two hairlines are `separatorBefore` on rows 2 and 5,
 * which is why the first row can never draw one.
 *
 * The three disabled rules are exactly the brief's:
 *
 * - both pane rows grey out on a single docked pane (`dock.count < 2`), because
 *   "clear the right pane" is a no-op when there is no right pane;
 * - the float row greys out when nothing floats;
 * - the two clear-and-collapse rows are never disabled — with nothing open they
 *   still collapse an expanded column, which is a real, harmless outcome.
 *
 * @param state - the snapshot from `readActionState`.
 * @param copy - the launcher's locale resolver.
 * @returns the rows, in menu order.
 */
export declare function buildActionRows(state: SidebarActionState, copy: (key: string) => string): readonly SidebarActionRow[];
/** Props for {@link SidebarActionMenu}. */
export interface SidebarActionMenuProps {
    /** Whether the card is showing; owned by the launcher component. */
    readonly open: boolean;
    /** The ball element the card hangs from. */
    readonly anchorRef: ElementRef;
    /** The rows to draw, from {@link buildActionRows}. */
    readonly rows: readonly SidebarActionRow[];
    /** The ball, rendered by the primitive as the trigger. */
    readonly children: ReactNode;
    /** Whether the host renders component rows. A capability, not a version. */
    readonly hasMenuRows: boolean;
    /** Which side of the ball the card opens on. */
    readonly side: 'top' | 'bottom';
    /** Run one action and dismiss the card. */
    onRun(id: SidebarActionId): void;
    /** Dismiss the card. */
    onClose(): void;
}
/**
 * Render the operations dropdown.
 *
 * On a host with component rows each row is a `MenuItemButton`, which carries
 * `disabled` and `separatorBefore` as props; on a host without them the legacy
 * data-row card is used instead.
 *
 * @param props - the rows, the anchor element, and the callbacks.
 * @returns the trigger with its conditional card.
 */
export declare function SidebarActionMenu(props: SidebarActionMenuProps): ReactNode;
