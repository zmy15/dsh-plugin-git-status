/**
 * dsh-plugin-git-status — host half.
 *
 * Reads the current session's Git facts and exposes them over one read-only
 * HTTP route. The browser half renders a Codex-style chip below the composer.
 *
 * The route resolves the session's cwd through `ctx.sessions`; it never
 * accepts a path from the browser.
 */

import { createGitStatusService } from './lib/git.js';
import { registerStatusRoutes } from './lib/routes.js';

/** Cordis row id; keep it equal to the patch's row id for readable logs. */
export const name = 'git-status';

/**
 * `webServer` is required for the route; `sessions` is required to map the
 * browser's session id to a cwd. Both are hard dependencies because a status
 * chip with no data has nothing to show.
 */
export const inject = ['sessions', 'webServer'];

/**
 * Mount the read-only Git status service.
 * @param {import('@deepseek-ai/cordis').Context} ctx - plugin context.
 */
export function apply(ctx) {
  const statusFor = createGitStatusService();
  ctx.effect(
    () => registerStatusRoutes(ctx, ctx.webServer, statusFor),
    'git-status: register status route',
  );
}
