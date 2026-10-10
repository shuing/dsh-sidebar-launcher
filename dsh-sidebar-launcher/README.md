# dsh-sidebar-launcher

**English** · [中文](./README.zh.md)

A draggable 36×36 launcher square for the DSH Web shell's right Sidebar. It sits in the  
frame's overlay layer, opens the right column's tab guide on hover or click, and keeps  
the three tabs you most recently activated at the end of the menu nearest the square.  
Right-clicking the square opens a second menu of six sidebar operations.

It is a **standalone plugin**: it declares no dependency on any other sidebar plugin,  
reads only public host APIs, and mounts through the ordinary bundle-patch channel.

It runs unmodified on **four host versions across two generations** — the modern grid  
renderer (DSH `0.1.7-rc.2`, `0.2.0-rc.2`, `0.2.1-alpha.2`) and the legacy flex renderer  
(`0.1.5-rc.2`, used by the Tavern desktop profile) — by probing what the live services  
actually expose rather than by comparing version numbers. See  
[Cross-host compatibility](#cross-host-compatibility).

## Screenshots

The hover menu on a modern host. The recent group sits at the near end of the card
(the end nearest the square), separated from the full list by a hairline:

![Hover menu on a modern host, with the recent group at the end nearest the square](./docs/hover-menu-modern.png)

The same menu on the legacy host (`0.1.5-rc.2`, Tavern), where every label comes from
the host's own tab type:

![Hover menu on the legacy 0.1.5 Tavern host](./docs/hover-menu-legacy.png)

The six-row sidebar-operations card, opened by right-clicking the square. The pane rows
are greyed out here because only one docked pane is open:

![The six-row sidebar-operations card](./docs/operations-menu.png)

### Demo

An 18.7-second recording on the `0.2.0-rc.2` host: hovering the square to open the card,
picking a tab, then using a row to open a second tab and split the column.

<video src="./docs/launcher-demo.mp4" poster="./docs/launcher-demo-poster.png" controls muted loop width="462"></video>

If your Markdown renderer does not play inline video, the file is at
[docs/launcher-demo.mp4](./docs/launcher-demo.mp4), with
[docs/launcher-demo-poster.png](./docs/launcher-demo-poster.png) as its still frame.

## What it does

- **Floating square.** 36×36, square corners, pinned under the right column's own  
  chrome button on first run (or the viewport's bottom-right corner before the  
  sidebar has rendered).
- **Draggable.** Primary button only. Travel under 4 px is treated as a click;  
  4 px or more is a drag. The position is remembered across reloads and is always  
  clamped so the whole square stays on screen.
- **Hover / click menu.** A dropdown listing every entry from the host's own tab  
  guide — the same entries, in the same order, as the column's `+` menu. The three  
  most recently activated tabs sit at the end of the card nearest the ball: a card  
  that opens *below* the ball lists them first, a card that opens *above* the ball  
  lists them last, and a hairline separates them from the full list.
- **Left click on a row** opens that tab in the **left** pane. **Right click on a row**  
  opens it in the **right** pane; when there is no right pane yet and the host can still  
  split, the launcher splits first and opens the tab in the pane it created. With no room  
  to split, the host silently lands the tab in the current pane, exactly as its own split  
  control does. A collapsed column is opened by either gesture, as a single pane. "Left"  
  and "right" are the host's own columns, not document order — see  
  [Reading the sidebar's shape](#reading-the-sidebars-shape).
- **Clicking a row keeps the menu open.** The card closes only when the pointer  
  leaves both the ball and the card, and the row order stays frozen while the card  
  is up — so a second click lands on the same row the pointer is on.
- **Follows the theme and the language.** Colour comes only from `--dsw-alias-*`  
  tokens and every label is read through the locale service and the tab type's own  
  translatable title.

## The sidebar-operations menu

Right-clicking the square opens a second card, separate from the hover menu. The two  
never stack: opening one closes the other.

| Row                                | What it does                                                                                   |
| ---------------------------------- | ---------------------------------------------------------------------------------------------- |
| **Clear tabs (keep floating)**     | Closes every **docked** tab, then collapses the column. Floating panels are left alone.        |
| **Clear all tabs (with floating)** | Closes every tab, docked and floating, then collapses the column.                              |
| **Clear left pane**                | Closes the tabs of the leftmost docked pane. Disabled when only one pane is open.              |
| **Clear right pane**               | Closes the tabs of the rightmost docked pane. Disabled when only one pane is open.             |
| **Close all floating panels**      | Closes every floating panel, leaving the docked panes untouched. Disabled when nothing floats. |
| **Reset launcher position**        | Returns the square to its measured anchor and forgets the stored position.                     |

Separators divide the rows into three groups: the two clear-and-collapse verbs, the  
three pane/float verbs, and the square's own reset.

### Behaviours worth knowing

- **A sole docked guide is never closed.** The host refuses to close the `guide` page  
  when it is the only docked tab (`canCloseTab` requires `!soleDockedTab`), so  
  "clear tabs" always leaves that one page behind. The plugin reproduces the same rule  
  itself rather than relying on the host's guard. A guide **inside a floating panel**  
  is not protected — the host's rule is scoped to `host === "dock"` — and it is closed  
  like any other float.
- **Clearing a pane does not always remove the split.** The dockkit settle pass merges  
  empty panes but explicitly skips the root pane, so clearing the root pane of a split  
  empties it while the split structure remains.
- **Closing a floating panel's only tab removes the panel.** The float pane is dropped  
  from the layout by the same operation, so no "close panel" API is needed.
- **Disabled rows are computed from the live DOM and API at open time**, not cached:  
  the pane rows grey out when fewer than two docked panes exist, and the float row greys  
  out when nothing floats.

## Requirements

- DSH Web, one of `0.1.5-rc.2`, `0.1.7-rc.2`, `0.2.0-rc.2`, `0.2.1-alpha.2`.
- The right Sidebar (`@deepseek-ai/dsh-client-ui-sidebar-right`), which `dsh-web-app`  
  mounts by default. Without it the plugin stays inactive and the square is simply  
  absent — `sidebarRight`/`sidebarRightTabs` are waited for, never assumed.

## Install

```sh
dsh plugin --profile web add ./dsh-sidebar-launcher
```

or add a `link:` entry to the profile's `package.json` and list the package in  
`dsh.profile.bundles`. Either way the bundle patch in `cordis.patch.yml` supplies the  
host row, and hard-refresh the browser (Ctrl/Cmd+Shift+R) to pick up the client half.  
No DSH restart is needed: only the host half would require one, and this plugin's host  
half is empty.

## Layout

```
package.json            dsh.bundle.patch + dsh.client {platform:"web", inject:[...]}
cordis.patch.yml        one insert: the host row (empty half, present for the client scan)
tsdown.config.ts        host ESM + the browser module-loader artifact
tsconfig.json           strict, no-emit typecheck (also covers the build config)
tsconfig.build.json     declaration-only emit into lib/types
tsconfig.evidence.json  compiles src/client to plain JS for the evidence runs
src/index.ts            host half: intentionally empty
src/client/
  index.tsx             apply(): locale registration, service wait, slot registration,
                        the two menus' owners and their dispatch
  launcher-ball.tsx     the square, its drag, and the hover/click/right-click machine
  launcher-menu.tsx     the tab dropdown, built on the host Menu/MenuItemButton primitives
  sidebar-action-menu.tsx  the six-row operations card and its pure row builder
  sidebar-actions.ts    what is open and how to close it: docked/floating partitioning,
                        left/right pane ordering, the guide guard, and the collapse
  menu-card.ts          card plumbing shared by both menus (portaled-card discovery,
                        the avoid-the-square nudge)
  placement.ts          how a row's left/right gesture reaches each host's panes
  entries.ts            guide() -> the two menu sections
  recent.ts             the persisted recent list and the tab-strip tracker
  anchor.ts             first placement and viewport clamping
  capabilities.ts       the capability probes that choose each host branch
  host-access.ts        the one place the two host generations' service shapes are read
  context-types.ts      structural mirrors of the host services consumed
  locales.ts            zh/en chrome copy
  launcher.css          token-only styling, plugin-prefixed literal class names
docs/                   the screenshots and the demo recording used by this README
.evidence/              the verification runs described below
```

## Cross-host compatibility

The plugin runs on four versions whose client APIs differ in shape. Three of them —
`0.1.7-rc.2`, `0.2.0-rc.2`, `0.2.1-alpha.2` — share the modern shape (a grid renderer,
`tabsIn`, an observable `mounted`, an exported `MenuItemButton`); `0.1.5-rc.2` (the
Tavern desktop profile) is the legacy flex renderer. Every branch is chosen by asking the
live object a `typeof` question — a version string cannot be read from inside a browser
bundle, and a number would be the wrong question anyway. The probes live in
`capabilities.ts`:

| Probe                        | modern (0.1.7 / 0.2.0 / 0.2.1) | legacy (0.1.5)                     |
| ---------------------------- | ------------------------------ | ---------------------------------- |
| `MenuItemButton` is exported | yes → component rows           | no → `items` data rows            |
| `sidebarRight.tabsIn` exists | yes                            | no → read `mounted()?.layout.tabs` |
| `mounted` is an observable   | yes                            | no → it is a plain method          |
| `sidebarRight.split` exists  | yes                            | yes → same placement on both       |
| `data-dockkit-column` written | yes → left/right read from it  | no → measured geometry fallback    |

The consequences that took the most care:

- **`mounted` differs in kind, not just presence.** On 0.1.5 it is a class method that  
  destructures `this`; detaching it and calling the bare reference throws. Every call  
  is made with an explicit receiver.
- **`split()` seeds the new pane on both generations** with the host's default page, so  
  a bare `split() + openTab()` would leave a stray tab beside the one the user asked for.  
  The seed is identified as the page tab the split added, and replaced through `replaceTab`.
- **Placement no longer branches by generation.** The earlier round used  
  `preferNewPane` on 0.1.7 and `split()` on 0.1.5. The host's `openContent` reducer  
  short-circuits a new-pane request into a plain focus for a page kind that is already  
  open in the target pane, so the option could never split for the row that matters most  
  (right-clicking an already-open tab). Both generations now place with  
  `split()` + `openTab({ paneId })`, which also retired the `preferNewPane` probe —  
  the compatibility layer's one documented assumption, stated in `capabilities.ts`  
  because it could not be probed by `typeof` and had to stand in for `tabsIn`.

## How the recent list is sourced

The preferred source is the host's own tab strip. Dockkit chips carry `role="tab"`  
with `aria-selected` and identify themselves through `data-dockkit-tab`, inside a  
`[data-dockkit-strip-tabs]` container, so a `MutationObserver` watching  
`aria-selected` is the host reporting which tab the user just activated. Three  
details each matter:

- an observer only fires on change, so the mount path scans the strip once first;
- the seat is replaced on a session switch, so a `sidebarRight.mounted` change  
  re-scans and rebinds (on 0.1.5, where that signal does not exist, a body observer  
  watching for the seat swap covers the same transition);
- a `tabId` is resolved to its `kind` through `active()`, falling back to the  
  mounted session's full record list for a tab in another pane.

If no strip is ever seen while a session is mounted, the list degrades to "tabs  
opened from this launcher" and the menu says so in a notice. It never degrades  
merely because the right column happens to be collapsed, and it never hides the  
degradation.

Only `kind` strings are persisted (`dsh-sidebar-launcher:recent`). Icons are  
components and titles are thunks, so both are looked up again at render time — which  
is what lets the recent rows follow a language switch and a tab type that moved  
between plugins.

The square's own position is persisted separately (`dsh-sidebar-launcher:position`),  
and "reset" clears that key as well as moving the square — otherwise a reload would  
put the stored position straight back.

## Reading the sidebar's shape

`sidebarRight` exposes `close(tabId)` and nothing else for this purpose: no  
`closeAll`, no `closePane`, and no layout tree. `tabsIn(sessionId)` returns flat  
records with **no pane ownership**, so "the left pane" cannot be read from the API at  
all. Two rules follow:

- **Floating tabs are a set difference, never a DOM scan.** A floating panel's header  
  carries `data-dockkit-float-grip` / `-title` / `-dock` / `-close` but **no**  
  `data-dockkit-tab`, so a floating tab's id is not recoverable from its own markup.  
  It is computed as `API total − docked`, which is also the honest definition: a tab  
  is floating exactly when it is open somewhere other than a docked pane.
- **Docked grouping is the one DOM dependency.** It comes from `[data-dockkit-pane]`,
  ordered left to right by the host's own `data-dockkit-column` (falling back to
  `getBoundingClientRect().left` when that attribute is absent). Ordering by *document
  order* would be wrong on every modern host: the grid renderer emits its tab cells in
  ascending **tab id** order (`Object.values(tabs).sort((a, b) => a.id.localeCompare(b.id))`)
  and only then places each with `gridColumn: column * 2 + 1`, so DOM order is the
  dictionary order of each pane's active tab id and has nothing to do with left and right.
  The legacy flex renderer writes no column at all and is already in visual order, which is
  why the fallback is a live path, not dead code. Only the two "clear one pane" rows and the
  two left/right gestures depend on it; the rest do not.

The container attribute also differs by generation: the modern hosts mark it
`[data-sidebar-right-session]`, while 0.1.5 has no such attribute and exposes the
panel as `[data-sidebar-right-panel]`. Both are accepted.

## Styling

Colour uses only host tokens. The square is the single solid amber surface
(`--dsw-alias-state-warn-primary`, hover and drag `--dsw-alias-state-warn-label`);
the cards take `--dsw-alias-bg-layer-3`; hover fills are a 12% `color-mix` tint and
the card outline is a 20% hairline. Text and glyphs come from `--dsw-alias-label-*`.

Both menus are deliberately dressed in **one neutral value set**, chosen to sit between
the two hosts' own menu metrics rather than copying either — otherwise the same plugin
would look noticeably different on each host. The card width adapts to its longest row
(`width: max-content` with a 160–320 px range; the taller operations card uses
196–264 px) purely in CSS, and long labels are trimmed by the host's own
`text-overflow: ellipsis`.

Two consequences, stated plainly: the launcher's menu no longer looks exactly like the
*other* native menus on either host, and 0.1.7's frosted-glass card material is traded
for an opaque fill so the card stays readable on a host that has no backdrop blur.

On 0.1.7 the card's background is painted by an inner `MenuSurface` layer rather than
by the card itself; that layer is neutralised explicitly, or the opaque fill would be
composited under a translucent blur.

## Positioning

The card prefers the side of the square that the square is not on: below the midline it
opens upward, above it downward. That removes overlap in the ordinary case but does not
make it impossible — a tall card clamped by the host's own viewport margin can be pushed
back over the square. So a frame-by-frame check nudges the card out of the way while it
is open, writing `transform` and never `left`/`top`, because 0.1.7's host recomputes
position every frame and would overwrite anything written to those two. Dragging the
square with a menu open therefore moves the card out of the way live.

## Verification

`pnpm build` produces `lib/index.js` and `lib/client.js`. The client artifact is a
`window.__ModuleLoader__.load({ id, factory })` closure with `apply`/`inject` — the
same shape the host's own client bundles use — and its only runtime imports are the
module-table entries `react`, `react/jsx-runtime`, and
`@deepseek-ai/dsh-client-ui-primitives`.

The `.evidence/` directory holds the runs used while building. `cross-host.mjs` is the
central one: it loads the same launcher modules once against each generation's **real**
installed primitives bundle, and asserts capability detection, menu assembly, left/right
dispatch, the right-click index refusal, and that a non-active tab's kind resolves
without throwing. It is the regression that pins "one codebase, two generations".
`sidebar-actions-check.mjs` covers the pane ordering directly, and
`next-round-column-order.mjs` drives the real `0.2.0` GUI into a state where document
order and column order disagree, then checks each gesture lands in the visually correct
pane; it also prints what the old document-order code would have chosen.

```sh
node .evidence/run-cross-host.mjs          # both host generations (modern + legacy)
node .evidence/ball-interaction.mjs        # the square's gesture machine
node .evidence/sidebar-actions-check.mjs   # action partitioning, guide guard, collapse
node .evidence/menu-interaction.mjs        # the tab dropdown's wiring
node .evidence/avoid-residue.mjs           # the nudge fires, and leaves no residue
```

Three limits worth stating plainly. The menu runs substitute the host primitives with a
contract-faithful stand-in, so they evidence *this plugin's* row and dispatch wiring
rather than the primitives' internals; the primitives' own behaviour is evidenced
separately against the installed package. The DOM-shaped checks read host markup through
the same attribute contract the plugin itself uses, so they confirm the plugin agrees
with the markup it was written against — not that the host will keep that markup. And
none of these runs is a substitute for looking at the running page: appearance, real
pointer feel, and theme rendering were confirmed in the live GUI.

## Notes on three design decisions

Each differs from the obvious reading of the original brief, for reasons found in the
installed host code:

- **The dropdown is portaled.** The app frame is `overflow: hidden`, so an in-place
  list would be cropped at the column edge. The portaled card's `z-index` (1100) is
  above the overlay layer's (20).
- **The hover grace is implemented here rather than via `closeOnPointerLeave`.** The
  primitive wires that grace to its trigger wrapper only; with a portaled list
  nothing cancels it, so it would close the menu as the pointer moved onto the card.
  The owning component runs an equivalent 200 ms grace that spans both the square and
  the card.
- **The two menus use distinct card classes.** Several effects locate a card by class
  alone — the hover grace, the nudge's residue cleanup, the legacy card branding — and
  each takes the first match. One class for two cards would make every one of them guess
  which card it found.

## License

MIT
