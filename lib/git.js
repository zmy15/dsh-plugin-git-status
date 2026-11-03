/**
 * Host-side Git facts for the composer status chip.
 *
 * One `git status --porcelain=v2 --branch -z` call carries the branch,
 * upstream, ahead/behind counts and every changed path; one `git log -1`
 * call supplies the last commit. Both run through `execFile` with a bounded
 * timeout, so a huge repository or a hung filesystem cannot stall the host.
 *
 * This module is deliberately free of Cordis/DOM dependencies: the route
 * layer and the tests both call it directly.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/** Default per-command deadline. Windows cold-starts git.exe slowly. */
export const DEFAULT_TIMEOUT_MS = 8_000;

/** Payload cap; the UI only renders the first few rows anyway. */
export const MAX_FILES = 200;

/** Status cache lifetime for the same working directory. */
export const CACHE_TTL_MS = 1_500;

/**
 * Run one git command.
 * @param {string[]} args - arguments after `git`.
 * @param {string} cwd - working directory.
 * @param {number} timeoutMs - deadline.
 * @returns {Promise<{ ok: boolean, stdout?: string, stderr?: string, code?: string, killed?: boolean, message?: string }>}
 */
async function runGit(args, cwd, timeoutMs) {
  try {
    const result = await execFileAsync('git', args, {
      cwd,
      encoding: 'utf8',
      timeout: timeoutMs,
      maxBuffer: 4 * 1024 * 1024,
      windowsHide: true,
    });
    return { ok: true, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
  } catch (error) {
    return {
      ok: false,
      stdout: typeof error?.stdout === 'string' ? error.stdout : '',
      stderr: typeof error?.stderr === 'string' ? error.stderr : '',
      code: typeof error?.code === 'string' ? error.code : undefined,
      killed: error?.killed === true,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Split a fixed number of space-delimited fields while keeping the rest of
 * the record (the path) intact. Paths may contain spaces, so a plain
 * `split(' ')` is wrong for porcelain-v2.
 * @param {string} body - record without its leading `N ` / `? ` marker.
 * @param {number} count - number of fields to take.
 * @returns {{ fields: string[], rest: string } | null}
 */
function takeFields(body, count) {
  const fields = [];
  let index = 0;
  for (let i = 0; i < count; i += 1) {
    const space = body.indexOf(' ', index);
    if (space === -1) return null;
    fields.push(body.slice(index, space));
    index = space + 1;
  }
  return { fields, rest: body.slice(index) };
}

/**
 * Classify a porcelain-v2 XY pair into the small vocabulary the chip shows.
 * @param {string} xy - two-character index/worktree status.
 * @returns {{ kind: string, letter: string }}
 */
export function classifyStatus(xy) {
  if (xy === '??') return { kind: 'untracked', letter: '?' };
  if (['DD', 'AU', 'UD', 'UA', 'DU', 'AA', 'UU'].includes(xy)) {
    return { kind: 'conflicted', letter: 'U' };
  }
  const [x, y] = xy;
  if (x === 'R' || y === 'R') return { kind: 'renamed', letter: 'R' };
  if (x === 'C' || y === 'C') return { kind: 'copied', letter: 'C' };
  if (x === 'A' || y === 'A') return { kind: 'added', letter: 'A' };
  if (x === 'D' || y === 'D') return { kind: 'deleted', letter: 'D' };
  if (x === 'T' || y === 'T') return { kind: 'typechange', letter: 'T' };
  return { kind: 'modified', letter: 'M' };
}

/**
 * Parse `git status --porcelain=v2 --branch -z`.
 *
 * Header records arrive NUL-terminated too (`# branch.head main\0`). Rename
 * and copy records are followed by the original path as their own NUL
 * record, which the loop consumes together with the entry.
 * @param {string} stdout - NUL-separated status output.
 * @returns {{
 *   branch: string,
 *   detached: boolean,
 *   oid: string | null,
 *   upstream: string | null,
 *   ahead: number,
 *   behind: number,
 *   files: Array<{ path: string, from?: string, xy: string, kind: string, letter: string }>,
 * }}
 */
export function parseStatusV2(stdout) {
  const records = stdout.split('\0');
  const files = [];
  let branch = '';
  let detached = false;
  let oid = null;
  let upstream = null;
  let ahead = 0;
  let behind = 0;

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    if (record === '') continue;

    if (record.startsWith('# branch.oid ')) {
      const value = record.slice('# branch.oid '.length).trim();
      oid = value === '(initial)' ? null : value;
      continue;
    }
    if (record.startsWith('# branch.head ')) {
      const value = record.slice('# branch.head '.length).trim();
      detached = value === '(detached)' || value === '(unknown)';
      branch = detached ? '' : value;
      continue;
    }
    if (record.startsWith('# branch.upstream ')) {
      upstream = record.slice('# branch.upstream '.length).trim() || null;
      continue;
    }
    if (record.startsWith('# branch.ab ')) {
      const match = /^# branch\.ab \+(\d+) -(\d+)$/.exec(record);
      if (match !== null) {
        ahead = Number(match[1]);
        behind = Number(match[2]);
      }
      continue;
    }
    if (record.startsWith('# ')) continue;

    if (record.startsWith('? ')) {
      const path = record.slice(2);
      if (path !== '') files.push({ path, xy: '??', ...classifyStatus('??') });
      continue;
    }
    if (record.startsWith('! ')) continue;

    if (record.startsWith('1 ')) {
      const parsed = takeFields(record.slice(2), 7);
      if (parsed === null || parsed.rest === '') continue;
      files.push({ path: parsed.rest, xy: parsed.fields[0], ...classifyStatus(parsed.fields[0]) });
      continue;
    }

    if (record.startsWith('2 ')) {
      const parsed = takeFields(record.slice(2), 8);
      if (parsed === null || parsed.rest === '') continue;
      const from = records[index + 1] ?? '';
      if (from !== '') index += 1;
      files.push({
        path: parsed.rest,
        ...(from === '' ? {} : { from }),
        xy: parsed.fields[0],
        ...classifyStatus(parsed.fields[0]),
      });
      continue;
    }

    if (record.startsWith('u ')) {
      const parsed = takeFields(record.slice(2), 9);
      if (parsed === null || parsed.rest === '') continue;
      files.push({ path: parsed.rest, xy: parsed.fields[0], ...classifyStatus(parsed.fields[0]) });
      continue;
    }
    // Unknown future record type: skip it rather than misreporting a path.
  }

  return { branch, detached, oid, upstream, ahead, behind, files };
}

/**
 * Parse `git log -1 --format=%h%x1f%s%x1f%cI%x1f%an`.
 * @param {string} stdout - one log line.
 * @returns {{ short: string, subject: string, date: string | null, author: string } | null}
 */
export function parseLastCommit(stdout) {
  const line = stdout.split('\n').find((value) => value.trim() !== '');
  if (line === undefined) return null;
  const parts = line.split('\x1f');
  if (parts.length < 2) return null;
  return {
    short: parts[0] ?? '',
    subject: parts[1] ?? '',
    date: parts[2] ?? null,
    author: parts[3] ?? '',
  };
}

/**
 * The repository name used in the popover header (last path segment).
 * @param {string} root - repository root path.
 * @returns {string}
 */
export function repoName(root) {
  const parts = root.split(/[\\/]+/).filter(Boolean);
  return parts.length === 0 ? root : parts[parts.length - 1];
}

/**
 * Inspect one working directory.
 *
 * @param {string} cwd - a directory inside the repository.
 * @param {{ timeoutMs?: number }} [options] - timeout override for tests.
 * @returns {Promise<
 *   | { kind: 'ok', value: object }
 *   | { kind: 'not-repo' }
 *   | { kind: 'git-missing' }
 *   | { kind: 'timeout' }
 *   | { kind: 'error', message: string }
 * >}
 */
export async function inspectGitStatus(cwd, options = {}) {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const rootResult = await runGit(['--no-optional-locks', 'rev-parse', '--show-toplevel'], cwd, timeoutMs);
  if (!rootResult.ok) {
    if (rootResult.code === 'ENOENT') return { kind: 'git-missing' };
    if (rootResult.killed) return { kind: 'timeout' };
    const detail = `${rootResult.stderr ?? ''}\n${rootResult.message ?? ''}`.toLowerCase();
    if (detail.includes('not a git repository') || detail.includes('not a git repo')) {
      return { kind: 'not-repo' };
    }
    return { kind: 'error', message: (rootResult.stderr || rootResult.message || 'git rev-parse failed').trim() };
  }

  const root = rootResult.stdout.trim();
  if (root === '') return { kind: 'not-repo' };

  const [statusResult, logResult] = await Promise.all([
    runGit(
      ['--no-optional-locks', 'status', '--porcelain=v2', '--branch', '-z', '--untracked-files=normal'],
      root,
      timeoutMs,
    ),
    runGit(
      ['--no-optional-locks', 'log', '-1', '--format=%h%x1f%s%x1f%cI%x1f%an'],
      root,
      timeoutMs,
    ),
  ]);

  if (!statusResult.ok) {
    if (statusResult.code === 'ENOENT') return { kind: 'git-missing' };
    if (statusResult.killed) return { kind: 'timeout' };
    return {
      kind: 'error',
      message: (statusResult.stderr || statusResult.message || 'git status failed').trim(),
    };
  }

  const parsed = parseStatusV2(statusResult.stdout);
  const files = parsed.files;
  const counts = {
    changed: files.length,
    staged: files.filter((file) => file.kind !== 'untracked' && file.kind !== 'conflicted' && file.xy[0] !== '.').length,
    unstaged: files.filter((file) => file.kind !== 'untracked' && file.kind !== 'conflicted' && file.xy[1] !== '.').length,
    untracked: files.filter((file) => file.kind === 'untracked').length,
    conflicted: files.filter((file) => file.kind === 'conflicted').length,
  };

  return {
    kind: 'ok',
    value: {
      root,
      name: repoName(root),
      branch: parsed.branch,
      detached: parsed.detached,
      unborn: parsed.oid === null,
      head: parsed.oid === null ? null : parsed.oid.slice(0, 7),
      upstream: parsed.upstream,
      ahead: parsed.ahead,
      behind: parsed.behind,
      clean: files.length === 0,
      counts,
      files: files.slice(0, MAX_FILES),
      truncated: files.length > MAX_FILES,
      lastCommit: logResult.ok ? parseLastCommit(logResult.stdout) : null,
    },
  };
}

/**
 * Create a small per-directory cache with in-flight de-duplication.
 *
 * @param {{ ttlMs?: number }} [options] - cache lifetime.
 * @returns {(cwd: string, force?: boolean) => Promise<object>} the cached inspector.
 */
export function createGitStatusService(options = {}) {
  const ttlMs = options.ttlMs ?? CACHE_TTL_MS;
  /** @type {Map<string, { at: number, value: object }>} */
  const cache = new Map();
  /** @type {Map<string, Promise<object>>} */
  const inflight = new Map();

  return async function statusFor(cwd, force = false) {
    const hit = cache.get(cwd);
    if (!force && hit !== undefined && Date.now() - hit.at < ttlMs) return hit.value;
    const running = inflight.get(cwd);
    if (running !== undefined) return running;

    const pending = inspectGitStatus(cwd)
      .then((result) => {
        cache.set(cwd, { at: Date.now(), value: result });
        if (cache.size > 100) {
          const oldest = [...cache.entries()].sort((a, b) => a[1].at - b[1].at)[0];
          if (oldest !== undefined) cache.delete(oldest[0]);
        }
        return result;
      })
      .finally(() => {
        inflight.delete(cwd);
      });

    inflight.set(cwd, pending);
    return pending;
  };
}
