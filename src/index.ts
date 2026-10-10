/**
 * Host half of dsh-sidebar-launcher.
 *
 * Empty on purpose. Everything this plugin does happens in the browser, through
 * the `dsh.client` half declared in package.json. The row still has to exist in
 * the Loader's entry list, because that is what the client-module scanner walks
 * to discover the package and place its `./client` artifact in the boot graph.
 *
 * Keeping the host half at zero also means the plugin holds no host-side
 * service, no Config, and no route: there is nothing here to conflict with
 * another plugin, and nothing to clean up when the row is disabled.
 */

/** No host-side behaviour to install. */
export function apply(): void {}
