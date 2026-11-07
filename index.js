/**
 * Host half of the local plugin market.
 *
 * Two jobs, both just proxying + caching the community catalog, because the
 * renderer runs on the `dsh-app://` origin and cannot call api.dsh-plugin.org
 * directly. Everything else (listing what is installed, installing, uninstalling)
 * happens in the client half through the official `pluginManager` remote — the
 * same path the built-in Plugins panel uses — so this package never needs the
 * `dsh` CLI, a PATH shim, or a profile guess.
 *
 * Routes:
 *   GET /plugin-market/catalog?lang=zh|en[&refresh=1]
 *     → the raw catalog array (proxied)
 *   GET /plugin-market/stats[?refresh=1]
 *     → { total, verified, fetchedAt } used by the featured strip
 *   Both answer with x-plugin-market-fetched-at / x-plugin-market-stale headers
 *   and cache to disk under $DSH_HOME/plugin-market.
 *
 * @module @local/dsh-plugin-market
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

/** Cordis plugin name. */
export const name = 'plugin-market'

/** Serve from disk for this long before asking the origin again. */
const CATALOG_TTL_MS = 6 * 60 * 60 * 1000
/** Small stats file: refresh more often. */
const STATS_TTL_MS = 60 * 60 * 1000
/** The sitemap index moves slowly (one page per ~2000 plugins). */
const INDEX_TTL_MS = 12 * 60 * 60 * 1000
/** Bound on one upstream fetch. */
const FETCH_TIMEOUT_MS = 45 * 1000
/** `lang` values the origin publishes. */
const LANGS = new Set(['zh', 'en'])

/** Harness home: the profile-independent place this plugin may write cache to. */
function harnessHome() {
  return process.env.DSH_HOME ?? join(homedir(), '.dsh')
}

/** Cache file for one logical key (`catalog.zh`, `catalog.en`, `stats`). */
function cacheFile(key) {
  return join(harnessHome(), 'plugin-market', `${key}.json`)
}

/** Canonical upstream catalog URL for one language. */
function defaultCatalogUrl(lang) {
  return `https://api.dsh-plugin.org/plugins.${lang}.json`
}

/** Canonical upstream stats URL. */
function defaultStatsUrl() {
  return 'https://api.dsh-plugin.org/stats.json'
}

/**
 * Canonical full-index URL.
 *
 * `plugins.{lang}.json` is only the curated subset the site exports (it went
 * from ~13.7k rows on 2026-10-12 down to ~4.7k on 2026-10-19), while the site
 * itself keeps listing every repository it indexed. The sitemap is the only
 * public, complete enumeration left: one index → N pages of
 * `/plugins/{owner}/{slug}` URLs.
 */
function defaultIndexUrl() {
  return 'https://dsh-plugin.org/sitemaps/plugins.xml'
}

/** Read a cached body, optionally requiring freshness. */
function readCache(key, maxAgeMs) {
  try {
    const entry = JSON.parse(readFileSync(cacheFile(key), 'utf8'))
    if (
      entry !== null &&
      typeof entry === 'object' &&
      typeof entry.at === 'number' &&
      typeof entry.body === 'string' &&
      Date.now() - entry.at < maxAgeMs
    ) {
      return { at: entry.at, body: entry.body }
    }
  } catch {
    // missing / unreadable / malformed cache is simply a miss
  }
  return null
}

/** Write the cache; failing to cache never fails the request. */
function writeCache(key, body) {
  try {
    const file = cacheFile(key)
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, JSON.stringify({ at: Date.now(), body }))
  } catch {
    // read-only or full disk: the response still goes out
  }
}

/** Fetch one upstream URL as text with a bound. */
async function fetchText(source) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const response = await fetch(source, {
      signal: controller.signal,
      headers: { accept: 'application/json' },
    })
    if (!response.ok) throw new Error(`HTTP ${String(response.status)}`)
    return await response.text()
  } finally {
    clearTimeout(timer)
  }
}

/** Fetch and validate the catalog array. */
async function fetchCatalog(source) {
  const body = await fetchText(source)
  const parsed = JSON.parse(body)
  if (!Array.isArray(parsed)) throw new Error('unexpected catalog shape')
  return { body, count: parsed.length }
}

/** Fetch and normalize the stats object. */
async function fetchStats(source) {
  const parsed = JSON.parse(await fetchText(source))
  const total = typeof parsed?.total === 'number' ? parsed.total : null
  const verified = typeof parsed?.verified === 'number' ? parsed.verified : null
  if (total === null || verified === null) throw new Error('unexpected stats shape')
  return JSON.stringify({ total, verified })
}

/** Every `<loc>` value in one sitemap document. */
export function sitemapLocs(xml) {
  return [...String(xml ?? '').matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((match) => match[1])
}

/**
 * `{owner}/{slug}` pairs in one plugin sitemap page. Chinese pages
 * (`/zh/plugins/...`) duplicate the English ones, so only un-prefixed paths
 * count.
 */
export function pluginPairs(xml) {
  const pairs = []
  for (const loc of sitemapLocs(xml)) {
    if (loc.includes('/zh/')) continue
    const match = /\/plugins\/([^/?#]+)\/([^/?#]+)\/?$/.exec(loc)
    if (match === null) continue
    try {
      pairs.push([decodeURIComponent(match[1]), decodeURIComponent(match[2])])
    } catch {
      pairs.push([match[1], match[2]])
    }
  }
  return pairs
}

/** Fetch the sitemap index, then every plugin page, and dedupe the pairs. */
async function fetchIndex(source) {
  const pages = sitemapLocs(await fetchText(source)).filter((url) => /\/sitemaps\/plugins\/\d+\.xml$/.test(url))
  if (pages.length === 0) throw new Error('unexpected sitemap shape')
  const documents = await Promise.all(pages.map((page) => fetchText(page)))
  const seen = new Set()
  const rows = []
  for (const xml of documents) {
    for (const [owner, slug] of pluginPairs(xml)) {
      const key = `${owner}/${slug}`
      if (seen.has(key)) continue
      seen.add(key)
      rows.push([owner, slug])
    }
  }
  if (rows.length === 0) throw new Error('empty sitemap index')
  return { body: JSON.stringify(rows), count: rows.length }
}

/**
 * Merge the curated catalog with the sitemap index. Rows the catalog does not
 * carry keep only what the URL gives us: owner, slug and the GitHub install
 * spec (slug is the repository name on dsh-plugin.org).
 */
export function mergeCatalog(catalogBody, indexBody) {
  const catalog = JSON.parse(catalogBody)
  if (!Array.isArray(catalog)) throw new Error('unexpected catalog shape')
  const index = JSON.parse(indexBody)
  if (!Array.isArray(index)) throw new Error('unexpected index shape')
  const known = new Set()
  for (const entry of catalog) {
    if (entry === null || typeof entry !== 'object') continue
    if (typeof entry.o !== 'string' || typeof entry.s !== 'string') continue
    known.add(`${entry.o}/${entry.s}`.toLowerCase())
  }
  const merged = catalog.slice()
  for (const row of index) {
    if (!Array.isArray(row) || row.length < 2) continue
    const owner = String(row[0])
    const slug = String(row[1])
    if (known.has(`${owner}/${slug}`.toLowerCase())) continue
    const command = `dsh plugin --profile web add github:${owner}/${slug}`
    merged.push({ s: slug, o: owner, n: slug, ic: command, igc: command, v: 'index' })
  }
  return JSON.stringify(merged)
}

/** Answer with JSON. */
function sendJson(response, status, value) {
  const body = JSON.stringify(value)
  response.writeHead(status, {
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
  })
  response.end(body)
}

/** Answer with a cached/proxied body and its freshness headers. */
function sendBody(request, response, cached, stale, extraHeaders = {}) {
  const body = cached.body
  response.writeHead(200, {
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'x-plugin-market-fetched-at': String(cached.at),
    'x-plugin-market-stale': stale ? '1' : '0',
    ...extraHeaders,
  })
  if (request.method === 'HEAD') response.end()
  else response.end(body)
}

/**
 * Read one cache key, refreshing from `source` when stale; falls back to an
 * arbitrarily old cache and reports it as stale.
 * @returns `{ cached, stale, count }` or `{ error }`.
 */
async function resolveCached(key, ttlMs, source, normalize) {
  const fresh = readCache(key, ttlMs)
  if (fresh !== null) return { cached: fresh, stale: false }
  try {
    const value = await normalize(source)
    writeCache(key, value.body)
    return { cached: { at: Date.now(), body: value.body }, stale: false, count: value.count }
  } catch (error) {
    const fallback = readCache(key, Number.POSITIVE_INFINITY)
    if (fallback === null) return { error: String(error?.message ?? error) }
    return { cached: fallback, stale: true }
  }
}

/**
 * Register the catalog + index + stats routes.
 *
 * `scope=all` merges the curated catalog with the sitemap index, so rows the
 * catalog export dropped (or never carried) are still discoverable — marked
 * `v: 'index'` because the export gives us no description for them.
 *
 * @param ctx - host plugin context.
 * @param config - optional `{ catalogUrl?: (lang) => string, statsUrl?: () => string, indexUrl?: () => string }`.
 */
export function apply(ctx, config = {}) {
  const catalogUrlOf = typeof config.catalogUrl === 'function' ? config.catalogUrl : defaultCatalogUrl
  const statsUrlOf = typeof config.statsUrl === 'function' ? config.statsUrl : defaultStatsUrl
  const indexUrlOf = typeof config.indexUrl === 'function' ? config.indexUrl : defaultIndexUrl

  ctx.inject(['webServer'], (host) => {
    host.effect(
      () =>
        host.webServer.register({
          kind: 'exact',
          path: '/plugin-market/catalog',
          handler: async (request, response) => {
            if (request.method !== 'GET' && request.method !== 'HEAD') {
              response.writeHead(405, { allow: 'GET, HEAD' })
              response.end()
              return
            }
            const url = new URL(request.url ?? '/', 'http://localhost')
            const requested = (url.searchParams.get('lang') ?? 'zh').toLowerCase()
            const lang = LANGS.has(requested) ? requested : 'zh'
            const refresh = url.searchParams.get('refresh') === '1'
            const scope = url.searchParams.get('scope') === 'all' ? 'all' : 'curated'
            const resolved = await resolveCached(`catalog.${lang}`, refresh ? 0 : CATALOG_TTL_MS, catalogUrlOf(lang), fetchCatalog)
            if (resolved.error !== undefined) {
              sendJson(response, 502, { error: `catalog unavailable: ${resolved.error}` })
              return
            }
            if (scope === 'curated') {
              sendBody(request, response, resolved.cached, resolved.stale === true, resolved.count === undefined ? {} : { 'x-plugin-market-count': String(resolved.count) })
              return
            }
            const index = await resolveCached('index', refresh ? 0 : INDEX_TTL_MS, indexUrlOf(), fetchIndex)
            if (index.error !== undefined) {
              // the curated catalog is still perfectly usable on its own
              sendBody(request, response, resolved.cached, resolved.stale === true, {
                'x-plugin-market-scope': 'curated',
                'x-plugin-market-index-error': index.error.slice(0, 200),
              })
              return
            }
            let merged
            try {
              merged = mergeCatalog(resolved.cached.body, index.cached.body)
            } catch (error) {
              sendJson(response, 502, { error: `catalog merge failed: ${String(error?.message ?? error)}` })
              return
            }
            const count = JSON.parse(merged).length
            sendBody(request, response, { at: resolved.cached.at, body: merged }, resolved.stale === true || index.stale === true, {
              'x-plugin-market-scope': 'all',
              'x-plugin-market-count': String(count),
            })
          },
        }),
      'plugin-market: catalog route',
    )

    host.effect(
      () =>
        host.webServer.register({
          kind: 'exact',
          path: '/plugin-market/index',
          handler: async (request, response) => {
            if (request.method !== 'GET' && request.method !== 'HEAD') {
              response.writeHead(405, { allow: 'GET, HEAD' })
              response.end()
              return
            }
            const url = new URL(request.url ?? '/', 'http://localhost')
            const refresh = url.searchParams.get('refresh') === '1'
            const resolved = await resolveCached('index', refresh ? 0 : INDEX_TTL_MS, indexUrlOf(), fetchIndex)
            if (resolved.error !== undefined) {
              sendJson(response, 502, { error: `index unavailable: ${resolved.error}` })
              return
            }
            const count = JSON.parse(resolved.cached.body).length
            sendBody(request, response, resolved.cached, resolved.stale === true, { 'x-plugin-market-count': String(count) })
          },
        }),
      'plugin-market: index route',
    )

    host.effect(
      () =>
        host.webServer.register({
          kind: 'exact',
          path: '/plugin-market/stats',
          handler: async (request, response) => {
            if (request.method !== 'GET' && request.method !== 'HEAD') {
              response.writeHead(405, { allow: 'GET, HEAD' })
              response.end()
              return
            }
            const url = new URL(request.url ?? '/', 'http://localhost')
            const refresh = url.searchParams.get('refresh') === '1'
            const resolved = await resolveCached('stats', refresh ? 0 : STATS_TTL_MS, statsUrlOf(), fetchStats)
            if (resolved.error !== undefined) {
              sendJson(response, 502, { error: `stats unavailable: ${resolved.error}` })
              return
            }
            let parsed
            try {
              parsed = JSON.parse(resolved.cached.body)
            } catch {
              sendJson(response, 502, { error: 'stats unavailable: unreadable cache' })
              return
            }
            sendJson(response, 200, { ...parsed, fetchedAt: resolved.cached.at, stale: resolved.stale === true })
          },
        }),
      'plugin-market: stats route',
    )
  })
}
