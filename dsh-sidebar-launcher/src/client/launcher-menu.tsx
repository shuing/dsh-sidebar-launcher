/**
 * The popup menu: recent kinds on top, then every guide entry.
 *
 * The rows come from the host's own `Menu` primitive, which is what makes this
 * read as a native menu rather than a lookalike: the same card material, the same
 * row rhythm, the same keyboard walk, and the same post-selection focus return.
 *
 * ## Two host generations, one visual result
 *
 * 0.1.7-rc.2 lets an owner pass *component* rows (`children`) and style the card
 * with `listClassName`. 0.1.5-rc.2 has neither: its `Menu` takes `items` data
 * only, `listClassName` does not exist, and `className` lands on the anchor
 * wrapper rather than the card. So the legacy path emits data rows and then
 * brands the card itself. The two paths are chosen by `hasMenuRows()` — a
 * capability, never a version.
 *
 * Three things had to be rebuilt for the 0.1.5 path, each verified against the
 * installed artifact rather than assumed:
 *
 * 1. **Icons and labels go in the fields the host renders.** 0.1.5's `renderEntry`
 *    puts `entry.icon` inside `span.itemIcon` and `entry.label` inside
 *    `span.itemLabel`, so the icon is handed over as a node and the title as the
 *    label. Composing them into one node ourselves would nest a second icon span
 *    and lose the host's alignment and colour.
 * 2. **The card class is attached after the fact.** With no `listClassName`, the
 *    portaled `div[role=menu]` is found by diffing the document against a
 *    pre-open snapshot — the only handle that reaches a card rendered under
 *    `document.body`.
 * 3. **Right-click is recovered by position.** 0.1.5's row buttons carry no
 *    `data-*` marker at all, so a right-click is mapped back to a row by counting
 *    `button[role=menuitem]`. That mapping is asserted, and a mismatch abandons
 *    the right-click in favour of the left-click behaviour for the row the
 *    pointer was actually over — it never activates whatever happens to sit at
 *    that index. See {@link resolveRowByIndex}.
 *
 * Host behaviours relied on and worth naming, because each was checked in the
 * installed artifact rather than assumed:
 *
 * - `Menu` closes on a document `pointerdown` outside its trigger and its list,
 *   and it has no `contextmenu` handler at all (0 occurrences across the whole
 *   primitives bundle). A right-click on a row therefore reaches our own
 *   `onContextMenu` handler without the menu tearing itself down.
 * - The list is portaled, so the anchor rect is supplied directly instead of
 *   letting the primitive measure its wrapper — the ball is fixed-positioned and
 *   is not laid out where the wrapper sits.
 * - `closeOnPointerLeave` is deliberately NOT used. Its grace is wired to the
 *   trigger wrapper only, so with a portaled list nothing cancels it once the
 *   pointer moves onto the card and the menu would close under the cursor. The
 *   owning component runs an equivalent grace that covers both the ball and the
 *   portaled card.
 */
import { Menu, MenuItemButton } from '@deepseek-ai/dsh-client-ui-primitives'
import { useCallback, useEffect } from 'react'
import type { ComponentType, ReactNode } from 'react'
import type { LauncherRow } from './entries.ts'
import type { IconProps } from './context-types.ts'
import { useAvoidAnchor, useLegacyCard } from './menu-card.ts'

/** Class on the portaled card; the only handle that reaches it from CSS. */
export const CARD_CLASS = 'dsh-sl-launcher-card'

/**
 * Class added to the card's footer once it is located.
 *
 * On the legacy path the launcher's own chrome (the empty state, the degraded
 * notice) cannot ride along as `children` — 0.1.5's `Menu` renders `items` and
 * `footer` only, and drops `children` on the floor. The footer is therefore the
 * only slot available, and it is marked here so the stylesheet can reach it
 * without depending on the host's hashed CSS-module class names.
 */
const FOOTER_CLASS = 'dsh-sl-launcher-footer'

/** The row selector both host generations agree on: every real row is a menuitem. */
const ROW_SELECTOR = 'button[role=menuitem]'


/** Props for {@link LauncherMenu}. */
export interface LauncherMenuProps {
  /** Whether the card is showing; owned by the ball's interaction machine. */
  readonly open: boolean
  /** The ball element the card hangs from. */
  readonly anchorRef: { readonly current: HTMLElement | null }
  /** The recent section: kinds the user most recently activated. */
  readonly recent: readonly LauncherRow[]
  /** Every guide entry, in the registry's order. */
  readonly all: readonly LauncherRow[]
  /** The ball, rendered by the primitive as the trigger. */
  readonly children: ReactNode
  /** Why the recent section may be incomplete, when the preferred source failed. */
  readonly degradedNote?: string
  /** Copy for the empty state. */
  readonly emptyText: string
  /** Copy for the empty state's second line. */
  readonly emptyHint: string
  /**
   * Whether the host renders component rows. A capability, not a version: see
   * `capabilities.hasMenuRows`.
   */
  readonly hasMenuRows: boolean
  /**
   * Which side of the ball the card opens on, chosen by the owner from the
   * ball's live position. Both host generations take the same `side` prop.
   */
  readonly side: 'top' | 'bottom'
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
  onActivate(kind: string, gesture: 'left' | 'right'): void
  /** Dismiss the card. */
  onClose(): void
}

/**
 * One icon renderer for a row, or nothing.
 * @param row - the row whose glyph to draw.
 * @returns the glyph element, or undefined.
 */
function rowIcon(row: LauncherRow): ReactNode {
  const Icon: ComponentType<IconProps> | undefined = row.icon
  if (Icon === undefined) return undefined
  return <Icon size={14} />
}

/** Props for one row wrapper. */
interface RowProps {
  readonly row: LauncherRow
  readonly separatorBefore: boolean
  readonly onActivate: LauncherMenuProps['onActivate']
}

/**
 * One menu row for the modern (component-row) path.
 *
 * `MenuItemButton` takes no event object on selection, so the left/right split is
 * done by wrapping the row: left-click reaches `onSelect`, while a right-click is
 * caught on the wrapper, prevented from opening the browser's own menu, and
 * dispatched as "open in a new pane".
 */
function Row({ row, separatorBefore, onActivate }: RowProps): ReactNode {
  return (
    <span
      onContextMenu={event => {
        event.preventDefault()
        event.stopPropagation()
        onActivate(row.kind, 'right')
      }}
    >
      <MenuItemButton
        icon={rowIcon(row)}
        separatorBefore={separatorBefore}
        onSelect={() => {
          onActivate(row.kind, 'left')
        }}
      >
        {row.title()}
      </MenuItemButton>
    </span>
  )
}

/** What the legacy path needs to know about one emitted data row. */
interface LegacyRow {
  /** The stable id handed to `Menu`'s `items`, and the value `onSelect` returns. */
  readonly id: string
  /** The row it draws, for activation. */
  readonly row: LauncherRow
}

/**
 * The order the two sections are drawn in, chosen so the recent three sit at the
 * end of the card nearest the ball.
 *
 * `side` names the side the card opens on, i.e. where the ball is relative to
 * it: `'top'` means the card is above the ball, so the card's bottom edge is the
 * near end. The recent rows are a shortlist the user reaches for with the same
 * pointer that is already on the ball, so they belong at that near end; the
 * full list follows.
 *
 * This is returned rather than applied inline for the same reason the legacy
 * plan is a function: the modern renderer, the legacy plan, and the legacy
 * right-click mapper must all read one order.
 *
 * @param side - the side the card opens on.
 * @returns `'recent-first'` when recent rows go on top, else `'recent-last'`.
 */
function sectionOrder(side: 'top' | 'bottom'): 'recent-first' | 'recent-last' {
  // Card below the ball: its top edge is nearest the ball, so recent goes first.
  return side === 'bottom' ? 'recent-first' : 'recent-last'
}

/**
 * Build the plan for the legacy data-row path.
 *
 * Returned rather than emitted inline because the right-click mapper needs the
 * same list, in the same order, to invert an index back to a row. Deriving both
 * from one function is what keeps the mapping honest: there is no second list
 * that could disagree with what `Menu` rendered.
 *
 * The order is {@link sectionOrder}'s, with the hairline between the two groups
 * wherever that order puts the boundary. `isEmpty` is left to the caller so the
 * empty state keeps its own copy.
 *
 * @param recent - the recent section.
 * @param all - every guide entry.
 * @param side - the side the card opens on; decides which group is nearer the ball.
 * @returns the ordered rows, with the index at which the hairline belongs.
 */
function planLegacyRows(
  recent: readonly LauncherRow[],
  all: readonly LauncherRow[],
  side: 'top' | 'bottom',
): { rows: readonly LegacyRow[]; separatorAt: number } {
  return planSections(recent, all, side).legacy
}

/**
 * One row of the modern (component-row) card, with the group break attached.
 *
 * The break is a property of the *following* row (`separatorBefore`), which is
 * the shape `MenuItemButton` takes, so the modern plan cannot reuse the legacy
 * plan's splice-an-entry shape — but both are derived from this one function so
 * they cannot select a different order.
 */
interface PlannedRow {
  /** The React key, carrying which section the row came from. */
  readonly key: string
  /** The row to draw. */
  readonly row: LauncherRow
  /** Whether a hairline is drawn above this row. */
  readonly separatorBefore: boolean
}

/**
 * One section plan, in both shapes the two paths need.
 *
 * Returned together because the order rule is the whole point: a second
 * function that recomputed the order could drift from this one, and the legacy
 * right-click mapper would then invert an index to the wrong row.
 */
interface SectionPlan {
  /** The modern path's ordered rows, each carrying its own group break. */
  readonly modern: readonly PlannedRow[]
  /** The legacy path's ordered rows and the splice index of the separator. */
  readonly legacy: { readonly rows: readonly LegacyRow[]; readonly separatorAt: number }
}

/**
 * Order the two sections for a given card side, in the shape each path needs.
 *
 * @param recent - the recent section.
 * @param all - every guide entry.
 * @param side - the side the card opens on; decides which group is nearer the ball.
 * @returns both renderings of the same order.
 */
function planSections(
  recent: readonly LauncherRow[],
  all: readonly LauncherRow[],
  side: 'top' | 'bottom',
): SectionPlan {
  // Each group carries its own section name, so the emitted id encodes where the
  // row came from without a second lookup — and so a kind that appears in BOTH
  // groups (the recent list is a shortlist over the full list, not a partition)
  // still yields two distinct ids.
  const groups = [
    { section: 'recent', rows: recent },
    { section: 'all', rows: all },
  ] as const
  // The recent rows go at the near end, so a `bottom` card (below the ball) puts
  // them first and a `top` card puts them last. See {@link sectionOrder}.
  const recentFirst = sectionOrder(side) === 'recent-first'
  const ordered = recentFirst ? groups : [groups[1], groups[0]]
  // A hairline is meaningful exactly when there is a group on each side of it.
  const separated = recent.length > 0 && all.length > 0

  const legacyRows: LegacyRow[] = []
  const modernRows: PlannedRow[] = []
  for (const [groupIndex, group] of ordered.entries()) {
    for (const [rowIndex, row] of group.rows.entries()) {
      const id = `${group.section}:${row.kind}:${row.id}`
      legacyRows.push({ id, row })
      // The break rides the first row of the second group.
      modernRows.push({ key: id, row, separatorBefore: separated && groupIndex === 1 && rowIndex === 0 })
    }
  }

  // The legacy shape cannot carry the break on a row, so it records the splice
  // index instead; the break falls exactly at the first group's length.
  const firstLength = ordered[0].rows.length
  const separatorAt = separated ? firstLength : -1
  return { modern: modernRows, legacy: { rows: legacyRows, separatorAt } }
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
export function resolveRowByIndex(
  eventTarget: EventTarget | null,
  rows: readonly LegacyRow[],
  surface: Element | null,
): LegacyRow | undefined {
  if (surface === null) return undefined
  if (!(eventTarget instanceof Element)) return undefined
  // The wrapper must be the one this menu rendered, never a nested submenu.
  if (!surface.contains(eventTarget)) return undefined

  const button = eventTarget.closest(ROW_SELECTOR)
  if (button === null || !surface.contains(button)) return undefined

  // Own buttons only: a nested submenu's rows are not in this menu's button list
  // in the order the plan describes, so a mismatched count refuses the gesture.
  const buttons = Array.from(surface.querySelectorAll(ROW_SELECTOR))
  if (buttons.length !== rows.length) return undefined

  const index = buttons.indexOf(button)
  if (index < 0) return undefined
  return rows[index]
}

/**
 * The legacy (data-row) card.
 *
 * Split out so the modern path keeps its original shape untouched: on a host with
 * component rows, `LauncherMenu` below renders exactly what it always did.
 *
 * ## Why the right-click is a document listener here
 *
 * The modern path wraps each component row in a `<span onContextMenu>`. That is
 * impossible on this path: `Menu` renders the data rows itself and portals the
 * list to `document.body` — outside any wrapper this component could provide — so
 * a handler on our own subtree would never see the event. The listener is bound to
 * the document for as long as the card is open, exactly as the host's own
 * outside-close listener is, and it runs the same {@link resolveRowByIndex}
 * assertion, so a right-click it cannot place is abandoned rather than guessed.
 *
 * @param props - the sections, the plan, and the activation callbacks.
 * @returns the `Menu` with data rows and a hand-branded card.
 */
function LegacyRowsMenu(props: LauncherMenuProps): ReactNode {
  const { open, anchorRef, recent, all, children, degradedNote, emptyText, emptyHint, side } = props
  const isEmpty = recent.length === 0 && all.length === 0
  const { rows, separatorAt } = planLegacyRows(recent, all, side)

  // The launcher's own chrome goes in `footer`, NOT `children`: 0.1.5's `Menu`
  // renders `items.map(renderEntry)` and `footer.map(renderEntry)` and never reads
  // `children` at all, so an empty state passed as a child would silently vanish
  // on this host while still working on 0.1.7.
  //
  // A `label` entry is the closest thing this host has to free-form, non-row
  // content: it draws a `div[role=presentation]` holding the text, and it is
  // deliberately NOT a `role=menuitem`, so `resolveRowByIndex`'s button sweep
  // never sees it and cannot be thrown off by chrome occupying footer space.
  //
  // The host builds those entries itself, so the launcher classes they would have
  // had on the modern path are applied afterwards, in this same order, by
  // `useLegacyCard`.
  const footer = isEmpty
    ? [
      { type: 'label' as const, id: '__empty__', text: emptyText },
      { type: 'label' as const, id: '__emptyHint__', text: emptyHint },
    ]
    : degradedNote === undefined
      ? []
      : [{ type: 'label' as const, id: '__note__', text: degradedNote }]

  const footerClasses = isEmpty
    ? ['dsh-sl-launcher-empty', 'dsh-sl-launcher-empty-hint']
    : degradedNote === undefined
      ? []
      : ['dsh-sl-launcher-note']

  const cardRef = useLegacyCard(open, footerClasses, CARD_CLASS, FOOTER_CLASS)
  // Opened on the far side of the ball, then nudged if the host's own clamping
  // still leaves the two overlapping (see useAvoidAnchor).
  useAvoidAnchor(open, anchorRef, CARD_CLASS)

  const onSelect = useCallback((id: string) => {
    const entry = rows.find(candidate => candidate.id === id)
    if (entry === undefined) return
    props.onActivate(entry.row.kind, 'left')
  }, [rows, props])

  // Right-click recovery, scoped to this card and asserted before it acts.
  useEffect(() => {
    if (!open) return
    const onContextMenu = (event: MouseEvent) => {
      const entry = resolveRowByIndex(event.target, rows, cardRef.current)
      // A refused mapping falls through to the host's own default handling.
      if (entry === undefined) return
      event.preventDefault()
      event.stopPropagation()
      props.onActivate(entry.row.kind, 'right')
    }
    document.addEventListener('contextmenu', onContextMenu, true)
    return () => {
      document.removeEventListener('contextmenu', onContextMenu, true)
    }
  }, [open, rows, props, cardRef])

  const items = rows.map(entry => ({
    id: entry.id,
    // The host renders `label` inside its own `span.itemLabel` and `icon` inside
    // its own `span.itemIcon`; composing them here would nest a second icon span
    // and lose the row's alignment and colour.
    label: entry.row.title(),
    icon: rowIcon(entry.row),
  }))

  // A separator is a distinct entry type, so the hairline is spliced into the
  // list rather than expressed as a property of a row.
  const entries = separatorAt < 0
    ? items
    : [...items.slice(0, separatorAt), { type: 'separator' as const, id: '__sep__' }, ...items.slice(separatorAt)]

  return (
    <Menu
      open={open}
      anchor={children}
      portal
      items={entries}
      footer={footer}
      onSelect={onSelect}
      // The ball is fixed-positioned, so the primitive must be handed the real
      // trigger rect rather than measuring its own wrapper.
      getAnchorRect={() => anchorRef.current?.getBoundingClientRect() ?? null}
      align="end"
      side={props.side}
      onClose={props.onClose}
    />
  )
}

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
export function LauncherMenu(props: LauncherMenuProps): ReactNode {
  if (!props.hasMenuRows) return <LegacyRowsMenu {...props} />

  const { open, anchorRef, recent, all, children, degradedNote, emptyText, emptyHint, side } = props

  const isEmpty = recent.length === 0 && all.length === 0

  // The same plan the legacy path renders from, so the two paths cannot put the
  // groups in a different order. Only the shape differs: here each row carries
  // its own `separatorBefore`, there the separator is a spliced entry.
  const { modern } = planSections(recent, all, side)

  // Opened on the far side of the ball, then nudged if the host's own clamping
  // still leaves the two overlapping (see useAvoidAnchor).
  useAvoidAnchor(open, anchorRef, CARD_CLASS)

  return (
    <Menu
      open={open}
      anchor={children}
      portal
      listClassName={CARD_CLASS}
      // The ball is fixed-positioned, so the primitive must be handed the real
      // trigger rect rather than measuring its own wrapper.
      getAnchorRect={() => anchorRef.current?.getBoundingClientRect() ?? null}
      align="end"
      side={props.side}
      onClose={props.onClose}
    >
      {isEmpty && (
        <>
          <div className="dsh-sl-launcher-empty">{emptyText}</div>
          <div className="dsh-sl-launcher-empty-hint">{emptyHint}</div>
        </>
      )}

      {modern.map((planned) => (
        <Row
          key={planned.key}
          row={planned.row}
          // Already decided by the plan: the break sits between the two groups,
          // wherever the card's side moved that boundary to.
          separatorBefore={planned.separatorBefore}
          onActivate={props.onActivate}
        />
      ))}

      {degradedNote !== undefined && !isEmpty && (
        <div className="dsh-sl-launcher-note">{degradedNote}</div>
      )}
    </Menu>
  )
}
