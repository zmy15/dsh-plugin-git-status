import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  classifyStatus,
  createGitStatusService,
  inspectGitStatus,
  listBranches,
  parseLastCommit,
  parseStatusV2,
  switchBranch,
} from '../lib/git.js';

/** Run git and return trimmed stdout. */
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

/** Create a temporary repo with one commit and return its path. */
function createRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'dsh git status '));
  git(dir, ['init', '-q']);
  writeFileSync(join(dir, 'a.txt'), 'one\n');
  writeFileSync(join(dir, 'b.txt'), 'bee\n');
  git(dir, ['add', '.']);
  git(dir, ['commit', '-qm', 'initial commit']);
  return dir;
}

test('parseStatusV2 reads headers, ordinary files, renames and conflicts', () => {
  const oid = '0123456789abcdef0123456789abcdef01234567';
  const output = [
    `# branch.oid ${oid}`,
    '# branch.head main',
    '# branch.upstream origin/main',
    '# branch.ab +2 -3',
    '1 M. N... 100644 100644 100644 aaaa bbbb path with space.txt',
    '2 R. N... 100644 100644 100644 aaaa bbbb R100 new name.txt',
    'old name.txt',
    '? untracked.txt',
    'u UU N... 100644 100644 100644 100644 aaaa bbbb cccc conflict.txt',
    '',
  ].join('\0');

  const parsed = parseStatusV2(output);
  assert.equal(parsed.branch, 'main');
  assert.equal(parsed.detached, false);
  assert.equal(parsed.oid, oid);
  assert.equal(parsed.upstream, 'origin/main');
  assert.equal(parsed.ahead, 2);
  assert.equal(parsed.behind, 3);
  assert.equal(parsed.files.length, 4);

  assert.deepEqual(parsed.files[0], {
    path: 'path with space.txt',
    xy: 'M.',
    kind: 'modified',
    letter: 'M',
  });
  assert.deepEqual(parsed.files[1], {
    path: 'new name.txt',
    from: 'old name.txt',
    xy: 'R.',
    kind: 'renamed',
    letter: 'R',
  });
  assert.equal(parsed.files[2].kind, 'untracked');
  assert.equal(parsed.files[3].kind, 'conflicted');
});

test('classifyStatus covers the porcelain letter families', () => {
  assert.deepEqual(classifyStatus('??'), { kind: 'untracked', letter: '?' });
  assert.deepEqual(classifyStatus('A.'), { kind: 'added', letter: 'A' });
  assert.deepEqual(classifyStatus('.D'), { kind: 'deleted', letter: 'D' });
  assert.deepEqual(classifyStatus('R.'), { kind: 'renamed', letter: 'R' });
  assert.deepEqual(classifyStatus('UU'), { kind: 'conflicted', letter: 'U' });
  assert.deepEqual(classifyStatus('T.'), { kind: 'typechange', letter: 'T' });
});

test('parseLastCommit handles the unit-separated format', () => {
  assert.deepEqual(
    parseLastCommit('abc1234\x1fFix composer\x1f2026-01-02T03:04:05Z\x1fAlice\n'),
    {
      short: 'abc1234',
      subject: 'Fix composer',
      date: '2026-01-02T03:04:05Z',
      author: 'Alice',
    },
  );
  assert.equal(parseLastCommit(''), null);
});

test('listBranches and switchBranch list, switch and create local branches', async () => {
  const dir = createRepo();
  try {
    const original = git(dir, ['branch', '--show-current']);
    git(dir, ['branch', 'dev']);

    const listed = await listBranches(dir);
    assert.equal(listed.kind, 'ok');
    assert.equal(listed.value.current, original);
    assert.ok(listed.value.branches.some((branch) => branch.name === original && branch.current));
    assert.ok(listed.value.branches.some((branch) => branch.name === 'dev' && !branch.current));

    const switched = await switchBranch(dir, 'dev');
    assert.equal(switched.kind, 'ok');
    assert.equal(switched.value.branch, 'dev');
    assert.equal(switched.value.created, false);
    assert.equal(switched.value.root.replaceAll('\\', '/').toLowerCase(), dir.replaceAll('\\', '/').toLowerCase());
    assert.equal(git(dir, ['branch', '--show-current']), 'dev');

    const created = await switchBranch(dir, 'feature/status-menu', { create: true });
    assert.equal(created.kind, 'ok');
    assert.equal(created.value.created, true);
    assert.equal(git(dir, ['branch', '--show-current']), 'feature/status-menu');

    const invalid = await switchBranch(dir, 'bad branch');
    assert.equal(invalid.kind, 'invalid-branch');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('switchBranch confirms before carrying uncommitted changes and preserves them', async () => {
  const dir = createRepo();
  try {
    const original = git(dir, ['branch', '--show-current']);
    git(dir, ['branch', 'dev']);
    writeFileSync(join(dir, 'a.txt'), 'dirty\n');

    const confirmation = await switchBranch(dir, 'dev');
    assert.equal(confirmation.kind, 'confirmation-required');
    assert.equal(confirmation.value.currentBranch, original);
    assert.equal(confirmation.value.targetBranch, 'dev');
    assert.equal(confirmation.value.dirty.counts.changed, 1);
    assert.equal(confirmation.value.dirty.files[0].path, 'a.txt');
    assert.equal(git(dir, ['branch', '--show-current']), original);
    assert.equal(readFileSync(join(dir, 'a.txt'), 'utf8').trim(), 'dirty');

    const carried = await switchBranch(dir, 'dev', { allowDirty: true });
    assert.equal(carried.kind, 'ok');
    assert.equal(carried.value.branch, 'dev');
    assert.equal(carried.value.carriedChanges, true);
    assert.equal(carried.value.dirty.counts.changed, 1);
    assert.equal(git(dir, ['branch', '--show-current']), 'dev');
    assert.equal(readFileSync(join(dir, 'a.txt'), 'utf8').trim(), 'dirty');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('switchBranch keeps the current branch and changes when Git reports a dirty conflict', async () => {
  const dir = createRepo();
  try {
    const original = git(dir, ['branch', '--show-current']);
    git(dir, ['switch', '-q', '-c', 'dev']);
    writeFileSync(join(dir, 'a.txt'), 'dev version\n');
    git(dir, ['add', 'a.txt']);
    git(dir, ['commit', '-qm', 'dev version']);
    git(dir, ['switch', '-q', original]);
    writeFileSync(join(dir, 'a.txt'), 'dirty main version\n');

    const conflict = await switchBranch(dir, 'dev', { allowDirty: true });
    assert.equal(conflict.kind, 'dirty-conflict');
    assert.match(conflict.message, /local changes|overwritten/i);
    assert.equal(conflict.value.currentBranch, original);
    assert.equal(conflict.value.dirty.counts.changed, 1);
    assert.equal(git(dir, ['branch', '--show-current']), original);
    assert.equal(readFileSync(join(dir, 'a.txt'), 'utf8').trim(), 'dirty main version');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('inspectGitStatus reports a dirty repository with staged, unstaged and untracked files', async () => {
  const dir = createRepo();
  try {
    writeFileSync(join(dir, 'a.txt'), 'two\n');
    git(dir, ['add', 'a.txt']);
    writeFileSync(join(dir, 'a.txt'), 'three\n');
    git(dir, ['mv', 'b.txt', 'c.txt']);
    writeFileSync(join(dir, 'new file.txt'), 'new\n');
    mkdirSync(join(dir, '中文目录'));
    writeFileSync(join(dir, '中文目录', '说明.txt'), 'zh\n');

    const result = await inspectGitStatus(dir);
    assert.equal(result.kind, 'ok');
    const status = result.value;
    const branch = git(dir, ['symbolic-ref', '--short', 'HEAD']);

    assert.equal(status.root.replaceAll('\\', '/').toLowerCase(), dir.replaceAll('\\', '/').toLowerCase());
    assert.equal(status.branch, branch);
    assert.equal(status.detached, false);
    assert.equal(status.clean, false);
    assert.equal(status.upstream, null);
    assert.equal(status.ahead, 0);
    assert.equal(status.behind, 0);
    assert.ok(status.counts.changed >= 4, `expected at least 4 changes, got ${status.counts.changed}`);
    assert.ok(status.counts.staged >= 2, `expected staged changes, got ${status.counts.staged}`);
    assert.ok(status.counts.unstaged >= 1, `expected unstaged changes, got ${status.counts.unstaged}`);
    assert.ok(status.counts.untracked >= 1, `expected untracked changes, got ${status.counts.untracked}`);
    assert.ok(status.files.some((file) => file.path === 'a.txt' && file.kind === 'modified'));
    assert.ok(status.files.some((file) => file.path === 'c.txt' && file.from === 'b.txt' && file.kind === 'renamed'));
    assert.ok(status.files.some((file) => file.kind === 'untracked'));
    assert.equal(status.lastCommit?.short.length, 7);
    assert.equal(status.lastCommit?.subject, 'initial commit');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('inspectGitStatus distinguishes detached HEAD and non-repositories', async () => {
  const repo = createRepo();
  const plain = mkdtempSync(join(tmpdir(), 'dsh git status plain '));
  try {
    git(repo, ['checkout', '--detach', '-q', 'HEAD']);
    const detached = await inspectGitStatus(repo);
    assert.equal(detached.kind, 'ok');
    assert.equal(detached.value.detached, true);
    assert.equal(detached.value.branch, '');
    assert.equal(detached.value.head.length, 7);

    const missing = await inspectGitStatus(plain);
    assert.deepEqual(missing, { kind: 'not-repo' });
  } finally {
    rmSync(repo, { recursive: true, force: true });
    rmSync(plain, { recursive: true, force: true });
  }
});

test('createGitStatusService caches the same directory and bypasses on force', async () => {
  const dir = createRepo();
  try {
    const service = createGitStatusService({ ttlMs: 60_000 });
    const first = await service(dir);
    const second = await service(dir);
    assert.equal(first, second, 'cached calls should return the same object');

    const forced = await service(dir, true);
    assert.notEqual(forced, first, 'forced calls should re-read the repository');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
