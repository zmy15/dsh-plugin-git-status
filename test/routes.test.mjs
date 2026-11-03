import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
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
  const routes = new Map();
  const ctx = {
    sessions: { get: getSession },
    logger: { warn() {} },
  };
  const webServer = {
    register(route) {
      routes.set(route.path, route);
      return () => {};
    },
  };
  const dispose = registerStatusRoutes(ctx, webServer, createGitStatusService());
  assert.equal(routes.size, 3);
  return { routes, dispose };
}

function request(url, body, method = 'GET') {
  const req = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))]);
  req.method = method;
  req.url = url;
  return req;
}

test('status route resolves the session cwd and returns a Git snapshot', async () => {
  const dir = repo();
  try {
    writeFileSync(join(dir, 'a.txt'), 'two\n');
    const { routes } = mount((id) => (id === 'session-1' ? { header: { cwd: dir } } : undefined));
    const res = fakeResponse();
    await routes.get('/git-status/status').handler(
      request('/git-status/status?sessionId=session-1&refresh=1'),
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
    await mounted.routes.get('/git-status/status').handler(
      request('/git-status/status?sessionId=session-1'),
      notRepo,
    );
    assert.equal(notRepo.statusCode, 200);
    assert.deepEqual(JSON.parse(notRepo.body), { ok: true, value: null });

    const missing = fakeResponse();
    await mounted.routes.get('/git-status/status').handler(
      request('/git-status/status?sessionId=missing'),
      missing,
    );
    assert.equal(missing.statusCode, 404);
    assert.equal(JSON.parse(missing.body).error.code, 'unknown-session');
  } finally {
    rmSync(plain, { recursive: true, force: true });
  }
});

test('status route rejects malformed and non-GET requests', async () => {
  const { routes } = mount(() => undefined);
  const route = routes.get('/git-status/status');

  const badRequest = fakeResponse();
  await route.handler(request('/git-status/status'), badRequest);
  assert.equal(badRequest.statusCode, 400);
  assert.equal(JSON.parse(badRequest.body).error.code, 'bad-request');

  const wrongMethod = fakeResponse();
  await route.handler(request('/git-status/status?sessionId=x', undefined, 'POST'), wrongMethod);
  assert.equal(wrongMethod.statusCode, 405);
  assert.equal(wrongMethod.headers.allow, 'GET');
});

test('branch routes list, switch and create branches for the session cwd', async () => {
  const dir = repo();
  try {
    git(dir, ['branch', 'dev']);
    const mounted = mount((id) => (id === 'session-1' ? { header: { cwd: dir } } : undefined));

    const listed = fakeResponse();
    await mounted.routes.get('/git-status/branches').handler(
      request('/git-status/branches?sessionId=session-1'),
      listed,
    );
    const listedPayload = JSON.parse(listed.body);
    assert.equal(listedPayload.ok, true);
    assert.ok(listedPayload.value.branches.some((branch) => branch.name === 'dev'));

    const switched = fakeResponse();
    await mounted.routes.get('/git-status/branch').handler(
      request('/git-status/branch', { sessionId: 'session-1', branch: 'dev' }, 'POST'),
      switched,
    );
    const switchedPayload = JSON.parse(switched.body);
    assert.equal(switchedPayload.ok, true);
    assert.equal(switchedPayload.value.branch, 'dev');
    assert.equal(switchedPayload.value.status.branch, 'dev');

    const created = fakeResponse();
    await mounted.routes.get('/git-status/branch').handler(
      request(
        '/git-status/branch',
        { sessionId: 'session-1', branch: 'feature/branch-picker', create: true },
        'POST',
      ),
      created,
    );
    const createdPayload = JSON.parse(created.body);
    assert.equal(createdPayload.ok, true);
    assert.equal(createdPayload.value.created, true);
    assert.equal(createdPayload.value.status.branch, 'feature/branch-picker');

    const invalid = fakeResponse();
    await mounted.routes.get('/git-status/branch').handler(
      request('/git-status/branch', { sessionId: 'session-1', branch: 'bad branch' }, 'POST'),
      invalid,
    );
    assert.equal(JSON.parse(invalid.body).error.code, 'invalid-branch');

    const wrongMethod = fakeResponse();
    await mounted.routes.get('/git-status/branch').handler(
      request('/git-status/branch', undefined, 'GET'),
      wrongMethod,
    );
    assert.equal(wrongMethod.statusCode, 405);
    assert.equal(wrongMethod.headers.allow, 'POST');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
