# dsh-plugin-market

简体中文 · [English（精简版）](README.en.md)

左侧栏「插件市场」面板：浏览 [dsh-plugin.org](https://dsh-plugin.org) 的社区插件目录，
并用 **Harness 官方插件管理器** 安装 / 启停 / 卸载到当前 profile —— 不依赖 `dsh` CLI，
也不接管官方插件管理器的任何一步。

[![version](https://img.shields.io/badge/version-0.3.1-blue)](https://github.com/wojiao42/dsh-plugin-market/releases)
[![license](https://img.shields.io/badge/license-MIT-green)](LICENSE)

## 截图

暂无截图（本仓库没有截图资产）。

面板入口：左侧栏「插件市场」面板，或 设置（Ctrl+,）里的「插件市场」分区；两者渲染同一个页面（同一个组件、各自独立的界面状态）。

## 快速上手

1. 装：首次安装走命令行 `dsh plugin --profile web add github:wojiao42/dsh-plugin-market`（设置里还没有「插件市场」分区——那个分区由本插件自己提供）；已经装过的，用 设置（Ctrl+,）→ 插件市场 → 自定义安装 → 填 `github:wojiao42/dsh-plugin-market` 等效。
2. 刷新窗口后打开面板：左侧栏「插件市场」，或 设置（Ctrl+,）→「插件市场」。
3. 在「市场」页签搜索关键词 → 点「安装」；装完的插件到「已安装」页签里启停 / 卸载。

## 功能

### 两个入口

入口有两个，渲染的是同一个页面（同一个组件、各自独立的界面状态）：**左侧栏「插件市场」面板**，以及 **设置（Ctrl+,）里的「插件市场」分区**（`settings.section`，order 60）。主区另有 `main` 页面。

### 界面：五个页签

| 页签 | 内容 |
|---|---|
| **市场** | 版式对齐官网列表：① **推荐条**（`推荐` 徽标 +「收录 N 款插件，M 款人工精选验证，每日更新」，数据取官网 `stats.json`，失败时回退目录统计）+ 官网入口；② 搜索框；③ **长名分类 chip**（全部 (N) / 界面体验 / 会话消息 / 记忆上下文 / 工具能力 / 技能智能体 / 工作流 / 集成连接 / 模型推理 / 开发运维 / 数据知识 / 娱乐，按官网分类顺序，空分类自动隐藏）；④ 结果数 + **分段排序控件**（Star / Fork / 最近更新 / 最新收录，点当前项切换升降序并显示箭头）+ 刷新。卡片是**单列全宽行**：名称 + 目录版本 + 已装版本 + 「可更新」+ 分类（长名）+ 「已验证」/「仅索引」+ 安装源类型（npm/git/path）**描边徽标**，描述（2 行截断，hover 看全文），能力要点（最多 2 条），topics；右侧竖排 ★ 星标 / Fork / 相对更新时间，动作是「详情」（跳 dsh-plugin.org 详情页）、「安装 / 可更新 / 已安装」、「复制命令」 |
| **已安装** | 当前 profile 的组合包：名称、版本、来源（官方/本地/第三方）、官方可选标记、已启用/已停用、包含组件数、描述；按钮「启用 / 停用」（`setBundleEnabled`）、「卸载」（`removeBundle`，二次确认） |
| **自定义安装** | 输入 npm 包名 / `github:owner/repo` / 本机绝对路径直接安装（同一套 inspect → installBundle 流程） |
| **设置** | 安装源（npm registry）：默认（pnpm 自身配置）、pnpm 当前解析值、host 提供的 fallback 镜像、自定义地址；校验与安装都按所选源 |
| **日志** | 本次会话的安装记录 + 当前/最近一次安装的 pnpm 日志；被 pnpm 拦下的构建脚本会列出并提供「允许构建脚本并重试」 |

### 数据源：为什么是两份

host 半边代理并缓存两份上游数据（渲染进程在 `dsh-app://` 源上，直连会受跨域限制）：`api.dsh-plugin.org/plugins.<lang>.json`（人工精选目录，缓存 `$DSH_HOME/plugin-market/catalog.<lang>.json`，6 小时 TTL）与 `dsh-plugin.org/sitemaps/plugins.xml`（全量索引，缓存 `index.json`，12 小时 TTL）。拉取失败回退旧缓存；索引挂了只降级为精选目录，不影响面板。

上游 `plugins.<lang>.json` 只是**精选子集**，不是全站：2026-10-12 还有 13,680 条，2026-10-19 只剩 4,677 条（`stats.json` 自己也写 `total=4677`），站内仍有 13,000+ 个插件详情页。结果就是**被导出丢掉的插件在面板里搜不到，但官网搜得到**——包括本机自己的三个插件（`wojiao42/dsh-memory-file`、`dsh-token-cost`、`dsh-space-optimizer`）。

（2026-11-08 实测：sitemap 22 页 / 21,438 行，精选目录 6,264 行，合并后 21,580 行、其中 15,316 行仅索引；自家三个插件目前在索引里。）

所以市场页默认走 `scope=all`：host 把精选目录与 sitemap 索引（`/plugins/{owner}/{slug}`）合并后再返回，索引里有、目录里没有的行标成 `v: 'index'`，卡片显示「仅索引」徽标，安装源按 `github:{owner}/{slug}` 推导，详情链接照旧跳官网。精选行优先（有描述、有星标，默认按 Star 排序在前），索引行只补可发现性。索引抓不到时自动退回精选目录（响应头 `x-plugin-market-scope: curated`）。

### 结构

| 文件 | 作用 |
|---|---|
| `cordis.patch.yml` | 往 profile 组合层插入一行 `plugin-market` |
| `index.js` | host 半边：`GET /plugin-market/catalog?lang=zh\|en[&refresh=1][&scope=all]`（目录；`scope=all` = 精选 + sitemap 索引合并）+ `GET /plugin-market/index`（sitemap 的 `owner/slug` 全量索引）+ `GET /plugin-market/stats`（精选统计，给推荐条用）；纯函数 `sitemapLocs` / `pluginPairs` / `mergeCatalog` 供测试直接调用 |
| `client.js` | 客户端半边：左栏面板 `sidebar.panellist` + 主区页面 `main` + 设置分区 `settings.section`（五个页签） |
| `package.json` | `dsh.bundle.patch` + `dsh.client`（platform: web）声明 + `pnpm test` / `pnpm test:live` |
| `test/market.test.mjs` | 离线单测：sitemap 解析、zh/en 去重、目录合并、脏数据容错 |
| `test/routes.test.mjs` | 离线路由测试：假 cordis ctx + 桩 fetch + 临时 `DSH_HOME`，覆盖精简目录 / `scope=all` / 索引路由 / 索引故障降级 / 缓存回退 |
| `test/live-check.mjs` | 联网核对真实上游：sitemap 行数、精选目录行数、合并结果，并断言 `wojiao42/dsh-*` 三个仓库都在索引里 |

## 口径与安全设计

### 为什么不用社区那个 `dsh-plugin` 市场

**不动第三方 bundle**：与社区插件市场 `dsh-plugin` 完全独立（那个插件在桌面端有 profile 误判、安装落到 `web` profile、依赖 `dsh` CLI 等问题，已卸载）。

### 安装不依赖 `dsh` CLI：走官方通道

客户端半边直接调 `ctx.remote.pluginManager`（`inspect` → `installBundle`，启停用 `setBundleEnabled`、卸载用 `removeBundle`），和内置「设置 → 插件」面板走同一条官方通道 —— 兼容性校验、profile 写锁、reconcile、热重载都由官方代码负责，本插件只负责调这几个方法。没有 PATH shim，不猜 profile，也不自己往 profile 里写东西。

## 安装

### 图形界面（桌面端，推荐）

设置（Ctrl+,）→ 插件市场 → 自定义安装 → 填 `github:wojiao42/dsh-plugin-market`。

> 首次安装时这个分区还不存在（它由本插件自己提供），用下面任一种方式先装一次。
> 桌面端的 profile 由应用托管，直接跑 `dsh plugin --profile desktop add` 可能被拒绝，遇到就走上一步。

### 命令行

```sh
# 桌面端（DSH Desktop）
dsh plugin --profile desktop add github:wojiao42/dsh-plugin-market

# 浏览器版（DSH Web）
dsh plugin --profile web add github:wojiao42/dsh-plugin-market
```

装完刷新窗口（Host 半边的新路由要重启 Harness 才加载，见「改完代码怎么生效」）。

### 本地源码开发

推荐直接走界面：插件市场 → 自定义安装 → 填源码目录的绝对路径。

想让 profile 长期指向源码目录，就登记成 pnpm 的 `link:` 协议（`file:` 会把目录复制进 `node_modules`，之后改源码不生效）：

```json
"dependencies": { "dsh-market-panel": "link:<插件目录>" },
"dsh": { "profile": { "bundles": [ "…", "dsh-market-panel" ] } }
```

包名是 `dsh-market-panel`（**不能叫 dsh-plugin-market**：与官方 @deepseek-ai/dsh-plugin-market 撞名，会让官方插件页在启动时失败）。它**不需要发布到 npm**：从 GitHub 或本机路径装即可。

### 改完代码怎么生效

profile 的 `node_modules/dsh-market-panel` 指向源码目录（junction / 符号链接），源码即安装件，**不需要任何同步脚本**。

- `client.js`：宿主按文件版本热更新客户端 bundle，**刷新页面**即可看到新界面。
- `index.js`（host 半边）：**必须重启 Harness** 才加载新路由。

### 卸载

从 profile `package.json` 的 `dsh.profile.bundles` 与 `dependencies` 里去掉，再 `pnpm remove dsh-market-panel`。

## 自测

```powershell
cd <插件目录>
node --check index.js
node --check client.js
node --test test/market.test.mjs test/routes.test.mjs   # 离线 10 条，无需网络
node test/live-check.mjs                                # 联网核对上游数据与三个自家仓库
```

实测（2026-11-08，Windows，Node v24.21.0）：两个 `--check` 无输出、退出码 0；`node --test` 输出 `tests 10 / pass 10 / fail 0`（断言条数即 10 条）。`test/live-check.mjs` **需要联网**（访问 `api.dsh-plugin.org` 与 `dsh-plugin.org` 的 sitemap），当天联网实测通过：sitemap 22 页 / 21,438 行、精选 6,264 行、合并 21,580 行、三个 `wojiao42/dsh-*` 都在索引里，退出码 0。

## 兼容

- **DSH Desktop / DSH Web 都能用**：客户端半侧声明 `platform: web`，注入 `sidebar.panellist`、`main`、`settings.section` 三个插槽；目标 DSH 需要支持组合包（`dsh.bundle.patch`）并提供 `ctx.remote.pluginManager` 的 `inspect` / `installBundle` / `setBundleEnabled` / `removeBundle`，缺一项就不工作。
- **Node**：`package.json` 没有声明 `engines`。Host 半边是纯 ESM，用全局 `fetch`（Node 18+ 才有），没有原生模块、没有构建步骤；本机实测运行时是 Node v24.21.0。
- **平台**：自测在本机 Windows 上跑过，代码里没有平台相关的原生依赖。

## 已知边界

- **索引挂了只降级，不报错**：sitemap 抓不到时市场页退回精选目录（响应头 `x-plugin-market-scope: curated`），「仅索引」的插件这段时间搜不到——也就是上游目录缩水时最缺的那部分。
- **缓存 TTL**：精选目录 6 小时、索引 12 小时、推荐条 `stats` 1 小时。上游下架或改名的插件，最长要等对应 TTL 才消失/更新；面板「刷新」会带 `&refresh=1` 绕过缓存。
- **上游目录本身会缩水**：精选目录是官网导出的一份子集，行数会变（2026-10-12 的 13,680 → 2026-10-19 的 4,677）；靠 sitemap 合并补可发现性，但「仅索引」行没有描述、星标、topics。
- **拉取失败回退旧缓存**：网络不通时用磁盘里上一份缓存；连缓存都没有时市场路由返回 502（带上游原因）。
- **单次上游抓取超时 45 秒**：超时按拉取失败处理（回退旧缓存；没有缓存就 502）。

## 版本

最新在最上。

- **v0.3.1**（2026-11-08）：**本地化命名空间改名** `pluginMarket` → `dshMarketPanel`。真正的启动失败原因在这里：官方 `@deepseek-ai/dsh-client-ui-plugin-market` 的 locale 命名空间也叫 `pluginMarket`，两个插件同时启用时 `ctx.locale.register()` 失败 → 官方插件页在 web 启动阶段激活失败（`web boot: 1 entry did not activate`）。已用「独立 DSH_HOME + dsh web + 无头 Chrome」复现并在修复后复测通过（官方实验性插件市场组合包 + 本插件同时启用 OK）。

- **v0.3.0**（2026-11-08）：**包名改成 `dsh-market-panel`**。原来的 `dsh-plugin-market` 与官方 `@deepseek-ai/dsh-plugin-market` 撞名：两个一起启用时，官方插件页的客户端（`@deepseek-ai/dsh-client-ui-plugin-market`）在 web 启动阶段激活失败，整个界面起不来（`web boot: 1 entry did not activate`）。已用「独立 DSH_HOME + dsh web + 无头 Chrome」复现并验证修复；GitHub 仓库名保持不变，安装命令也不变。

- **v0.2.1**（2026-11-08）：修包名重命名后的客户端模块 id —— `client.js` 里 `__ModuleLoader__.load({ id })` 还写着旧包名 `@local/dsh-plugin-market`，导致 web 启动时 factory 重复注册、整个界面起不来（`web boot: 1 entry did not activate`）。

- **v0.2.0**（2026-11-08）：包名由 `@local/dsh-plugin-market` 改为 `dsh-plugin-market`（可直接从 GitHub 装，不再带 `@local` 前缀）；功能无变化。
- **v0.1.0**（2026-11-08）：首个公开版本：左侧栏 + 设置分区的插件市场面板、五个页签、精选目录与 sitemap 全量索引合并（`scope=all`）、安装 / 启停 / 卸载全部走官方 `pluginManager`。

## 收录状态

**awesome-dsh-plugin**：已投稿 → PR [#13628](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/pull/13628)（2026-11-09 开，CI 全绿，等待维护者合并）。合并前目录里还查不到本插件。

**dsh-plugin.org**：尚未提交（站点没有公开投稿入口），目前站内没有条目。

在两者收录之前，装它只能按上面「安装」里的方式（GitHub / 本机路径 / 插件管理器自定义安装）。

## 许可

MIT，见 `LICENSE`（Copyright (c) 2026 wojiao42）。
