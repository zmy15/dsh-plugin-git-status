/**
 * dsh-plugin-git-status — browser half.
 *
 * A compact Codex-style Git status chip below the composer card. It reads the
 * same-origin `/git-status/status` route; all Git work happens in the host.
 *
 * The module follows the Harness Module Loader shape: a lazy factory that
 * receives React through the host's module table. No Harness client package
 * is imported at runtime, so the bundle stays valid across SDK updates.
 */

window.__ModuleLoader__.load({
  id: 'dsh-plugin-git-status',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    /** Locale namespace; also the slot registration's `locale` seat. */
    const NS = 'git-status';
    /** Poll interval while the composer is visible. */
    const POLL_MS = 10_000;
    /** Files shown before the "+N more" row. */
    const FILES_SHOWN = 8;

    const EN = {
      'chip.title': 'Git · {branch}',
      'chip.clean': 'Clean',
      'chip.change': '1 change',
      'chip.changes': '{count} changes',
      'chip.ahead': '{count} ahead',
      'chip.behind': '{count} behind',
      'chip.detached': 'Detached',
      'chip.unborn': 'Unborn branch',
      'chip.unknown': 'Unknown branch',
      'chip.error': 'Git unavailable',
      'chip.branchMenu': 'Switch branch',
      'chip.details': 'Git status details',
      'chip.lastCommit': 'Last commit: {subject}',
      'branch.title': 'Branches',
      'branch.local': 'Local',
      'branch.search': 'Search {name} branches',
      'branch.create': 'Create and checkout branch…',
      'branch.createLabel': 'Create and checkout {branch}',
      'branch.empty': 'No matching branches',
      'branch.loading': 'Loading branches…',
      'branch.current': 'Current branch',
      'branch.latestCommit': 'Latest commit',
      'branch.noCommits': 'No commits yet',
      'branch.uncommittedOne': '1 uncommitted change',
      'branch.uncommitted': '{count} uncommitted changes',
      'branch.worktreeClean': 'No uncommitted changes',
      'branch.carryPrompt': 'Switching to "{branch}" will carry the uncommitted changes shown here. No changes will be discarded.',
      'branch.dirtyConflict': 'Git blocked the switch because uncommitted changes would be overwritten. Commit, stash, or discard the conflicting files first.',
      'branch.switchAnyway': 'Switch and carry changes',
      'branch.stay': 'Stay on {branch}',
      'branch.moreFiles': '+{count} more',
      'popover.title': 'Git status',
      'popover.close': 'Close',
      'popover.repo': 'Repository',
      'popover.detached': 'Detached HEAD',
      'popover.noUpstream': 'No upstream',
      'popover.upToDate': 'Up to date',
      'popover.ahead': '{count} ahead',
      'popover.behind': '{count} behind',
      'popover.changed': '{count} changed',
      'popover.staged': '{count} staged',
      'popover.unstaged': '{count} unstaged',
      'popover.untracked': '{count} untracked',
      'popover.conflicted': '{count} conflicts',
      'popover.clean': 'Working tree clean — no changes to commit',
      'popover.files': 'Changed files',
      'popover.lastCommit': 'Last commit',
      'popover.noCommits': 'No commits yet',
      'popover.refresh': 'Refresh',
      'popover.refreshing': 'Refreshing…',
      'popover.more': '+{count} more',
      'file.modified': 'Modified',
      'file.added': 'Added',
      'file.deleted': 'Deleted',
      'file.renamed': 'Renamed',
      'file.copied': 'Copied',
      'file.untracked': 'Untracked',
      'file.conflicted': 'Conflict',
      'file.typechange': 'Type changed',
    };

    const ZH = {
      'chip.title': 'Git · {branch}',
      'chip.clean': '干净',
      'chip.change': '1 处改动',
      'chip.changes': '{count} 处改动',
      'chip.ahead': '领先 {count}',
      'chip.behind': '落后 {count}',
      'chip.detached': '游离 HEAD',
      'chip.unborn': '未出生分支',
      'chip.unknown': '未知分支',
      'chip.error': 'Git 不可用',
      'chip.branchMenu': '切换分支',
      'chip.details': 'Git 状态详情',
      'chip.lastCommit': '最近提交：{subject}',
      'branch.title': '分支',
      'branch.local': '本地',
      'branch.search': '搜索 {name} 分支',
      'branch.create': '创建并检出分支…',
      'branch.createLabel': '创建并检出 {branch}',
      'branch.empty': '没有匹配的分支',
      'branch.loading': '正在读取分支…',
      'branch.current': '当前分支',
      'branch.latestCommit': '最近提交',
      'branch.noCommits': '还没有提交',
      'branch.uncommittedOne': '1 个未提交改动',
      'branch.uncommitted': '{count} 个未提交改动',
      'branch.worktreeClean': '没有未提交改动',
      'branch.carryPrompt': '切换到“{branch}”时，这 {count} 个未提交改动会被带到新分支，不会被丢弃。',
      'branch.dirtyConflict': 'Git 无法安全切换：未提交改动会被覆盖。请先提交、暂存或撤销冲突文件。',
      'branch.switchAnyway': '携带改动并切换',
      'branch.stay': '留在 {branch}',
      'branch.moreFiles': '还有 {count} 个',
      'popover.title': 'Git 状态',
      'popover.close': '关闭',
      'popover.repo': '仓库',
      'popover.detached': '游离 HEAD',
      'popover.noUpstream': '未设置上游分支',
      'popover.upToDate': '已与上游同步',
      'popover.ahead': '领先 {count} 个提交',
      'popover.behind': '落后 {count} 个提交',
      'popover.changed': '{count} 个改动',
      'popover.staged': '{count} 个已暂存',
      'popover.unstaged': '{count} 个未暂存',
      'popover.untracked': '{count} 个未跟踪',
      'popover.conflicted': '{count} 个冲突',
      'popover.clean': '工作区干净，没有待提交的改动',
      'popover.files': '改动的文件',
      'popover.lastCommit': '最近提交',
      'popover.noCommits': '还没有提交',
      'popover.refresh': '刷新',
      'popover.refreshing': '刷新中…',
      'popover.more': '还有 {count} 个',
      'file.modified': '已修改',
      'file.added': '新增',
      'file.deleted': '已删除',
      'file.renamed': '重命名',
      'file.copied': '复制',
      'file.untracked': '未跟踪',
      'file.conflicted': '冲突',
      'file.typechange': '类型变更',
    };

    /** Fallback used only if the locale seat is unavailable. */
    function fallbackT(key, values) {
      let text = EN[key] ?? key;
      if (values !== undefined) {
        for (const [name, value] of Object.entries(values)) {
          text = text.split(`{${name}}`).join(String(value));
        }
      }
      return text;
    }

    /**
     * Read the host status route.
     * @param {string} sessionId - live session id.
     * @param {boolean} force - bypass the host cache.
     * @returns {Promise<object|null>} status, or null when not a repository.
     */
    async function fetchStatus(sessionId, force) {
      const query = `sessionId=${encodeURIComponent(sessionId)}${force ? '&refresh=1' : ''}`;
      const response = await fetch(`/git-status/status?${query}`, {
        headers: { accept: 'application/json' },
        cache: 'no-store',
      });
      if (!response.ok) throw new Error(`Git status request failed (${response.status})`);
      const payload = await response.json();
      if (payload === null || typeof payload !== 'object') throw new Error('Malformed Git status response');
      if (!payload.ok) {
        throw new Error(payload.error?.message ?? 'Git status unavailable');
      }
      return payload.value ?? null;
    }

    /**
     * List local branches for one live session.
     * @param {string} sessionId - live session id.
     * @returns {Promise<object|null>} branch snapshot, or null outside a repository.
     */
    async function fetchBranches(sessionId) {
      const response = await fetch(`/git-status/branches?sessionId=${encodeURIComponent(sessionId)}`, {
        headers: { accept: 'application/json' },
        cache: 'no-store',
      });
      if (!response.ok) throw new Error(`Branch list request failed (${response.status})`);
      const payload = await response.json();
      if (payload === null || typeof payload !== 'object') throw new Error('Malformed branch response');
      if (!payload.ok) throw new Error(payload.error?.message ?? 'Branch list unavailable');
      return payload.value ?? null;
    }

    /**
     * Switch to a branch, optionally creating it first.
     * @param {string} sessionId - live session id.
     * @param {string} branch - local branch name.
     * @param {boolean} create - create before switching.
     * @param {boolean} allowDirty - explicitly carry uncommitted changes.
     * @returns {Promise<object>} mutation result, including the refreshed status.
     */
    async function changeBranch(sessionId, branch, create, allowDirty) {
      const response = await fetch('/git-status/branch', {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
        },
        cache: 'no-store',
        body: JSON.stringify({
          sessionId,
          branch,
          create: create === true,
          allowDirty: allowDirty === true,
        }),
      });
      if (!response.ok) throw new Error(`Branch switch request failed (${response.status})`);
      const payload = await response.json();
      if (payload === null || typeof payload !== 'object') throw new Error('Malformed branch switch response');
      if (!payload.ok) {
        const error = new Error(payload.error?.message ?? 'Branch switch failed');
        error.code = payload.error?.code;
        error.details = payload.error?.details;
        throw error;
      }
      return payload.value;
    }

    /** Small branch glyph. */
    function BranchGlyph({ size = 14 }) {
      return h(
        'svg',
        {
          width: size,
          height: size,
          viewBox: '0 0 16 16',
          fill: 'none',
          'aria-hidden': 'true',
          className: 'gs-glyph',
        },
        h('path', {
          d: 'M4.25 3.4v9.2',
          stroke: 'currentColor',
          strokeWidth: 1.5,
          strokeLinecap: 'round',
        }),
        h('path', {
          d: 'M11.75 3.4v3.05a2.35 2.35 0 0 1-2.35 2.35H4.25',
          stroke: 'currentColor',
          strokeWidth: 1.5,
          strokeLinecap: 'round',
        }),
        h('circle', { cx: 4.25, cy: 2.25, r: 1.4, stroke: 'currentColor', strokeWidth: 1.5 }),
        h('circle', { cx: 11.75, cy: 2.25, r: 1.4, stroke: 'currentColor', strokeWidth: 1.5 }),
        h('circle', { cx: 4.25, cy: 13.75, r: 1.4, stroke: 'currentColor', strokeWidth: 1.5 }),
      );
    }

    /** Small check glyph for a clean tree. */
    function CheckGlyph({ size = 12 }) {
      return h(
        'svg',
        { width: size, height: size, viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': 'true' },
        h('path', {
          d: 'M3.2 8.4l3.1 3.1 6.5-7',
          stroke: 'currentColor',
          strokeWidth: 1.8,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        }),
      );
    }

    /** Small chevron that flips when the popover is open. */
    function ChevronGlyph({ open }) {
      return h(
        'svg',
        { width: 12, height: 12, viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': 'true' },
        h('path', {
          d: open ? 'M4 10l4-4 4 4' : 'M4 6l4 4 4-4',
          stroke: 'currentColor',
          strokeWidth: 1.5,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        }),
      );
    }

    /** Search glyph for the branch picker. */
    function SearchGlyph({ size = 14 }) {
      return h(
        'svg',
        { width: size, height: size, viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': 'true' },
        h('circle', {
          cx: 6.8,
          cy: 6.8,
          r: 4.3,
          stroke: 'currentColor',
          strokeWidth: 1.4,
        }),
        h('path', {
          d: 'M10 10l3.2 3.2',
          stroke: 'currentColor',
          strokeWidth: 1.4,
          strokeLinecap: 'round',
        }),
      );
    }

    /** Plus glyph for branch creation. */
    function PlusGlyph({ size = 14 }) {
      return h(
        'svg',
        { width: size, height: size, viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': 'true' },
        h('path', {
          d: 'M8 3.2v9.6M3.2 8h9.6',
          stroke: 'currentColor',
          strokeWidth: 1.45,
          strokeLinecap: 'round',
        }),
      );
    }

    /**
     * Format an ISO instant relative to now. Falls back to a local date when
     * Intl.RelativeTimeFormat is unavailable.
     * @param {string|null} iso - commit date.
     * @returns {string}
     */
    function relativeTime(iso) {
      if (typeof iso !== 'string' || iso === '') return '';
      const date = new Date(iso);
      if (Number.isNaN(date.getTime())) return '';
      const diff = date.getTime() - Date.now();
      const units = [
        ['year', 31_536_000_000],
        ['month', 2_592_000_000],
        ['week', 604_800_000],
        ['day', 86_400_000],
        ['hour', 3_600_000],
        ['minute', 60_000],
        ['second', 1_000],
      ];
      try {
        const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
        for (const [unit, ms] of units) {
          if (Math.abs(diff) >= ms || unit === 'second') {
            return formatter.format(Math.round(diff / ms), unit);
          }
        }
      } catch {
        // Older engines: a stable absolute value is better than nothing.
      }
      try {
        return date.toLocaleString();
      } catch {
        return iso;
      }
    }

    /**
     * The chip and its popover.
     * @param {{ sessionId?: string, t?: Function }} props - slot runtime + locale.
     */
    function GitStatusDock(props) {
      const sessionId = props.sessionId;
      const placement = props.placement;
      const t = typeof props.t === 'function' ? props.t : fallbackT;
      const [status, setStatus] = React.useState(undefined);
      const [error, setError] = React.useState('');
      const [open, setOpen] = React.useState(false);
      const [menuOpen, setMenuOpen] = React.useState(false);
      const [branches, setBranches] = React.useState([]);
      const [branchesLoading, setBranchesLoading] = React.useState(false);
      const [branchError, setBranchError] = React.useState('');
      const [branchQuery, setBranchQuery] = React.useState('');
      const [newBranch, setNewBranch] = React.useState('');
      const [branchBusy, setBranchBusy] = React.useState('');
      const [branchConfirmation, setBranchConfirmation] = React.useState(null);
      const [refreshing, setRefreshing] = React.useState(false);
      const rootRef = React.useRef(null);
      const buttonRef = React.useRef(null);
      const aliveRef = React.useRef(true);

      const refresh = React.useCallback(
        async (force) => {
          if (typeof sessionId !== 'string' || sessionId === '') return;
          try {
            const next = await fetchStatus(sessionId, force === true);
            if (!aliveRef.current) return;
            setStatus(next);
            setError('');
          } catch (cause) {
            if (!aliveRef.current) return;
            const message = cause instanceof Error ? cause.message : String(cause);
            console.warn('git-status: status request failed:', message);
            setError(message);
          }
        },
        [sessionId],
      );

      const loadBranches = React.useCallback(async () => {
        if (typeof sessionId !== 'string' || sessionId === '') return;
        setBranchesLoading(true);
        try {
          const snapshot = await fetchBranches(sessionId);
          if (!aliveRef.current) return;
          setBranches(Array.isArray(snapshot?.branches) ? snapshot.branches : []);
          setBranchError('');
        } catch (cause) {
          if (!aliveRef.current) return;
          setBranchError(cause instanceof Error ? cause.message : String(cause));
        } finally {
          if (aliveRef.current) setBranchesLoading(false);
        }
      }, [sessionId]);

      // Initial read, focus/visibility refresh, and a slow visible-page poll.
      React.useEffect(() => {
        aliveRef.current = true;
        if (typeof sessionId !== 'string' || sessionId === '') {
          return () => {
            aliveRef.current = false;
          };
        }

        let disposed = false;
        let timer;

        function schedule() {
          if (!disposed) timer = window.setTimeout(tick, POLL_MS);
        }

        function tick() {
          if (disposed) return;
          if (document.visibilityState === 'hidden') {
            schedule();
            return;
          }
          refresh(false).finally(schedule);
        }

        refresh(false);
        schedule();

        const onFocus = () => {
          if (document.visibilityState !== 'hidden') refresh(false);
        };
        const onVisibility = () => {
          if (document.visibilityState === 'visible') refresh(false);
        };
        window.addEventListener('focus', onFocus);
        document.addEventListener('visibilitychange', onVisibility);

        return () => {
          disposed = true;
          aliveRef.current = false;
          window.clearTimeout(timer);
          window.removeEventListener('focus', onFocus);
          document.removeEventListener('visibilitychange', onVisibility);
        };
      }, [sessionId, refresh]);

      // Dismiss on outside pointer or Escape.
      React.useEffect(() => {
        if (!open && !menuOpen) return undefined;
        const onPointer = (event) => {
          const root = rootRef.current;
          if (root !== null && event.target instanceof Node && !root.contains(event.target)) {
            setOpen(false);
            setMenuOpen(false);
          }
        };
        const onKey = (event) => {
          if (event.key === 'Escape') {
            setOpen(false);
            setMenuOpen(false);
            buttonRef.current?.focus?.();
          }
        };
        document.addEventListener('pointerdown', onPointer, true);
        document.addEventListener('keydown', onKey);
        return () => {
          document.removeEventListener('pointerdown', onPointer, true);
          document.removeEventListener('keydown', onKey);
        };
      }, [open, menuOpen]);

      const className = placement === 'hero-options'
        ? 'gs-root gs-hero-option'
        : placement === 'header-utility'
          ? 'gs-root gs-header-utility'
          : 'gs-root';

      if (status === null) return null;
      if (status === undefined) {
        if (error === '') return null;
        return h(
          'div',
          { className },
          h(
            'button',
            {
              type: 'button',
              className: 'gs-chip gs-chip-error',
              onClick: () => refresh(true),
              'aria-label': `${t('chip.error')}: ${error}`,
              title: error,
            },
            h(BranchGlyph, { size: 14 }),
            h('span', { className: 'gs-branch' }, t('chip.error')),
          ),
        );
      }

      const counts = status.counts ?? { changed: 0, staged: 0, unstaged: 0, untracked: 0, conflicted: 0 };
      const changed = Number(counts.changed) || 0;
      const ahead = Number(status.ahead) || 0;
      const behind = Number(status.behind) || 0;
      const branchLabel = status.detached
        ? status.head
          ? `${t('chip.detached')} @ ${status.head}`
          : t('chip.detached')
        : status.branch || (status.unborn ? t('chip.unborn') : t('chip.unknown'));

      const titleParts = [t('chip.title', { branch: branchLabel })];
      if (changed > 0) titleParts.push(changed === 1 ? t('chip.change') : t('chip.changes', { count: changed }));
      else titleParts.push(t('chip.clean'));
      if (status.lastCommit?.subject) {
        titleParts.push(t('chip.lastCommit', { subject: status.lastCommit.subject }));
      }
      if (ahead > 0) titleParts.push(t('chip.ahead', { count: ahead }));
      if (behind > 0) titleParts.push(t('chip.behind', { count: behind }));
      const title = titleParts.join(' · ');

      const toggleDetails = () => {
        setMenuOpen(false);
        if (open) {
          setOpen(false);
          return;
        }
        setOpen(true);
        setRefreshing(true);
        refresh(true).finally(() => {
          if (aliveRef.current) setRefreshing(false);
        });
      };

      const toggleBranches = () => {
        setOpen(false);
        if (menuOpen) {
          setMenuOpen(false);
          return;
        }
        setMenuOpen(true);
        setBranchQuery('');
        setNewBranch('');
        setBranchError('');
        setBranchConfirmation(null);
        loadBranches();
        refresh(true);
      };

      const onRefresh = () => {
        setRefreshing(true);
        refresh(true).finally(() => {
          if (aliveRef.current) setRefreshing(false);
        });
      };

      const applyBranchChange = async (name, create, allowDirty) => {
        const branch = name.trim();
        if (branch === '' || branchBusy !== '') return;
        if (!create && branch === status.branch) return;
        setBranchBusy(create ? 'create' : branch);
        setBranchError('');
        try {
          const result = await changeBranch(sessionId, branch, create, allowDirty);
          if (!aliveRef.current) return;
          if (result?.confirmationRequired === true) {
            setBranchConfirmation({
              branch,
              create,
              dirty: result.dirty ?? {
                counts: status.counts,
                files: status.files,
                truncated: status.truncated,
              },
              conflict: '',
            });
            return;
          }
          if (result?.status !== undefined && result.status !== null) setStatus(result.status);
          setError(result?.statusError?.message ?? '');
          setBranchConfirmation(null);
          setBranchError('');
          if (create) setNewBranch('');
          setMenuOpen(false);
        } catch (cause) {
          if (!aliveRef.current) return;
          const message = cause instanceof Error ? cause.message : String(cause);
          if (cause?.code === 'dirty-conflict') {
            setBranchConfirmation({
              branch,
              create,
              dirty: cause.details?.dirty ?? {
                counts: status.counts,
                files: status.files,
                truncated: status.truncated,
              },
              conflict: message,
            });
          } else {
            setBranchError(message);
          }
        } finally {
          if (aliveRef.current) setBranchBusy('');
        }
      };

      const selectBranch = async (name) => applyBranchChange(name, false, false);

      const createBranch = async (name) => {
        const branch = name.trim();
        if (branch === '' || branchBusy !== '') return;
        await applyBranchChange(branch, true, false);
      };

      const confirmDirtyBranchChange = () => {
        if (branchConfirmation === null || branchBusy !== '') return;
        applyBranchChange(branchConfirmation.branch, branchConfirmation.create, true);
      };

      return h(
        'div',
        { className, ref: rootRef },
        h(
          'div',
          { className: 'gs-chip' },
          h(
            'button',
            {
              type: 'button',
              ref: buttonRef,
              className: 'gs-branch-trigger',
              onClick: toggleBranches,
              'aria-haspopup': 'menu',
              'aria-expanded': menuOpen,
              'aria-label': `${t('chip.branchMenu')}: ${branchLabel}`,
              title: t('chip.branchMenu'),
            },
            h(BranchGlyph, { size: 14 }),
            h('span', { className: 'gs-branch' }, branchLabel),
            h('span', { className: 'gs-chevron' }, h(ChevronGlyph, { open: menuOpen })),
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'gs-status-trigger',
              onClick: toggleDetails,
              'aria-haspopup': 'dialog',
              'aria-expanded': open,
              'aria-label': `${t('chip.details')}: ${title}`,
              title,
            },
            changed > 0
              ? h(
                  'span',
                  { className: 'gs-dirty', 'aria-hidden': 'true' },
                  h('span', { className: 'gs-dot' }),
                  h('span', null, String(changed)),
                )
              : h(
                  'span',
                  { className: 'gs-clean', title: t('chip.clean') },
                  h(CheckGlyph, { size: 12 }),
                  h('span', { className: 'gs-sr-only' }, t('chip.clean')),
                ),
            ahead > 0 ? h('span', { className: 'gs-sync', 'aria-hidden': 'true' }, `↑${ahead}`) : null,
            behind > 0 ? h('span', { className: 'gs-sync', 'aria-hidden': 'true' }, `↓${behind}`) : null,
          ),
        ),
        menuOpen
          ? h(GitBranchMenu, {
              status,
              branches,
              loading: branchesLoading,
              query: branchQuery,
              setQuery: setBranchQuery,
              newBranch,
              setNewBranch,
              busy: branchBusy,
              error: branchError,
              confirmation: branchConfirmation,
              t,
              onSelect: selectBranch,
              onCreate: createBranch,
              onRetry: loadBranches,
              onConfirm: confirmDirtyBranchChange,
              onCancelConfirm: () => setBranchConfirmation(null),
            })
          : null,
        open
          ? h(GitStatusPopover, {
              status,
              counts,
              t,
              error,
              refreshing,
              onRefresh,
              onClose: () => {
                setOpen(false);
                buttonRef.current?.focus?.();
              },
            })
          : null,
      );
    }

    /** Searchable local-branch picker with an inline create-and-switch row. */
    function GitBranchMenu({
      status,
      branches,
      loading,
      query,
      setQuery,
      newBranch,
      setNewBranch,
      busy,
      error,
      confirmation,
      t,
      onSelect,
      onCreate,
      onConfirm,
      onCancelConfirm,
    }) {
      const needle = query.trim().toLowerCase();
      const filtered = needle === ''
        ? branches
        : branches.filter((branch) => branch.name.toLowerCase().includes(needle));
      const current = status.branch || branches.find((branch) => branch.current)?.name || '';
      const pending = busy !== '';
      const commit = status.lastCommit;
      const changed = Number(status.counts?.changed) || 0;
      const changeLabel = changed === 0
        ? t('branch.worktreeClean')
        : changed === 1
          ? t('branch.uncommittedOne')
          : t('branch.uncommitted', { count: changed });
      const confirmCount = Number(confirmation?.dirty?.counts?.changed) || 0;
      const confirmFiles = Array.isArray(confirmation?.dirty?.files) ? confirmation.dirty.files : [];

      const submitCreate = (event) => {
        event.preventDefault();
        if (!pending && newBranch.trim() !== '') onCreate(newBranch);
      };

      return h(
        'div',
        {
          className: 'gs-popover gs-branch-menu',
          role: 'dialog',
          'aria-label': t('branch.title'),
          'aria-modal': 'false',
        },
        h(
          'label',
          { className: 'gs-branch-search' },
          h(SearchGlyph, { size: 14 }),
          h('input', {
            type: 'search',
            value: query,
            autoFocus: true,
            placeholder: t('branch.search', { name: status.name || t('popover.repo') }),
            onChange: (event) => setQuery(event.target.value),
          }),
        ),
        h(
          'section',
          { className: 'gs-branch-current', 'aria-label': t('branch.current') },
          h(
            'div',
            { className: 'gs-branch-current-head' },
            h('span', { className: 'gs-branch-current-label' }, t('branch.current')),
            h(
              'span',
              { className: changed > 0 ? 'gs-branch-worktree gs-is-dirty' : 'gs-branch-worktree' },
              changeLabel,
            ),
          ),
          h(
            'div',
            { className: 'gs-branch-current-name', title: current || t('chip.unknown') },
            current || t('chip.unknown'),
          ),
          h(
            'div',
            { className: 'gs-branch-current-commit' },
            h('span', { className: 'gs-branch-current-label' }, t('branch.latestCommit')),
            commit
              ? h('code', { className: 'gs-commit-hash' }, commit.short)
              : null,
            h(
              'span',
              { className: 'gs-branch-current-subject', title: commit?.subject ?? '' },
              commit?.subject || t('branch.noCommits'),
            ),
          ),
          commit
            ? h(
                'div',
                { className: 'gs-branch-current-meta' },
                [commit.author, relativeTime(commit.date)].filter(Boolean).join(' · '),
              )
            : null,
        ),
        h(
          'div',
          { className: 'gs-branch-heading' },
          h('span', null, t('branch.title')),
          h('span', { className: 'gs-branch-local' }, t('branch.local')),
        ),
        h(
          'div',
          { className: 'gs-branch-list', role: 'listbox', 'aria-label': t('branch.title') },
          loading
            ? h('div', { className: 'gs-branch-state' }, t('branch.loading'))
            : filtered.length === 0
              ? h('div', { className: 'gs-branch-state' }, t('branch.empty'))
              : filtered.map((branch) =>
                  h(
                    'button',
                    {
                      type: 'button',
                      key: branch.name,
                      className: 'gs-branch-row',
                      role: 'option',
                      'aria-selected': branch.name === current,
                      'aria-current': branch.name === current ? 'true' : undefined,
                      disabled: pending,
                      onClick: () => onSelect(branch.name),
                    },
                    h(BranchGlyph, { size: 14 }),
                    h(
                      'span',
                      { className: 'gs-branch-row-main' },
                      h('span', { className: 'gs-branch-name' }, branch.name),
                      h(
                        'span',
                        {
                          className: 'gs-branch-subject',
                          title: branch.subject || (branch.name === current ? commit?.subject : '') || '',
                        },
                        branch.subject || (branch.name === current ? commit?.subject : '') || t('branch.noCommits'),
                      ),
                      h(
                        'span',
                        { className: 'gs-branch-meta' },
                        [branch.head, relativeTime(branch.date)].filter(Boolean).join(' · '),
                      ),
                    ),
                    branch.name === current
                      ? h('span', { className: 'gs-branch-check', title: t('branch.current') }, h(CheckGlyph))
                      : null,
                  ),
                ),
        ),
        confirmation
          ? h(
              'div',
              {
                className: confirmation.conflict
                  ? 'gs-branch-attention gs-branch-attention-error'
                  : 'gs-branch-attention',
                role: 'alert',
              },
              h(
                'div',
                { className: 'gs-branch-attention-copy', title: confirmation.conflict || '' },
                confirmation.conflict
                  ? t('branch.dirtyConflict')
                  : t('branch.carryPrompt', {
                      branch: confirmation.branch,
                      count: confirmCount,
                    }),
              ),
              confirmFiles.length > 0
                ? h(
                    'ul',
                    { className: 'gs-branch-confirm-files' },
                    ...confirmFiles.slice(0, 4).map((file, index) =>
                      h(
                        'li',
                        { className: 'gs-file', key: `${file.path}:${index}` },
                        h(
                          'span',
                          {
                            className: `gs-file-badge gs-${file.kind}`,
                            title: t(`file.${file.kind}`),
                            'aria-label': t(`file.${file.kind}`),
                          },
                          file.letter,
                        ),
                        h('span', { className: 'gs-file-path', title: file.path }, file.path),
                      ),
                    ),
                    confirmCount > 4
                      ? h('li', { className: 'gs-branch-confirm-more' }, t('branch.moreFiles', {
                          count: confirmCount - 4,
                        }))
                      : null,
                  )
                : null,
              h(
                'div',
                { className: 'gs-branch-confirm-actions' },
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'gs-branch-cancel',
                    disabled: pending,
                    onClick: onCancelConfirm,
                  },
                  t('branch.stay', { branch: current || t('branch.current') }),
                ),
                confirmation.conflict
                  ? null
                  : h(
                      'button',
                      {
                        type: 'button',
                        className: 'gs-branch-confirm-go',
                        disabled: pending,
                        onClick: onConfirm,
                      },
                      t('branch.switchAnyway'),
                    ),
              ),
            )
          : null,
        h('div', { className: 'gs-branch-divider' }),
        h(
          'form',
          { className: 'gs-branch-create', onSubmit: submitCreate },
          h(PlusGlyph, { size: 14 }),
          h('input', {
            type: 'text',
            value: newBranch,
            placeholder: t('branch.create'),
            onChange: (event) => setNewBranch(event.target.value),
            'aria-label': t('branch.create'),
          }),
          newBranch.trim() !== ''
            ? h(
                'button',
                {
                  type: 'submit',
                  className: 'gs-branch-create-go',
                  disabled: pending,
                  title: t('branch.createLabel', { branch: newBranch.trim() }),
                  'aria-label': t('branch.createLabel', { branch: newBranch.trim() }),
                },
                h(CheckGlyph),
              )
            : null,
        ),
        error ? h('div', { className: 'gs-error gs-branch-error' }, error) : null,
      );
    }

    /** The status panel. */
    function GitStatusPopover({ status, counts, t, error, refreshing, onRefresh, onClose }) {
      const files = Array.isArray(status.files) ? status.files : [];
      const visible = files.slice(0, FILES_SHOWN);
      const changed = Number(counts.changed) || files.length;
      const remaining = Math.max(0, changed - visible.length);
      const branchLabel = status.detached
        ? status.head
          ? `${t('chip.detached')} @ ${status.head}`
          : t('chip.detached')
        : status.branch || (status.unborn ? t('chip.unborn') : t('chip.unknown'));

      const sync = [];
      if (status.detached) {
        sync.push(t('popover.detached'));
      } else if (!status.upstream) {
        sync.push(t('popover.noUpstream'));
      } else {
        sync.push(status.upstream);
        if (status.ahead > 0) sync.push(t('popover.ahead', { count: status.ahead }));
        if (status.behind > 0) sync.push(t('popover.behind', { count: status.behind }));
        if (status.ahead === 0 && status.behind === 0) sync.push(t('popover.upToDate'));
      }

      const countChips = [];
      if (changed > 0) countChips.push(t('popover.changed', { count: changed }));
      if (counts.staged > 0) countChips.push(t('popover.staged', { count: counts.staged }));
      if (counts.unstaged > 0) countChips.push(t('popover.unstaged', { count: counts.unstaged }));
      if (counts.untracked > 0) countChips.push(t('popover.untracked', { count: counts.untracked }));
      if (counts.conflicted > 0) countChips.push(t('popover.conflicted', { count: counts.conflicted }));

      const commit = status.lastCommit;

      return h(
        'div',
        {
          className: 'gs-popover',
          role: 'dialog',
          'aria-label': t('popover.title'),
          'aria-modal': 'false',
        },
        h(
          'div',
          { className: 'gs-pop-head' },
          h('span', { className: 'gs-pop-glyph' }, h(BranchGlyph, { size: 16 })),
          h(
            'div',
            { className: 'gs-pop-title' },
            h('div', { className: 'gs-pop-repo' }, status.name || t('popover.repo')),
            h('div', { className: 'gs-pop-branch' }, branchLabel),
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'gs-icon-btn',
              onClick: onClose,
              'aria-label': t('popover.close'),
              title: t('popover.close'),
            },
            '×',
          ),
        ),
        h('div', { className: 'gs-pop-sync' }, sync.join(' · ')),
        countChips.length > 0
          ? h('div', { className: 'gs-counts' }, ...countChips.map((text, index) =>
              h('span', { className: 'gs-count', key: index }, text)))
          : null,
        error ? h('div', { className: 'gs-error' }, error) : null,
        h('div', { className: 'gs-divider' }),
        changed === 0
          ? h('div', { className: 'gs-empty' }, t('popover.clean'))
          : h(
              'div',
              { className: 'gs-files-wrap' },
              h('div', { className: 'gs-section-label' }, t('popover.files')),
              h(
                'ul',
                { className: 'gs-files' },
                ...visible.map((file, index) =>
                  h(
                    'li',
                    { className: 'gs-file', key: `${file.path}:${index}` },
                    h(
                      'span',
                      {
                        className: `gs-file-badge gs-${file.kind}`,
                        title: t(`file.${file.kind}`),
                        'aria-label': t(`file.${file.kind}`),
                      },
                      file.letter,
                    ),
                    h(
                      'span',
                      { className: 'gs-file-path', title: file.path },
                      file.path,
                      file.from !== undefined ? h('span', { className: 'gs-file-from' }, ` ← ${file.from}`) : null,
                    ),
                  ),
                ),
              ),
            ),
        remaining > 0 ? h('div', { className: 'gs-more' }, t('popover.more', { count: remaining })) : null,
        h('div', { className: 'gs-divider' }),
        h(
          'div',
          { className: 'gs-commit' },
          h('div', { className: 'gs-section-label' }, t('popover.lastCommit')),
          commit
            ? h(
                React.Fragment,
                null,
                h(
                  'div',
                  { className: 'gs-commit-row' },
                  h('code', { className: 'gs-commit-hash' }, commit.short),
                  h('span', { className: 'gs-commit-subject', title: commit.subject }, commit.subject),
                ),
                h(
                  'div',
                  { className: 'gs-commit-meta' },
                  [commit.author, relativeTime(commit.date)].filter(Boolean).join(' · '),
                ),
              )
            : h('div', { className: 'gs-commit-meta' }, t('popover.noCommits')),
        ),
        h(
          'div',
          { className: 'gs-pop-foot' },
          h(
            'button',
            {
              type: 'button',
              className: 'gs-refresh',
              onClick: onRefresh,
              disabled: refreshing,
            },
            refreshing ? t('popover.refreshing') : t('popover.refresh'),
          ),
        ),
      );
    }

    /** Inject the component's stylesheet once; remove only what we created. */
    function ensureStyles() {
      if (typeof document === 'undefined') return () => {};
      let style = document.getElementById('git-status-styles');
      const created = style === null;
      if (style === null) {
        style = document.createElement('style');
        style.id = 'git-status-styles';
        style.textContent = `
.gs-root {
  position: relative; z-index: 1000; display: flex; align-items: center;
  justify-content: center; max-width: 100%;
}
.gs-root.gs-hero-option {
  display: flex; justify-content: flex-end; align-self: center;
  margin-left: 0;
}
.gs-root.gs-header-utility {
  display: flex; align-items: center;
}
[data-content-phase="hero"] .gs-hero-option .gs-popover {
  top: calc(100% + 8px); right: 0; bottom: auto; left: auto;
  transform: none;
  max-height: 38vh; overflow-y: auto; overscroll-behavior: contain;
  animation-name: gs-pop-in-right;
}
.gs-header-utility .gs-popover {
  top: calc(100% + 8px); right: 0; bottom: auto; left: auto;
  transform: none;
  max-height: min(70vh, 620px); overflow-y: auto; overscroll-behavior: contain;
  animation-name: gs-pop-in-right;
}
.gs-hero-option .gs-branch-menu {
  width: min(352px, calc(100vw - 24px));
}
@keyframes gs-pop-in-right {
  from { opacity: 0; transform: translateY(6px) scale(.985); }
  to { opacity: 1; transform: none; }
}
.gs-glyph { flex: none; }
.gs-chip {
  box-sizing: border-box;
  display: inline-flex; align-items: stretch;
  height: 28px; max-width: min(72vw, 520px); padding: 0;
  border: 1px solid var(--dsw-alias-border-l2, rgba(128,128,128,.28));
  border-radius: 999px;
  background: color-mix(
    in srgb,
    var(--dsw-alias-bg-base, #fff) 84%,
    var(--dsw-specific-menu, #fff)
  );
  color: var(--dsw-alias-label-secondary, inherit);
  font: 12px/18px var(--dsw-font-family, inherit);
  user-select: none;
  transition: background-color .12s, border-color .12s;
}
.gs-chip:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,.14)); }
.gs-branch-trigger, .gs-status-trigger {
  appearance: none; border: 0; background: transparent; color: inherit;
  font: inherit; height: 100%; display: inline-flex; align-items: center;
  gap: 5px; min-width: 0; cursor: pointer;
}
.gs-branch-trigger { padding: 0 5px 0 9px; }
.gs-status-trigger { padding: 0 8px; border-left: 1px solid var(--dsw-alias-border-l3, rgba(128,128,128,.16)); }
.gs-branch-trigger:disabled, .gs-status-trigger:disabled { cursor: default; opacity: .6; }
.gs-branch-trigger:focus-visible, .gs-status-trigger:focus-visible {
  outline: var(--dsw-focus-ring-width, 2px) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary, #4d93f8));
  outline-offset: -2px;
}
.gs-chip-error {
  color: var(--dsw-alias-state-error-primary, #e5534b);
  border-color: color-mix(in srgb, currentColor 35%, transparent);
}
.gs-chip:focus-visible {
  outline: var(--dsw-focus-ring-width, 2px) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary, #4d93f8));
  outline-offset: 2px;
}
.gs-branch { min-width: 0; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  color: var(--dsw-alias-label-primary, inherit); font-weight: 500; }
.gs-dirty { display: inline-flex; align-items: center; gap: 4px; flex: none;
  color: var(--dsw-alias-state-warn-primary, #f59e0b); font-variant-numeric: tabular-nums; }
.gs-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
.gs-clean { display: inline-flex; align-items: center; flex: none;
  color: var(--dsw-alias-state-success-primary, #4ed17e); }
.gs-sync { flex: none; color: var(--dsw-alias-label-tertiary, inherit); font-variant-numeric: tabular-nums; }
.gs-chevron { display: inline-flex; align-items: center; flex: none; opacity: .55; }
.gs-sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden;
  clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
.gs-branch-menu { width: 352px; padding: 10px; }
.gs-branch-search {
  display: flex; align-items: center; gap: 7px; height: 32px; padding: 0 9px;
  border-radius: 8px; color: var(--dsw-alias-label-tertiary, inherit);
  background: var(--dsw-alias-bg-module-platform, rgba(127,127,127,.08));
}
.gs-branch-search input, .gs-branch-create input {
  min-width: 0; flex: 1; border: 0; outline: 0; padding: 0;
  background: transparent; color: var(--dsw-alias-label-primary, inherit);
  font: 12px/18px var(--dsw-font-family, inherit);
}
.gs-branch-search input::placeholder, .gs-branch-create input::placeholder {
  color: var(--dsw-alias-label-tertiary, inherit);
}
.gs-branch-current {
  margin-top: 8px; padding: 9px 10px;
  border: 1px solid var(--dsw-alias-border-l3, rgba(128,128,128,.16));
  border-radius: 8px;
  background: color-mix(
    in srgb,
    var(--dsw-alias-bg-module-platform, rgba(127,127,127,.08)) 72%,
    transparent
  );
}
.gs-branch-current-head, .gs-branch-current-commit, .gs-branch-current-meta {
  display: flex; align-items: center; gap: 6px; min-width: 0;
}
.gs-branch-current-label {
  flex: none; color: var(--dsw-alias-label-caption, inherit);
  font-size: 10px; line-height: 14px;
}
.gs-branch-worktree {
  margin-left: auto; flex: none; color: var(--dsw-alias-state-success-primary, #4ed17e);
  font-size: 10px; line-height: 14px;
}
.gs-branch-worktree.gs-is-dirty { color: var(--dsw-alias-state-warn-primary, #f59e0b); }
.gs-branch-current-name {
  margin-top: 2px; color: var(--dsw-alias-label-primary, inherit);
  font: 600 13px/18px var(--dsh-font-family-code, ui-monospace, monospace);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.gs-branch-current-commit { margin-top: 5px; }
.gs-branch-current-subject {
  min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  color: var(--dsw-alias-label-secondary, inherit); font-size: 11px;
}
.gs-branch-current-meta {
  margin-top: 2px; color: var(--dsw-alias-label-tertiary, inherit);
  font-size: 10px; line-height: 14px;
}
.gs-branch-heading {
  display: flex; align-items: center; gap: 6px; padding: 10px 7px 5px;
  color: var(--dsw-alias-label-tertiary, inherit); font-size: 11px;
}
.gs-branch-local {
  padding: 1px 6px; border-radius: 999px; font-size: 10px; line-height: 14px;
  background: var(--dsw-alias-bg-module-platform, rgba(127,127,127,.10));
}
.gs-branch-list { max-height: 260px; overflow-y: auto; overscroll-behavior: contain; }
.gs-branch-row {
  box-sizing: border-box; width: 100%; min-height: 48px; padding: 5px 8px;
  border: 0; border-radius: 7px; display: flex; align-items: center; gap: 8px;
  background: transparent; color: var(--dsw-alias-label-secondary, inherit);
  text-align: left; cursor: pointer;
}
.gs-branch-row:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,.12)); }
.gs-branch-row[aria-selected="true"] { color: var(--dsw-alias-label-primary, inherit); }
.gs-branch-row:disabled { cursor: default; opacity: .65; }
.gs-branch-row-main { min-width: 0; flex: 1; display: flex; flex-direction: column; }
.gs-branch-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500; }
.gs-branch-subject {
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  color: var(--dsw-alias-label-secondary, inherit); font-size: 10px; line-height: 14px;
}
.gs-branch-meta {
  color: var(--dsw-alias-label-tertiary, inherit);
  font: 10px/14px var(--dsh-font-family-code, ui-monospace, monospace);
}
.gs-branch-check {
  flex: none; display: inline-flex; color: var(--dsw-alias-state-business-primary, #4d93f8);
}
.gs-branch-state { padding: 12px 8px; color: var(--dsw-alias-label-tertiary, inherit); }
.gs-branch-attention {
  margin-top: 8px; padding: 9px 10px; border-radius: 8px;
  border: 1px solid color-mix(in srgb, var(--dsw-alias-state-warn-primary, #f59e0b) 34%, transparent);
  color: var(--dsw-alias-label-secondary, inherit);
  background: color-mix(in srgb, var(--dsw-alias-state-warn-primary, #f59e0b) 9%, transparent);
}
.gs-branch-attention-error {
  border-color: color-mix(in srgb, var(--dsw-alias-state-error-primary, #e5534b) 32%, transparent);
  background: color-mix(in srgb, var(--dsw-alias-state-error-primary, #e5534b) 8%, transparent);
}
.gs-branch-attention-copy { font-size: 11px; line-height: 16px; }
.gs-branch-confirm-files {
  list-style: none; margin: 7px 0 0; padding: 0;
  max-height: 82px; overflow-y: auto; overscroll-behavior: contain;
}
.gs-branch-confirm-more {
  padding-top: 3px; color: var(--dsw-alias-label-tertiary, inherit); font-size: 10px;
}
.gs-branch-confirm-actions {
  display: flex; align-items: center; justify-content: flex-end; gap: 6px; margin-top: 8px;
}
.gs-branch-cancel, .gs-branch-confirm-go {
  min-height: 26px; padding: 3px 9px; border-radius: 6px; cursor: pointer;
  font: 11px/18px var(--dsw-font-family, inherit);
}
.gs-branch-cancel {
  border: 1px solid var(--dsw-alias-border-l2, rgba(128,128,128,.28));
  background: transparent; color: var(--dsw-alias-label-secondary, inherit);
}
.gs-branch-confirm-go {
  border: 1px solid color-mix(in srgb, var(--dsw-alias-state-warn-primary, #f59e0b) 55%, transparent);
  background: color-mix(in srgb, var(--dsw-alias-state-warn-primary, #f59e0b) 14%, transparent);
  color: var(--dsw-alias-label-primary, inherit);
}
.gs-branch-cancel:hover:not(:disabled), .gs-branch-confirm-go:hover:not(:disabled) {
  background: var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,.14));
}
.gs-branch-cancel:disabled, .gs-branch-confirm-go:disabled { opacity: .5; cursor: default; }
.gs-branch-divider { height: 1px; margin: 8px 0; background: var(--dsw-alias-border-l3, rgba(128,128,128,.16)); }
.gs-branch-create {
  display: flex; align-items: center; gap: 7px; min-height: 32px; padding: 0 7px;
  color: var(--dsw-alias-label-tertiary, inherit);
}
.gs-branch-create-go {
  flex: none; width: 24px; height: 24px; padding: 0; border: 0; border-radius: 6px;
  display: inline-flex; align-items: center; justify-content: center;
  color: var(--dsw-alias-state-business-primary, #4d93f8);
  background: var(--dsw-alias-bg-module-platform, rgba(127,127,127,.10));
  cursor: pointer;
}
.gs-branch-create-go:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,.14)); }
.gs-branch-create-go:disabled { opacity: .45; cursor: default; }
.gs-branch-error { margin-top: 6px; }
.gs-popover {
  position: absolute; left: 50%; bottom: calc(100% + 10px); transform: translateX(-50%);
  box-sizing: border-box; width: 390px; max-width: calc(100vw - 24px);
  padding: 14px;
  border: 1px solid var(--dsw-alias-border-l1, rgba(128,128,128,.24));
  border-radius: var(--dsw-radius-lg, 16px);
  background: color-mix(
    in srgb,
    var(--dsw-alias-bg-base, #fff) 92%,
    var(--dsw-specific-menu, #fff)
  );
  backdrop-filter: var(--dsw-menu-backdrop-filter, none);
  box-shadow: var(--dsw-elevation-panel, 0 18px 46px rgba(0,0,0,.22));
  color: var(--dsw-alias-label-primary, inherit);
  font: 12px/18px var(--dsw-font-family, inherit);
  text-align: left; z-index: 40;
  animation: gs-pop-in .14s ease-out both;
}
@keyframes gs-pop-in {
  from { opacity: 0; transform: translate(-50%, 6px) scale(.985); }
  to { opacity: 1; transform: translate(-50%, 0) scale(1); }
}
@media (prefers-reduced-motion: reduce) { .gs-popover { animation: none; } }
.gs-pop-head { display: flex; align-items: flex-start; gap: 9px; }
.gs-pop-glyph { display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px;
  border-radius: 7px; flex: none; color: var(--dsw-alias-label-secondary, inherit);
  background: var(--dsw-alias-bg-module-platform, rgba(127,127,127,.10)); }
.gs-pop-title { min-width: 0; flex: 1; }
.gs-pop-repo { color: var(--dsw-alias-label-caption, inherit); font-size: 10px; line-height: 14px;
  text-overflow: ellipsis; overflow: hidden; white-space: nowrap; }
.gs-pop-branch { color: var(--dsw-alias-label-primary, inherit); font-size: 14px; line-height: 20px;
  font-weight: 600; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; }
.gs-icon-btn { flex: none; width: 24px; height: 24px; padding: 0; border: 0; border-radius: 6px;
  background: transparent; color: var(--dsw-alias-label-tertiary, inherit); cursor: pointer;
  font-size: 17px; line-height: 22px; }
.gs-icon-btn:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,.14)); }
.gs-icon-btn:focus-visible { outline: var(--dsw-focus-ring-width, 2px) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary, #4d93f8)); outline-offset: 1px; }
.gs-pop-sync { margin-top: 2px; color: var(--dsw-alias-label-tertiary, inherit); font-size: 11px; line-height: 16px;
  text-overflow: ellipsis; overflow: hidden; white-space: nowrap; }
.gs-counts { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.gs-count { padding: 2px 8px; border-radius: 999px; font-size: 11px; line-height: 16px;
  color: var(--dsw-alias-label-secondary, inherit);
  background: var(--dsw-alias-bg-module-platform, rgba(127,127,127,.10)); }
.gs-divider { height: 1px; margin: 10px 0; background: var(--dsw-alias-border-l3, rgba(128,128,128,.16)); }
.gs-error { margin-top: 8px; padding: 6px 8px; border-radius: 6px; font-size: 11px;
  color: var(--dsw-alias-state-error-primary, #e5534b);
  background: color-mix(in srgb, var(--dsw-alias-state-error-primary, #e5534b) 10%, transparent); }
.gs-section-label { margin-bottom: 5px; color: var(--dsw-alias-label-caption, inherit);
  font-size: 10px; line-height: 14px; }
.gs-files-wrap { min-width: 0; }
.gs-files { list-style: none; margin: 0; padding: 0; max-height: 210px; overflow-y: auto;
  overscroll-behavior: contain; }
.gs-file { display: flex; align-items: center; gap: 8px; min-width: 0; padding: 3px 0; }
.gs-file-badge { flex: none; display: inline-flex; align-items: center; justify-content: center;
  width: 18px; height: 18px; border-radius: 5px; font: 600 10px/1 var(--dsh-font-family-code, ui-monospace, monospace);
  color: var(--dsw-alias-label-secondary, inherit);
  background: var(--dsw-alias-bg-module-platform, rgba(127,127,127,.12));
  background: color-mix(in srgb, currentColor 14%, transparent); }
.gs-file-badge.gs-modified, .gs-file-badge.gs-typechange { color: var(--dsw-alias-state-warn-primary, #f59e0b); }
.gs-file-badge.gs-added, .gs-file-badge.gs-untracked { color: var(--dsw-alias-state-success-primary, #4ed17e); }
.gs-file-badge.gs-deleted, .gs-file-badge.gs-conflicted { color: var(--dsw-alias-state-error-primary, #e5534b); }
.gs-file-badge.gs-renamed, .gs-file-badge.gs-copied { color: var(--dsw-alias-state-business-primary, #4d93f8); }
.gs-file-path { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  color: var(--dsw-alias-label-secondary, inherit);
  font: 11px/18px var(--dsh-font-family-code, ui-monospace, monospace); }
.gs-file-from { color: var(--dsw-alias-label-caption, inherit); }
.gs-more { padding-top: 6px; color: var(--dsw-alias-label-tertiary, inherit); font-size: 11px; }
.gs-empty { padding: 2px 0; color: var(--dsw-alias-label-tertiary, inherit); }
.gs-commit-row { display: flex; align-items: baseline; gap: 7px; min-width: 0; }
.gs-commit-hash { flex: none; padding: 1px 5px; border-radius: 4px;
  color: var(--dsw-alias-label-secondary, inherit);
  background: var(--dsw-alias-bg-module-platform, rgba(127,127,127,.10));
  font: 10px/16px var(--dsh-font-family-code, ui-monospace, monospace); }
.gs-commit-subject { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  color: var(--dsw-alias-label-secondary, inherit); font-size: 12px; }
.gs-commit-meta { margin-top: 3px; color: var(--dsw-alias-label-tertiary, inherit); font-size: 11px; line-height: 16px; }
.gs-pop-foot { display: flex; justify-content: flex-end; margin-top: 10px; }
.gs-refresh { padding: 4px 10px; border-radius: 6px; font-size: 11px; line-height: 16px;
  border: 1px solid var(--dsw-alias-border-l2, rgba(128,128,128,.28));
  background: transparent; color: var(--dsw-alias-label-secondary, inherit); cursor: pointer; }
.gs-refresh:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,.14)); }
.gs-refresh:disabled { opacity: .5; cursor: default; }
`;
        document.head.appendChild(style);
      }
      return () => {
        if (created) style.remove();
      };
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ensureStyles(), 'git-status: component styles');
        ctx.effect(() => {
          try {
            return ctx.locale.register(NS, { en: EN, zh: ZH });
          } catch {
            return () => {};
          }
        }, 'git-status: dictionaries');

        // Once the conversation starts, the hero row disappears. Keep the
        // same top-right placement by mounting beside the session header's
        // right-side utilities instead of adding a row under the composer.
        ctx.slots.inject('conversation.session.header.utilities', () => {
          try {
            return ctx.slots.register(
              {
                name: 'conversation.session.header.utilities',
                id: 'git-status-header-utility',
                order: 60,
                locale: NS,
                inject: (sessionId) => ({ sessionId, placement: 'header-utility' }),
              },
              GitStatusDock,
            );
          } catch {
            return () => {};
          }
        });

        // The hero workspace row already renders workspace, agent preset and
        // its right-aligned option slot. Put Git status beside those controls
        // instead of giving it another row below the composer.
        ctx.slots.inject('conversation.hero.options', () => {
          try {
            return ctx.slots.register(
              {
                name: 'conversation.hero.options',
                id: 'git-status-hero-option',
                order: 60,
                locale: NS,
                inject: (sessionId) => ({ sessionId, placement: 'hero-options' }),
              },
              GitStatusDock,
            );
          } catch {
            return () => {};
          }
        });
      },
    };
  },
});
