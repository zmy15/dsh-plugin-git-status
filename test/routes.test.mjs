import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { createGitStatusService } from '../lib/git.js';
import { registerStatusRoutes } from '../lib/routes.js';

function git(cwd, args) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'Test',
      GIT_AUTHOR_EMAIL: 'test@example.invalid',
      GIT_COMMITTER_NAME: 'Test',
      GIT_COMMITTER_EMAIL: 'test@example.invalid',
    },
  }).trim();
}

function repo() {
  const dir = mkdtempSync(join(tmpdir(), 'dsh git status route '));
  git(dir, ['init', '-q']);
  writeFileSync(join(dir, 'a.txt'), 'one\n');
  git(dir, ['add', '.']);
  git(dir, ['commit', '-qm', 'first']);
  return dir;
}

function fakeResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: '',
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    end(body) {
      this.body = body ?? '';
    },
  };
}

function mount(getSession) {
  let route;
  const ctx = {
    sessions: { get: getSession },
    logger: { warn() {} },
  };
  const webServer = {
    register(next) {
      route = next;
      return () => {};
    },
  };
  const dispose = registerStatusRoutes(ctx, webServer, createGitStatusService());
  assert.equal(route.path, '/git-status/status');
  return { route, dispose };
}

test('status route resolves the session cwd and returns a Git snapshot', async () => {
  const dir = repo();
  try {
    writeFileSync(join(dir, 'a.txt'), 'two\n');
    const { route } = mount((id) => (id === 'session-1' ? { header: { cwd: dir } } : undefined));
    const res = fakeResponse();
    await route.handler(
      { method: 'GET', url: '/git-status/status?sessionId=session-1&refresh=1' },
      res,
    );

    assert.equal(res.statusCode, 200);
    assert.equal(res.headers['content-type'], 'application/json; charset=utf-8');
    const payload = JSON.parse(res.body);
    assert.equal(payload.ok, true);
    assert.equal(payload.value.counts.changed, 1);
    assert.equal(payload.value.clean, false);
    assert.equal(payload.value.lastCommit.subject, 'first');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('status route returns null for a non-repository cwd and 404 for an unknown session', async () => {
  const plain = mkdtempSync(join(tmpdir(), 'dsh git status plain route '));
  try {
    const mounted = mount((id) => (id === 'session-1' ? { header: { cwd: plain } } : undefined));

    const notRepo = fakeResponse();
    await mounted.route.handler({ method: 'GET', url: '/git-status/status?sessionId=session-1' }, notRepo);
    assert.equal(notRepo.statusCode, 200);
    assert.deepEqual(JSON.parse(notRepo.body), { ok: true, value: null });

    const missing = fakeResponse();
    await mounted.route.handler({ method: 'GET', url: '/git-status/status?sessionId=missing' }, missing);
    assert.equal(missing.statusCode, 404);
    assert.equal(JSON.parse(missing.body).error.code, 'unknown-session');
  } finally {
    rmSync(plain, { recursive: true, force: true });
  }
});

test('status route rejects malformed and non-GET requests', async () => {
  const { route } = mount(() => undefined);

  const badRequest = fakeResponse();
  await route.handler({ method: 'GET', url: '/git-status/status' }, badRequest);
  assert.equal(badRequest.statusCode, 400);
  assert.equal(JSON.parse(badRequest.body).error.code, 'bad-request');

  const wrongMethod = fakeResponse();
  await route.handler({ method: 'POST', url: '/git-status/status?sessionId=x' }, wrongMethod);
  assert.equal(wrongMethod.statusCode, 405);
  assert.equal(wrongMethod.headers.allow, 'GET');
});
