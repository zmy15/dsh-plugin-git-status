# dsh-plugin-git-status

给 DeepSeek Harness（DSH）增加一条克制、可直接操作的 **Git 状态提示**。

仓库地址：[github.com/zmy15/dsh-plugin-git-status](https://github.com/zmy15/dsh-plugin-git-status)

- 新会话：显示在工作区名称和 Agent 模式同一行的最右侧；
- 对话开始后：显示在会话标题栏右侧工具区；
- 点击分支名切换分支，点击状态区域查看改动、同步状态和最近提交。

它显示当前会话工作目录的：

- 当前分支（游离 HEAD 会显示为 `HEAD @ 1a2b3c4`）；
- 分支菜单中显示当前分支的最近提交标题、短哈希、作者和相对时间；
- 本地分支列表，每行显示该分支最近提交标题，可搜索、切换，或输入名称创建并检出分支；
- 改动文件数（已暂存 / 未暂存 / 未跟踪 / 冲突在弹层里分别统计）；
- 与上游分支的领先 / 落后提交数；
- 最近一次提交的短哈希、标题、作者和相对时间；
- 展开后列出改动文件（最多 8 行，其余折叠为 “还有 N 个”）。

工作区干净时只显示一个绿色对勾，不占视觉注意力。

---

## 功能

- **当前分支**：普通分支、未出生分支和游离 HEAD 都有明确显示。
- **最近提交**：显示短哈希、提交标题、作者和相对时间。
- **未提交改动**：统计已暂存、未暂存、未跟踪和冲突文件，并列出具体路径。
- **同步状态**：显示上游分支及 ahead / behind 数量。
- **本地分支切换**：可搜索、切换、创建并检出本地分支。
- **改动保护**：有未提交改动时先展示文件并要求确认，不会静默丢弃改动。
- **冲突保护**：目标分支会覆盖本地文件时，Git 拒绝切换；原分支保持不变。
- **自动刷新**：页面可见时每 10 秒刷新；窗口重新聚焦或标签页恢复可见时立即刷新。
- **安全路径绑定**：浏览器只提交 session id，由宿主解析该会话的工作目录。

---

## 界面与交互

- **位置**：新会话 hero 模式使用 `conversation.hero.options`，显示在工作区名称与
  Agent 模式同一行的最右侧；对话开始后使用 `conversation.session.header.utilities`，
  显示在会话标题栏右侧工具区，不再占用输入框下方的新一行。
- **会话绑定**：该槽位本身不向组件传 props，插件通过 slot 的 `inject(sessionId)` 取得当前会话 ID。
- **切换分支**：点击分支名打开本地分支菜单；当前分支带勾选，可按名称过滤，
  也可在底部输入新分支名后回车创建并检出。有未提交改动时先展示改动数量和文件，
  确认后才把改动带到目标分支。
- **查看状态**：点击右侧改动数 / 干净标记 / ahead-behind 打开状态面板。
- **关闭**：点击外部或按 `Esc` 关闭分支菜单和状态面板。
- **自动刷新**：页面可见时每 10 秒刷新一次；窗口重新获得焦点、标签页切回可见时立即刷新。宿主侧还有 1.5 秒缓存与并发合并，避免多个面板同时打 git。
- **主题**：所有颜色、圆角、阴影、字体都走 `--dsw-*` 主题 token，自动适配亮色 / 暗色皮肤。
- **非 Git 目录 / Git 不可用**：静默隐藏，不显示死控件；打开弹层时如果刷新失败，会在弹层内展示原因。

---

## 接口与实现

```
浏览器（client.js）                    宿主（index.js + lib/）
┌─────────────────────────┐          ┌──────────────────────────────┐
│ 每 10s GET              │          │ GET  /git-status/status      │
│ /git-status/status      │ ───────▶ │ GET  /git-status/branches    │
│ /git-status/branches    │          │ POST /git-status/branch      │
│ POST /git-status/branch │          │  sessionId → ctx.sessions    │
└─────────────────────────┘          │  → session.header.cwd        │
                                     │  → git status / for-each-ref │
                                     │  → git switch [-c]           │
                                     └──────────────────────────────┘
```

### 宿主只接收 session id

浏览器不能指定路径。宿主用 `ctx.sessions.get(sessionId).header.cwd` 自己解析工作目录，
再把该目录交给 git。这样即使页面被篡改，也不能借这些路由读写任意目录。

分支切换和创建只接受分支名，不接受路径。分支名先经过 `git check-ref-format --branch`
校验；命令通过 `execFile` 执行，不经过 shell。

### 读取策略

`git status --porcelain=v2 --branch -z` 一次给出分支、上游、ahead/behind 和全部改动
（含重命名、冲突、未跟踪）；`git log -1` 只补最近提交。两条命令并行执行，各自有
8 秒超时和 4 MiB 输出上限，避免大仓库卡住宿主。只有用户真正切换分支时，宿主才会
额外读取一次工作区状态，用于决定是否需要确认。

---

## 安装

### Web profile

先克隆仓库：

```bash
git clone https://github.com/zmy15/dsh-plugin-git-status.git
```

将当前 profile 链接到克隆目录：

```bash
dsh plugin --profile web add link:<本仓库绝对路径>
```

然后把 `dsh-plugin-git-status` 加进该 profile `package.json` 的
`dsh.profile.bundles`，重启 DSH。

### 桌面端（Electron）

桌面 profile 由 Electron 独占，`dsh plugin` 会拒绝直接修改。可以：

1. 用 DSH 的 Plugin Manager 安装；或
2. 手工建链接并把包名加入 profile：

```text
<profile>/node_modules/dsh-plugin-git-status -> <本仓库绝对路径>
```

```jsonc
"dsh": { "profile": { "bundles": [ ..., "dsh-plugin-git-status" ] } }
```

桌面端宿主半边是启动期 bundle 行，**装完必须重启 DSH**；只刷新页面不够。

---

## 环境要求

- Node.js `>=22.19.0`
- DSH `>=0.2.1-rc.1`
- 系统 `PATH` 中可用的 Git

---

## 开发

```bash
node --test test/git.test.mjs test/routes.test.mjs test/client.test.mjs
node --check client.js
node --check lib/git.js
node --check lib/routes.js
```

测试覆盖：

- porcelain-v2 解析（含路径带空格、重命名、冲突、未跟踪）；
- 真实临时仓库的分支 / 计数 / 最近提交；
- 本地分支列表、切换、新建分支与非法分支名；
- 有未提交改动时先要求确认，确认后携带改动切换；
- 目标分支会覆盖本地改动时拒绝切换，并保持原分支和文件内容；
- 游离 HEAD 与非 Git 目录；
- 缓存与强制刷新；
- 状态、分支列表和分支切换路由的 200 / 400 / 404 / 405 和方法校验。

状态条、状态面板、分支菜单，以及新会话和活动会话两种位置，均已在真实桌面 GUI 中验证。

---

## 已知限制

- 分支切换分两步：有未提交改动时先展示改动并要求确认；确认后由 Git 判断能否安全携带。
  如果 Git 判断文件会被覆盖，切换失败、原分支保持不变，菜单显示冲突说明。插件不会
  自动暂存、丢弃或覆盖改动。
- 不提供暂存、提交、拉取、推送等额外写操作。
- 只对 live session 生效：路由不读取 session 持久化，因为 composer 打开时 session 一定在宿主内存里。
- 超大仓库的 `git status` 可能慢；8 秒超时后弹层显示错误，状态 chip 保留上一次成功结果。
- 每 10 秒轮询是刻意的取舍：没有新增 SSE 通道，避免在桌面 IPC / 远程 web 两种传输上引入额外生命周期。
