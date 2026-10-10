import './launcher.css';
import type { LauncherContext } from './context-types.ts';
/** Services required before the menu can be built. */
export declare const inject: string[];
/**
 * Client plugin body.
 * @param ctx - the client root context.
 */
export declare function apply(ctx: LauncherContext): void;
