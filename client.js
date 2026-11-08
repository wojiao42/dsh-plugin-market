/**
 * Client half of the local plugin market.
 *
 * Left-sidebar panel (`sidebar.panellist` + `main`) and the Ctrl+, Settings
 * section (`settings.section`) render the same page: browse the dsh-plugin.org
 * catalog, install through the official `pluginManager` remote
 * (inspect → installBundle) — no `dsh` CLI, no PATH shim.
 *
 * Layout mirrors the dsh-plugin.org listing: a featured strip with the site's
 * catalog stats, search + long-form category chips, a segmented sort control
 * with direction toggle, and single-column full-width cards.
 *
 * @module dsh-market-panel/client
 */
window.__ModuleLoader__.load({
  id: 'dsh-market-panel',
  factory: (require) => {
    const React = require('react')
    const h = React.createElement

    /**
 * 本地化命名空间。
 *
 * 不能叫 `pluginMarket`：官方 @deepseek-ai/dsh-client-ui-plugin-market 用的就是这个名字，
 * 两个插件同时启用时 `ctx.locale.register()` 重名注册会抛错 → 官方插件页在启动阶段激活失败
 * （web boot: @deepseek-ai/dsh-client-ui-plugin-market: failed，整个界面起不来）。
 */
const NS = 'dshMarketPanel'
    const PANEL_ID = 'plugin-market'
    const CATALOG_URL = '/plugin-market/catalog'
    const STATS_URL = '/plugin-market/stats'
    const SITE = 'https://dsh-plugin.org/'
    const PAGE_STEP = 30
    const LOG_LIMIT = 400

    /** Category chips keep the site's own order. */
    const CATEGORY_ORDER = ['interface', 'session', 'memory', 'tools', 'agent', 'workflow', 'integration', 'model', 'dev', 'knowledge', 'fun']

    /** Sort keys mirror the site listing: stars / forks / updated / newest. */
    const SORTS = [
      { key: 'stars', label: 'sort.stars', value: (entry) => (typeof entry?.sg === 'number' ? entry.sg : 0), defaultDir: 'desc' },
      { key: 'forks', label: 'sort.forks', value: (entry) => (typeof entry?.fk === 'number' ? entry.fk : 0), defaultDir: 'desc' },
      { key: 'updated', label: 'sort.updated', value: (entry) => String(entry?.u ?? ''), defaultDir: 'desc' },
      { key: 'newest', label: 'sort.newest', value: (entry) => String(entry?.a ?? ''), defaultDir: 'desc' },
    ]

    const ZH = {
      panel: '插件市场',
      title: '社区插件市场',
      intro: '目录来自 dsh-plugin.org；安装走 Harness 官方插件管理器，直接写入当前 profile。',
      cached: '缓存副本',
      'tab.market': '市场',
      'tab.installed': '已安装',
      'tab.custom': '自定义安装',
      'tab.settings': '设置',
      'tab.logs': '日志',
      'banner.badge': '推荐',
      'banner.text': 'DSH 插件市场：收录 {total} 款插件，{verified} 款人工精选验证，每日更新',
      'banner.site': '前往官网',
      search: '搜索插件名称、作者、描述、标签…',
      'chip.all': '全部',
      'sort.stars': 'Star',
      'sort.forks': 'Fork',
      'sort.updated': '最近更新',
      'sort.newest': '最新收录',
      'sort.aria': '插件排序方式',
      results: '共 {count} 条结果',
      fork: 'Fork {count}',
      loading: '正在读取…',
      loadFailed: '目录读取失败：{reason}',
      empty: '没有匹配的插件。',
      more: '显示更多',
      refresh: '刷新',
      detail: '详情',
      install: '安装',
      installing: '安装中…',
      installed: '已安装',
      update: '可更新',
      copy: '复制命令',
      copied: '已复制',
      cancel: '取消',
      canceling: '正在取消…',
      checking: '正在校验 {spec} …',
      'phase.installing': '正在安装（第 {attempt} 个安装源）…',
      log: '安装日志',
      close: '关闭',
      'version.catalog': '目录版本',
      'version.installed': '已装版本',
      verified: '已验证',
      indexOnly: '仅索引',
      indexOnlyHint: '目录导出里没有这一条的摘要，点「详情」去官网看全文。',
      allowBuilds: '允许构建脚本并重试',
      buildHint: '以下构建脚本被 pnpm 拦下，确认可信后可放行重试：',
      noManager: '宿主没有可管理的 profile：官方插件管理器不可用。',
      spec: '安装源',
      'result.installed': '已安装并启用。',
      'result.restart': '已安装，重启 Harness 后生效。',
      'result.cancelled': '已取消。',
      'result.failed': '安装失败：{reason}',
      'problem.invalid-spec': '这个包名/地址无法识别：{reason}',
      'problem.already-installed': '该插件已安装：{reason}',
      'problem.not-a-bundle': '这个包没有声明组合包，不能作为插件安装：{reason}',
      'problem.not-a-package': '路径不存在或不是有效的插件包：{reason}',
      'problem.incompatible-version': '与当前 Harness 版本不兼容：{reason}',
      'problem.unknown': '无法安装：{reason}',
      'installed.title': '当前 profile 的插件',
      'installed.empty': '没有已安装的插件。',
      'installed.enabled': '已启用',
      'installed.disabled': '已停用',
      'installed.optional': '官方可选',
      'installed.official': '官方',
      'installed.local': '本地',
      'installed.thirdParty': '第三方',
      'installed.enable': '启用',
      'installed.disable': '停用',
      'installed.remove': '卸载',
      'installed.removeConfirm': '确认卸载',
      'installed.removeHint': '卸载会从 profile 移除该插件包（修改 package.json / bundles）。停用只影响加载，不删包。',
      'installed.failed': '异常',
      'installed.busy': '处理中…',
      'custom.title': '安装任意插件',
      'custom.hint': '支持 npm 包名、GitHub 仓库（github:owner/repo 或 https://github.com/owner/repo）、本机绝对路径。',
      'custom.placeholder': '例如 @liustack/modlens 或 github:owner/dsh-plugin',
      'custom.run': '安装',
      'settings.title': '安装源（npm registry）',
      'settings.hint': '留空使用 pnpm 自己的配置；校验与安装都按这里选择。',
      'settings.default': '默认安装源',
      'settings.resolved': 'pnpm 当前解析：{url}',
      'settings.reload': '重新读取',
      'settings.custom': '自定义地址',
      'settings.customPlaceholder': 'https://npm.example.com/',
      'logs.empty': '本次会话还没有安装记录。',
      'logs.clear': '清空',
      'components': '组件 {count}',
      'cat.interface': '界面与体验',
      'cat.session': '会话与消息',
      'cat.memory': '记忆与上下文',
      'cat.tools': '工具与能力',
      'cat.agent': '技能与智能体',
      'cat.workflow': '工作流与自动化',
      'cat.integration': '集成与连接',
      'cat.model': '模型与推理',
      'cat.dev': '开发与运维',
      'cat.knowledge': '数据与知识',
      'cat.fun': '娱乐',
      'catShort.interface': '界面体验',
      'catShort.session': '会话消息',
      'catShort.memory': '记忆上下文',
      'catShort.tools': '工具能力',
      'catShort.agent': '技能智能体',
      'catShort.workflow': '工作流',
      'catShort.integration': '集成连接',
      'catShort.model': '模型推理',
      'catShort.dev': '开发运维',
      'catShort.knowledge': '数据知识',
      'catShort.fun': '娱乐',
    }

    const EN = {
      panel: 'Plugin market',
      title: 'Community plugin market',
      intro: 'Catalog from dsh-plugin.org; installs go through the official Harness plugin manager into this profile.',
      cached: 'stale cache',
      'tab.market': 'Market',
      'tab.installed': 'Installed',
      'tab.custom': 'Custom install',
      'tab.settings': 'Settings',
      'tab.logs': 'Logs',
      'banner.badge': 'Featured',
      'banner.text': 'DSH plugin market: {total} plugins collected, {verified} hand-picked and verified, updated daily',
      'banner.site': 'Visit site',
      search: 'Search name, author, description, tags…',
      'chip.all': 'All',
      'sort.stars': 'Star',
      'sort.forks': 'Fork',
      'sort.updated': 'Recently updated',
      'sort.newest': 'Newest added',
      'sort.aria': 'Plugin sort order',
      results: '{count} results',
      fork: 'Fork {count}',
      loading: 'Loading…',
      loadFailed: 'Could not load the catalog: {reason}',
      empty: 'No matching plugins.',
      more: 'Show more',
      refresh: 'Refresh',
      detail: 'Details',
      install: 'Install',
      installing: 'Installing…',
      installed: 'Installed',
      update: 'Update',
      copy: 'Copy command',
      copied: 'Copied',
      cancel: 'Cancel',
      canceling: 'Cancelling…',
      checking: 'Checking {spec} …',
      'phase.installing': 'Installing (source {attempt})…',
      log: 'Install log',
      close: 'Close',
      'version.catalog': 'Catalog version',
      'version.installed': 'Installed version',
      verified: 'Verified',
      indexOnly: 'Index only',
      indexOnlyHint: 'The catalog export carries no summary for this row; open “Details” on the site.',
      allowBuilds: 'Allow build scripts and retry',
      buildHint: 'pnpm blocked these build scripts; allow them and retry if you trust the package:',
      noManager: 'The host exposes no managed profile: the official plugin manager is unavailable.',
      spec: 'Source',
      'result.installed': 'Installed and enabled.',
      'result.restart': 'Installed; restart Harness to apply.',
      'result.cancelled': 'Cancelled.',
      'result.failed': 'Install failed: {reason}',
      'problem.invalid-spec': 'Unrecognized package name or address: {reason}',
      'problem.already-installed': 'Already installed: {reason}',
      'problem.not-a-bundle': 'This package declares no bundle patch: {reason}',
      'problem.not-a-package': 'Missing or invalid plugin package: {reason}',
      'problem.incompatible-version': 'Incompatible with this Harness version: {reason}',
      'problem.unknown': 'Cannot install: {reason}',
      'installed.title': 'Plugins in this profile',
      'installed.empty': 'No plugins installed.',
      'installed.enabled': 'Enabled',
      'installed.disabled': 'Disabled',
      'installed.optional': 'Official optional',
      'installed.official': 'Official',
      'installed.local': 'Local',
      'installed.thirdParty': 'Third-party',
      'installed.enable': 'Enable',
      'installed.disable': 'Disable',
      'installed.remove': 'Uninstall',
      'installed.removeConfirm': 'Confirm uninstall',
      'installed.removeHint': 'Uninstalling removes the package from this profile (package.json / bundles). Disabling only affects loading.',
      'installed.failed': 'Failed',
      'installed.busy': 'Working…',
      'custom.title': 'Install any plugin',
      'custom.hint': 'Accepts an npm package, a GitHub repository (github:owner/repo or https://github.com/owner/repo), or a local absolute path.',
      'custom.placeholder': 'e.g. @liustack/modlens or github:owner/dsh-plugin',
      'custom.run': 'Install',
      'settings.title': 'Install source (npm registry)',
      'settings.hint': 'Empty uses pnpm’s own configuration; inspection and installation both follow this choice.',
      'settings.default': 'Default source',
      'settings.resolved': 'pnpm currently resolves: {url}',
      'settings.reload': 'Reload',
      'settings.custom': 'Custom address',
      'settings.customPlaceholder': 'https://npm.example.com/',
      'logs.empty': 'No install activity in this session yet.',
      'logs.clear': 'Clear',
      'components': '{count} components',
      'cat.interface': 'UI & Experience',
      'cat.session': 'Sessions & Messages',
      'cat.memory': 'Memory & Context',
      'cat.tools': 'Tools & Capabilities',
      'cat.agent': 'Skills & Agents',
      'cat.workflow': 'Workflow & Automation',
      'cat.integration': 'Integrations & Connections',
      'cat.model': 'Models & Reasoning',
      'cat.dev': 'Development & Operations',
      'cat.knowledge': 'Data & Knowledge',
      'cat.fun': 'Entertainment',
      'catShort.interface': 'UI Exp',
      'catShort.session': 'Sessions',
      'catShort.memory': 'Memory',
      'catShort.tools': 'Tools',
      'catShort.agent': 'Agents',
      'catShort.workflow': 'Workflow',
      'catShort.integration': 'Integrations',
      'catShort.model': 'Models',
      'catShort.dev': 'Dev',
      'catShort.knowledge': 'Knowledge',
      'catShort.fun': 'Fun',
    }

    const CSS = [
      // 页面骨架：整页可滚，内容居中
      '.pm-root{box-sizing:border-box;height:100%;min-height:0;display:flex;flex-direction:column;overflow:auto;',
      'color:var(--dsw-alias-label-primary);padding:0 clamp(20px,3vw,40px) 40px}',
      '.pm-root>*{width:100%;max-width:900px;margin:0 auto}',
      '.pm-head{display:flex;flex-direction:column;gap:2px;padding-top:22px}',
      '.pm-headRow{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}',
      '.pm-title{margin:0;font-size:17px;font-weight:600;line-height:26px}',
      '.pm-intro{margin:0;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}',
      '.pm-meta{color:var(--dsw-alias-label-caption,var(--dsw-alias-label-tertiary));font-size:11px;line-height:16px;white-space:nowrap}',
      // 主分段导航
      '.pm-tabs{display:flex;align-items:center;gap:4px;padding:10px 0 8px;flex-wrap:wrap}',
      '.pm-tab{box-sizing:border-box;height:28px;padding:0 12px;border-radius:999px;border:.5px solid transparent;background:0 0;',
      'color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;line-height:26px;cursor:pointer}',
      '.pm-tab:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}',
      '.pm-tab[data-active="true"]{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary);font-weight:500}',
      // 推荐条
      '.pm-banner{display:flex;align-items:center;gap:10px;border:.5px solid var(--dsw-alias-border-l2);border-radius:8px;',
      'background:var(--dsw-alias-bg-layer-2);padding:8px 12px;margin:2px 0 10px}',
      '.pm-bannerBadge{flex:none;border-radius:4px;padding:0 6px;font-size:10px;line-height:16px;font-weight:500;',
      'color:var(--dsw-alias-state-business-primary);border:.5px solid var(--dsw-alias-state-business-primary);}',
      '.pm-bannerText{flex:1 1 auto;min-width:0;color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}',
      '.pm-bannerLink{flex:none;color:var(--dsw-alias-state-business-primary);font-size:12px;line-height:18px;text-decoration:none}',
      '.pm-bannerLink:hover{text-decoration:underline}',
      // 搜索 + 分类 chip + 控制行
      '.pm-input{box-sizing:border-box;width:100%;height:30px;padding:0 10px;border-radius:6px;border:.5px solid var(--dsw-alias-input-border);',
      'background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:12px}',
      '.pm-chips{display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:10px 0 0}',
      '.pm-chip{box-sizing:border-box;display:inline-flex;align-items:center;gap:5px;height:24px;padding:0 9px;border-radius:999px;',
      'border:.5px solid var(--dsw-alias-border-l2);background:0 0;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;',
      'line-height:22px;cursor:pointer;white-space:nowrap}',
      '.pm-chip:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}',
      '.pm-chip[data-active="true"]{border-color:var(--dsw-alias-state-business-primary);color:var(--dsw-alias-state-business-primary);',
      'background:color-mix(in srgb, var(--dsw-alias-state-business-primary) 10%, transparent)}',
      '.pm-chipCount{color:var(--dsw-alias-label-caption,var(--dsw-alias-label-tertiary));font-size:10px;line-height:1}',
      '.pm-controls{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:10px 0 6px}',
      '.pm-results{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;font-variant-numeric:tabular-nums}',
      '.pm-seg{display:flex;align-items:center;gap:4px}',
      '.pm-segLabel{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px}',
      '.pm-segGroup{display:inline-flex;align-items:center;gap:2px;border:.5px solid var(--dsw-alias-border-l2);border-radius:999px;padding:2px}',
      '.pm-segBtn{box-sizing:border-box;display:inline-flex;align-items:center;gap:3px;height:22px;padding:0 9px;border-radius:999px;border:0;',
      'background:0 0;color:var(--dsw-alias-label-secondary);font:inherit;font-size:11px;line-height:22px;cursor:pointer;white-space:nowrap}',
      '.pm-segBtn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}',
      '.pm-segBtn[data-active="true"]{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary);font-weight:500}',
      // 单列全宽卡片（对齐官网列表）
      '.pm-list{display:flex;flex-direction:column;gap:6px;padding:2px 0 0}',
      '.pm-card{display:flex;align-items:stretch;justify-content:space-between;gap:12px;border:.5px solid var(--dsw-alias-border-l2);',
      'border-radius:8px;padding:9px 12px;background:var(--dsw-alias-bg-layer-2);transition:border-color 120ms ease,background 120ms ease}',
      '.pm-card:hover{border-color:var(--dsw-alias-state-business-primary);background:var(--dsw-alias-interactive-bg-hover)}',
      '.pm-cardMain{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:4px}',
      '.pm-cardHead{display:flex;align-items:center;gap:6px;min-width:0;flex-wrap:wrap}',
      '.pm-cardTitle{font-size:13px;line-height:18px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}',
      '.pm-badge{flex:none;font-size:10px;line-height:16px;border-radius:4px;padding:0 6px;border:.5px solid transparent;',
      'color:var(--dsw-alias-label-secondary)}',
      '.pm-badgeCategory{color:var(--dsw-alias-state-business-primary);border-color:var(--dsw-alias-state-business-primary)}',
      '.pm-badgeVerified{color:var(--dsw-alias-state-success-primary);border-color:var(--dsw-alias-state-success-primary)}',
      '.pm-badgeVersion{color:var(--dsw-alias-label-secondary);border-color:var(--dsw-alias-border-l2);font-variant-numeric:tabular-nums}',
      '.pm-badgeUpdate{color:var(--dsw-alias-state-warn-primary,var(--dsw-alias-state-business-primary));',
      'border-color:var(--dsw-alias-state-warn-primary,var(--dsw-alias-state-business-primary));',
      'background:color-mix(in srgb, var(--dsw-alias-state-warn-primary,var(--dsw-alias-state-business-primary)) 10%, transparent)}',
      '.pm-badgeKind{color:var(--dsw-alias-label-tertiary);border-color:var(--dsw-alias-border-l2);',
      'font-family:ui-monospace,SFMono-Regular,Menlo,monospace}',
      '.pm-desc{margin:0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);display:-webkit-box;',
      '-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}',
      '.pm-features{margin:0;padding-left:15px;font-size:11px;line-height:17px;color:var(--dsw-alias-label-tertiary)}',
      '.pm-features li{margin:0}',
      '.pm-topics{display:flex;align-items:center;gap:4px;flex-wrap:wrap;min-width:0}',
      '.pm-topic{flex:none;font-size:10px;line-height:16px;color:var(--dsw-alias-label-tertiary);',
      'background:var(--dsw-alias-interactive-bg-hover);border-radius:4px;padding:0 6px;white-space:nowrap}',
      '.pm-cardSide{flex:none;display:flex;flex-direction:column;align-items:flex-end;justify-content:space-between;gap:6px}',
      '.pm-stats{display:flex;flex-direction:column;align-items:flex-end;gap:1px}',
      '.pm-star{font-size:11px;line-height:16px;color:var(--dsw-alias-state-warn-primary,var(--dsw-alias-state-business-primary));white-space:nowrap}',
      '.pm-fork{font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary);white-space:nowrap}',
      '.pm-date{font-size:10px;line-height:14px;color:var(--dsw-alias-label-caption,var(--dsw-alias-label-tertiary));white-space:nowrap}',
      '.pm-actions{display:flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:flex-end}',
      // 按钮（小号，对齐官网）
      '.pm-btn{box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;gap:4px;font-size:11px;line-height:18px;',
      'border-radius:6px;padding:2px 10px;cursor:pointer;border:.5px solid var(--dsw-alias-border-l2);background:0 0;',
      'color:var(--dsw-alias-label-secondary);font-family:inherit;white-space:nowrap;text-decoration:none}',
      '.pm-btn:hover{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-label-tertiary)}',
      '.pm-btn[disabled]{opacity:.55;cursor:default}',
      '.pm-btnPrimary{color:#fff;background:var(--dsw-alias-label-primary);border-color:transparent;font-weight:500}',
      '.pm-btnPrimary:hover{color:#fff;opacity:.88}',
      '.pm-btnUpdate{color:#fff;background:var(--dsw-alias-state-warn-primary,var(--dsw-alias-state-business-primary));border-color:transparent;font-weight:500}',
      '.pm-btnInstalled{color:var(--dsw-alias-state-success-primary);border-color:transparent;cursor:default;user-select:none;',
      'background:color-mix(in srgb, var(--dsw-alias-state-success-primary) 12%, transparent)}',
      '.pm-btnDanger{color:var(--dsw-alias-state-danger-primary);border-color:transparent;',
      'background:color-mix(in srgb, var(--dsw-alias-state-danger-primary) 12%, transparent)}',
      '.pm-btnDanger:hover{color:#fff;background:var(--dsw-alias-state-danger-primary);border-color:transparent}',
      '.pm-btnGhost{border-color:transparent}',
      // 安装面板 / 状态
      '.pm-panel{border:.5px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-2);',
      'padding:10px 12px;margin:2px 0 8px;display:flex;flex-direction:column;gap:6px}',
      '.pm-panelHead{display:flex;align-items:center;justify-content:space-between;gap:12px}',
      '.pm-pre{margin:0;max-height:220px;overflow:auto;white-space:pre-wrap;word-break:break-all;background:var(--dsw-alias-bg-base);',
      'border-radius:6px;padding:8px;color:var(--dsw-alias-label-secondary);font-size:11px;line-height:16px;',
      'font-family:ui-monospace,SFMono-Regular,Menlo,monospace}',
      '.pm-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
      '.pm-note{margin:0;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}',
      '.pm-status{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;padding:4px 0;margin:0}',
      '.pm-error{color:var(--dsw-alias-state-danger-primary)}',
      // 已安装列表 / 表单
      '.pm-installed{display:flex;flex-direction:column;gap:6px;padding:4px 0 0}',
      '.pm-installedRow{border:.5px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-2);',
      'padding:9px 12px;display:flex;gap:12px;align-items:flex-start;justify-content:space-between}',
      '.pm-installedMain{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:4px}',
      '.pm-installedSide{flex:none;display:flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:flex-end}',
      '.pm-form{display:flex;flex-direction:column;gap:8px;padding:6px 0 0;max-width:760px}',
      '.pm-radio{display:flex;align-items:center;gap:8px;font-size:12px;line-height:20px}',
    ].join('')

    /* ------------------------------------------------------------------ helpers */

    /** Localized text with `{name}` interpolation. */
    function fill(text, values) {
      return String(text).replace(/\{(\w+)\}/g, (whole, token) => (token in values ? String(values[token]) : whole))
    }

    /** Localized category label, falling back to the raw key. */
    function categoryText(t, key, short) {
      const lookup = `${short ? 'catShort' : 'cat'}.${key}`
      const text = t(lookup)
      return text === lookup ? key : text
    }

    /** Install spec for one catalog row: npm package first, then GitHub, then the published command. */
    function specOf(entry) {
      const repo = entry === null || typeof entry !== 'object' ? undefined : entry.r
      if (repo !== null && typeof repo === 'object') {
        if (typeof repo.npmPackage === 'string' && repo.npmPackage.length > 0) return repo.npmPackage
        if (typeof repo.repo === 'string' && repo.repo.length > 0) return `github:${repo.repo}`
      }
      if (typeof repo === 'string' && repo.length > 0) return `github:${repo}`
      const command = typeof entry?.igc === 'string' ? entry.igc : entry?.ic
      if (typeof command === 'string') {
        const match = /^dsh\s+plugin\s+--profile\s+\S+\s+add\s+(.+)$/i.exec(command.trim())
        if (match !== null) return match[1].trim()
      }
      return typeof entry?.n === 'string' ? entry.n : ''
    }

    /** `npm`, `git` or `path` badge for one spec. */
    function kindOf(spec) {
      if (spec.startsWith('github:') || spec.startsWith('git+') || spec.startsWith('http')) return 'git'
      if (spec.startsWith('.') || spec.startsWith('/') || /^[A-Za-z]:[\\/]/.test(spec)) return 'path'
      return 'npm'
    }

    /** GitHub `owner/repo` of one catalog row, when known. */
    function repoOf(entry) {
      const repo = entry === null || typeof entry !== 'object' ? undefined : entry.r
      if (typeof repo === 'string' && repo.length > 0) return repo
      if (repo !== null && typeof repo === 'object' && typeof repo.repo === 'string' && repo.repo.length > 0) return repo.repo
      return null
    }

    /** Public detail page on dsh-plugin.org (Chinese pages live under /zh/). */
    function detailUrl(entry, lang) {
      const repo = repoOf(entry) ?? ''
      const owner = typeof entry?.o === 'string' && entry.o.length > 0 ? entry.o.toLowerCase() : String(repo.split('/')[0] ?? '').toLowerCase()
      const slug = String(entry?.s ?? entry?.n ?? '')
      const prefix = lang === 'en' ? '' : 'zh/'
      return `${SITE}${prefix}plugins/${owner}/${slug}?ref=hub`
    }

    /** Stable identity for React keys. */
    function keyOf(entry) {
      return String(entry?.s ?? entry?.n ?? specOf(entry))
    }

    /** 1234 → 1.2k. */
    function fmtStars(value) {
      const n = typeof value === 'number' ? value : 0
      if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`
      return String(n)
    }

    /** Relative time in the active language. */
    function relTime(iso, lang) {
      const then = Date.parse(String(iso ?? ''))
      if (!Number.isFinite(then)) return ''
      const seconds = Math.max(0, Math.round((Date.now() - then) / 1000))
      const table = lang === 'en'
        ? [[31536000, 'y'], [2592000, 'mo'], [604800, 'w'], [86400, 'd'], [3600, 'h'], [60, 'min']]
        : [[31536000, '年'], [2592000, '个月'], [604800, '周'], [86400, '天'], [3600, '小时'], [60, '分钟']]
      for (const [size, unit] of table) {
        const count = Math.floor(seconds / size)
        if (count >= 1) return lang === 'en' ? `${count}${unit} ago` : `${count}${unit}前`
      }
      return lang === 'en' ? 'just now' : '刚刚'
    }

    /** Version without a leading v, for comparing catalog and installed versions. */
    function plainVersion(value) {
      return typeof value === 'string' ? value.replace(/^v/i, '') : ''
    }

    /** Copy text, tolerating a missing clipboard API. */
    async function copyText(text) {
      try {
        if (navigator?.clipboard?.writeText !== undefined) {
          await navigator.clipboard.writeText(text)
          return true
        }
      } catch {
        // fall through to the legacy path
      }
      try {
        const area = document.createElement('textarea')
        area.value = text
        area.setAttribute('readonly', '')
        area.style.position = 'fixed'
        area.style.opacity = '0'
        document.body.appendChild(area)
        area.select()
        const ok = document.execCommand('copy')
        document.body.removeChild(area)
        return ok
      } catch {
        return false
      }
    }

    /** Registry to hand to the host, or null for pnpm's own configuration. */
    function registryFromState(state) {
      if (state?.choice === 'custom') {
        const url = String(state.custom ?? '').trim()
        return url.length === 0 ? null : url
      }
      if (typeof state?.choice === 'string' && state.choice.startsWith('fallback:')) return state.choice.slice('fallback:'.length)
      if (typeof state?.choice === 'string' && state.choice.startsWith('configured:')) return state.choice.slice('configured:'.length)
      return null
    }

    /* --------------------------------------------------------------- components */

    /** Sidebar glyph: a small storefront. */
    function MarketIcon({ size = 16 }) {
      return h(
        'svg',
        {
          width: size,
          height: size,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.6,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
        },
        h('path', { d: 'M3.5 9 5 4h14l1.5 5' }),
        h('path', { d: 'M4.5 9v10h15V9' }),
        h('path', { d: 'M9.5 19v-5.5h5V19' }),
      )
    }

    /** Sort direction arrow. */
    function SortArrow({ up }) {
      return h(
        'svg',
        { width: 10, height: 10, viewBox: '0 0 12 12', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, 'aria-hidden': true },
        up ? h('path', { d: 'M6 10V2M3 5l3-3 3 3' }) : h('path', { d: 'M6 2v8M3 7l3 3 3-3' }),
      )
    }

    /** One catalog card: a full-width row like the site listing. */
    function Card({ entry, t, lang, installed, hasUpdate, busy, onInstall, onCopy }) {
      const spec = specOf(entry)
      const repo = repoOf(entry)
      const version = typeof entry.vr === 'string' ? entry.vr : ''
      const installedVersion = installed === null || installed === undefined ? '' : plainVersion(installed.version)
      const topics = Array.isArray(entry.t) ? entry.t.slice(0, 4) : []
      const features = Array.isArray(entry.f) ? entry.f.slice(0, 2) : []
      const stars = typeof entry.sg === 'number' ? entry.sg : 0
      const forks = typeof entry.fk === 'number' ? entry.fk : 0
      const isInstalled = installed !== null && installed !== undefined
      const category = typeof entry.c === 'string' ? entry.c : ''

      return h(
        'article',
        { className: 'pm-card', 'data-plugin-market': keyOf(entry) },
        h(
          'div',
          { className: 'pm-cardMain' },
          h(
            'div',
            { className: 'pm-cardHead' },
            h('span', { className: 'pm-cardTitle', title: String(entry.n ?? spec) }, String(entry.n ?? spec)),
            version.length > 0 ? h('span', { className: 'pm-badge pm-badgeVersion', title: t('version.catalog') }, version) : null,
            isInstalled && installedVersion.length > 0
              ? h('span', { className: 'pm-badge pm-badgeVersion', title: t('version.installed') }, `${t('installed')} ${installedVersion}`)
              : null,
            hasUpdate ? h('span', { className: 'pm-badge pm-badgeUpdate' }, t('update')) : null,
            category.length > 0 ? h('span', { className: 'pm-badge pm-badgeCategory' }, categoryText(t, category, false)) : null,
            entry.v === 'verified' ? h('span', { className: 'pm-badge pm-badgeVerified' }, t('verified')) : null,
            entry.v === 'index' ? h('span', { className: 'pm-badge pm-badgeCategory', title: t('indexOnlyHint') }, t('indexOnly')) : null,
            h('span', { className: 'pm-badge pm-badgeKind' }, kindOf(spec)),
          ),
          typeof entry.d === 'string' && entry.d.length > 0 ? h('p', { className: 'pm-desc', title: entry.d }, entry.d) : null,
          features.length > 0
            ? h('ul', { className: 'pm-features' }, features.map((feature) => h('li', { key: String(feature) }, String(feature))))
            : null,
          topics.length > 0
            ? h('div', { className: 'pm-topics' }, topics.map((topic) => h('span', { className: 'pm-topic', key: String(topic) }, String(topic))))
            : null,
        ),
        h(
          'div',
          { className: 'pm-cardSide' },
          h(
            'div',
            { className: 'pm-stats' },
            h('span', { className: 'pm-star', title: 'stars' }, `★ ${fmtStars(stars)}`),
            forks > 0 ? h('span', { className: 'pm-fork', title: 'forks' }, t('fork').replace('{count}', fmtStars(forks))) : null,
            relTime(entry.u, lang) !== '' ? h('span', { className: 'pm-date', title: String(entry.u) }, relTime(entry.u, lang)) : null,
          ),
          h(
            'div',
            { className: 'pm-actions' },
            repo !== null || (typeof entry.o === 'string' && entry.o.length > 0 && typeof entry.s === 'string')
              ? h('a', { className: 'pm-btn pm-btnGhost', href: detailUrl(entry, lang), target: '_blank', rel: 'noopener noreferrer' }, t('detail'))
              : null,
            isInstalled
              ? hasUpdate
                ? h(
                    'button',
                    { type: 'button', className: 'pm-btn pm-btnUpdate', disabled: busy, onClick: () => onInstall(entry) },
                    busy ? t('installing') : t('update'),
                  )
                : h('button', { type: 'button', className: 'pm-btn pm-btnInstalled', disabled: true }, t('installed'))
              : h(
                  'button',
                  {
                    type: 'button',
                    className: 'pm-btn pm-btnPrimary',
                    disabled: busy || spec.length === 0,
                    title: spec,
                    onClick: () => onInstall(entry),
                  },
                  busy ? t('installing') : t('install'),
                ),
            h('button', { type: 'button', className: 'pm-btn pm-btnGhost', title: `pnpm add ${spec}`, onClick: () => onCopy(spec) }, t('copy')),
          ),
        ),
      )
    }

    /** One row of the installed list, with the official enable/disable/remove calls. */
    function InstalledRow({ row, t, busy, confirming, onToggle, onRemove, onConfirm }) {
      const name = String(row.name ?? '')
      const official = name.startsWith('@deepseek-ai/')
      const local = name.startsWith('@local/')
      const origin = official ? t('installed.official') : local ? t('installed.local') : t('installed.thirdParty')
      const components = Array.isArray(row.rows) ? row.rows.length : 0
      return h(
        'div',
        { className: 'pm-installedRow', 'data-plugin-market-installed': name },
        h(
          'div',
          { className: 'pm-installedMain' },
          h(
            'div',
            { className: 'pm-cardHead' },
            h('span', { className: 'pm-cardTitle' }, name),
            typeof row.version === 'string' && row.version.length > 0 ? h('span', { className: 'pm-badge pm-badgeVersion' }, row.version) : null,
            h('span', { className: 'pm-badge pm-badgeKind' }, origin),
            row.optional === true ? h('span', { className: 'pm-badge pm-badgeKind' }, t('installed.optional')) : null,
            h('span', { className: row.enabled === true ? 'pm-badge pm-badgeVerified' : 'pm-badge pm-badgeKind' }, row.enabled === true ? t('installed.enabled') : t('installed.disabled')),
            row.error !== undefined ? h('span', { className: 'pm-badge pm-badgeUpdate' }, t('installed.failed')) : null,
          ),
          typeof row.description === 'string' && row.description.length > 0 ? h('p', { className: 'pm-desc' }, row.description) : null,
          components > 0 ? h('p', { className: 'pm-note' }, t('components').replace('{count}', String(components))) : null,
        ),
        h(
          'div',
          { className: 'pm-installedSide' },
          busy
            ? h('span', { className: 'pm-note' }, t('installed.busy'))
            : h(
                'button',
                {
                  type: 'button',
                  className: 'pm-btn',
                  disabled: row.readOnlyReason !== undefined,
                  onClick: () => onToggle(row, row.enabled !== true),
                },
                row.enabled === true ? t('installed.disable') : t('installed.enable'),
              ),
          row.removable === true
            ? h(
                'button',
                {
                  type: 'button',
                  className: 'pm-btn pm-btnDanger',
                  title: t('installed.removeHint'),
                  onClick: () => (confirming ? onRemove(row) : onConfirm(name)),
                },
                confirming ? t('installed.removeConfirm') : t('installed.remove'),
              )
            : null,
        ),
      )
    }

    /**
     * The market page.
     * @param props - slot props: `t` (bound dictionary) and `ctx` (client context).
     */
    function MarketPage(props) {
      const t = typeof props.t === 'function' ? props.t : (key) => key
      const ctx = props.ctx
      const tr = React.useCallback((key, values) => fill(t(key), values ?? {}), [t])
      const lang = React.useMemo(() => {
        try {
          const active = ctx?.locale?.getSnapshot?.()?.active
          if (typeof active === 'string' && active.toLowerCase().startsWith('en')) return 'en'
        } catch {
          // fall back to the Chinese catalog
        }
        return 'zh'
      }, [ctx])

      const [tab, setTab] = React.useState('market')
      const [catalog, setCatalog] = React.useState({ phase: 'loading', items: [], fetchedAt: 0, stale: false, error: null })
      const [stats, setStats] = React.useState(null)
      const [bundles, setBundles] = React.useState({ phase: 'loading', rows: [], error: null })
      const [query, setQuery] = React.useState('')
      const [category, setCategory] = React.useState('')
      const [sort, setSort] = React.useState({ key: 'stars', dir: 'desc' })
      const [visible, setVisible] = React.useState(PAGE_STEP)
      const [install, setInstall] = React.useState(null)
      const [history, setHistory] = React.useState([])
      const [registry, setRegistry] = React.useState({ phase: 'idle', value: null, custom: '', choice: 'default', error: null })
      const [customSpec, setCustomSpec] = React.useState('')
      const [busyName, setBusyName] = React.useState(null)
      const [confirmRemove, setConfirmRemove] = React.useState(null)
      const [toast, setToast] = React.useState(null)

      /* ------------------------------------------------------------ data reads */

      const loadCatalog = React.useCallback(
        async (refresh) => {
          setCatalog((current) => ({ ...current, phase: 'loading', error: null }))
          try {
            // scope=all: the curated export merged with the sitemap index, so
            // plugins the export dropped stay searchable (see host index.js).
            const suffix = refresh ? `?lang=${lang}&refresh=1&scope=all` : `?lang=${lang}&scope=all`
            const response = await fetch(`${CATALOG_URL}${suffix}`, { cache: 'no-store' })
            if (!response.ok) {
              let detail = `HTTP ${response.status}`
              try {
                const problem = await response.json()
                if (typeof problem?.error === 'string') detail = problem.error
              } catch {
                // keep the status text
              }
              throw new Error(detail)
            }
            const items = await response.json()
            if (!Array.isArray(items)) throw new Error('unexpected catalog shape')
            setCatalog({
              phase: 'ready',
              items,
              fetchedAt: Number(response.headers.get('x-plugin-market-fetched-at') ?? 0),
              stale: response.headers.get('x-plugin-market-stale') === '1',
              error: null,
            })
          } catch (error) {
            setCatalog((current) => ({ ...current, phase: 'error', error: String(error?.message ?? error) }))
          }
        },
        [lang],
      )

      const loadStats = React.useCallback(async () => {
        try {
          const response = await fetch(STATS_URL, { cache: 'no-store' })
          if (!response.ok) return
          const value = await response.json()
          if (value === null || typeof value !== 'object') return
          if (typeof value.total !== 'number' || typeof value.verified !== 'number') return
          setStats({ total: value.total, verified: value.verified, fetchedAt: Number(value.fetchedAt ?? 0) })
        } catch {
          // the banner falls back to counts computed from the catalog
        }
      }, [])

      const loadInstalled = React.useCallback(async () => {
        const manager = ctx?.remote?.pluginManager
        if (manager === undefined) {
          setBundles({ phase: 'error', rows: [], error: 'plugin manager unavailable' })
          return
        }
        setBundles((current) => ({ ...current, phase: 'loading' }))
        try {
          const result = await manager.listBundles()
          if (result?.ok !== true) {
            setBundles({ phase: 'error', rows: [], error: String(result?.error?.message ?? 'listBundles failed') })
            return
          }
          const rows = Array.isArray(result.value) ? result.value.filter((row) => row.installed === true || row.enabled === true) : []
          setBundles({ phase: 'ready', rows, error: null })
        } catch (error) {
          setBundles({ phase: 'error', rows: [], error: String(error?.message ?? error) })
        }
      }, [ctx])

      const loadRegistries = React.useCallback(async () => {
        const manager = ctx?.remote?.pluginManager
        if (manager === undefined) return
        setRegistry((current) => ({ ...current, phase: 'loading', error: null }))
        try {
          const result = await manager.registries()
          if (result?.ok !== true) {
            setRegistry((current) => ({ ...current, phase: 'error', error: String(result?.error?.message ?? 'registries failed') }))
            return
          }
          setRegistry((current) => ({ ...current, phase: 'ready', value: result.value ?? null, error: null }))
        } catch (error) {
          setRegistry((current) => ({ ...current, phase: 'error', error: String(error?.message ?? error) }))
        }
      }, [ctx])

      React.useEffect(() => {
        loadCatalog(false)
        loadStats()
        loadInstalled()
      }, [loadCatalog, loadStats, loadInstalled])

      // Load per-tab data when a tab is opened (never in response to its own result).
      React.useEffect(() => {
        if (tab === 'installed') loadInstalled()
        if (tab === 'settings') loadRegistries()
      }, [tab]) // eslint-disable-line react-hooks/exhaustive-deps

      React.useEffect(() => {
        if (toast === null) return undefined
        const timer = setTimeout(() => setToast(null), 2000)
        return () => clearTimeout(timer)
      }, [toast])

      /* ------------------------------------------------------------ install flow */

      const appendLog = React.useCallback((chunk) => {
        const text = typeof chunk?.text === 'string' ? chunk.text : ''
        const requestId = chunk?.requestId
        setInstall((current) => {
          if (current === null || requestId === undefined || requestId !== current.requestId) return current
          return { ...current, log: [...current.log, text].slice(-LOG_LIMIT) }
        })
      }, [])

      const installSpec = React.useCallback(
        async (spec, subject, options) => {
          const manager = ctx?.remote?.pluginManager
          const name = subject?.name ?? spec
          const base = { key: subject?.key ?? spec, name, spec, requestId: undefined, phase: 'checking', message: null, log: [], pendingBuilds: [], attempt: undefined }
          setInstall(base)
          if (spec.length === 0) {
            setInstall({ ...base, phase: 'failed', message: tr('problem.invalid-spec', { reason: 'empty' }) })
            return
          }
          if (manager === undefined) {
            setInstall({ ...base, phase: 'failed', message: tr('noManager') })
            return
          }
          const chosen = registryFromState(registry)
          const registryOption = chosen === null ? {} : { registry: chosen }
          let inspected
          try {
            inspected = await manager.inspect(spec, registryOption)
          } catch (error) {
            setInstall({ ...base, phase: 'failed', message: String(error?.message ?? error) })
            return
          }
          if (inspected?.ok !== true) {
            setInstall({ ...base, phase: 'failed', message: String(inspected?.error?.message ?? 'inspect failed') })
            return
          }
          if (inspected.value?.status === 'refused') {
            const problem = String(inspected.value.problem ?? 'unknown')
            const reason = String(inspected.value.reason ?? '')
            const key = `problem.${problem}`
            setInstall({ ...base, phase: 'failed', message: t(key) === key ? tr('problem.unknown', { reason }) : tr(key, { reason }) })
            return
          }

          const requestId = globalThis.crypto?.randomUUID?.() ?? `pm-${Date.now()}-${Math.random().toString(16).slice(2)}`
          const offLog = typeof ctx?.remote?.$on === 'function' ? ctx.remote.$on('plugin-manager/install-log', appendLog) : undefined
          const offPhase = typeof ctx?.remote?.$on === 'function'
            ? ctx.remote.$on('plugin-manager/install-state', (progress) => {
                if (progress?.requestId !== requestId) return
                setInstall((current) => {
                  if (current === null || current.requestId !== requestId) return current
                  if (progress.phase === 'cancelling') return { ...current, phase: 'cancelling' }
                  return progress.attempt === undefined ? current : { ...current, attempt: progress.attempt }
                })
              })
            : undefined
          setInstall({ ...base, phase: 'installing', requestId })
          try {
            const request = {
              requestId,
              ...registryOption,
              ...(options?.approvedBuilds === undefined ? {} : { approvedBuilds: options.approvedBuilds }),
            }
            const result = await manager.installBundle(spec, request)
            if (result?.ok !== true) {
              setInstall({ ...base, phase: 'failed', message: String(result?.error?.message ?? 'install failed') })
              return
            }
            const value = result.value ?? {}
            if (value.application === 'failed') {
              const pending = Array.isArray(value.pendingBuilds) ? value.pendingBuilds : []
              const reason = String(value.error?.message ?? value.packageResult?.kind ?? 'install failed')
              setInstall({ ...base, phase: 'failed', message: tr('result.failed', { reason }), pendingBuilds: pending })
              setHistory((current) => [{ at: Date.now(), name, spec, ok: false, message: reason }, ...current].slice(0, 50))
              return
            }
            if (value.application === 'cancelled') {
              setInstall({ ...base, phase: 'cancelled', message: tr('result.cancelled') })
              setHistory((current) => [{ at: Date.now(), name, spec, ok: false, message: 'cancelled' }, ...current].slice(0, 50))
              return
            }
            setInstall({ ...base, phase: 'done', message: value.application === 'restart-required' ? tr('result.restart') : tr('result.installed') })
            setHistory((current) => [{ at: Date.now(), name, spec, ok: true, message: String(value.application ?? 'installed') }, ...current].slice(0, 50))
            loadInstalled()
            loadCatalog(false)
          } catch (error) {
            setInstall({ ...base, phase: 'failed', message: String(error?.message ?? error) })
          } finally {
            if (offLog !== undefined) offLog()
            if (offPhase !== undefined) offPhase()
          }
        },
        [appendLog, ctx, loadCatalog, loadInstalled, registry, t, tr],
      )

      const onCopy = React.useCallback(async (spec) => {
        const ok = await copyText(`pnpm add ${spec}`)
        if (ok) setToast(spec)
      }, [])

      const cancelInstall = React.useCallback(() => {
        const manager = ctx?.remote?.pluginManager
        const requestId = install?.requestId
        if (manager === undefined || requestId === undefined) return
        setInstall((current) => (current === null ? current : { ...current, phase: 'cancelling' }))
        Promise.resolve(manager.cancelInstall(requestId)).catch(() => {})
      }, [ctx, install])

      const toggleBundle = React.useCallback(
        async (row, enabled) => {
          const manager = ctx?.remote?.pluginManager
          if (manager === undefined) return
          setBusyName(String(row.name))
          try {
            const result = await manager.setBundleEnabled(String(row.name), enabled)
            if (result?.ok !== true) setToast(String(result?.error?.message ?? 'setBundleEnabled failed'))
          } finally {
            setBusyName(null)
            loadInstalled()
          }
        },
        [ctx, loadInstalled],
      )

      const removeBundle = React.useCallback(
        async (row) => {
          const manager = ctx?.remote?.pluginManager
          if (manager === undefined) return
          setConfirmRemove(null)
          setBusyName(String(row.name))
          try {
            const result = await manager.removeBundle(String(row.name))
            if (result?.ok !== true) setToast(String(result?.error?.message ?? 'removeBundle failed'))
          } finally {
            setBusyName(null)
            loadInstalled()
          }
        },
        [ctx, loadInstalled],
      )

      /* ------------------------------------------------------------ market view */

      const categoryCounts = React.useMemo(() => {
        const counts = new Map()
        for (const item of catalog.items) {
          const key = typeof item?.c === 'string' && item.c.length > 0 ? item.c : null
          if (key === null) continue
          counts.set(key, (counts.get(key) ?? 0) + 1)
        }
        return counts
      }, [catalog.items])

      const verifiedCount = React.useMemo(() => catalog.items.filter((item) => item?.v === 'verified').length, [catalog.items])

      const filtered = React.useMemo(() => {
        const needle = query.trim().toLowerCase()
        const rows = catalog.items.filter((item) => {
          if (category !== '' && item?.c !== category) return false
          if (needle.length === 0) return true
          const haystack = [item?.n, item?.o, item?.d, item?.s, specOf(item), ...(Array.isArray(item?.t) ? item.t : []), ...(Array.isArray(item?.f) ? item.f : [])]
            .filter((part) => typeof part === 'string')
            .join(' ')
            .toLowerCase()
          return haystack.includes(needle)
        })
        const active = SORTS.find((row) => row.key === sort.key) ?? SORTS[0]
        const direction = sort.dir === 'asc' ? 1 : -1
        return [...rows].sort((left, right) => {
          const a = active.value(left)
          const b = active.value(right)
          if (typeof a === 'number' && typeof b === 'number') return (a - b) * direction
          return String(a).localeCompare(String(b)) * direction
        })
      }, [catalog.items, query, category, sort])

      React.useEffect(() => {
        setVisible(PAGE_STEP)
      }, [query, category, sort])

      const installedOf = React.useCallback(
        (entry) => {
          const spec = specOf(entry)
          const name = String(entry?.n ?? '')
          return bundles.rows.find((row) => row.name === spec || (name.length > 0 && row.name === name)) ?? null
        },
        [bundles.rows],
      )

      const hasUpdate = React.useCallback(
        (entry) => {
          const row = installedOf(entry)
          if (row === null) return false
          const catalogVersion = plainVersion(entry?.vr)
          const installedVersion = plainVersion(row.version)
          return catalogVersion.length > 0 && installedVersion.length > 0 && catalogVersion !== installedVersion
        },
        [installedOf],
      )

      const toggleSort = React.useCallback((key) => {
        setSort((current) => {
          if (current.key === key) return { key, dir: current.dir === 'asc' ? 'desc' : 'asc' }
          const definition = SORTS.find((row) => row.key === key)
          return { key, dir: definition?.defaultDir ?? 'desc' }
        })
      }, [])

      const installKey = install !== null && install.phase !== 'done' && install.phase !== 'failed' && install.phase !== 'cancelled' ? install.key : null
      const shown = filtered.slice(0, visible)
      const hasManager = ctx?.remote?.pluginManager !== undefined
      // scope=all merges the sitemap index in, so the row count can exceed the
      // curated stats report
      const bannerTotal = Math.max(stats?.total ?? 0, catalog.items.length)
      const bannerVerified = stats?.verified ?? verifiedCount

      /* ------------------------------------------------------------------ render */

      const tabButton = (id, label) =>
        h(
          'button',
          { type: 'button', className: 'pm-tab', 'data-active': tab === id ? 'true' : undefined, onClick: () => setTab(id) },
          label,
        )

      const installPanel =
        install === null
          ? null
          : h(
              'section',
              { className: 'pm-panel' },
              h(
                'div',
                { className: 'pm-panelHead' },
                h(
                  'strong',
                  null,
                  install.phase === 'checking'
                    ? tr('checking', { spec: install.spec })
                    : install.phase === 'installing' && install.attempt !== undefined
                      ? tr('phase.installing', { attempt: install.attempt })
                      : `${tr('install')} ${install.name}`,
                ),
                h(
                  'div',
                  { className: 'pm-row' },
                  install.phase === 'cancelling' ? h('span', { className: 'pm-note' }, tr('canceling')) : null,
                  installKey !== null && install.requestId !== undefined
                    ? h('button', { type: 'button', className: 'pm-btn', onClick: cancelInstall }, tr('cancel'))
                    : null,
                  h('button', { type: 'button', className: 'pm-btn', onClick: () => setInstall(null) }, tr('close')),
                ),
              ),
              install.spec.length > 0 ? h('p', { className: 'pm-note' }, `${tr('spec')}: ${install.spec}`) : null,
              install.message !== null ? h('p', { className: install.phase === 'failed' ? 'pm-note pm-error' : 'pm-note' }, install.message) : null,
              install.pendingBuilds.length > 0
                ? h(
                    'div',
                    null,
                    h('p', { className: 'pm-note' }, tr('buildHint')),
                    h(
                      'pre',
                      { className: 'pm-pre' },
                      install.pendingBuilds.map((item) => (typeof item === 'string' ? item : String(item?.key ?? item?.name ?? JSON.stringify(item)))).join('\n'),
                    ),
                    h(
                      'button',
                      {
                        type: 'button',
                        className: 'pm-btn pm-btnPrimary',
                        onClick: () =>
                          installSpec(
                            install.spec,
                            { key: install.key, name: install.name },
                            {
                              approvedBuilds: install.pendingBuilds.map((item) => (typeof item === 'string' ? item : String(item?.key ?? item?.name ?? ''))),
                            },
                          ),
                      },
                      tr('allowBuilds'),
                    ),
                  )
                : null,
              install.log.length > 0 ? h('p', { className: 'pm-note' }, tr('log')) : null,
              install.log.length > 0 ? h('pre', { className: 'pm-pre' }, install.log.join('')) : null,
            )

      const banner = h(
        'div',
        { className: 'pm-banner' },
        h('span', { className: 'pm-bannerBadge' }, tr('banner.badge')),
        h('span', { className: 'pm-bannerText' }, tr('banner.text', { total: bannerTotal, verified: bannerVerified })),
        h('a', { className: 'pm-bannerLink', href: `${SITE}${lang === 'en' ? '' : 'zh/'}?ref=hub`, target: '_blank', rel: 'noopener noreferrer' }, `${tr('banner.site')} →`),
      )

      const marketView = h(
        'div',
        null,
        banner,
        h('input', {
          className: 'pm-input',
          type: 'search',
          placeholder: tr('search'),
          value: query,
          onChange: (event) => setQuery(event.target.value),
        }),
        h(
          'div',
          { className: 'pm-chips', role: 'tablist' },
          h(
            'button',
            { type: 'button', className: 'pm-chip', 'data-active': category === '' ? 'true' : undefined, onClick: () => setCategory('') },
            tr('chip.all'),
            h('span', { className: 'pm-chipCount' }, String(catalog.items.length)),
          ),
          CATEGORY_ORDER.filter((key) => (categoryCounts.get(key) ?? 0) > 0).map((key) =>
            h(
              'button',
              { type: 'button', key, className: 'pm-chip', 'data-active': category === key ? 'true' : undefined, onClick: () => setCategory(key) },
              categoryText(t, key, true),
            ),
          ),
        ),
        h(
          'div',
          { className: 'pm-controls' },
          h('span', { className: 'pm-results' }, tr('results', { count: filtered.length })),
          h(
            'div',
            { className: 'pm-seg' },
            h('span', { className: 'pm-segLabel' }, tr('sort.aria')),
            h(
              'div',
              { className: 'pm-segGroup', role: 'radiogroup', 'aria-label': tr('sort.aria') },
              SORTS.map((row) =>
                h(
                  'button',
                  {
                    type: 'button',
                    key: row.key,
                    className: 'pm-segBtn',
                    'data-active': sort.key === row.key ? 'true' : undefined,
                    title: tr(row.label),
                    onClick: () => toggleSort(row.key),
                  },
                  tr(row.label),
                  sort.key === row.key ? h(SortArrow, { up: sort.dir === 'asc' }) : null,
                ),
              ),
            ),
          ),
          h('button', { type: 'button', className: 'pm-btn', disabled: catalog.phase === 'loading', onClick: () => loadCatalog(true) }, tr('refresh')),
        ),
        catalog.phase === 'error'
          ? h('p', { className: 'pm-status pm-error' }, tr('loadFailed', { reason: catalog.error ?? '' }))
          : catalog.phase === 'loading'
            ? h('p', { className: 'pm-status' }, tr('loading'))
            : shown.length === 0
              ? h('p', { className: 'pm-status' }, tr('empty'))
              : h(
                  'div',
                  { className: 'pm-list' },
                  shown.map((entry) =>
                    h(Card, {
                      key: keyOf(entry),
                      entry,
                      t,
                      lang,
                      installed: installedOf(entry),
                      hasUpdate: hasUpdate(entry),
                      busy: installKey === keyOf(entry),
                      onInstall: (item) => installSpec(specOf(item), { key: keyOf(item), name: String(item?.n ?? '') }),
                      onCopy,
                    }),
                  ),
                ),
        visible < filtered.length
          ? h(
              'div',
              { className: 'pm-row', style: { paddingTop: '10px', justifyContent: 'center' } },
              h('button', { type: 'button', className: 'pm-btn', onClick: () => setVisible((value) => value + PAGE_STEP) }, tr('more')),
            )
          : null,
      )

      const installedView = h(
        'div',
        { className: 'pm-installed' },
        h(
          'div',
          { className: 'pm-row', style: { justifyContent: 'space-between' } },
          h('p', { className: 'pm-status' }, tr('installed.title')),
          h('button', { type: 'button', className: 'pm-btn', disabled: bundles.phase === 'loading', onClick: () => loadInstalled() }, tr('refresh')),
        ),
        bundles.phase === 'error' ? h('p', { className: 'pm-status pm-error' }, bundles.error) : null,
        bundles.phase === 'loading' ? h('p', { className: 'pm-status' }, tr('loading')) : null,
        bundles.phase === 'ready' && bundles.rows.length === 0 ? h('p', { className: 'pm-status' }, tr('installed.empty')) : null,
        bundles.rows.map((row) =>
          h(InstalledRow, {
            key: String(row.name),
            row,
            t,
            busy: busyName === String(row.name),
            confirming: confirmRemove === String(row.name),
            onToggle: toggleBundle,
            onRemove: removeBundle,
            onConfirm: (name) => setConfirmRemove(name),
          }),
        ),
        h('p', { className: 'pm-note' }, tr('installed.removeHint')),
      )

      const customView = h(
        'div',
        { className: 'pm-form' },
        h('h2', { className: 'pm-title', style: { fontSize: '14px' } }, tr('custom.title')),
        h('p', { className: 'pm-note' }, tr('custom.hint')),
        h('input', {
          className: 'pm-input',
          type: 'text',
          placeholder: tr('custom.placeholder'),
          value: customSpec,
          onChange: (event) => setCustomSpec(event.target.value),
          onKeyDown: (event) => {
            if (event.key === 'Enter' && customSpec.trim().length > 0) installSpec(customSpec.trim(), { key: customSpec.trim(), name: customSpec.trim() })
          },
        }),
        h(
          'div',
          { className: 'pm-row' },
          h(
            'button',
            {
              type: 'button',
              className: 'pm-btn pm-btnPrimary',
              disabled: customSpec.trim().length === 0 || installKey !== null,
              onClick: () => installSpec(customSpec.trim(), { key: customSpec.trim(), name: customSpec.trim() }),
            },
            tr('custom.run'),
          ),
          h('button', { type: 'button', className: 'pm-btn', onClick: () => onCopy(customSpec.trim()) }, tr('copy')),
        ),
      )

      const registryValue = registry.value ?? {}
      const registryOptions = [{ id: 'default', label: tr('settings.default') }]
      if (typeof registryValue.resolved === 'string' && registryValue.resolved.length > 0) {
        registryOptions.push({ id: `resolved:${registryValue.resolved}`, label: tr('settings.resolved', { url: registryValue.resolved }) })
      }
      for (const url of Array.isArray(registryValue.fallbackRegistries) ? registryValue.fallbackRegistries : []) {
        registryOptions.push({ id: `fallback:${url}`, label: url })
      }
      if (typeof registryValue.registry === 'string' && registryValue.registry.length > 0) {
        registryOptions.push({ id: `configured:${registryValue.registry}`, label: `${registryValue.registry} (configured)` })
      }
      registryOptions.push({ id: 'custom', label: tr('settings.custom') })

      const settingsView = h(
        'div',
        { className: 'pm-form' },
        h('h2', { className: 'pm-title', style: { fontSize: '14px' } }, tr('settings.title')),
        h('p', { className: 'pm-note' }, tr('settings.hint')),
        registryOptions.map((option) =>
          h(
            'label',
            { className: 'pm-radio', key: option.id },
            h('input', {
              type: 'radio',
              name: 'pm-registry',
              checked: registry.choice === option.id,
              onChange: () => setRegistry((current) => ({ ...current, choice: option.id })),
            }),
            h('span', null, option.label),
          ),
        ),
        registry.choice === 'custom'
          ? h('input', {
              className: 'pm-input',
              type: 'text',
              placeholder: tr('settings.customPlaceholder'),
              value: registry.custom,
              onChange: (event) => setRegistry((current) => ({ ...current, custom: event.target.value })),
            })
          : null,
        h(
          'div',
          { className: 'pm-row' },
          h('button', { type: 'button', className: 'pm-btn', disabled: registry.phase === 'loading', onClick: () => loadRegistries() }, tr('settings.reload')),
          registry.phase === 'error' ? h('span', { className: 'pm-note pm-error' }, registry.error) : null,
          registry.phase === 'loading' ? h('span', { className: 'pm-note' }, tr('loading')) : null,
        ),
      )

      const logsView = h(
        'div',
        { className: 'pm-form' },
        h('h2', { className: 'pm-title', style: { fontSize: '14px' } }, tr('tab.logs')),
        history.length === 0 && (install === null || install.log.length === 0) ? h('p', { className: 'pm-note' }, tr('logs.empty')) : null,
        install !== null && install.log.length > 0 ? h('pre', { className: 'pm-pre' }, install.log.join('')) : null,
        history.length > 0
          ? h(
              'pre',
              { className: 'pm-pre' },
              history.map((row) => `${new Date(row.at).toLocaleTimeString()}  ${row.ok ? 'OK  ' : 'FAIL'}  ${row.name}  (${row.spec})  ${row.message}`).join('\n'),
            )
          : null,
        history.length > 0
          ? h('div', { className: 'pm-row' }, h('button', { type: 'button', className: 'pm-btn', onClick: () => setHistory([]) }, tr('logs.clear')))
          : null,
      )

      return h(
        'div',
        { className: 'pm-root', 'data-plugin-market': 'root' },
        h('style', null, CSS),
        h(
          'header',
          { className: 'pm-head' },
          h(
            'div',
            { className: 'pm-headRow' },
            h(
              'div',
              null,
              h('h1', { className: 'pm-title' }, tr('title')),
              h('p', { className: 'pm-intro' }, hasManager ? tr('intro') : tr('noManager')),
            ),
            catalog.fetchedAt > 0
              ? h('span', { className: 'pm-meta' }, `${new Date(catalog.fetchedAt).toLocaleString()}${catalog.stale ? ` · ${tr('cached')}` : ''}`)
              : null,
          ),
          h(
            'nav',
            { className: 'pm-tabs', role: 'tablist' },
            tabButton('market', tr('tab.market')),
            tabButton('installed', tr('tab.installed')),
            tabButton('custom', tr('tab.custom')),
            tabButton('settings', tr('tab.settings')),
            tabButton('logs', tr('tab.logs')),
          ),
        ),
        toast !== null ? h('p', { className: 'pm-note' }, `${tr('copied')}: pnpm add ${toast}`) : null,
        installPanel,
        tab === 'market' ? marketView : tab === 'installed' ? installedView : tab === 'custom' ? customView : tab === 'settings' ? settingsView : logsView,
      )
    }

    const inject = ['slots', 'locale', 'remote', 'remote.pluginManager']

    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { zh: ZH, en: EN }), 'plugin-market: dictionaries')
      const t = ctx.locale.bind(NS)
      ctx.slots.inject('main', () =>
        ctx.slots.register(
          {
            name: 'main',
            key: PANEL_ID,
            locale: NS,
            inject: () => ({ t, ctx }),
          },
          MarketPage,
        ),
      )
      // 左栏入口
      ctx.slots.inject('sidebar.panellist', () =>
        ctx.slots.register(
          {
            name: 'sidebar.panellist',
            id: PANEL_ID,
            order: 20,
            locale: NS,
            label: () => t('panel'),
          },
          MarketIcon,
        ),
      )
      // 设置（Ctrl+,）入口：同一个市场页面，两个入口都在。
      ctx.slots.inject('settings.section', () =>
        ctx.slots.register(
          {
            name: 'settings.section',
            id: PANEL_ID,
            order: 60,
            locale: NS,
            label: () => t('panel'),
            inject: () => ({ t, ctx }),
          },
          MarketPage,
        ),
      )
    }

    return { name: NS, inject, apply }
  },
})
