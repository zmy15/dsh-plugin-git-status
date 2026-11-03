/**
 * HTTP face of the Git status chip.
 *
 * The browser sends only a session id. The host resolves the session's
 * durable cwd itself, so a compromised page cannot ask this route to read a
 * repository outside the session's own working directory.
 */

/** Route prefix (kept out of `/api` and `/git` so another plugin cannot collide). */
export const BASE = '/git-status';

/** One JSON response. */
function sendJson(res, code, payload) {
  const body = JSON.stringify(payload);
  res.statusCode = code;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.setHeader('content-length', Buffer.byteLength(body));
  res.end(body);
}

/**
 * Convert the inspector outcome into the stable client envelope.
 * `not-repo` is a successful "no chip" answer, not an error.
 * @param {Awaited<ReturnType<import('./git.js').createGitStatusService>>} result
 * @returns {{ ok: true, value: object | null } | { ok: false, error: { code: string, message: string } }}
 */
function envelope(result) {
  if (result?.kind === 'ok') return { ok: true, value: result.value };
  if (result?.kind === 'not-repo') return { ok: true, value: null };
  if (result?.kind === 'git-missing') {
    return {
      ok: false,
      error: {
        code: 'git-missing',
        message: 'Git executable not found on PATH',
      },
    };
  }
  if (result?.kind === 'timeout') {
    return {
      ok: false,
      error: {
        code: 'timeout',
        message: 'Git status timed out',
      },
    };
  }
  return {
    ok: false,
    error: {
      code: 'git-failed',
      message: typeof result?.message === 'string' && result.message !== ''
        ? result.message
        : 'Git status failed',
    },
  };
}

/**
 * Register the status route.
 * @param {import('@deepseek-ai/cordis').Context} ctx - plugin context.
 * @param {{ register(route: object): () => void }} webServer - host web server.
 * @param {(cwd: string, force?: boolean) => Promise<object>} statusFor - cached inspector.
 * @returns {() => void} disposer.
 */
export function registerStatusRoutes(ctx, webServer, statusFor) {
  return webServer.register({
    kind: 'exact',
    path: `${BASE}/status`,
    handler: async (req, res) => {
      const method = (req.method ?? 'GET').toUpperCase();
      if (method !== 'GET') {
        res.statusCode = 405;
        res.setHeader('allow', 'GET');
        res.end('method not allowed');
        return;
      }

      const url = new URL(req.url ?? '/', 'http://localhost');
      const sessionId = url.searchParams.get('sessionId');
      if (sessionId === null || sessionId.trim() === '') {
        sendJson(res, 400, {
          ok: false,
          error: { code: 'bad-request', message: 'sessionId is required' },
        });
        return;
      }

      const session = ctx.sessions.get(sessionId);
      if (session === undefined) {
        sendJson(res, 404, {
          ok: false,
          error: { code: 'unknown-session', message: 'session is not live' },
        });
        return;
      }

      const cwd = session.header?.cwd;
      if (typeof cwd !== 'string' || cwd === '') {
        sendJson(res, 200, { ok: true, value: null });
        return;
      }

      const force = url.searchParams.get('refresh') === '1';
      try {
        sendJson(res, 200, envelope(await statusFor(cwd, force)));
      } catch (error) {
        ctx.logger?.warn?.('git-status: status request failed: %s', String(error));
        sendJson(res, 200, {
          ok: false,
          error: { code: 'internal', message: String(error) },
        });
      }
    },
  });
}
