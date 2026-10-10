import type { ReactNode } from 'react';
import type { LauncherRow } from './entries.ts';
/** Class on the portaled card; the only handle that reaches it from CSS. */
export declare const CARD_CLASS = "dsh-sl-launcher-card";
/** Props for {@link LauncherMenu}. */
export interface LauncherMenuProps {
    /** Whether the card is showing; owned by the ball's interaction machine. */
    readonly open: boolean;
    /** The ball element the card hangs from. */
    readonly anchorRef: {
        readonly current: HTMLElement | null;
    };
    /** The recent section: kinds the user most recently activated. */
    readonly recent: readonly LauncherRow[];
    /** Every guide entry, in the registry's order. */
    readonly all: readonly LauncherRow[];
    /** The ball, rendered by the primitive as the trigger. */
    readonly children: ReactNode;
    /** Why the recent section may be incomplete, when the preferred source failed. */
    readonly degradedNote?: string;
    /** Copy for the empty state. */
    readonly emptyText: string;
    /** Copy for the empty state's second line. */
    readonly emptyHint: string;
    /**
     * Whether the host renders component rows. A capability, not a version: see
     * `capabilities.hasMenuRows`.
     */
    readonly hasMenuRows: boolean;
    /**
     * Which side of the ball the card opens on, chosen by the owner from the
     * ball's live position. Both host generations take the same `side` prop.
     */
    readonly side: 'top' | 'bottom';
    /**
     * Activate a row.
     *
     * The gesture is passed through unresolved — the menu has no sidebar state and
     * must not acquire any — and the owner turns it into a concrete pane target at
     * activation time, from the layout as it is at that instant.
     *
     * @param kind - the kind to open.
     * @param gesture - `'right'` for the context-menu gesture, else `'left'`.
     */
    onActivate(kind: string, gesture: 'left' | 'right'): void;
    /** Dismiss the card. */
    onClose(): void;
}
/** What the legacy path needs to know about one emitted data row. */
interface LegacyRow {
    /** The stable id handed to `Menu`'s `items`, and the value `onSelect` returns. */
    readonly id: string;
    /** The row it draws, for activation. */
    readonly row: LauncherRow;
}
/**
 * Map a right-clicked row button back to its row, or refuse.
 *
 * This is the one genuinely fragile part of the legacy path, so it fails closed.
 * 0.1.5's row buttons carry no identifier of any kind — `role="menuitem"` is
 * their only handle — so the row is recovered by counting the menu's own buttons
 * and matching that count against the plan that produced them.
 *
 * Proceeds only when every one of these holds:
 *
 * - the button is inside THIS menu's `div[role=menu]` (a nested submenu also
 *   renders `button[role=menuitem]`, so a document-wide sweep can over-count),
 * - the menu's button count equals the number of data rows emitted,
 * - the button's index resolves to a row in the plan.
 *
 * Any failure returns `undefined`, and the caller falls back to the left-click
 * behaviour for the row the pointer was over. That is the deliberate choice: a
 * refused right-click opens the tab in the current pane, which is a legitimate
 * outcome, whereas guessing an index could open a tab the user never chose.
 *
 * @param eventTarget - the node the contextmenu event reached.
 * @param rows - the plan the menu was rendered from, in order.
 * @param surface - the menu element the row must belong to.
 * @returns the row to activate, or undefined when the mapping cannot be trusted.
 */
export declare function resolveRowByIndex(eventTarget: EventTarget | null, rows: readonly LegacyRow[], surface: Element | null): LegacyRow | undefined;
/**
 * Render the dropdown.
 *
 * On a host with component rows this is byte-for-byte the original path: the
 * `Menu` takes `children`, and `listClassName` carries {@link CARD_CLASS}. On a
 * host without them the legacy data-row card is used instead.
 *
 * @param props - sections, the anchor element, and the activation callbacks.
 * @returns the trigger with its conditional card.
 */
export declare function LauncherMenu(props: LauncherMenuProps): ReactNode;
export {};
