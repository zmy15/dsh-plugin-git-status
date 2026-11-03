# dsh-plugin-git-status

参考 Codex 的克制风格，给 DSH 输入框下方加一条 **Git 状态提示**：

```
[git] main  ● 3  ↑1     ← 点击展开
```

它显示当前会话工作目录的：

- 当前分支（游离 HEAD 会显示为 `HEAD @ 1a2b3c4`）；
- 改动文件数（已暂存 / 未暂存 / 未跟踪 / 冲突在弹层里分别统计）；
- 与上游分支的领先 / 落后提交数；
- 最近一次提交的短哈希、标题、作者和相对时间；
- 展开后列出改动文件（最多 8 行，其余折叠为 “还有 N 个”）。

工作区干净时只显示一个绿色对勾，不占视觉注意力。

---

## 界面与交互

- **位置**：活动对话使用 `conversation.composer.dock`；新会话 hero 模式使用同样存在的
  `conversation.input.dock`，再通过 CSS 排序放到输入框下方。两种布局都保持 ambient chip，
  不会挤压输入框，也不会盖住工具栏。
- **会话绑定**：该槽位本身不向组件传 props，插件通过 slot 的 `inject(sessionId)` 取得当前会话 ID。
- **点击**：弹出状态面板；点击外部或按 `Esc` 关闭。
- **自动刷新**：页面可见时每 10 秒刷新一次；窗口重新获得焦点、标签页切回可见时立即刷新。宿主侧还有 1.5 秒缓存与并发合并，避免多个面板同时打 git。
- **主题**：所有颜色、圆角、阴影、字体都走 `--dsw-*` 主题 token，自动适配亮色 / 暗色皮肤。
- **非 Git 目录 / Git 不可用**：静默隐藏，不显示死控件；打开弹层时如果刷新失败，会在弹层内展示原因。

---

## 实现

```
浏览器（client.js）                    宿主（index.js + lib/）
┌─────────────────────────┐          ┌──────────────────────────────┐
│ 每 10s GET              │          │ /git-status/status           │
│ /git-status/status      │ ───────▶ │  sessionId → ctx.sessions    │
│ ?sessionId=…&refresh=1  │          │  → session.header.cwd        │
└─────────────────────────┘          │  → git status --porcelain=v2 │
                                     │  → git log -1                │
                                     └──────────────────────────────┘
```

### 为什么宿主只收 sessionId

浏览器不能指定路径。宿主用 `ctx.sessions.get(sessionId).header.cwd` 自己解析工作目录，
再把该目录交给 git。这样即使页面被篡改，也不能借这条路由读取任意目录。

### 为什么只跑两条 git 命令

`git status --porcelain=v2 --branch -z` 一次给出分支、上游、ahead/behind 和全部改动
（含重命名、冲突、未跟踪）；`git log -1` 只补最近提交。两条命令并行执行，各自有
8 秒超时和 4 MiB 输出上限，避免大仓库卡住宿主。

### 安装（web profile）

```bash
dsh plugin --profile web add link:F:/dsh/dsh-plugin-git-status
```

然后把 `dsh-plugin-git-status` 加进该 profile `package.json` 的
`dsh.profile.bundles`，重启 DSH。

### 桌面端（Electron）

桌面 profile 由 Electron 独占，`dsh plugin` 会拒绝直接修改。可以：

1. 用 DSH 的 Plugin Manager 安装；或
2. 手工建链接并把包名加入 profile：

```text
<profile>/node_modules/dsh-plugin-git-status -> F:\dsh\dsh-plugin-git-status
```

```jsonc
"dsh": { "profile": { "bundles": [ ..., "dsh-plugin-git-status" ] } }
```

桌面端宿主半边是启动期 bundle 行，**装完必须重启 DSH**；只刷新页面不够。

---

## 开发与验证

```bash
node --test test/*.test.mjs
node --check client.js
```

测试覆盖：

- porcelain-v2 解析（含路径带空格、重命名、冲突、未跟踪）；
- 真实临时仓库的分支 / 计数 / 最近提交；
- 游离 HEAD 与非 Git 目录；
- 缓存与强制刷新；
- HTTP 路由的 200 / 400 / 404 / 405 和方法校验。

> 当前会话里已做过的运行时验证：临时 web profile 启动后，
> `/git-status/status?sessionId=…` 返回本插件的 JSON 错误信封（证明路由已挂载），
> 启动 HTML 的 client combo 中也能取到 `dsh-plugin-git-status/client.js`。
> 视觉渲染仍需在重启后的真实 GUI 中确认。

## 已知限制

- 只读：不提供切换分支、暂存、提交等写操作；有意保持低风险。
- 只对 live session 生效：路由不读取 session 持久化，因为 composer 打开时 session 一定在宿主内存里。
- 超大仓库的 `git status` 可能慢；8 秒超时后弹层显示错误，状态 chip 保留上一次成功结果。
- 每 10 秒轮询是刻意的取舍：没有新增 SSE 通道，避免在桌面 IPC / 远程 web 两种传输上引入额外生命周期。
