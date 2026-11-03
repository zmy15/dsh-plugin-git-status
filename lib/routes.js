/**
 * HTTP face of the Git status chip.
 *
 * The browser sends only a session id. The host resolves the session's
 * durable cwd itself, so a compromised page cannot ask this route to read a
 * repository outside the session's own working directory.
 */

import { listBranches, switchBranch } from './git.js';

/** Route prefix (kept out of `/api` and `/git` so another plugin cannot collide). */
export const BASE = '/git-status';

/** Branch mutation requests are tiny JSON objects. */
const MAX_BODY_BYTES = 16 * 1024;

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
  if (result?.kind === 'invalid-branch') {
    return {
      ok: false,
      error: {
        code: 'invalid-branch',
        message: typeof result.message === 'string' && result.message !== ''
          ? result.message
          : 'Invalid branch name',
      },
    };
  }
  if (result?.kind === 'dirty-conflict') {
    return {
      ok: false,
      error: {
        code: 'dirty-conflict',
        message: typeof result.message === 'string' && result.message !== ''
          ? result.message
          : 'Uncommitted changes would be overwritten',
        details: result.value,
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
 * Resolve only the live session's durable cwd. The browser never supplies a path.
 * @param {object} ctx - Cordis context.
 * @param {string} sessionId - live session id.
 * @param {object} res - HTTP response.
 * @returns {{ ok: true, cwd: string } | { ok: false }}
 */
function resolveSessionCwd(ctx, sessionId, res) {
  if (typeof sessionId !== 'string' || sessionId.trim() === '') {
    sendJson(res, 400, {
      ok: false,
      error: { code: 'bad-request', message: 'sessionId is required' },
    });
    return { ok: false };
  }

  const session = ctx.sessions.get(sessionId);
  if (session === undefined) {
    sendJson(res, 404, {
      ok: false,
      error: { code: 'unknown-session', message: 'session is not live' },
    });
    return { ok: false };
  }

  const cwd = session.header?.cwd;
  if (typeof cwd !== 'string' || cwd === '') {
    sendJson(res, 200, { ok: true, value: null });
    return { ok: false };
  }
  return { ok: true, cwd };
}

/**
 * Read a bounded JSON object from a mutation request.
 * @param {import('node:http').IncomingMessage} req - request.
 * @returns {Promise<{ ok: boolean, value?: object, tooLarge?: boolean }>}
 */
function readJsonBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    let size = 0;
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        finish({ ok: false, tooLarge: true });
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        const value = raw === '' ? {} : JSON.parse(raw);
        finish(value !== null && typeof value === 'object' && !Array.isArray(value)
          ? { ok: true, value }
          : { ok: false });
      } catch {
        finish({ ok: false });
      }
    });
    req.on('error', () => finish({ ok: false }));
  });
}

/**
 * Register the read-only status/branch routes and the explicit branch mutation route.
 * @param {import('@deepseek-ai/cordis').Context} ctx - plugin context.
 * @param {{ register(route: object): () => void }} webServer - host web server.
 * @param {(cwd: string, force?: boolean) => Promise<object>} statusFor - cached inspector.
 * @returns {() => void} disposer.
 */
export function registerStatusRoutes(ctx, webServer, statusFor) {
  const disposers = [];

  disposers.push(webServer.register({
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
      const resolved = resolveSessionCwd(ctx, url.searchParams.get('sessionId'), res);
      if (!resolved.ok) return;

      const force = url.searchParams.get('refresh') === '1';
      try {
        sendJson(res, 200, envelope(await statusFor(resolved.cwd, force)));
      } catch (error) {
        ctx.logger?.warn?.('git-status: status request failed: %s', String(error));
        sendJson(res, 200, {
          ok: false,
          error: { code: 'internal', message: String(error) },
        });
      }
    },
  }));

  disposers.push(webServer.register({
    kind: 'exact',
    path: `${BASE}/branches`,
    handler: async (req, res) => {
      const method = (req.method ?? 'GET').toUpperCase();
      if (method !== 'GET') {
        res.statusCode = 405;
        res.setHeader('allow', 'GET');
        res.end('method not allowed');
        return;
      }

      const url = new URL(req.url ?? '/', 'http://localhost');
      const resolved = resolveSessionCwd(ctx, url.searchParams.get('sessionId'), res);
      if (!resolved.ok) return;

      try {
        sendJson(res, 200, envelope(await listBranches(resolved.cwd)));
      } catch (error) {
        ctx.logger?.warn?.('git-status: branch list failed: %s', String(error));
        sendJson(res, 200, {
          ok: false,
          error: { code: 'internal', message: String(error) },
        });
      }
    },
  }));

  disposers.push(webServer.register({
    kind: 'exact',
    path: `${BASE}/branch`,
    handler: async (req, res) => {
      const method = (req.method ?? 'POST').toUpperCase();
      if (method !== 'POST') {
        res.statusCode = 405;
        res.setHeader('allow', 'POST');
        res.end('method not allowed');
        return;
      }

      const body = await readJsonBody(req);
      if (body.tooLarge) {
        sendJson(res, 413, {
          ok: false,
          error: { code: 'body-too-large', message: 'branch request is too large' },
        });
        return;
      }
      if (!body.ok) {
        sendJson(res, 400, {
          ok: false,
          error: { code: 'bad-request', message: 'invalid branch request body' },
        });
        return;
      }

      const resolved = resolveSessionCwd(ctx, body.value?.sessionId, res);
      if (!resolved.ok) return;

      const branch = body.value?.branch;
      const create = body.value?.create === true;
      const allowDirty = body.value?.allowDirty === true;
      try {
        const changed = await switchBranch(
          resolved.cwd,
          typeof branch === 'string' ? branch : '',
          { create, allowDirty },
        );
        if (changed.kind === 'confirmation-required') {
          sendJson(res, 200, {
            ok: true,
            value: {
              switched: false,
              confirmationRequired: true,
              reason: 'dirty-worktree',
              branch: changed.value.targetBranch,
              currentBranch: changed.value.currentBranch,
              created: changed.value.created,
              dirty: changed.value.dirty,
            },
          });
          return;
        }
        if (changed.kind !== 'ok') {
          sendJson(res, 200, envelope(changed));
          return;
        }

        const status = envelope(await statusFor(resolved.cwd, true));
        sendJson(res, 200, {
          ok: true,
          value: {
            switched: true,
            branch: changed.value.branch,
            created: changed.value.created,
            carriedChanges: changed.value.carriedChanges,
            dirty: changed.value.dirty,
            status: status.ok ? status.value : null,
            ...status.ok ? {} : { statusError: status.error },
          },
        });
      } catch (error) {
        ctx.logger?.warn?.('git-status: branch switch failed: %s', String(error));
        sendJson(res, 200, {
          ok: false,
          error: { code: 'internal', message: String(error) },
        });
      }
    },
  }));

  return () => {
    for (const dispose of disposers) {
      try {
        dispose();
      } catch {
        // Disposal failures must not prevent the remaining routes from unregistering.
      }
    }
  };
}
