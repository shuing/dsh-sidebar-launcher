window.__ModuleLoader__.load({
	id: "dsh-sidebar-launcher",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		//#region src/client/locales.ts
		/**
		* Client-half copy for dsh-sidebar-launcher, registered into the host locale
		* registry under {@link LOCALE_NS}.
		*
		* Only chrome the host does not already own lives here. Every menu row's text
		* comes from the tab type's own `title()`/`description()` thunks, read at render
		* time, so a language change or a new tab type follows automatically and this
		* dictionary never has to guess at another plugin's vocabulary.
		*
		* Keys are flat and templates use `{name}` placeholders, matching the host's
		* `LocaleDict` contract.
		*/
		/** Namespace this plugin's copy is registered under. */
		const LOCALE_NS = "sidebarLauncher";
		/** Chinese copy (the host's default locale). */
		const zh = {
			ballAria: "侧边栏启动器：打开右栏页签菜单（左键在左格打开，右键在右格打开；点击行不关闭菜单）",
			ballTitle: "侧边栏启动器",
			recentHeading: "最近打开",
			allHeading: "全部页签",
			empty: "右栏还没有可打开的页签",
			emptyHint: "停用或移除提供页签的插件后，这里会暂时为空",
			degraded: "正在用降级模式记录最近项：宿主页签条读不到，只记录从本启动器打开过的页签。",
			actionsAria: "侧边栏操作",
			actionClearDocked: "清空标签页（保留浮动）",
			actionClearAll: "清空全部标签页（含浮动）",
			actionClearLeft: "清空左分栏",
			actionClearRight: "清空右分栏",
			actionClearFloats: "清除所有浮动面板",
			actionResetBall: "重置悬浮球位置"
		};
		/** English copy. */
		const en = {
			ballAria: "Sidebar launcher: open the right-column tab menu (left click opens in the left pane, right click in the right pane; clicking a row keeps the menu open)",
			ballTitle: "Sidebar launcher",
			recentHeading: "Recent",
			allHeading: "All tabs",
			empty: "No tabs are available in the right column",
			emptyHint: "This stays empty while no installed plugin contributes a tab type",
			degraded: "Recent tabs are being recorded in degraded mode: the host tab strip was not found, so only tabs opened from this launcher are recorded.",
			actionsAria: "Sidebar actions",
			actionClearDocked: "Clear tabs (keep floating)",
			actionClearAll: "Clear all tabs (with floating)",
			actionClearLeft: "Clear left pane",
			actionClearRight: "Clear right pane",
			actionClearFloats: "Close all floating panels",
			actionResetBall: "Reset launcher position"
		};
		//#endregion
		//#region src/client/host-access.ts
		/**
		* Narrow `sidebarRight.mounted` to its observable form.
		*
		* This guard lives here rather than in `capabilities.ts` on purpose, and the
		* reason is structural rather than stylistic. `capabilities.ts` must import the
		* host primitives package to answer `hasMenuRows`, so anything importing *it* for
		* a value inherits that dependency. The tracker needs only this narrowing — it
		* never asks about menu rows — and it is the piece most worth unit-testing in
		* isolation, so the guard sits in the module it belongs to and keeps the tracker's
		* import graph free of the primitives bundle.
		*
		* `capabilities.ts` imports the guard back, so there is still exactly one
		* definition of the predicate.
		*
		* @param sidebarRight - the right-Sidebar navigation face.
		* @returns true when `mounted` is an observable snapshot source.
		*/
		function isMountedObservableShape(sidebarRight) {
			const mounted = sidebarRight.mounted;
			return typeof mounted === "object" && mounted !== null && typeof mounted.getSnapshot === "function";
		}
		/**
		* The mounted session's id, when a seat is on screen.
		*
		* Modern hosts publish it directly. Legacy hosts have no such member, so the
		* caller's "is a session mounted" question is answered separately by
		* {@link hasMountedSession}, and this returns `undefined` here by design rather
		* than inventing an id the host never exposed.
		*
		* @param caps - the capability set read from this host.
		* @param sidebarRight - the right-Sidebar navigation face.
		* @returns the mounted session id, or undefined on a legacy host or with no seat.
		*/
		function mountedSessionId(caps, sidebarRight) {
			if (!caps.hasMountedObservable || !isMountedObservableShape(sidebarRight)) return void 0;
			return sidebarRight.mounted.getSnapshot();
		}
		/**
		* The mounted session's surface, whichever generation published it.
		*
		* The call is made with an explicit receiver, and that is load-bearing rather
		* than defensive. On 0.1.5-rc.2 `mounted` is a **class method** that reads
		* `this.binding`:
		*
		*     mounted() { const { binding } = this; return binding === void 0 ? void 0 : … }
		*
		* Detaching it — `const read = face.mounted; read()` — therefore throws
		* `TypeError: Cannot destructure property 'binding' of 'this' as it is undefined`
		* the moment it is invoked. That failure is not theoretical: it was found by
		* driving the real host, *after* the jsdom harness had passed, precisely because a
		* fake face written as an arrow function has no `this` to lose. `call` is what
		* makes the real host work.
		*
		* @param caps - the capability set read from this host.
		* @param sidebarRight - the right-Sidebar navigation face.
		* @returns the surface, or undefined with no seat or before the first open.
		*/
		function mountedSurface(caps, sidebarRight) {
			if (caps.hasMountedObservable) return void 0;
			const read = sidebarRight.mounted;
			if (typeof read !== "function") return void 0;
			return read.call(sidebarRight);
		}
		/**
		* Whether a session's seat is mounted, i.e. whether the right column could be
		* showing a tab strip at all.
		*
		* The two generations cannot answer this identically, and the difference is a
		* real behaviour gap rather than a detail:
		*
		* - Modern: `mounted.getSnapshot() !== undefined`.
		* - Legacy: `active() !== undefined`, because `mounted()` is `undefined` until
		*   the surface's first open stores one — an expanded-but-never-opened column
		*   reports "no session", so this reads "no session" later than the modern one
		*   does.
		*
		* That later signal is the reason the legacy degrade check waits instead of
		* firing early; see `recent.ts`. It is called out here so the caller states the
		* consequence rather than rediscovering it.
		*
		* @param caps - the capability set read from this host.
		* @param sidebarRight - the right-Sidebar navigation face.
		* @returns true when a session is on screen by this host's own definition.
		*/
		function hasMountedSession(caps, sidebarRight) {
			if (caps.hasMountedObservable) return mountedSessionId(caps, sidebarRight) !== void 0;
			if (mountedSurface(caps, sidebarRight) !== void 0) return true;
			return sidebarRight.active() !== void 0;
		}
		/**
		* Every open tab record of the mounted session.
		*
		* The modern route asks the host's own inventory lookup by session id. The
		* legacy route reads the same records out of the surface's `layout.tabs` — the
		* exact object `tabsIn` projects (`Object.values(…layout.tabs ?? {})`), so the
		* two routes return the same shape rather than a lookalike.
		*
		* @param caps - the capability set read from this host.
		* @param sidebarRight - the right-Sidebar navigation face.
		* @returns the records, or an empty list when nothing is mounted.
		*/
		function mountedTabRecords(caps, sidebarRight) {
			if (caps.hasTabInventory) {
				const sessionId = mountedSessionId(caps, sidebarRight);
				if (sessionId === void 0) return [];
				return sidebarRight.tabsIn?.(sessionId) ?? [];
			}
			const surface = mountedSurface(caps, sidebarRight);
			if (surface === void 0) return [];
			return Object.values(surface.layout.tabs);
		}
		/**
		* Bind a change listener to the mounted-session signal, when the host has one.
		*
		* Legacy hosts have no such signal. The caller already watches `document.body`
		* for the seat swap a session switch causes, so skipping the subscription here
		* is a covered path rather than a missing one — and callers must not treat the
		* absent disposer as an error.
		*
		* @param caps - the capability set read from this host.
		* @param sidebarRight - the right-Sidebar navigation face.
		* @param listener - called on every mounted-session change.
		* @returns a disposer, or undefined when this host publishes no signal.
		*/
		function subscribeMounted(caps, sidebarRight, listener) {
			if (!caps.hasMountedObservable || !isMountedObservableShape(sidebarRight)) return void 0;
			return sidebarRight.mounted.subscribe(listener);
		}
		//#endregion
		//#region src/client/recent.ts
		/** `localStorage` key holding the recent kinds, most recent first. */
		const STORAGE_KEY = "dsh-sidebar-launcher:recent";
		/** How many kinds the list keeps. */
		const MAX_RECENT = 3;
		/** Container whose subtree holds the host's tab chips. */
		const STRIP_TABS_SELECTOR = "[data-dockkit-strip-tabs]";
		/** The chip attribute carrying the tab's id. */
		const TAB_ID_ATTRIBUTE$1 = "data-dockkit-tab";
		/** The chip attribute whose flip means "this tab became the active one". */
		const ACTIVE_ATTRIBUTE = "aria-selected";
		/**
		* How long a mounted session may show no strip before the source is declared
		* degraded. Long enough to cover the seat's own mount and first paint.
		*/
		const DEGRADE_GRACE_MS = 1500;
		/** Read the persisted list, tolerating absent, unparsable, or wrong-shaped data. */
		function readStored() {
			try {
				const raw = window.localStorage.getItem(STORAGE_KEY);
				if (raw === null) return [];
				const parsed = JSON.parse(raw);
				if (!Array.isArray(parsed)) return [];
				return parsed.filter((value) => typeof value === "string").slice(0, MAX_RECENT);
			} catch {
				return [];
			}
		}
		/**
		* Create the store over the persisted list.
		* @returns the store, already holding whatever the last session left behind.
		*/
		function createRecentStore() {
			let current = readStored();
			const listeners = /* @__PURE__ */ new Set();
			return {
				get: () => current,
				subscribe: (listener) => {
					listeners.add(listener);
					return () => {
						listeners.delete(listener);
					};
				},
				record: (kind) => {
					if (kind === "") return;
					const next = [kind, ...current.filter((entry) => entry !== kind)].slice(0, MAX_RECENT);
					if (next.length === current.length && next.every((value, index) => value === current[index])) return;
					current = next;
					try {
						window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
					} catch {}
					for (const listener of [...listeners]) listener();
				}
			};
		}
		/**
		* Resolve a chip's tabId to the tab kind it belongs to.
		*
		* Two routes, cheapest first: the active tab of the active pane is the common
		* case (the user just activated a tab), and the mounted session's full record
		* list covers an inactive pane or a floating panel whose chip also flipped.
		*
		* Both routes go through `host-access.ts`, so this never touches
		* `mounted.getSnapshot` on a host where `mounted` is a method. That call is what
		* used to throw on 0.1.5-rc.2, inside a `MutationObserver` callback, where the
		* exception both aborted this function before `store.record` ran and escaped the
		* tracker's `start()`.
		*
		* @param tabId - the `data-dockkit-tab` value read from the chip.
		* @param capabilities - the capability set read from this host.
		* @param sidebarRight - the navigation face to read records from.
		* @returns the kind, or undefined when the tab is not in the mounted session yet.
		*/
		function kindForTabId(tabId, capabilities, sidebarRight) {
			const active = sidebarRight.active();
			if (active !== void 0 && active.id === tabId) return active.kind;
			return mountedTabRecords(capabilities, sidebarRight).find((record) => record.id === tabId)?.kind;
		}
		/**
		* Create the tracker.
		*
		* Nothing is watched until {@link RecentTracker.start} runs, so construction is
		* cheap and safe during a React render.
		*
		* @param options - the navigation face, the store to fill, and a mode listener.
		* @returns the tracker.
		*/
		function createRecentTracker(options) {
			const { sidebarRight, capabilities, store, onModeChange } = options;
			const observers = /* @__PURE__ */ new Map();
			const disposers = [];
			let currentMode = "b1";
			let started = false;
			/** Once a strip has been seen, the preferred source is settled for this mount. */
			let sawStrip = false;
			let degradeTimer = 0;
			let scheduled = 0;
			function setMode(next) {
				if (next === currentMode) return;
				currentMode = next;
				onModeChange?.(next);
			}
			function clearDegradeTimer() {
				if (degradeTimer === 0) return;
				window.clearTimeout(degradeTimer);
				degradeTimer = 0;
			}
			/** Read one chip, if it is a chip and it is the active one. */
			function recordFromChip(chip) {
				if (chip.getAttribute(ACTIVE_ATTRIBUTE) !== "true") return;
				const tabId = chip.getAttribute(TAB_ID_ATTRIBUTE$1);
				if (tabId === null || tabId === "") return;
				const kind = kindForTabId(tabId, capabilities, sidebarRight);
				if (kind !== void 0 && kind !== "") store.record(kind);
			}
			/** Scan every strip currently in the document; this is the mount-time pass. */
			function scanStrips() {
				const strips = document.querySelectorAll(STRIP_TABS_SELECTOR);
				if (strips.length === 0) return false;
				for (const strip of strips) for (const chip of strip.querySelectorAll(`[${TAB_ID_ATTRIBUTE$1}]`)) recordFromChip(chip);
				return true;
			}
			/** Observe every strip's subtree for the active-tab attribute flip. */
			function rebindObservers() {
				const strips = new Set(document.querySelectorAll(STRIP_TABS_SELECTOR));
				for (const [element, observer] of observers) {
					if (element === document.body) continue;
					if (strips.has(element) && element.isConnected) continue;
					observer.disconnect();
					observers.delete(element);
				}
				for (const strip of strips) {
					if (observers.has(strip)) continue;
					const observer = new MutationObserver((records) => {
						for (const record of records) {
							const target = record.target;
							if (target instanceof Element) recordFromChip(target);
						}
					});
					observer.observe(strip, {
						subtree: true,
						attributes: true,
						attributeFilter: [ACTIVE_ATTRIBUTE]
					});
					observers.set(strip, observer);
				}
			}
			/**
			* Arm the delayed downgrade check.
			*
			* Only a mounted session can prove the host *should* be rendering a strip, so
			* the check is skipped entirely while none is mounted — a collapsed column and
			* a session-less window are both normal, and neither is evidence about the host.
			*
			* "Mounted" is answered by `host-access.ts`, which on a legacy host has only
			* `active() !== undefined` to go on. That makes the legacy downgrade fire later
			* than the modern one; the file header records why, and the notice copy is
			* worded to match.
			*/
			function scheduleDegradeCheck() {
				if (sawStrip || degradeTimer !== 0) return;
				if (!hasMountedSession(capabilities, sidebarRight)) return;
				degradeTimer = window.setTimeout(() => {
					degradeTimer = 0;
					if (sawStrip) return;
					if (!hasMountedSession(capabilities, sidebarRight)) return;
					if (!started) return;
					setMode("b2");
				}, DEGRADE_GRACE_MS);
			}
			/** Re-derive the whole state: scan what is there, then watch it. */
			function resync() {
				const found = scanStrips();
				if (found) {
					sawStrip = true;
					clearDegradeTimer();
					setMode("b1");
				}
				rebindObservers();
				if (!found) scheduleDegradeCheck();
			}
			/**
			* Coalesce resyncs to one per frame.
			*
			* The body watcher sees every DOM insertion the whole application makes, and a
			* resync runs a document-wide `querySelectorAll` sweep; without coalescing, a
			* busy render would turn each insertion into its own sweep.
			*/
			function scheduleResync() {
				if (scheduled !== 0) return;
				scheduled = requestAnimationFrame(() => {
					scheduled = 0;
					if (started) resync();
				});
			}
			return {
				start() {
					if (started) return;
					started = true;
					resync();
					const seatObserver = new MutationObserver(() => {
						scheduleResync();
					});
					seatObserver.observe(document.body, {
						childList: true,
						subtree: true
					});
					observers.set(document.body, seatObserver);
					const unobserve = subscribeMounted(capabilities, sidebarRight, () => {
						scheduleResync();
					});
					if (unobserve !== void 0) disposers.push(unobserve);
				},
				stop() {
					if (!started) return;
					started = false;
					if (scheduled !== 0) {
						cancelAnimationFrame(scheduled);
						scheduled = 0;
					}
					clearDegradeTimer();
					for (const observer of observers.values()) observer.disconnect();
					observers.clear();
					for (const dispose of disposers.splice(0)) dispose();
				},
				recordLauncherOpen: (kind) => {
					if (currentMode !== "b2") return;
					store.record(kind);
				},
				mode: () => currentMode
			};
		}
		//#endregion
		//#region src/client/entries.ts
		/**
		* Map a guide box to a row.
		* @param box - one entry from `guide()`.
		* @returns the row, or undefined when the box cannot be opened.
		*/
		function toRow(box) {
			if (box.kind === "") return void 0;
			return {
				kind: box.kind,
				id: box.id,
				title: box.title,
				...box.description === void 0 ? {} : { description: box.description },
				...box.icon === void 0 ? {} : { icon: box.icon }
			};
		}
		/**
		* Resolve the guide and the recent kinds into the menu's two sections.
		*
		* Recent entries are read *through* the current guide rather than from anything
		* stored: a kind that no longer exists is dropped, and a kind whose title or icon
		* changed shows the new one. That is what makes the recent list survive a
		* language switch, a theme switch, and another plugin being disabled.
		*
		* @param guide - the current guide entries.
		* @param recentKinds - stored kinds, most recent first.
		* @returns the recent section and the full section.
		*/
		function resolveSections(guide, recentKinds) {
			const all = [];
			const byKind = /* @__PURE__ */ new Map();
			for (const box of guide) {
				const row = toRow(box);
				if (row === void 0) continue;
				all.push(row);
				if (!byKind.has(row.kind)) byKind.set(row.kind, row);
			}
			const recent = [];
			const seen = /* @__PURE__ */ new Set();
			for (const kind of recentKinds) {
				if (seen.has(kind)) continue;
				seen.add(kind);
				const row = byKind.get(kind);
				if (row !== void 0) recent.push(row);
			}
			return {
				recent,
				all
			};
		}
		/**
		* Read the two sections from the live services.
		* @param guide - a `guide()` thunk, read fresh so a registry change is picked up.
		* @param store - the recent store.
		* @returns the resolved sections.
		*/
		function readSections(guide, store) {
			return resolveSections(guide(), store.get());
		}
		//#endregion
		//#region src/client/anchor.ts
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
		/** The host's chrome-button markers, in probe order. */
		const ANCHOR_SELECTORS = ["[data-sidebar-right-toggle]", "[data-sidebar-right-expand]"];
		/** Gap between the anchor button's bottom edge and the ball. */
		const ANCHOR_GAP = 8;
		/** Inset used when no anchor is measurable at all. */
		const FALLBACK_EDGE = 16;
		/** Smallest distance the ball keeps from any viewport edge. */
		const EDGE_MARGIN = 4;
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
		function clampToViewport(position, size) {
			const viewportWidth = typeof window === "undefined" ? 0 : window.innerWidth;
			const viewportHeight = typeof window === "undefined" ? 0 : window.innerHeight;
			const maxLeft = Math.max(EDGE_MARGIN, viewportWidth - size - EDGE_MARGIN);
			const maxTop = Math.max(EDGE_MARGIN, viewportHeight - size - EDGE_MARGIN);
			return {
				left: Math.min(Math.max(position.left, EDGE_MARGIN), maxLeft),
				top: Math.min(Math.max(position.top, EDGE_MARGIN), maxTop)
			};
		}
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
		function measureInitialPosition(size) {
			const viewportWidth = typeof window === "undefined" ? 0 : window.innerWidth;
			const viewportHeight = typeof window === "undefined" ? 0 : window.innerHeight;
			for (const selector of ANCHOR_SELECTORS) {
				const anchor = document.querySelector(selector);
				if (anchor === null) continue;
				const rect = anchor.getBoundingClientRect();
				if (rect.width === 0 || rect.height === 0) continue;
				return {
					position: {
						left: rect.right - size,
						top: rect.bottom + ANCHOR_GAP
					},
					anchored: true
				};
			}
			return {
				position: {
					left: viewportWidth - size - FALLBACK_EDGE,
					top: viewportHeight - size - FALLBACK_EDGE
				},
				anchored: false
			};
		}
		//#endregion
		//#region \0dsh-css:C:\Users\shuying\Documents\deepseek-harness\default-workspace\dsh-sidebar-launcher\src\client\launcher.css.mjs
		const css = "/**\n * Launcher chrome.\n *\n * Colour comes only from the host's `--dsw-alias-*` tokens and typography only\n * from `--dsw-font-*`, so the launcher follows a theme (including a third-party\n * one) without knowing anything about it. The one deliberate exception is the\n * amber family used as an *accent*: `.dsh-sl-ball` is the single solid-yellow\n * surface, and everywhere else yellow appears as a low-alpha tint or a hairline.\n *\n * Class names are literal and plugin-prefixed rather than scoped. Two of the\n * nodes styled here are moved out of this component's subtree — the dropdown is\n * portaled to `document.body` — so a scoping transform would have to be escaped\n * anyway; one naming scheme for both keeps the portaled and in-place rules\n * looking the same.\n *\n * Two host facts shape the geometry:\n *\n * - `shell.overlay` is a click-through layer whose direct children opt back into\n *   pointer events, so a 36px ball here cannot block the columns underneath.\n * - The app frame is `overflow: hidden`, which is why the dropdown is portaled\n *   instead of positioned in place.\n */\n\n/* ---------- the ball ---------- */\n\n.dsh-sl-ball {\n  position: fixed;\n  box-sizing: border-box;\n  width: 36px;\n  height: 36px;\n  /* Square corners: the ball is a deliberate hard-edged accent, not a control\n     moulded from the host's radius scale. */\n  border-radius: 0;\n  padding: 0;\n  border: none;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  background: var(--dsw-alias-state-warn-primary);\n  /* The icon sits on an invariant amber fill (`--dsw-alias-state-warn-primary`\n     is `#f59e0b` in both themes on both hosts), so what it needs is a\n     *contrasting* colour, not a themed one.\n     `--dsw-alias-menu-icon` is the host's own icon-foreground token and is dark\n     in both themes on 0.1.7-rc.2. It does not exist on 0.1.5-rc.2, hence the\n     fallback: `--dsw-alias-label-primary-inverted` resolves to `#fff` in light\n     and `#353638` in dark there, both legible on amber. The chain therefore\n     keeps 0.1.7's exact current colour and gives 0.1.5 a themed equivalent. */\n  color: var(--dsw-alias-menu-icon, var(--dsw-alias-label-primary-inverted));\n  cursor: grab;\n  touch-action: none;\n  user-select: none;\n  -webkit-user-select: none;\n  font: inherit;\n  transition: background-color 120ms ease;\n}\n\n.dsh-sl-ball:hover {\n  background: var(--dsw-alias-state-warn-label);\n}\n\n.dsh-sl-ball:focus-visible {\n  outline: 2px solid var(--dsw-alias-brand-primary);\n  outline-offset: 2px;\n}\n\n.dsh-sl-ball[data-dragging='true'] {\n  background: var(--dsw-alias-state-warn-label);\n  cursor: grabbing;\n}\n\n.dsh-sl-ball-glyph {\n  display: block;\n  width: 18px;\n  height: 18px;\n  pointer-events: none;\n}\n\n/* ---------- the dropdown card ---------- */\n\n/* C1 — one neutral skin for both host generations.\n *\n * Every value sits ON 0.1.7's compact scale and only relaxes toward 0.1.5's\n * roomier one where the relaxation costs nothing. A true midpoint would make\n * the menu that was already comfortable worse, which is the opposite of the\n * point: 0.1.5 is the generation that hurts (40px rows, 14px text, a dozen\n * entries stacked into a scrolling wall).\n *\n *              launcher   0.1.7     0.1.5\n *   font       13 / 20    13 / 20   14 / 22\n *   row min-h  36         34        40\n *   row pad    7 9        6 8       8 10\n *   icon gap   7          6         8\n *   icon box   14         14        16\n *   row radius 8          12        10   <- the ONE value that is not between\n *                                           the two hosts. 8 is the requested\n *                                           figure and is kept deliberately;\n *                                           if it ever reads as a typo, 11 is\n *                                           the midpoint. See §8 of the brief.\n *   card radius 14        16        20\n *   card fill  solid      translucent + blur (see \"Material\" below)\n *\n * Font sizes are whole pixels on purpose: a fractional size lands off the 1x\n * pixel grid, and CJK glyphs go visibly soft there. That would fail the\n * \"clearly readable\" requirement outright, so 13.5px-style values are not used\n * even where they would land closer to a host's own number.\n *\n * ## Specificity\n *\n * `CARD_CLASS` and the hosts' own `.list` / `.item` are each a single class.\n * Everything here that overrides a property the host also declares is therefore\n * doubled — `.card.card` — which wins on specificity alone and never depends on\n * which stylesheet the host injects first. The same rules serve both of the\n * launcher's cards, so each selector below is written once per card class.\n *\n * ## Material — the load-bearing choice\n *\n * The card is an OPAQUE fill, not each host's own surface.\n *\n * 0.1.7's translucent card is only legible because a separate `MenuSurface`\n * material layer sits behind its rows and blurs what is underneath. 0.1.5 has\n * no such layer, so a translucent card there would put the conversation text\n * and its images directly behind the row labels — legibility broken on the\n * spot. `--dsw-alias-bg-layer-3` is defined on both hosts in both themes,\n * which is what lets one value cover both.\n *\n * 0.1.7 also paints that material in a CHILD div rather than on the card, so\n * recolouring the card alone is not enough: the child is neutralised further\n * down through the `data-menu-material` attribute, which only `MenuSurface`\n * emits. On 0.1.5 the attribute is absent, that selector matches nothing, and\n * the fill set here is the entire material — which is exactly 0.1.5's own\n * shape.\n *\n * Trade-off accepted (worth re-checking if the look is ever revisited): the\n * launcher's menu no longer matches the rest of that host's native menus on\n * either generation. That is the unavoidable cost of one cross-host skin.\n */\n.dsh-sl-launcher-card.dsh-sl-launcher-card,\n.dsh-sl-action-card.dsh-sl-action-card {\n  /* C2 — width adapts, height does not.\n     The card grows to its longest row and stops. Pure CSS: no JS, no measuring,\n     no reflow loop. 160px keeps a two-character menu from collapsing into a\n     stub; 320px holds roughly 21 CJK glyphs at 13px. Past that the host's own\n     `.itemLabel` ellipsis takes over — both generations already declare\n     `overflow:hidden; text-overflow:ellipsis; white-space:nowrap` there, and\n     this plugin adds no truncation logic of its own.\n\n     Height stays what it always was: natural from the row count, capped by the\n     scroll ceiling below, with the host's `.viewport` scrolling inside. That\n     is the host's `Menu` behaviour and is deliberately NOT made \"automatic\" —\n     the brief is explicit that only width adapts. */\n  width: max-content;\n  min-width: 160px;\n  max-width: 320px;\n\n  /* C1 card geometry. */\n  border-radius: 14px;\n  /* Opaque in both generations. The fallback chain only matters if a future\n     host drops layer-3; on both current hosts the first value resolves. */\n  background: var(--dsw-alias-bg-layer-3, var(--dsw-alias-bg-layer-1, #ffffff));\n  /* Scroll ceiling: 16px tighter than the tighter host's own cap (0.1.7 on\n     Windows computes to 100vh - 24px). A shorter card is more likely to fit\n     beside the ball, which leaves the §6.3 fallback less to do — and the spec\n     asks for exactly this number. */\n  max-height: calc(100vh - 40px);\n\n  border: 1px solid color-mix(in srgb, var(--dsw-alias-state-warn-label) 20%, transparent);\n  font-family: var(--dsw-font-family);\n  font-size: 13px;\n  line-height: 20px;\n}\n\n/* 0.1.7-only: neutralise the separate material layer, because the fill above\n   IS the material now. `data-menu-material` is `MenuSurface`'s marker on the\n   card and `aria-hidden='true'` is its marker on that child, so this cannot\n   reach anything else on either host — and on 0.1.5 it matches nothing. */\n.dsh-sl-launcher-card[data-menu-material] > [aria-hidden='true'],\n.dsh-sl-action-card[data-menu-material] > [aria-hidden='true'] {\n  background: transparent;\n  backdrop-filter: none;\n}\n\n/* C1 rows. One rule carries every row metric, so the two generations cannot\n   drift apart on, say, the gap while agreeing on the padding. */\n.dsh-sl-launcher-card.dsh-sl-launcher-card button[role='menuitem'],\n.dsh-sl-action-card.dsh-sl-action-card button[role='menuitem'] {\n  min-height: 36px;\n  gap: 7px;\n  padding: 7px 9px;\n  border-radius: 8px;\n  font-size: 13px;\n  line-height: 20px;\n}\n\n/* The icon box and the glyph, pinned together. `.itemIcon` is a 16px box on\n   0.1.5 and a 14px one on 0.1.7; both the box and the `svg` are set so the\n   label starts at the same offset on either host.\n   `:has(svg)` is what makes sizing the span safe. A row with no icon renders\n   its LABEL as the button's first child — sizing that would clip the row's own\n   text, which is the exact bug this stylesheet's history warns about. Only an\n   icon span can contain an `svg`. Should `:has()` ever fail to parse, only\n   this rule drops and the `svg` rule below still sizes the glyph. */\n.dsh-sl-launcher-card.dsh-sl-launcher-card button[role='menuitem'] > span:has(svg),\n.dsh-sl-action-card.dsh-sl-action-card button[role='menuitem'] > span:has(svg) {\n  width: 14px;\n  height: 14px;\n  flex: none;\n}\n\n/* The glyph's own size and colour. `--dsw-alias-label-tertiary` is the host's\n   resting icon colour on BOTH generations (0.1.7 uses `--dsw-alias-menu-icon`\n   for its own rows), so naming the tertiary token directly is what makes the\n   two hosts agree here instead of following 0.1.7's menu-icon token. */\n.dsh-sl-launcher-card.dsh-sl-launcher-card button[role='menuitem'] svg,\n.dsh-sl-action-card.dsh-sl-action-card button[role='menuitem'] svg {\n  width: 14px;\n  height: 14px;\n  color: var(--dsw-alias-label-tertiary);\n}\n\n/* Amber replaces the host's neutral hover fill, as before: the accent belongs\n   to the launcher, not to the host's menu. */\n.dsh-sl-launcher-card.dsh-sl-launcher-card button[role='menuitem']:hover:not(:disabled),\n.dsh-sl-launcher-card.dsh-sl-launcher-card button[role='menuitem']:focus-visible:not(:disabled),\n.dsh-sl-action-card.dsh-sl-action-card button[role='menuitem']:hover:not(:disabled),\n.dsh-sl-action-card.dsh-sl-action-card button[role='menuitem']:focus-visible:not(:disabled) {\n  background: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 12%, transparent);\n}\n\n/* C5 — the group hairline, made visible again.\n *\n * The host's own `Menu.module.css` hides the first separator of a group's first\n * row:\n *\n *     .itemWrap:first-child > .separator:first-child { display: none }\n *\n * which exists so the very first row of a LIST does not draw a hairline at its\n * top. The launcher's component rows are each wrapped in a\n * `<span onContextMenu>` (the only handle that catches a right-click on the\n * modern path), and that wrapper makes EVERY row's `.itemWrap` its own parent's\n * first child — so the rule matched every row and hid every hairline, including\n * the one between the recent group and the full list. Measured live on\n * 0.2.0-rc.2: the open card had `[role=separator]` nodes with\n * `display: none` and the card read as one undivided list (see `_diag/`).\n *\n * This plugin never emits a separator on the list's true first row (the break is\n * emitted on the first row of the SECOND group; see `launcher-menu.tsx`), so\n * un-hiding every separator inside the launcher card is safe: nothing that\n * should be hidden becomes visible.\n *\n * Specificity: the host rule is `.itemWrap` + `:first-child` + `.separator` +\n * `:first-child` = (0,4,0). A doubled card class plus the role attribute is only\n * (0,3,0), which is exactly the trap the file header warns about — so the rule\n * anchors on `div[role='menu']` (element column) as well, giving (0,4,1), which\n * wins without depending on which stylesheet the host injects first.\n *\n * Visibility is also raised to the operations card's: the host default is\n * `0.5px` + `--dsw-alias-border-l2` (~10% alpha), which reads as nothing on the\n * opaque card fill. `1px` + the amber tint is what the operations card already\n * uses, so the two cards read as one family. The operations card's own rule\n * below is deliberately left as it is.\n */\ndiv[role='menu'].dsh-sl-launcher-card.dsh-sl-launcher-card [role='separator'] {\n  display: block;\n  height: 1px;\n  background: color-mix(in srgb, var(--dsw-alias-state-warn-label) 28%, transparent);\n}\n\n/* ---------- the operations card (right-click) ---------- */\n\n/* C4 — the operations card is the same material as the hover card and a different\n * *instrument*. Six flat verbs with no tab titles to read, so it is narrower, its\n * rows are a touch taller, and it wears the amber accent as a structural device\n * rather than only as a hover tint:\n *\n *              action card   hover card\n *   min-width  196           160\n *   max-width  264           320\n *   row min-h  38            36\n *   icon box   16            14\n *\n * The width numbers are chosen against the longest label in either language. In\n * Chinese the longest is 清空标签页（保留浮动） = 10 CJK glyphs; at 13px that is\n * ~130px, plus a 16px glyph box, a 9px gap, two 11px paddings and the card's own\n * border — ~196px. In English the longest is \"Clear all tabs (with floating)\" at\n * 30 characters, ~186px, which the 264px ceiling holds with room for the host's\n * own ellipsis on anything longer. A 196px floor keeps the card from looking\n * pinched beside the hover card's 216px widest case.\n */\n.dsh-sl-action-card.dsh-sl-action-card {\n  min-width: 196px;\n  max-width: 264px;\n  /* A shadow would be a new colour decision, and the brief keeps the palette to\n     the host's tokens. Instead the card earns its lift from the same amber\n     hairline as the hover card, doubled into a two-step edge: a full-strength\n     1px border with a soft 3px amber halo outside it. Both come from\n     `--dsw-alias-state-warn-label`, so they follow the theme. */\n  border: 1px solid color-mix(in srgb, var(--dsw-alias-state-warn-label) 34%, transparent);\n  box-shadow: 0 0 0 3px color-mix(in srgb, var(--dsw-alias-state-warn-primary) 10%, transparent);\n  /* A short, sharp entrance. This is the one animation in the plugin and it is\n     deliberately not a slide or a bounce: 120ms of opacity plus a 2px rise from\n     the ball's side reads as the card being *placed*, not performed. It runs on\n     the card itself, which is remounted per open by both hosts, so it cannot\n     become a persistent state. */\n  animation: dsh-sl-action-in 120ms cubic-bezier(0.22, 1, 0.36, 1);\n}\n\n@keyframes dsh-sl-action-in {\n  from {\n    opacity: 0;\n    transform: translateY(2px);\n  }\n  to {\n    opacity: 1;\n    transform: none;\n  }\n}\n\n/* Honour a reduced-motion preference: the card still appears, it just does not\n   move. The opacity ramp is kept because it is not motion, and dropping it\n   entirely would make a system preference look like a glitch. */\n@media (prefers-reduced-motion: reduce) {\n  .dsh-sl-action-card.dsh-sl-action-card {\n    animation: dsh-sl-action-opacity 120ms linear;\n  }\n  @keyframes dsh-sl-action-opacity {\n    from { opacity: 0; }\n    to { opacity: 1; }\n  }\n}\n\n/* Row rhythm: one metric above the shared rule, so the two generations cannot\n   drift on it. 38px (against the hover card's 36px) gives the six verbs a little\n   more air than the tab list, which is what makes the card read as a control\n   panel rather than a longer version of the same list. */\n.dsh-sl-action-card.dsh-sl-action-card button[role='menuitem'] {\n  min-height: 38px;\n  padding: 8px 9px;\n}\n\n/* The card's own glyph box. Both hosts box the icon at 14px (0.1.7) or 16px\n   (0.1.5) and this stylesheet pins the hover card to 14px; the operations card\n   uses 16px, so the larger glyphs read as deliberate rather than oversized. */\n.dsh-sl-action-card.dsh-sl-action-card button[role='menuitem'] > span:has(svg) {\n  width: 16px;\n  height: 16px;\n}\n\n/* The glyphs carry the accent. The hover card's icons are tertiary grey because\n   they are mnemonics beside a title; these *are* the rows' meaning, so they get\n   the amber at rest. The label stays the host's primary colour — the accent is\n   on the mark, not on the words, which is what keeps the card from shouting. */\n.dsh-sl-action-card.dsh-sl-action-card button[role='menuitem'] svg {\n  width: 16px;\n  height: 16px;\n  color: var(--dsw-alias-state-warn-label);\n}\n\n/* The group hairlines, brightened into a deliberate division. The host's own\n   separator is a faint neutral line; this one picks up the amber at low alpha so\n   the three groups read as groups at a glance rather than as one long list with\n   two faint rules in it. Only this card's separators are touched. */\n.dsh-sl-action-card.dsh-sl-action-card [role='separator'] {\n  background: color-mix(in srgb, var(--dsw-alias-state-warn-label) 28%, transparent);\n  height: 1px;\n}\n\n/* Disabled rows. The host already dims a disabled row's colour, but it leaves the\n   glyph at full accent and the row at full opacity, which makes \"greyed\" and\n   \"ready\" a matter of a few percent of text contrast. This makes the difference\n   unmistakable at a glance:\n *\n *   - the whole row drops to 42% opacity,\n *   - the amber glyph desaturates to the neutral tertiary token, so the accent\n *     itself disappears — the strongest available signal that the row is inert,\n *   - the cursor stops inviting a click.\n *\n * The hover fill is suppressed by the existing `:not(:disabled)` guard, so a\n * disabled row cannot light up under the pointer either. */\n.dsh-sl-action-card.dsh-sl-action-card button[role='menuitem']:disabled {\n  opacity: 0.42;\n  cursor: default;\n}\n\n.dsh-sl-action-card.dsh-sl-action-card button[role='menuitem']:disabled svg {\n  color: var(--dsw-alias-label-tertiary);\n}\n\n/* ---------- in-menu notices ---------- */\n\n/* The launcher's own chrome rides inside the host card, so its padding is the\n   row padding (9px) plus the card's own 4px inset. One block, both hosts. */\n.dsh-sl-launcher-note {\n  margin: 4px 2px 0;\n  padding: 6px 9px;\n  /* `--dsw-radius-sm` is 8px on 0.1.7-rc.2 and absent on 0.1.5-rc.2, so the\n     fallback reproduces the small-radius look there without moving 0.1.7. */\n  border-radius: var(--dsw-radius-sm, 6px);\n  background: var(--dsw-alias-state-warn-tertiary);\n  color: var(--dsw-alias-label-primary);\n  font-size: 11px;\n  line-height: 15px;\n}\n\n.dsh-sl-launcher-empty {\n  padding: 7px 9px;\n  color: var(--dsw-alias-label-primary);\n  font-size: 13px;\n  line-height: 20px;\n}\n\n.dsh-sl-launcher-empty-hint {\n  padding: 0 9px 7px;\n  color: var(--dsw-alias-label-tertiary);\n  font-size: 11px;\n  line-height: 15px;\n}\n\n/* ---------- legacy (0.1.5) chrome ---------- */\n\n/* On a host whose `Menu` has no `children` slot, the launcher's own chrome rides\n   in the footer, which the host renders as a plain `role=presentation` region of\n   `label` entries. Those entries cannot carry our classes (the host builds them\n   from `{type:'label', text}`), so the chrome is tagged onto the host's own nodes\n   once the card is located: the footer itself gets `dsh-sl-launcher-footer`, and\n   each label entry gets the class it would have had on the modern path. These\n   rules then make both hosts draw the same two blocks from the same copy. */\n\n/* C1 footer spacing: 4px above and 4px inside. Sits inside the host's own\n   `.footer` hairline, so this only sets the rhythm below it. */\n.dsh-sl-launcher-footer {\n  padding: 4px 4px 4px;\n}\n";
		const tagId = "dsh-sidebar-launcher/launcher.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-sidebar-launcher";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		/** Travel at or above this many px is a drag; below it, a click. */
		const DRAG_THRESHOLD = 4;
		/** `localStorage` key holding the ball's committed position. */
		const POSITION_KEY = "dsh-sidebar-launcher:position";
		/** Read the stored position, or undefined when absent or malformed. */
		function readStoredPosition() {
			try {
				const raw = window.localStorage.getItem(POSITION_KEY);
				if (raw === null) return void 0;
				const parsed = JSON.parse(raw);
				if (typeof parsed !== "object" || parsed === null) return void 0;
				const { left, top } = parsed;
				if (typeof left !== "number" || typeof top !== "number") return void 0;
				if (!Number.isFinite(left) || !Number.isFinite(top)) return void 0;
				return {
					left,
					top
				};
			} catch {
				return;
			}
		}
		/** Persist the committed position; a refusal must not break the ball. */
		function writeStoredPosition(position) {
			try {
				window.localStorage.setItem(POSITION_KEY, JSON.stringify(position));
			} catch {}
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
		function clearStoredPosition() {
			try {
				window.localStorage.removeItem(POSITION_KEY);
			} catch {}
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
		function useLauncherBall() {
			const ref = (0, react.useRef)(null);
			const [position, setPosition] = (0, react.useState)(() => {
				return clampToViewport(readStoredPosition() ?? measureInitialPosition(36).position, 36);
			});
			const [phase, setPhase] = (0, react.useState)("idle");
			const [menuOpen, setMenuOpen] = (0, react.useState)(false);
			const [actionsOpen, setActionsOpen] = (0, react.useState)(false);
			/**
			* Live drag bookkeeping, kept in a ref so moves never re-render for it.
			*
			* The latest offset is stored here too, which is what lets the release commit
			* from a ref instead of from inside a state updater.
			*/
			const drag = (0, react.useRef)(null);
			/** True while the pointer is over the ball; drives the hover-open decision. */
			const hovering = (0, react.useRef)(false);
			/** Suppresses hover while a press is in flight, per the mutual exclusion rule. */
			const hoverSuppressed = (0, react.useRef)(false);
			const endDrag = (0, react.useCallback)((pointerId, cancelled) => {
				const active = drag.current;
				if (active === null || active.pointerId !== pointerId) return;
				drag.current = null;
				const element = ref.current;
				if (element !== null && element.hasPointerCapture(pointerId)) element.releasePointerCapture(pointerId);
				setPhase("idle");
				if (cancelled) return;
				const committed = clampToViewport({
					left: active.originLeft + active.dx,
					top: active.originTop + active.dy
				}, 36);
				writeStoredPosition(committed);
				setPosition(committed);
			}, []);
			const onPointerDown = (0, react.useCallback)((event) => {
				if (event.button !== 0) return;
				hoverSuppressed.current = true;
				setMenuOpen(false);
				setActionsOpen(false);
				drag.current = {
					pointerId: event.pointerId,
					startX: event.clientX,
					startY: event.clientY,
					originLeft: position.left,
					originTop: position.top,
					travel: 0,
					moved: false,
					dx: 0,
					dy: 0
				};
				setPhase("pressed");
				event.currentTarget.setPointerCapture(event.pointerId);
			}, [position.left, position.top]);
			const onPointerMove = (0, react.useCallback)((event) => {
				const active = drag.current;
				if (active === null || active.pointerId !== event.pointerId) return;
				const dx = event.clientX - active.startX;
				const dy = event.clientY - active.startY;
				active.dx = dx;
				active.dy = dy;
				active.travel = Math.hypot(dx, dy);
				if (active.travel >= DRAG_THRESHOLD && !active.moved) {
					active.moved = true;
					setPhase("dragging");
				}
				setPosition(clampToViewport({
					left: active.originLeft + dx,
					top: active.originTop + dy
				}, 36));
			}, []);
			const onPointerUp = (0, react.useCallback)((event) => {
				const active = drag.current;
				if (active === null || active.pointerId !== event.pointerId) return;
				const wasDrag = active.moved;
				endDrag(event.pointerId, false);
				if (!wasDrag) setMenuOpen(true);
				if (!hovering.current) hoverSuppressed.current = false;
			}, [endDrag]);
			const onPointerCancel = (0, react.useCallback)((event) => {
				endDrag(event.pointerId, true);
				hoverSuppressed.current = false;
			}, [endDrag]);
			const onPointerEnter = (0, react.useCallback)(() => {
				hovering.current = true;
				if (hoverSuppressed.current || actionsOpen) return;
				setMenuOpen(true);
			}, [actionsOpen]);
			const onPointerLeave = (0, react.useCallback)(() => {
				hovering.current = false;
				hoverSuppressed.current = false;
			}, []);
			const onContextMenu = (0, react.useCallback)((event) => {
				event.preventDefault();
				hoverSuppressed.current = true;
				setMenuOpen(false);
				setActionsOpen(true);
			}, []);
			const onClick = (0, react.useCallback)((event) => {
				event.preventDefault();
			}, []);
			const onKeyDown = (0, react.useCallback)((event) => {
				if (event.key === "Enter" || event.key === " ") {
					event.preventDefault();
					setActionsOpen(false);
					setMenuOpen((open) => !open);
				}
				if (event.key === "Escape") {
					setMenuOpen(false);
					setActionsOpen(false);
				}
			}, []);
			(0, react.useEffect)(() => {
				const onResize = () => {
					setPosition((current) => clampToViewport(current, 36));
				};
				window.addEventListener("resize", onResize);
				return () => {
					window.removeEventListener("resize", onResize);
				};
			}, []);
			(0, react.useEffect)(() => {
				if (readStoredPosition() !== void 0) return;
				if (measureInitialPosition(36).anchored) return;
				let timer = 0;
				let elapsed = 0;
				const POLL_MS = 250;
				const DEADLINE_MS = 8e3;
				const tick = () => {
					elapsed += POLL_MS;
					if (readStoredPosition() !== void 0) return;
					const measured = measureInitialPosition(36);
					if (measured.anchored) {
						setPosition(clampToViewport(measured.position, 36));
						return;
					}
					if (elapsed >= DEADLINE_MS) return;
					timer = window.setTimeout(tick, POLL_MS);
				};
				timer = window.setTimeout(tick, POLL_MS);
				return () => {
					window.clearTimeout(timer);
				};
			}, []);
			return {
				ref,
				position,
				phase,
				menuOpen,
				setMenuOpen,
				actionsOpen,
				setActionsOpen,
				resetPosition: (0, react.useCallback)(() => {
					setPosition(clampToViewport(measureInitialPosition(36).position, 36));
					clearStoredPosition();
				}, []),
				handlers: (0, react.useMemo)(() => ({
					onPointerDown,
					onPointerMove,
					onPointerUp,
					onPointerCancel,
					onPointerEnter,
					onPointerLeave,
					onContextMenu,
					onClick,
					onKeyDown
				}), [
					onPointerDown,
					onPointerMove,
					onPointerUp,
					onPointerCancel,
					onPointerEnter,
					onPointerLeave,
					onContextMenu,
					onClick,
					onKeyDown
				])
			};
		}
		/** The ball's button SVG, sized by CSS. */
		function BallGlyph() {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
				className: "dsh-sl-ball-glyph",
				viewBox: "0 0 18 18",
				fill: "none",
				"aria-hidden": "true",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
						x: "1.75",
						y: "1.75",
						width: "6",
						height: "6",
						fill: "currentColor"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
						x: "10.25",
						y: "1.75",
						width: "6",
						height: "6",
						fill: "currentColor"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
						x: "1.75",
						y: "10.25",
						width: "6",
						height: "6",
						fill: "currentColor"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
						x: "10.25",
						y: "10.25",
						width: "6",
						height: "6",
						fill: "currentColor"
					})
				]
			});
		}
		//#endregion
		//#region src/client/menu-card.ts
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
		/** The portaled list, whichever generation rendered it. */
		const LIST_SELECTOR = "div[role=menu]";
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
		function findOpenedCard(known) {
			const candidates = Array.from(document.querySelectorAll(LIST_SELECTOR)).filter((element) => !known.has(element));
			return candidates[candidates.length - 1];
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
		function useAvoidAnchor(open, anchorRef, cardClass) {
			const cardRef = (0, react.useRef)(null);
			(0, react.useEffect)(() => {
				if (!open) {
					const stale = document.querySelector("." + cardClass);
					if (stale !== null) stale.style.transform = "";
					return;
				}
				let frame = 0;
				let card = null;
				const step = () => {
					frame = requestAnimationFrame(step);
					if (card === null || !card.isConnected) card = document.querySelector("." + cardClass);
					const ball = anchorRef.current;
					if (card === null || ball === null) return;
					if (card.style.transform !== "") card.style.transform = "";
					const c = card.getBoundingClientRect();
					const b = ball.getBoundingClientRect();
					if (c.width === 0 || c.height === 0 || b.width === 0 || b.height === 0) return;
					if (!(c.left < b.right && c.right > b.left && c.top < b.bottom && c.bottom > b.top)) return;
					const GAP = 8;
					const MARGIN = 4;
					const dx = c.left >= b.left ? b.right - c.left + GAP : b.left - c.right - GAP;
					if (c.left + dx >= MARGIN && c.right + dx <= window.innerWidth - MARGIN) {
						card.style.transform = "translateX(" + Math.round(dx) + "px)";
						return;
					}
					const dy = b.bottom - c.top + GAP;
					card.style.transform = "translateY(" + Math.round(dy) + "px)";
				};
				frame = requestAnimationFrame(step);
				return () => {
					cancelAnimationFrame(frame);
					if (card !== null) card.style.transform = "";
					const live = document.querySelector("." + cardClass);
					if (live !== null) live.style.transform = "";
				};
			}, [
				open,
				anchorRef,
				cardClass
			]);
			return cardRef;
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
		function useLegacyCard(open, footerClasses, cardClass, footerClass) {
			const cardRef = (0, react.useRef)(null);
			const knownRef = (0, react.useRef)(/* @__PURE__ */ new Set());
			const footerClassesRef = (0, react.useRef)(footerClasses);
			footerClassesRef.current = footerClasses;
			(0, react.useLayoutEffect)(() => {
				if (open) return;
				knownRef.current = new Set(document.querySelectorAll(LIST_SELECTOR));
				cardRef.current = null;
			}, [open]);
			(0, react.useEffect)(() => {
				if (!open) return;
				let frame = 0;
				let branded = null;
				let tagged = [];
				const attach = () => {
					const card = findOpenedCard(knownRef.current);
					if (card === void 0) {
						frame = requestAnimationFrame(attach);
						return;
					}
					card.classList.add(cardClass);
					cardRef.current = card;
					branded = card;
					if (footerClass === void 0) return;
					const footer = Array.from(card.children).filter((child) => child.getAttribute("role") === "presentation")[1];
					if (footer === void 0) return;
					footer.classList.add(footerClass);
					const entries = Array.from(footer.children);
					const classes = footerClassesRef.current;
					tagged = entries;
					entries.forEach((entry, index) => {
						const className = classes[index];
						if (className !== void 0) entry.classList.add(className);
					});
				};
				attach();
				return () => {
					if (frame !== 0) cancelAnimationFrame(frame);
					cardRef.current = null;
					if (branded !== null && branded.isConnected) {
						branded.classList.remove(cardClass);
						if (footerClass !== void 0) branded.classList.remove(footerClass);
						for (const entry of tagged) entry.classList.remove(...footerClassesRef.current);
					}
				};
			}, [
				open,
				cardClass,
				footerClass
			]);
			return cardRef;
		}
		//#endregion
		//#region src/client/launcher-menu.tsx
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
		/** Class on the portaled card; the only handle that reaches it from CSS. */
		const CARD_CLASS = "dsh-sl-launcher-card";
		/**
		* Class added to the card's footer once it is located.
		*
		* On the legacy path the launcher's own chrome (the empty state, the degraded
		* notice) cannot ride along as `children` — 0.1.5's `Menu` renders `items` and
		* `footer` only, and drops `children` on the floor. The footer is therefore the
		* only slot available, and it is marked here so the stylesheet can reach it
		* without depending on the host's hashed CSS-module class names.
		*/
		const FOOTER_CLASS = "dsh-sl-launcher-footer";
		/** The row selector both host generations agree on: every real row is a menuitem. */
		const ROW_SELECTOR = "button[role=menuitem]";
		/**
		* One icon renderer for a row, or nothing.
		* @param row - the row whose glyph to draw.
		* @returns the glyph element, or undefined.
		*/
		function rowIcon(row) {
			const Icon = row.icon;
			if (Icon === void 0) return void 0;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, { size: 14 });
		}
		/**
		* One menu row for the modern (component-row) path.
		*
		* `MenuItemButton` takes no event object on selection, so the left/right split is
		* done by wrapping the row: left-click reaches `onSelect`, while a right-click is
		* caught on the wrapper, prevented from opening the browser's own menu, and
		* dispatched as "open in a new pane".
		*/
		function Row({ row, separatorBefore, onActivate }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				onContextMenu: (event) => {
					event.preventDefault();
					event.stopPropagation();
					onActivate(row.kind, "right");
				},
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.MenuItemButton, {
					icon: rowIcon(row),
					separatorBefore,
					onSelect: () => {
						onActivate(row.kind, "left");
					},
					children: row.title()
				})
			});
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
		function sectionOrder(side) {
			return side === "bottom" ? "recent-first" : "recent-last";
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
		function planLegacyRows(recent, all, side) {
			return planSections(recent, all, side).legacy;
		}
		/**
		* Order the two sections for a given card side, in the shape each path needs.
		*
		* @param recent - the recent section.
		* @param all - every guide entry.
		* @param side - the side the card opens on; decides which group is nearer the ball.
		* @returns both renderings of the same order.
		*/
		function planSections(recent, all, side) {
			const groups = [{
				section: "recent",
				rows: recent
			}, {
				section: "all",
				rows: all
			}];
			const ordered = sectionOrder(side) === "recent-first" ? groups : [groups[1], groups[0]];
			const separated = recent.length > 0 && all.length > 0;
			const legacyRows = [];
			const modernRows = [];
			for (const [groupIndex, group] of ordered.entries()) for (const [rowIndex, row] of group.rows.entries()) {
				const id = `${group.section}:${row.kind}:${row.id}`;
				legacyRows.push({
					id,
					row
				});
				modernRows.push({
					key: id,
					row,
					separatorBefore: separated && groupIndex === 1 && rowIndex === 0
				});
			}
			const firstLength = ordered[0].rows.length;
			return {
				modern: modernRows,
				legacy: {
					rows: legacyRows,
					separatorAt: separated ? firstLength : -1
				}
			};
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
		function resolveRowByIndex(eventTarget, rows, surface) {
			if (surface === null) return void 0;
			if (!(eventTarget instanceof Element)) return void 0;
			if (!surface.contains(eventTarget)) return void 0;
			const button = eventTarget.closest(ROW_SELECTOR);
			if (button === null || !surface.contains(button)) return void 0;
			const buttons = Array.from(surface.querySelectorAll(ROW_SELECTOR));
			if (buttons.length !== rows.length) return void 0;
			const index = buttons.indexOf(button);
			if (index < 0) return void 0;
			return rows[index];
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
		function LegacyRowsMenu(props) {
			const { open, anchorRef, recent, all, children, degradedNote, emptyText, emptyHint, side } = props;
			const isEmpty = recent.length === 0 && all.length === 0;
			const { rows, separatorAt } = planLegacyRows(recent, all, side);
			const footer = isEmpty ? [{
				type: "label",
				id: "__empty__",
				text: emptyText
			}, {
				type: "label",
				id: "__emptyHint__",
				text: emptyHint
			}] : degradedNote === void 0 ? [] : [{
				type: "label",
				id: "__note__",
				text: degradedNote
			}];
			const cardRef = useLegacyCard(open, isEmpty ? ["dsh-sl-launcher-empty", "dsh-sl-launcher-empty-hint"] : degradedNote === void 0 ? [] : ["dsh-sl-launcher-note"], CARD_CLASS, FOOTER_CLASS);
			useAvoidAnchor(open, anchorRef, CARD_CLASS);
			const onSelect = (0, react.useCallback)((id) => {
				const entry = rows.find((candidate) => candidate.id === id);
				if (entry === void 0) return;
				props.onActivate(entry.row.kind, "left");
			}, [rows, props]);
			(0, react.useEffect)(() => {
				if (!open) return;
				const onContextMenu = (event) => {
					const entry = resolveRowByIndex(event.target, rows, cardRef.current);
					if (entry === void 0) return;
					event.preventDefault();
					event.stopPropagation();
					props.onActivate(entry.row.kind, "right");
				};
				document.addEventListener("contextmenu", onContextMenu, true);
				return () => {
					document.removeEventListener("contextmenu", onContextMenu, true);
				};
			}, [
				open,
				rows,
				props,
				cardRef
			]);
			const items = rows.map((entry) => ({
				id: entry.id,
				label: entry.row.title(),
				icon: rowIcon(entry.row)
			}));
			const entries = separatorAt < 0 ? items : [
				...items.slice(0, separatorAt),
				{
					type: "separator",
					id: "__sep__"
				},
				...items.slice(separatorAt)
			];
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Menu, {
				open,
				anchor: children,
				portal: true,
				items: entries,
				footer,
				onSelect,
				getAnchorRect: () => anchorRef.current?.getBoundingClientRect() ?? null,
				align: "end",
				side: props.side,
				onClose: props.onClose
			});
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
		function LauncherMenu(props) {
			if (!props.hasMenuRows) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(LegacyRowsMenu, { ...props });
			const { open, anchorRef, recent, all, children, degradedNote, emptyText, emptyHint, side } = props;
			const isEmpty = recent.length === 0 && all.length === 0;
			const { modern } = planSections(recent, all, side);
			useAvoidAnchor(open, anchorRef, CARD_CLASS);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.Menu, {
				open,
				anchor: children,
				portal: true,
				listClassName: CARD_CLASS,
				getAnchorRect: () => anchorRef.current?.getBoundingClientRect() ?? null,
				align: "end",
				side: props.side,
				onClose: props.onClose,
				children: [
					isEmpty && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dsh-sl-launcher-empty",
						children: emptyText
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dsh-sl-launcher-empty-hint",
						children: emptyHint
					})] }),
					modern.map((planned) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Row, {
						row: planned.row,
						separatorBefore: planned.separatorBefore,
						onActivate: props.onActivate
					}, planned.key)),
					degradedNote !== void 0 && !isEmpty && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dsh-sl-launcher-note",
						children: degradedNote
					})
				]
			});
		}
		//#endregion
		//#region src/client/sidebar-action-menu.tsx
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
		/** Class on the operation card; the only handle that reaches it from CSS. */
		const ACTION_CARD_CLASS = "dsh-sl-action-card";
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
		function Glyph({ children }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
				className: "dsh-sl-action-glyph",
				viewBox: "0 0 16 16",
				fill: "none",
				"aria-hidden": "true",
				children
			});
		}
		/** The stroke shared by every glyph, so the set reads as one family. */
		const STROKE = {
			stroke: "currentColor",
			strokeWidth: 1.5,
			strokeLinecap: "round",
			strokeLinejoin: "round"
		};
		/**
		* The six leading glyphs, keyed by action.
		*
		* Each one says what the row does to the *surface*, not merely that it clears
		* something: `clearDocked` keeps the float block, `clearAll` drops it, `clearLeft`
		* and `clearRight` are the two halves of a split, `clearFloats` is a detached
		* panel, and `resetBall` is a re-centre.
		*/
		const GLYPHS = {
			clearDocked: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Glyph, { children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
					x: "2",
					y: "3.5",
					width: "12",
					height: "3.5",
					rx: "1",
					...STROKE
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M3.5 10.5h9",
					...STROKE
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M3.5 13h5",
					...STROKE
				})
			] }),
			clearAll: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Glyph, { children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
					x: "2",
					y: "3.5",
					width: "12",
					height: "3.5",
					rx: "1",
					...STROKE
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M3.5 10.5h9",
					...STROKE
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M6 13h4",
					...STROKE
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M13.4 6.6l-4.8 4.8",
					...STROKE
				})
			] }),
			clearLeft: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Glyph, { children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
					x: "2",
					y: "3",
					width: "12",
					height: "10",
					rx: "1.5",
					...STROKE
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M8 3v10",
					...STROKE
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M3.6 6.4h2.2",
					...STROKE
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M3.6 9.6h2.2",
					...STROKE
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M6.6 5.2l-2 2.4 2 2.4",
					...STROKE
				})
			] }),
			clearRight: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Glyph, { children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
					x: "2",
					y: "3",
					width: "12",
					height: "10",
					rx: "1.5",
					...STROKE
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M8 3v10",
					...STROKE
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M10.2 6.4h2.2",
					...STROKE
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M10.2 9.6h2.2",
					...STROKE
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M9.4 5.2l2 2.4-2 2.4",
					...STROKE
				})
			] }),
			clearFloats: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Glyph, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
				x: "2.2",
				y: "2.6",
				width: "9",
				height: "7.4",
				rx: "1.4",
				...STROKE
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
				x: "5.4",
				y: "5.6",
				width: "8.4",
				height: "7",
				rx: "1.4",
				...STROKE
			})] }),
			resetBall: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Glyph, { children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
					cx: "8",
					cy: "8",
					r: "5.2",
					...STROKE
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
					cx: "8",
					cy: "8",
					r: "1.6",
					...STROKE
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M8 1.2v1.8M8 13v1.8M1.2 8h1.8M13 8h1.8",
					...STROKE
				})
			] })
		};
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
		function buildActionRows(state, copy) {
			const twoPanes = state.dock.count > 1;
			const hasFloats = state.floated.length > 0;
			return [
				{
					id: "clearDocked",
					label: copy("actionClearDocked"),
					disabled: false,
					separatorBefore: false,
					icon: GLYPHS.clearDocked
				},
				{
					id: "clearAll",
					label: copy("actionClearAll"),
					disabled: false,
					separatorBefore: false,
					icon: GLYPHS.clearAll
				},
				{
					id: "clearLeft",
					label: copy("actionClearLeft"),
					disabled: !twoPanes,
					separatorBefore: true,
					icon: GLYPHS.clearLeft
				},
				{
					id: "clearRight",
					label: copy("actionClearRight"),
					disabled: !twoPanes,
					separatorBefore: false,
					icon: GLYPHS.clearRight
				},
				{
					id: "clearFloats",
					label: copy("actionClearFloats"),
					disabled: !hasFloats,
					separatorBefore: false,
					icon: GLYPHS.clearFloats
				},
				{
					id: "resetBall",
					label: copy("actionResetBall"),
					disabled: false,
					separatorBefore: true,
					icon: GLYPHS.resetBall
				}
			];
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
		function LegacyActionMenu(props) {
			useLegacyCard(props.open, [], ACTION_CARD_CLASS);
			useAvoidAnchor(props.open, props.anchorRef, ACTION_CARD_CLASS);
			const onSelect = (0, react.useCallback)((id) => {
				const row = props.rows.find((candidate) => candidate.id === id);
				if (row === void 0 || row.disabled) return;
				props.onRun(row.id);
			}, [props]);
			const items = [];
			props.rows.forEach((row, index) => {
				if (row.separatorBefore && index > 0) items.push({
					type: "separator",
					id: "sep:" + row.id
				});
				items.push({
					id: row.id,
					label: row.label,
					icon: row.icon,
					disabled: row.disabled
				});
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Menu, {
				open: props.open,
				anchor: props.children,
				portal: true,
				items,
				onSelect,
				getAnchorRect: () => props.anchorRef.current?.getBoundingClientRect() ?? null,
				align: "end",
				side: props.side,
				onClose: props.onClose
			});
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
		function SidebarActionMenu(props) {
			if (!props.hasMenuRows) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(LegacyActionMenu, { ...props });
			useAvoidAnchor(props.open, props.anchorRef, ACTION_CARD_CLASS);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Menu, {
				open: props.open,
				anchor: props.children,
				portal: true,
				listClassName: ACTION_CARD_CLASS,
				getAnchorRect: () => props.anchorRef.current?.getBoundingClientRect() ?? null,
				align: "end",
				side: props.side,
				onClose: props.onClose,
				children: props.rows.map((row) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.MenuItemButton, {
					icon: row.icon,
					disabled: row.disabled,
					separatorBefore: row.separatorBefore,
					onSelect: () => {
						if (row.disabled) return;
						props.onRun(row.id);
					},
					children: row.label
				}, row.id))
			});
		}
		//#endregion
		//#region src/client/sidebar-actions.ts
		/**
		* The sidebar-operations menu's *mechanics*: what is open, and how to close it.
		*
		* Everything in this module is deliberately free of React and of the host
		* primitives, so it can be unit-tested under jsdom against both host generations'
		* markup without mounting anything. The component that draws the menu
		* (`sidebar-action-menu.tsx`) and the owner that wires it (`index.tsx`) both go
		* through here, which is what keeps the "which tabs am I about to close" question
		* answered in exactly one place.
		*
		* ## Why the docked/floating split is computed the way it is
		*
		* The host exposes `ISidebarRight.close(tabId)` and nothing else: no `closeAll`,
		* no `closePane`, no `mergePane`, and no layout tree on the public face.
		* `tabsIn(sessionId)` returns flat `{sessionId, tabId, kind, contentId}` records
		* with **no pane ownership**, so "the left pane" cannot be read from the API at
		* all. Two consequences shape this file:
		*
		* 1. **Docked grouping is the one and only DOM dependency.** It comes from
		*    `[data-dockkit-pane]`, ordered left to right by the host's own
		*    `data-dockkit-column` (falling back to measured geometry when that is
		*    absent). Document order is deliberately *not* used: on 0.1.7+ the grid
		*    renderer emits panes sorted by active tab id, which has nothing to do with
		*    left and right. See {@link orderPanesLeftToRight}. Only the two "clear one
		*    pane" rows depend on the order; the other four do not.
		* 2. **Floating tabs are a set difference, never a DOM scan.** A float's header
		*    carries `data-dockkit-float-grip` / `-title` / `-dock` / `-close` but **no**
		*    `data-dockkit-tab`, so a floating tab's id is not recoverable from its own
		*    markup. It is recoverable as *API total minus docked*, which is also the
		*    honest definition: a tab is floating exactly when it is open somewhere other
		*    than a docked pane.
		*
		* ## A live-measured correction to the brief's DOM contract
		*
		* The brief's §5.4 table lists `[data-sidebar-right-session]` as the session
		* container. **That attribute exists only on 0.1.7-rc.2.** A live probe of the
		* running Tavern host (0.1.5-rc.2), with the column expanded and tabs open, found
		* zero such elements; there the panel itself carries
		* `[data-sidebar-right-panel]` + `[data-sidebar-right-open]` and the panes hang
		* under `[data-dockkit-surface]`. So the root resolver below accepts **either**
		* container attribute and is not tied to a version; see {@link paneRoot}.
		*
		* ## Closing is not atomic, so the id list is snapshotted first
		*
		* `close(tabId)` runs the tab kind's own `closeHandler` and only then commits
		* (`removeAfterCleanup`). Both current hosts commit synchronously, but React
		* batches the resulting render, so **the DOM does not reflect a close until the
		* handler that triggered it returns**. Any loop that re-read the layout between
		* closes would therefore re-close the same tabs, or miss the ones after it. Every
		* entry point here reads its ids once, up front, and only then closes.
		*/
		/** The containers a docked pane can hang under, either host generation. */
		const PANE_ROOT_SELECTORS = ["[data-sidebar-right-session]", "[data-sidebar-right-panel]"];
		/** Inside a collapsed or inactive seat: not the surface the user is looking at. */
		const HIDDEN_ANCESTOR = "[hidden], [aria-hidden=\"true\"]";
		/** A docked pane. Floating panes carry `data-dockkit-float` and are excluded. */
		const DOCKED_PANE = "[data-dockkit-pane]";
		/** The chip attribute whose value is the tab's own id. */
		const TAB_CHIP = "[data-dockkit-tab]";
		/** The `dataset` key carrying the tab id on a chip. */
		const TAB_ID_KEY = "dockkitTab";
		/** The `dataset` key carrying a pane's own id on a `[data-dockkit-pane]` node. */
		const PANE_ID_KEY = "dockkitPane";
		/** The attribute name a chip's tab id is actually read from, derived once. */
		const TAB_ID_ATTRIBUTE = "data-" + TAB_ID_KEY.replace(/[A-Z]/g, (letter) => "-" + letter.toLowerCase());
		/**
		* The attribute a pane's own id is read from, derived once from the `dataset`
		* key. The host reads the same attribute as `container.dataset.dockkitPane`,
		* so this is the host's own spelling of the value rather than a second guess.
		*/
		const PANE_ID_ATTRIBUTE = "data-" + PANE_ID_KEY.replace(/[A-Z]/g, (letter) => "-" + letter.toLowerCase());
		/** The attribute name a pane's column is actually read from, derived once. */
		const PANE_COLUMN_ATTRIBUTE = "data-" + "dockkitColumn".replace(/[A-Z]/g, (letter) => "-" + letter.toLowerCase());
		/**
		* Read the mounted session's tab records, whichever generation published them.
		*
		* This is the same two-route lookup `host-access.mountedTabRecords` performs, and
		* it is restated rather than imported for one structural reason: `capabilities.ts`
		* value-imports the host primitives package, so anything importing it for a value
		* drags the primitives bundle into this module and out of plain-jsdom reach. The
		* *predicate* is shared — {@link isMountedObservableShape} comes from
		* `host-access.ts`, which imports `capabilities.ts` as a type only — so the two
		* copies cannot drift in the way that matters.
		*
		* @param faces - the right-Sidebar navigation face.
		* @param sessionId - the mounted session on a modern host; unused on a legacy one.
		* @returns the records, or `[]` when no seat is mounted.
		*/
		function tabRecords(faces, sessionId) {
			if (typeof faces.tabsIn === "function") {
				const target = sessionId ?? observableSessionId(faces);
				if (target !== void 0) return faces.tabsIn(target);
				const active = faces.active();
				return active === void 0 ? [] : [active];
			}
			const mounted = faces.mounted;
			if (typeof mounted === "function") {
				const surface = mounted.call(faces);
				if (surface === void 0) return [];
				return Object.values(surface.layout.tabs);
			}
			return [];
		}
		/**
		* The mounted session id, when the host publishes one as an observable.
		* @param faces - the right-Sidebar navigation face.
		* @returns the id, or undefined on a legacy host.
		*/
		function observableSessionId(faces) {
			if (!isMountedObservableShape(faces)) return void 0;
			return faces.mounted.getSnapshot();
		}
		/**
		* Every open tab id of the mounted session, docked and floating alike. API only.
		*
		* @param faces - the right-Sidebar navigation face.
		* @param sessionId - the mounted session on a modern host.
		* @returns the ids, in the host's own record order.
		*/
		function allTabIds(faces, sessionId) {
			return tabRecords(faces, sessionId).map((record) => record.id);
		}
		/**
		* Resolve the container whose docked panes are the ones on screen.
		*
		* ## Why "visible first, then id, then anything"
		*
		* A modern host keeps a **retained** right Sidebar per session and hides the ones
		* that are not selected, so several pane containers can exist at once and only one
		* of them belongs to the mounted session. The session id, when the caller has one,
		* is the precise answer; the hidden-ancestor test is the fallback that works on a
		* host which publishes no id at all (0.1.5).
		*
		* The final fallback — the first container in document order even while a hidden
		* ancestor hides it — is deliberate: a collapsed column still holds real tabs, and
		* "clear the docked tabs" should work with the column shut. Closing a tab does not
		* depend on its pane being painted.
		*
		* @param sessionId - the mounted session id, when known.
		* @returns the container, or null when no right Sidebar is in the document.
		*/
		function paneRoot(sessionId) {
			const candidates = [];
			for (const selector of PANE_ROOT_SELECTORS) for (const element of document.querySelectorAll(selector)) if (!candidates.includes(element)) candidates.push(element);
			if (candidates.length === 0) return null;
			const visible = candidates.filter((element) => element.closest(HIDDEN_ANCESTOR) === null);
			if (sessionId !== void 0) {
				const owned = candidates.filter((element) => element.getAttribute("data-sidebar-right-session") === sessionId);
				const ownedVisible = owned.find((element) => visible.includes(element));
				if (ownedVisible !== void 0) return ownedVisible;
				if (owned[0] !== void 0) return owned[0];
			}
			return visible[0] ?? candidates[0] ?? null;
		}
		/**
		* Order docked panes left to right by the column the host itself wrote.
		*
		* Document order is **not** left-to-right on the 0.1.7+ grid renderer, which is
		* why this function exists. That renderer emits its tab cells in ascending *tab
		* id* order — verbatim, `Object.values(n.tabs).sort((a, b) => a.id.localeCompare(b.id))`
		* — and only then places each one with `gridColumn: column * 2 + 1`. Neither the
		* sort nor the DOM knows about columns, so `querySelectorAll` order is the
		* dictionary order of each pane's active tab id, unrelated to left/right. The
		* real column is the host's own `data-dockkit-column`, written on the tab cell
		* and on the pane section inside it.
		*
		* Two fallbacks, in order, because a missing column is not a rare shape:
		*
		* - **Any pane without a column** drops the whole batch to measured geometry
		*   (`getBoundingClientRect().left`). A modern host renders *empty* panes from a
		*   separate branch (`div[data-dockkit-empty]` wrapping the pane section) that
		*   writes **no** column and always sorts after every occupied cell, so trusting
		*   document order for it would put a left-hand empty pane on the right. The
		*   geometry read is per-pane rather than all-or-nothing: mixing a column with a
		*   measurement is the same unit mismatch this fallback exists to avoid.
		* - **Non-finite column** (absent or non-numeric) also falls back to geometry,
		*   so a malformed attribute degrades instead of sorting as NaN.
		*
		* The 0.1.5 flex renderer writes no column anywhere and already lays its panes
		* out left to right, so geometry reproduces its document order exactly — this is
		* a live regression path (Tavern), not dead code.
		*
		* @param panes - the docked panes, in whatever order the DOM reported them.
		* @returns the same panes, left to right.
		*/
		function orderPanesLeftToRight(panes) {
			if (panes.length < 2) return panes;
			const columns = panes.map((pane) => {
				const raw = pane.getAttribute(PANE_COLUMN_ATTRIBUTE);
				return raw === null ? NaN : Number.parseInt(raw, 10);
			});
			const scores = columns.every(Number.isFinite) ? columns : panes.map((pane) => pane.getBoundingClientRect().left);
			return panes.map((pane, index) => ({
				pane,
				score: scores[index] ?? 0
			})).sort((a, b) => a.score - b.score).map((entry) => entry.pane);
		}
		/**
		* Read the docked panes and their tabs, left to right.
		*
		* "Left to right" is {@link orderPanesLeftToRight}'s answer, not document order:
		* see that function for why the two differ on every 0.1.7+ host and agree on
		* 0.1.5. This is the batch's only non-API dependency.
		*
		* A single docked pane reports itself in `left` and leaves `right` empty, which is
		* what lets the menu disable both pane rows on one pane rather than offering a
		* no-op right-hand clear. More than two panes cannot happen under the host's
		* two-pane budget, but if it ever did, the middle panes would still be closed by
		* {@link DockGroups.all} while `left` and `right` kept meaning "first" and "last".
		*
		* @param sessionId - the mounted session id, when known.
		* @returns the groups; all-empty when no right Sidebar is in the document.
		*/
		function dockGroups(sessionId) {
			const root = paneRoot(sessionId);
			if (root === null) return {
				count: 0,
				left: [],
				right: [],
				all: [],
				paneIds: []
			};
			const panes = orderPanesLeftToRight(Array.from(root.querySelectorAll(DOCKED_PANE)));
			const groups = panes.map((pane) => Array.from(pane.querySelectorAll(TAB_CHIP)).map((chip) => chip.getAttribute(TAB_ID_ATTRIBUTE) ?? "").filter((id) => id !== ""));
			const paneIds = panes.map((pane) => pane.getAttribute(PANE_ID_ATTRIBUTE) ?? "");
			const all = groups.flat();
			const first = groups[0];
			if (first === void 0) return {
				count: 0,
				left: [],
				right: [],
				all,
				paneIds
			};
			const firstPaneId = paneIds[0];
			const lastPaneId = paneIds[paneIds.length - 1];
			if (groups.length === 1) return {
				count: 1,
				left: first,
				right: [],
				all,
				paneIds,
				...firstPaneId === void 0 || firstPaneId === "" ? {} : { leftPaneId: firstPaneId }
			};
			return {
				count: groups.length,
				left: first,
				right: groups[groups.length - 1] ?? [],
				all,
				paneIds,
				...firstPaneId === void 0 || firstPaneId === "" ? {} : { leftPaneId: firstPaneId },
				...lastPaneId === void 0 || lastPaneId === "" ? {} : { rightPaneId: lastPaneId }
			};
		}
		/**
		* The floating tab ids: everything the API reports, minus every docked tab.
		*
		* @param all - every open tab id, from {@link allTabIds}.
		* @param docked - every docked tab id, from {@link DockGroups.all}.
		* @returns the floating ids, in the API's order.
		*/
		function floatedTabIds(all, docked) {
			const dockedSet = new Set(docked);
			return all.filter((id) => !dockedSet.has(id));
		}
		/**
		* Close each named tab, skipping the one the host would refuse anyway.
		*
		* The skip reproduces the host's own `canCloseTab` rule for the single case that
		* matters — the last docked tab when it is the guide page:
		*
		*     tab.kind === "guide" && soleDockedTab(layout, tabId)
		*     soleDockedTab = pane.host === "dock" && pane.tabs.length === 1
		*                     && dockPaneIds(layout).length === 1
		*
		* Read against the docked set, that reduces to "the whole docked surface holds
		* exactly one tab and it is this guide", which is computable without the layout
		* tree. A guide **inside a float is not protected** — `soleDockedTab` requires
		* `host === "dock"` — and this rule leaves it closable, matching the host.
		*
		* The host still applies its own guard as a backstop (`close` then `closeIn` then
		* `canCloseTab` on 0.1.7, the `closeTab` reducer on 0.1.5), so this duplicates a
		* rule rather than depending on one: if a future host relaxed it, the menu would
		* simply skip one tab it could now have closed.
		*
		* @param faces - the right-Sidebar navigation face.
		* @param ids - the tab ids to close, snapshotted by the caller before any close.
		* @param sessionId - the mounted session id, when known.
		* @returns how many tabs were actually handed to the host.
		*/
		function closeTabs(faces, ids, sessionId) {
			if (ids.length === 0) return 0;
			const kinds = new Map(tabRecords(faces, sessionId).map((record) => [record.id, record.kind]));
			const docked = new Set(dockGroups(sessionId).all);
			const soleDocked = docked.size === 1 ? [...docked][0] : void 0;
			let closed = 0;
			for (const id of ids) {
				if (kinds.get(id) === "guide" && id === soleDocked) continue;
				faces.close(id);
				closed += 1;
			}
			return closed;
		}
		/**
		* Collapse the column when it is showing its panel.
		*
		* `isExpanded` is asked first rather than toggling blind: `toggleExpanded` is an
		* *expand or collapse* control, so calling it unconditionally would pop the panel
		* open on a host where the user had it shut.
		*
		* @param faces - the right-Sidebar navigation face.
		* @returns whether a collapse was requested.
		*/
		function collapseIfExpanded(faces) {
			if (!faces.isExpanded()) return false;
			faces.toggleExpanded();
			return true;
		}
		/**
		* Snapshot the sidebar's state for one menu open.
		* @param faces - the right-Sidebar navigation face.
		* @param sessionId - the mounted session id, when known.
		* @returns the snapshot the menu draws its enabled/disabled rows from.
		*/
		function readActionState(faces, sessionId) {
			const dock = dockGroups(sessionId);
			const all = allTabIds(faces, sessionId);
			return {
				dock,
				all,
				floated: floatedTabIds(all, dock.all),
				expanded: faces.isExpanded()
			};
		}
		//#endregion
		//#region src/client/capabilities.ts
		/**
		* Capability probes for the two DSH client generations this plugin runs on.
		*
		* ## Why probing, and not a version check
		*
		* The launcher ships as a source `link:` into more than one host profile, and the
		* two hosts differ in *shape*, not in name: 0.1.7-rc.2 exports `MenuItemButton`
		* and gives `sidebarRight` an observable `mounted` plus a `tabsIn(sessionId)`
		* lookup; 0.1.5-rc.2 has neither — its `mounted` is a plain method and its `Menu`
		* is `items`-driven. (`split()` and `openTab` exist on both, so placement no
		* longer branches by generation; see `placement.ts`.)
		*
		* A version string cannot be read from inside a browser bundle: `package.json`
		* is not in the client module table, and the host publishes no version on the
		* context. Even if it did, a *number* would be the wrong question — what matters
		* is which members and props actually exist on the objects this plugin was handed.
		* So every branch in this plugin is chosen by asking the live value a `typeof`
		* question, which is what this module centralizes. Nothing here reads a version.
		*
		* ## Why there is no `preferNewPane` probe
		*
		* There used to be one, aliased onto {@link hasTabInventory} because
		* `preferNewPane` is an *option value* inside an options object and `typeof`
		* cannot see inside one without calling `openTab` — a call that opens a real tab
		* in the user's UI and is therefore unthinkable as a probe. That alias was the
		* one known-weak branch in this layer.
		*
		* It is gone because the option itself is no longer used. `openTab({ preferNewPane: true })`
		* cannot split for a page kind that is already open in the target pane — the
		* host's `openContent` short circuits to `focusTab` before the split branch is
		* reached — so both generations now place a new pane with `split()` +
		* `openTab({ paneId })`. See `placement.ts` for the reducer excerpt. Removing
		* the option removes the need to guess at it, and with it the assumption.
		*/
		/**
		* Whether the host's `Menu` renders component rows (`children` +
		* `listClassName`) rather than only data rows.
		*
		* `MenuItemButton` is the marker: it is the primitive that exists precisely to
		* let an owner render a `role="menuitem"` row as a component, and it arrived in
		* the same release as `Menu`'s `children` and `listClassName` props. On
		* 0.1.5-rc.2 the import resolves to `undefined` inside the module-table factory
		* rather than throwing, so this probe is a plain `typeof` check at module scope.
		*
		* @returns true when the modern, component-row menu path is available.
		*/
		function hasMenuRows() {
			return typeof _deepseek_ai_dsh_client_ui_primitives.MenuItemButton === "function";
		}
		/**
		* Whether `sidebarRight` exposes `tabsIn(sessionId)`.
		*
		* The method signature of the 0.1.5 controller has no `tabsIn`; 0.1.7 added it
		* as the cross-session tab inventory. When absent, the mounted surface's own
		* `layout.tabs` carries the same records — see `recent.ts`.
		*
		* @param sidebarRight - the right-Sidebar navigation face.
		* @returns true when the tab inventory lookup exists.
		*/
		function hasTabInventory(sidebarRight) {
			return typeof sidebarRight.tabsIn === "function";
		}
		/**
		* Whether `sidebarRight` is of the modern generation, i.e. whether `mounted` is
		* an observable snapshot source.
		*
		* @param sidebarRight - the right-Sidebar navigation face.
		* @returns true when `mounted` is an observable snapshot source.
		*/
		function hasMountedObservable(sidebarRight) {
			return isMountedObservableShape(sidebarRight);
		}
		/**
		* Read every service-backed capability at once.
		*
		* Called once where `sidebarRight` is resolved (not per render), so a branch
		* taken while opening cannot disagree with the branch taken while drawing: both
		* read one object captured from one service instance.
		*
		* @param sidebarRight - the right-Sidebar navigation face.
		* @returns the capability set for this host generation.
		*/
		function detectCapabilities(sidebarRight) {
			return {
				hasTabInventory: hasTabInventory(sidebarRight),
				hasMountedObservable: hasMountedObservable(sidebarRight),
				hasSplit: typeof sidebarRight.split === "function"
			};
		}
		//#endregion
		//#region src/client/placement.ts
		/**
		* The scheme a *page* address carries, as opposed to a resource's
		* `dsh-resource://`. The host records pages at `sidebar://<kind>`, which is what
		* makes a seeded tab identifiable.
		*/
		const PAGE_SCHEME = "sidebar://";
		/**
		* Read the seed out of one post-split inventory.
		*
		* `before` is the set of tab ids that were open before the split. Any id not in
		* it was added by the split; the first of those that is a page address is the
		* seed. A non-page tab among the newcomers is deliberately not taken for one: a
		* resource opened from a file carries `dsh-resource://`, and replacing it would
		* close content the user asked to keep.
		*
		* @param capabilities - the capability set read from this host.
		* @param sidebarRight - the right-Sidebar navigation face.
		* @param before - every tab id open before the split.
		* @returns whether the read was usable, and the seed tab's id when there is one.
		*/
		function readSeed(capabilities, sidebarRight, before) {
			let sawNewTab = false;
			for (const record of mountedTabRecords(capabilities, sidebarRight)) {
				if (before.has(record.id)) continue;
				sawNewTab = true;
				if (record.contentId.startsWith(PAGE_SCHEME)) return {
					state: "ready",
					tabId: record.id
				};
			}
			if (!sawNewTab) return { state: "stale" };
			return { state: "ready" };
		}
		/**
		* Every tab id currently open in the mounted session.
		*
		* Read immediately before a `split()` so the difference across the call names
		* the seed. An empty set is a valid answer (nothing was open), not a failure.
		*
		* @param capabilities - the capability set read from this host.
		* @param sidebarRight - the right-Sidebar navigation face.
		* @returns the ids, as a set for a cheap membership test.
		*/
		function openTabIds(capabilities, sidebarRight) {
			return new Set(mountedTabRecords(capabilities, sidebarRight).map((record) => record.id));
		}
		/**
		* Open a kind into the pane the gesture asked for. See the module header for
		* the three targets and the seed deferral.
		*
		* @param capabilities - the capability set read from this host.
		* @param sidebarRight - the right-Sidebar navigation face.
		* @param kind - the tab kind to open.
		* @param target - the pane the gesture wants: the left pane, the right pane, or
		*   the only pane there is (a collapsed column included).
		* @param panes - the pane ids on screen for THIS open, read from the DOM just
		*   before the call; see {@link PlacementPanes}.
		* @returns nothing; the host owns every layout decision.
		*/
		function openKind(capabilities, sidebarRight, kind, target, panes) {
			if (target === "single") {
				sidebarRight.openTab(kind);
				return;
			}
			if (target === "left") {
				const paneId = panes.leftPaneId;
				if (paneId === void 0) {
					sidebarRight.openTab(kind);
					return;
				}
				sidebarRight.openTab(kind, { paneId });
				return;
			}
			const existingRight = panes.rightPaneId;
			if (existingRight !== void 0) {
				sidebarRight.openTab(kind, { paneId: existingRight });
				return;
			}
			const split = sidebarRight.split;
			if (split === void 0) {
				sidebarRight.openTab(kind);
				return;
			}
			const before = openTabIds(capabilities, sidebarRight);
			const paneId = split.call(sidebarRight, panes.leftPaneId);
			if (paneId === void 0) {
				sidebarRight.openTab(kind);
				return;
			}
			const read = readSeed(capabilities, sidebarRight, before);
			if (read.state === "ready") {
				sidebarRight.openTab(kind, read.tabId === void 0 ? {
					paneId,
					revealIfOpened: false
				} : {
					paneId,
					revealIfOpened: false,
					replaceTab: read.tabId
				});
				return;
			}
			queueMicrotask(() => {
				const late = readSeed(capabilities, sidebarRight, before);
				const tabId = late.state === "ready" ? late.tabId : void 0;
				sidebarRight.openTab(kind, tabId === void 0 ? {
					paneId,
					revealIfOpened: false
				} : {
					paneId,
					revealIfOpened: false,
					replaceTab: tabId
				});
			});
		}
		//#endregion
		//#region src/client/index.tsx
		/**
		* Client half of dsh-sidebar-launcher.
		*
		* Mounts one launcher ball into the host's `shell.overlay` layer and gives it a
		* dropdown of the right column's tab types.
		*
		* ## Service arrival
		*
		* The slot registry arrives with the client runtime, but `sidebarRight` and
		* `sidebarRightTabs` are published by the right-Sidebar package, which may load
		* after this one. The menu's data is therefore read inside
		* `ctx.inject([...], callback)`, whose callback runs when — and only when — both
		* services exist, and re-runs if either is replaced. Reading them with `ctx.get()`
		* from inside the slot callback instead would capture `undefined` once and never
		* retry, because the slot registration is not re-evaluated when a service appears.
		*
		* ## Why the hover grace lives here
		*
		* The grace has to span two elements that are not in the same subtree: the ball,
		* and the portaled menu card. `Menu`'s own `closeOnPointerLeave` wires its grace
		* to the trigger wrapper only, so it cannot see a portaled card and would close
		* the menu the moment the pointer left the ball. The grace is owned here instead,
		* where both elements can be observed.
		*/
		/** Services required before the menu can be built. */
		const inject = ["slots", "locale"];
		/** The slot the ball mounts into. */
		const SLOT_KEY = "shell.overlay";
		/** How long the pointer may leave both the ball and the card before closing. */
		const POINTER_GRACE_MS = 200;
		/**
		* C3 — which side of the ball the card opens on, from the ball's live position.
		*
		* The ball already carries its position in React state, so the ballpark answer
		* costs nothing and needs no measuring: below the viewport's midline the card
		* opens upward (`top`), above it downward (`bottom`, the default). Both host
		* generations take `side` as a `Menu` prop.
		*
		* This is a HINT, not a guarantee. When the card is long enough to hit its
		* scroll ceiling and the ball is low, the host's own viewport clamp can push a
		* `top` card back down over the ball. The frame-by-frame nudge in
		* `useAvoidAnchor` is what actually closes that case, and it runs on both
		* paths.
		*
		* @param position - the ball's current top-left corner, in viewport px.
		* @returns the side the card should prefer.
		*/
		function preferredSide(position) {
			const viewportHeight = typeof window === "undefined" ? 0 : window.innerHeight;
			return position.top + 18 > viewportHeight / 2 ? "top" : "bottom";
		}
		/**
		* Create the mode observable the menu's notice subscribes to.
		* @returns the source, initially the preferred mode.
		*/
		function createModeSource() {
			let current = "b1";
			const listeners = /* @__PURE__ */ new Set();
			return {
				get: () => current,
				subscribe(listener) {
					listeners.add(listener);
					return () => {
						listeners.delete(listener);
					};
				},
				set(mode) {
					if (mode === current) return;
					current = mode;
					for (const listener of [...listeners]) listener();
				}
			};
		}
		/**
		* Read the launcher's copy for the active locale.
		*
		* The title and description of every row come from the tab type's own thunks, so
		* this only covers chrome the host does not own.
		*
		* @param locale - the locale service face.
		* @returns a key-to-text resolver bound to the active locale.
		*/
		function useCopy(locale) {
			const subscribe = (0, react.useCallback)((listener) => locale.subscribe(listener), [locale]);
			const getSnapshot = (0, react.useCallback)(() => locale.getSnapshot(), [locale]);
			(0, react.useSyncExternalStore)(subscribe, getSnapshot, getSnapshot);
			return (0, react.useCallback)((key) => {
				return (locale.getSnapshot().active.toLowerCase().startsWith("zh") ? zh : en)[key] ?? key;
			}, [locale]);
		}
		/**
		* Build the ball and its menu over the live services.
		*
		* @param data - the service-backed data the menu draws from.
		* @param locale - the locale service face.
		* @returns the component to register into the slot.
		*/
		function createLauncher(data, locale) {
			return function Launcher() {
				const ball = useLauncherBall();
				const copy = useCopy(locale);
				const mode = (0, react.useSyncExternalStore)(data.mode.subscribe, data.mode.get, data.mode.get);
				const recentKinds = (0, react.useSyncExternalStore)(data.recent.subscribe, data.recent.get, data.recent.get);
				const [sections, setSections] = (0, react.useState)(() => readSections(data.guide, data.recent));
				/**
				* The rows and card side frozen for the life of one open, or null while shut.
				*
				* Clicking a row no longer closes the card, so the card outlives the click
				* that changed the recent list. Without freezing, the clicked row would
				* immediately jump into the recent section *under the pointer*, and the next
				* click would land on a different tab than the one the user aimed at. Freezing
				* the order (and the side, so the card cannot flip sides mid-interaction) is
				* therefore a precondition for "clicking a row does not close the menu", not
				* a cosmetic extra.
				*
				* Held in state, not a ref, because the rendered rows must come from it; it is
				* set exactly once per open and cleared when the card closes.
				*/
				const [frozen, setFrozen] = (0, react.useState)(null);
				const resyncSections = (0, react.useCallback)(() => {
					setSections(readSections(data.guide, data.recent));
				}, []);
				(0, react.useEffect)(() => {
					if (!ball.menuOpen) return;
					resyncSections();
				}, [
					ball.menuOpen,
					recentKinds,
					resyncSections
				]);
				(0, react.useEffect)(() => {
					const subscribeTabs = data.tabsSubscribe;
					if (subscribeTabs === void 0) return;
					return subscribeTabs(() => {
						resyncSections();
					});
				}, [resyncSections]);
				(0, react.useEffect)(() => {
					if (!ball.menuOpen) {
						setFrozen(null);
						return;
					}
					setFrozen({
						sections: readSections(data.guide, data.recent),
						side: preferredSide(ball.position)
					});
				}, [ball.menuOpen]);
				const actionState = (0, react.useMemo)(() => ball.actionsOpen ? readActionState(data.sidebarRight, data.sessionId()) : null, [ball.actionsOpen]);
				/**
				* Run one of the six actions and dismiss the card.
				*
				* Every branch reads its ids from the snapshot or re-reads once, up front, and
				* only then closes: a close does not commit to the DOM until this handler
				* returns, so a loop that re-read between closes would act on stale markup. See
				* `sidebar-actions.ts`.
				*/
				const onRunAction = (0, react.useCallback)((id) => {
					const faces = data.sidebarRight;
					const sessionId = data.sessionId();
					switch (id) {
						case "clearDocked":
							closeTabs(faces, dockGroups(sessionId).all, sessionId);
							collapseIfExpanded(faces);
							break;
						case "clearAll":
							closeTabs(faces, allTabIds(faces, sessionId), sessionId);
							collapseIfExpanded(faces);
							break;
						case "clearLeft":
							closeTabs(faces, dockGroups(sessionId).left, sessionId);
							break;
						case "clearRight":
							closeTabs(faces, dockGroups(sessionId).right, sessionId);
							break;
						case "clearFloats":
							closeTabs(faces, floatedTabIds(allTabIds(faces, sessionId), dockGroups(sessionId).all), sessionId);
							break;
						case "resetBall": ball.resetPosition();
					}
					ball.setActionsOpen(false);
				}, [ball]);
				/**
				* Open one row and leave the menu up.
				*
				* The menu deliberately does NOT close here (a left or right click on a row
				* keeps it open; only the pointer leaving both the ball and the card closes
				* it). Two consequences are load-bearing:
				*
				* 1. The target pane is read from the live DOM *per activation* rather than
				*    from the render that drew the rows, because a row click may itself have
				*    created a pane a moment ago.
				* 2. `sections` and `side` are frozen for as long as the card is up, so the
				*    row the pointer is over cannot move to the recent section underneath it
				*    (which would make a double click land on a different tab).
				*/
				const onActivate = (0, react.useCallback)((kind, gesture) => {
					data.open(kind, gesture);
					data.tracker.recordLauncherOpen(kind);
				}, []);
				const closeTimer = (0, react.useRef)(0);
				const pointer = (0, react.useRef)({
					x: -1,
					y: -1
				});
				(0, react.useEffect)(() => {
					const onMove = (event) => {
						pointer.current = {
							x: event.clientX,
							y: event.clientY
						};
					};
					window.addEventListener("pointermove", onMove);
					return () => {
						window.removeEventListener("pointermove", onMove);
					};
				}, []);
				const cancelClose = (0, react.useCallback)(() => {
					if (closeTimer.current === 0) return;
					window.clearTimeout(closeTimer.current);
					closeTimer.current = 0;
				}, []);
				const armClose = (0, react.useCallback)(() => {
					cancelClose();
					closeTimer.current = window.setTimeout(() => {
						closeTimer.current = 0;
						const { x, y } = pointer.current;
						const under = x >= 0 && y >= 0 ? document.elementFromPoint(x, y) : null;
						if (under !== null && (ball.ref.current?.contains(under) === true || document.querySelector("." + (ball.actionsOpen ? "dsh-sl-action-card" : "dsh-sl-launcher-card"))?.contains(under) === true)) return;
						ball.setMenuOpen(false);
						ball.setActionsOpen(false);
					}, POINTER_GRACE_MS);
				}, [ball, cancelClose]);
				(0, react.useEffect)(() => () => {
					cancelClose();
				}, [cancelClose]);
				const cardClass = ball.actionsOpen ? ACTION_CARD_CLASS : CARD_CLASS;
				(0, react.useEffect)(() => {
					if (!ball.menuOpen && !ball.actionsOpen) return;
					let frame = 0;
					let card = null;
					const enter = () => {
						cancelClose();
					};
					const leave = () => {
						armClose();
					};
					const attach = () => {
						card = document.querySelector(`.${cardClass}`);
						if (card === null) {
							frame = requestAnimationFrame(attach);
							return;
						}
						card.addEventListener("pointerenter", enter);
						card.addEventListener("pointerleave", leave);
					};
					attach();
					return () => {
						if (frame !== 0) cancelAnimationFrame(frame);
						if (card === null) return;
						card.removeEventListener("pointerenter", enter);
						card.removeEventListener("pointerleave", leave);
					};
				}, [
					ball.menuOpen,
					ball.actionsOpen,
					cardClass,
					armClose,
					cancelClose
				]);
				const onBallLeave = (0, react.useCallback)(() => {
					if (!ball.menuOpen && !ball.actionsOpen) return;
					armClose();
				}, [
					armClose,
					ball.menuOpen,
					ball.actionsOpen
				]);
				const ballElement = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					ref: ball.ref,
					type: "button",
					className: "dsh-sl-ball",
					style: {
						left: `${ball.position.left}px`,
						top: `${ball.position.top}px`
					},
					"data-dragging": ball.phase === "dragging",
					"aria-label": copy("ballAria"),
					"aria-haspopup": "menu",
					"aria-expanded": ball.menuOpen || ball.actionsOpen,
					title: copy("ballTitle"),
					onPointerEnter: (event) => {
						ball.handlers.onPointerEnter(event);
						cancelClose();
					},
					onPointerLeave: (event) => {
						ball.handlers.onPointerLeave(event);
						onBallLeave();
					},
					onPointerDown: ball.handlers.onPointerDown,
					onPointerMove: ball.handlers.onPointerMove,
					onPointerUp: ball.handlers.onPointerUp,
					onPointerCancel: ball.handlers.onPointerCancel,
					onContextMenu: ball.handlers.onContextMenu,
					onClick: ball.handlers.onClick,
					onKeyDown: ball.handlers.onKeyDown,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(BallGlyph, {})
				});
				const rows = actionState === null ? [] : buildActionRows(actionState, copy);
				const shown = frozen;
				const shownSections = shown?.sections ?? sections;
				const shownSide = shown?.side ?? preferredSide(ball.position);
				return ball.actionsOpen ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SidebarActionMenu, {
					open: true,
					anchorRef: ball.ref,
					rows,
					hasMenuRows: data.hasMenuRows,
					side: preferredSide(ball.position),
					onRun: onRunAction,
					onClose: () => {
						ball.setActionsOpen(false);
					},
					children: ballElement
				}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(LauncherMenu, {
					open: ball.menuOpen,
					anchorRef: ball.ref,
					recent: shownSections.recent,
					all: shownSections.all,
					degradedNote: mode === "b2" ? copy("degraded") : void 0,
					emptyText: copy("empty"),
					emptyHint: copy("emptyHint"),
					hasMenuRows: data.hasMenuRows,
					side: shownSide,
					onActivate,
					onClose: () => {
						ball.setMenuOpen(false);
					},
					children: ballElement
				});
			};
		}
		/**
		* Client plugin body.
		* @param ctx - the client root context.
		*/
		function apply(ctx) {
			ctx.effect(() => {
				const offZh = ctx.locale.register(LOCALE_NS, "zh", zh);
				const offEn = ctx.locale.register(LOCALE_NS, "en", en);
				return () => {
					offZh();
					offEn();
				};
			});
			ctx.inject(["sidebarRight", "sidebarRightTabs"], (injected) => {
				const sidebarRight = injected.get("sidebarRight");
				const tabs = injected.get("sidebarRightTabs");
				if (sidebarRight === void 0 || tabs === void 0) return;
				const recent = createRecentStore();
				const mode = createModeSource();
				const capabilities = detectCapabilities(sidebarRight);
				const subscribeTabs = tabs.subscribe === void 0 ? void 0 : tabs.subscribe.bind(tabs);
				const tracker = createRecentTracker({
					sidebarRight,
					capabilities,
					store: recent,
					onModeChange: (next) => {
						mode.set(next);
					}
				});
				injected.effect(() => {
					tracker.start();
					return () => {
						tracker.stop();
					};
				});
				const Launcher = createLauncher({
					guide: () => tabs.guide(),
					recent,
					tracker,
					mode,
					tabsSubscribe: subscribeTabs,
					hasMenuRows: hasMenuRows(),
					sidebarRight,
					sessionId: () => mountedSessionId(capabilities, sidebarRight),
					open(kind, gesture) {
						if (!sidebarRight.isExpanded()) {
							openKind(capabilities, sidebarRight, kind, "single", {});
							return;
						}
						const groups = dockGroups(mountedSessionId(capabilities, sidebarRight));
						const panes = {
							...groups.leftPaneId === void 0 ? {} : { leftPaneId: groups.leftPaneId },
							...groups.rightPaneId === void 0 ? {} : { rightPaneId: groups.rightPaneId }
						};
						openKind(capabilities, sidebarRight, kind, gesture, panes);
					}
				}, ctx.locale);
				injected.effect(() => ctx.slots.inject(SLOT_KEY, () => ctx.slots.register({
					name: SLOT_KEY,
					id: "sidebar-launcher:ball",
					order: 100
				}, Launcher)));
			});
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map