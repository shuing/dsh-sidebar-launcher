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
export declare const LOCALE_NS = "sidebarLauncher";
/** Chinese copy (the host's default locale). */
export declare const zh: Record<string, string>;
/** English copy. */
export declare const en: Record<string, string>;
