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
export const LOCALE_NS = 'sidebarLauncher'

/** Chinese copy (the host's default locale). */
export const zh: Record<string, string> = {
  ballAria: '侧边栏启动器：打开右栏页签菜单（左键在左格打开，右键在右格打开；点击行不关闭菜单）',
  ballTitle: '侧边栏启动器',
  recentHeading: '最近打开',
  allHeading: '全部页签',
  empty: '右栏还没有可打开的页签',
  emptyHint: '停用或移除提供页签的插件后，这里会暂时为空',
  degraded: '正在用降级模式记录最近项：宿主页签条读不到，只记录从本启动器打开过的页签。',
  actionsAria: '侧边栏操作',
  actionClearDocked: '清空标签页（保留浮动）',
  actionClearAll: '清空全部标签页（含浮动）',
  actionClearLeft: '清空左分栏',
  actionClearRight: '清空右分栏',
  actionClearFloats: '清除所有浮动面板',
  actionResetBall: '重置悬浮球位置',
}

/** English copy. */
export const en: Record<string, string> = {
  ballAria: 'Sidebar launcher: open the right-column tab menu (left click opens in the left pane, right click in the right pane; clicking a row keeps the menu open)',
  ballTitle: 'Sidebar launcher',
  recentHeading: 'Recent',
  allHeading: 'All tabs',
  empty: 'No tabs are available in the right column',
  emptyHint: 'This stays empty while no installed plugin contributes a tab type',
  degraded: 'Recent tabs are being recorded in degraded mode: the host tab strip was not found, so only tabs opened from this launcher are recorded.',
  actionsAria: 'Sidebar actions',
  actionClearDocked: 'Clear tabs (keep floating)',
  actionClearAll: 'Clear all tabs (with floating)',
  actionClearLeft: 'Clear left pane',
  actionClearRight: 'Clear right pane',
  actionClearFloats: 'Close all floating panels',
  actionResetBall: 'Reset launcher position',
}
