/**
 * The right-click operations menu: six flat actions on the right Sidebar.
 *
 * Split out of `launcher-menu.tsx` for the reason the brief gives — that file is
 * long enough — and because this card is a *different menu*, not a section of the
 * other one: it has its own open state, its own card class, and its own rows.
 * What the two share is lifted into `menu-card.ts` (portaled-card discovery, the
 * avoid-the-ball loop) and, for the skin, into `launcher.css`.
 *
 * ## Rows are data, so they can be tested without a browser
 *
 * {@link buildActionRows} is the whole decision surface — which of the six rows
 * exists, in what order, where the two hairlines fall, and which rows are
 * disabled — and it is a pure function of a snapshot plus a copy resolver. The
 * component below only renders it. That is what makes the disabled rules (single
 * pane, no floats) assertable in jsdom without driving a menu.
 *
 * ## Two host generations, one row set
 *
 * 0.1.7 renders component rows through `MenuItemButton`; 0.1.5 has neither that
 * primitive nor `listClassName`, so its rows are `items` data and the card is
 * branded after the fact. Both paths are chosen by the same `hasMenuRows()`
 * capability the hover menu uses, never by a version string.
 *
 * ## Right-click inside this menu does nothing
 *
 * The hover menu maps a right-click on a row to "open in a new pane". These rows
 * are not tab kinds and have no such gesture, so the browser menu is simply
 * suppressed — there is deliberately no document-level contextmenu listener here.
 */
import { Menu, MenuItemButton } from '@deepseek-ai/dsh-client-ui-primitives'
import type { MenuEntry } from '@deepseek-ai/dsh-client-ui-primitives'
import { useCallback } from 'react'
import type { ReactNode } from 'react'
import { useAvoidAnchor, useLegacyCard, type ElementRef } from './menu-card.ts'
import type { SidebarActionState } from './sidebar-actions.ts'

/** Class on the operation card; the only handle that reaches it from CSS. */
export const ACTION_CARD_CLASS = 'dsh-sl-action-card'

/** The six actions, in their fixed menu order. */
export type SidebarActionId =
  | 'clearDocked'
  | 'clearAll'
  | 'clearLeft'
  | 'clearRight'
  | 'clearFloats'
  | 'resetBall'

/** One drawable row of the operations menu. */
export interface SidebarActionRow {
  /** The action to run; also the React key and the legacy data-row id. */
  readonly id: SidebarActionId
  /** The localized label. */
  readonly label: string
  /** Whether the row is greyed and unselectable. */
  readonly disabled: boolean
  /** Whether the row starts a new group (a hairline above it). */
  readonly separatorBefore: boolean
  /** The leading glyph. */
  readonly icon: ReactNode
}

/**
 * A 16px box glyph drawn in the row's own text colour.
 *
 * The launcher draws its own glyphs rather than importing the host's icon set,
 * and that is a compatibility decision rather than a stylistic one. The two hosts
 * publish different icon vocabularies: 0.1.7 exports ~378 names in
 * `IconThingOutline16`/`Regular` form, 0.1.5 exports 76 in a different set.
 * Picking names that exist on both would leave this plugin hostage to that
 * intersection; inline art costs a few hundred bytes and cannot go missing.
 *
 * @param props.children - the path elements.
 * @returns the glyph element.
 */
function Glyph({ children }: { readonly children: ReactNode }): ReactNode {
  return (
    <svg className="dsh-sl-action-glyph" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      {children}
    </svg>
  )
}

/** The stroke shared by every glyph, so the set reads as one family. */
const STROKE = {
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

/**
 * The six leading glyphs, keyed by action.
 *
 * Each one says what the row does to the *surface*, not merely that it clears
 * something: `clearDocked` keeps the float block, `clearAll` drops it, `clearLeft`
 * and `clearRight` are the two halves of a split, `clearFloats` is a detached
 * panel, and `resetBall` is a re-centre.
 */
const GLYPHS: Readonly<Record<SidebarActionId, ReactNode>> = {
  clearDocked: (
    <Glyph>
      <rect x="2" y="3.5" width="12" height="3.5" rx="1" {...STROKE} />
      <path d="M3.5 10.5h9" {...STROKE} />
      <path d="M3.5 13h5" {...STROKE} />
    </Glyph>
  ),
  clearAll: (
    <Glyph>
      <rect x="2" y="3.5" width="12" height="3.5" rx="1" {...STROKE} />
      <path d="M3.5 10.5h9" {...STROKE} />
      <path d="M6 13h4" {...STROKE} />
      <path d="M13.4 6.6l-4.8 4.8" {...STROKE} />
    </Glyph>
  ),
  clearLeft: (
    <Glyph>
      <rect x="2" y="3" width="12" height="10" rx="1.5" {...STROKE} />
      <path d="M8 3v10" {...STROKE} />
      <path d="M3.6 6.4h2.2" {...STROKE} />
      <path d="M3.6 9.6h2.2" {...STROKE} />
      <path d="M6.6 5.2l-2 2.4 2 2.4" {...STROKE} />
    </Glyph>
  ),
  clearRight: (
    <Glyph>
      <rect x="2" y="3" width="12" height="10" rx="1.5" {...STROKE} />
      <path d="M8 3v10" {...STROKE} />
      <path d="M10.2 6.4h2.2" {...STROKE} />
      <path d="M10.2 9.6h2.2" {...STROKE} />
      <path d="M9.4 5.2l2 2.4-2 2.4" {...STROKE} />
    </Glyph>
  ),
  clearFloats: (
    <Glyph>
      <rect x="2.2" y="2.6" width="9" height="7.4" rx="1.4" {...STROKE} />
      <rect x="5.4" y="5.6" width="8.4" height="7" rx="1.4" {...STROKE} />
    </Glyph>
  ),
  resetBall: (
    <Glyph>
      <circle cx="8" cy="8" r="5.2" {...STROKE} />
      <circle cx="8" cy="8" r="1.6" {...STROKE} />
      <path d="M8 1.2v1.8M8 13v1.8M1.2 8h1.8M13 8h1.8" {...STROKE} />
    </Glyph>
  ),
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
export function buildActionRows(
  state: SidebarActionState,
  copy: (key: string) => string,
): readonly SidebarActionRow[] {
  const twoPanes = state.dock.count > 1
  const hasFloats = state.floated.length > 0
  return [
    { id: 'clearDocked', label: copy('actionClearDocked'), disabled: false, separatorBefore: false, icon: GLYPHS.clearDocked },
    { id: 'clearAll', label: copy('actionClearAll'), disabled: false, separatorBefore: false, icon: GLYPHS.clearAll },
    { id: 'clearLeft', label: copy('actionClearLeft'), disabled: !twoPanes, separatorBefore: true, icon: GLYPHS.clearLeft },
    { id: 'clearRight', label: copy('actionClearRight'), disabled: !twoPanes, separatorBefore: false, icon: GLYPHS.clearRight },
    { id: 'clearFloats', label: copy('actionClearFloats'), disabled: !hasFloats, separatorBefore: false, icon: GLYPHS.clearFloats },
    { id: 'resetBall', label: copy('actionResetBall'), disabled: false, separatorBefore: true, icon: GLYPHS.resetBall },
  ]
}

/** Props for {@link SidebarActionMenu}. */
export interface SidebarActionMenuProps {
  /** Whether the card is showing; owned by the launcher component. */
  readonly open: boolean
  /** The ball element the card hangs from. */
  readonly anchorRef: ElementRef
  /** The rows to draw, from {@link buildActionRows}. */
  readonly rows: readonly SidebarActionRow[]
  /** The ball, rendered by the primitive as the trigger. */
  readonly children: ReactNode
  /** Whether the host renders component rows. A capability, not a version. */
  readonly hasMenuRows: boolean
  /** Which side of the ball the card opens on. */
  readonly side: 'top' | 'bottom'
  /** Run one action and dismiss the card. */
  onRun(id: SidebarActionId): void
  /** Dismiss the card. */
  onClose(): void
}

/**
 * The legacy (data-row) operations card.
 *
 * 0.1.5's `Menu` reads `items` and ignores `children` entirely, so the rows and
 * their separators are emitted as data. A separator is a distinct entry type
 * there, so the two hairlines are spliced into the list rather than expressed as
 * a property of a row — and the result is the same three groups the modern path
 * draws from `separatorBefore`.
 *
 * No footer is emitted. The hover menu uses one for its degraded notice because
 * that chrome has nowhere else to go on this host; this card has no such chrome,
 * and an empty footer would only add a pinned region and a redundant hairline.
 *
 * @param props - the rows and callbacks.
 * @returns the `Menu` with data rows and a hand-branded card.
 */
function LegacyActionMenu(props: SidebarActionMenuProps): ReactNode {
  // The returned ref is not needed here (these rows carry no right-click
  // gesture), but the hook is: on this generation it is what brands the portaled
  // card with the launcher's class, which is the only handle the stylesheet has.
  useLegacyCard(props.open, [], ACTION_CARD_CLASS)
  useAvoidAnchor(props.open, props.anchorRef, ACTION_CARD_CLASS)

  const onSelect = useCallback((id: string) => {
    const row = props.rows.find(candidate => candidate.id === id)
    if (row === undefined || row.disabled) return
    props.onRun(row.id)
  }, [props])

  const items: MenuEntry[] = []
  props.rows.forEach((row, index) => {
    if (row.separatorBefore && index > 0) items.push({ type: 'separator', id: 'sep:' + row.id })
    items.push({ id: row.id, label: row.label, icon: row.icon, disabled: row.disabled })
  })

  return (
    <Menu
      open={props.open}
      anchor={props.children}
      portal
      items={items}
      onSelect={onSelect}
      // The ball is fixed-positioned, so the primitive must be handed the real
      // trigger rect rather than measuring its own wrapper.
      getAnchorRect={() => props.anchorRef.current?.getBoundingClientRect() ?? null}
      align="end"
      side={props.side}
      onClose={props.onClose}
    />
  )
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
export function SidebarActionMenu(props: SidebarActionMenuProps): ReactNode {
  if (!props.hasMenuRows) return <LegacyActionMenu {...props} />

  useAvoidAnchor(props.open, props.anchorRef, ACTION_CARD_CLASS)

  return (
    <Menu
      open={props.open}
      anchor={props.children}
      portal
      listClassName={ACTION_CARD_CLASS}
      getAnchorRect={() => props.anchorRef.current?.getBoundingClientRect() ?? null}
      align="end"
      side={props.side}
      onClose={props.onClose}
    >
      {props.rows.map(row => (
        <MenuItemButton
          key={row.id}
          icon={row.icon}
          disabled={row.disabled}
          separatorBefore={row.separatorBefore}
          onSelect={() => {
            if (row.disabled) return
            props.onRun(row.id)
          }}
        >
          {row.label}
        </MenuItemButton>
      ))}
    </Menu>
  )
}
