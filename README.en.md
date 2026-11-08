# dsh-plugin-market

[简体中文（完整版）](README.md) · English (abridged)

> This is an **abridged English version**. The [Chinese README](README.md) is the source of truth;
> details that change often (design notes, changelog, screenshots) live there.

A left-sidebar **Plugin Market** panel: browse the dsh-plugin.org community catalog and install,
enable, disable or uninstall bundles into the current profile through the **official plugin
manager** — no `dsh` CLI, no profile guessing.

[![version](https://img.shields.io/badge/version-0.2.1-blue)](https://github.com/wojiao42/dsh-plugin-market/releases)
[![license](https://img.shields.io/badge/license-MIT-green)](LICENSE)

## What it does

- Two entry points, one page: the sidebar **Plugin Market** panel and the **Plugin Market**
  section in Settings (Ctrl+,); both render the same component with independent UI state.
- Five tabs: **Market** (featured strip, search, long category chips, segmented sort by
  Star / Fork / recently updated / newly listed, single-column cards with badges), **Installed**
  (enable/disable, uninstall with confirmation), **Custom install** (npm name / `github:owner/repo`
  / local absolute path), **Settings** (npm registry choice) and **Logs** (install history plus
  the pnpm log, including blocked build scripts with "allow and retry").
- Install, enable, disable and uninstall call `ctx.remote.pluginManager` (`inspect` →
  `installBundle`, `setBundleEnabled`, `removeBundle`) — the same path the built-in Plugins panel
  uses, so compatibility checks, the profile write lock, reconcile and hot reload stay official.
- The Host half proxies and caches two upstream sources (the renderer runs on `dsh-app://` and
  cannot call them directly): the curated catalog `api.dsh-plugin.org/plugins.<lang>.json`
  (6 h TTL) and the full index `dsh-plugin.org/sitemaps/plugins.xml` (12 h TTL).
- The Market tab defaults to `scope=all`: curated rows plus sitemap-only rows, which are marked
  `v: 'index'` and badged "index only"; their install source is derived as
  `github:{owner}/{slug}`. Curated rows still win (description, stars, Star sort).
- Why two sources: the curated catalog is only an exported subset — 13,680 rows on 2026-10-12,
  4,677 on 2026-10-19 — so plugins dropped from the export (including this machine's own three
  `wojiao42/dsh-*` plugins) were unfindable in the panel while still listed on the site.

## Quick start

In DSH Desktop the documented path is Settings (Ctrl+,) → Plugin Market → Custom install →
`github:wojiao42/dsh-plugin-market`, then refresh the window. On a first install that section does
not exist yet (this plugin provides it), so install from the command line once:

```sh
dsh plugin --profile web add github:wojiao42/dsh-plugin-market
```

## Key limits

- **Sitemap down means degraded, not broken:** the Market tab falls back to the curated catalog
  (response header `x-plugin-market-scope: curated`) and index-only plugins become unfindable.
- **Caches:** curated catalog 6 h, index 12 h, featured stats 1 h. Upstream removals or renames
  take up to that long; the Refresh button sends `&refresh=1` to bypass the cache.
- **The curated upstream shrinks:** it is one export of the site and its row count moves; index-only
  rows carry no description, stars or topics.
- **Failed fetches fall back to the last good cache**; with no cache the market route answers 502
  with the upstream reason. One upstream fetch times out after 45 s.
- It never shells out to `dsh` and never writes the profile itself — the official manager does.
- No screenshots exist in this repository yet.

## Compatibility

- DSH Desktop and DSH Web: the client half declares `platform: web` and injects into
  `sidebar.panellist`, `main` and `settings.section`. The target DSH must support bundle patches
  (`dsh.bundle.patch`) and the `pluginManager` remote (`inspect` / `installBundle` /
  `setBundleEnabled` / `removeBundle`).
- The package name is `dsh-plugin-market`; it is not published to npm and does not need to be —
  install it from GitHub or a local path.
- `package.json` declares no `engines`. The Host half is plain ESM using global `fetch` (Node 18+),
  with no native modules and no build step; tested locally on Node v24.21.0 (Windows).
- Offline tests need no network: `node --test test/market.test.mjs test/routes.test.mjs` (10 tests).
  `node test/live-check.mjs` hits the real upstream and needs network.
- Changing `client.js` needs a page refresh; changing `index.js` needs a Harness restart.

## License

MIT. See [LICENSE](LICENSE).
