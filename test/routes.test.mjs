/**
 * Route-level tests for the host half, offline.
 *
 * Run: node --test test/routes.test.mjs
 *
 * A fake cordis context collects the registered web routes, a stubbed fetch
 * serves fixtures, and `$DSH_HOME` points at a temp dir so the disk cache never
 * touches the real profile.
 */

import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, test } from 'node:test'

import { apply } from '../index.js'

const homes = []
function freshHome() {
  const dir = mkdtempSync(join(tmpdir(), 'market-test-'))
  homes.push(dir)
  return dir
}

after(() => {
  for (const dir of homes) rmSync(dir, { recursive: true, force: true })
  delete process.env.DSH_HOME
})

const CATALOG = [{ s: 'a', o: 'o1', n: 'a', v: 'verified', d: 'curated row' }]
const SITEMAP_INDEX = '<sitemapindex><sitemap><loc>http://up/sitemaps/plugins/1.xml</loc></sitemap></sitemapindex>'
const SITEMAP_PAGE = '<urlset>' +
  '<url><loc>https://dsh-plugin.org/plugins/o1/a</loc></url>' +
  '<url><loc>https://dsh-plugin.org/plugins/o2/b</loc></url>' +
  '</urlset>'

const FIXTURES = new Map([
  ['http://up/catalog.json', JSON.stringify(CATALOG)],
  ['http://up/sitemap.xml', SITEMAP_INDEX],
  ['http://up/sitemaps/plugins/1.xml', SITEMAP_PAGE],
])

function stubFetch() {
  const original = globalThis.fetch
  globalThis.fetch = async (url) => {
    const body = FIXTURES.get(String(url))
    return {
      ok: body !== undefined,
      status: body === undefined ? 404 : 200,
      text: async () => body ?? '',
    }
  }
  return () => {
    globalThis.fetch = original
  }
}

/** Collect the web routes one `apply()` registers. */
function mount() {
  const routes = new Map()
  const host = {
    effect(fn) {
      fn()
      return () => {}
    },
    webServer: {
      register(route) {
        routes.set(route.path, route)
        return () => {}
      },
    },
  }
  const ctx = {
    inject(deps, fn) {
      assert.deepEqual(deps, ['webServer'])
      fn(host)
    },
  }
  apply(ctx, { catalogUrl: () => 'http://up/catalog.json', indexUrl: () => 'http://up/sitemap.xml', statsUrl: () => 'http://up/stats.json' })
  return routes
}

function fakeResponse() {
  const out = { status: 0, headers: {}, body: undefined }
  return {
    out,
    writeHead(status, headers) {
      out.status = status
      out.headers = headers ?? {}
    },
    end(chunk) {
      out.body = chunk
    },
  }
}

async function call(route, url, method = 'GET') {
  const response = fakeResponse()
  await route.handler({ method, url }, response)
  return response.out
}

test('curated catalog is the default and streams through unchanged', async () => {
  process.env.DSH_HOME = freshHome()
  const restore = stubFetch()
  try {
    const routes = mount()
    const out = await call(routes.get('/plugin-market/catalog'), '/plugin-market/catalog?lang=zh')
    assert.equal(out.status, 200)
    assert.deepEqual(JSON.parse(out.body), CATALOG)
    assert.equal(out.headers['x-plugin-market-count'], '1')
    assert.equal(out.headers['x-plugin-market-scope'], undefined)
  } finally {
    restore()
  }
})

test('scope=all merges the sitemap index in and reports the scope', async () => {
  process.env.DSH_HOME = freshHome()
  const restore = stubFetch()
  try {
    const routes = mount()
    const out = await call(routes.get('/plugin-market/catalog'), '/plugin-market/catalog?lang=zh&scope=all')
    assert.equal(out.status, 200)
    const items = JSON.parse(out.body)
    assert.equal(items.length, 2)
    assert.equal(items[0].v, 'verified')
    assert.equal(items[1].o, 'o2')
    assert.equal(items[1].v, 'index')
    assert.equal(items[1].igc, 'dsh plugin --profile web add github:o2/b')
    assert.equal(out.headers['x-plugin-market-scope'], 'all')
    assert.equal(out.headers['x-plugin-market-count'], '2')
  } finally {
    restore()
  }
})

test('index route serves owner/slug pairs and rejects other verbs', async () => {
  process.env.DSH_HOME = freshHome()
  const restore = stubFetch()
  try {
    const routes = mount()
    const out = await call(routes.get('/plugin-market/index'), '/plugin-market/index')
    assert.deepEqual(JSON.parse(out.body), [['o1', 'a'], ['o2', 'b']])

    const head = await call(routes.get('/plugin-market/index'), '/plugin-market/index', 'HEAD')
    assert.equal(head.status, 200)
    assert.equal(head.body, undefined)

    const post = await call(routes.get('/plugin-market/index'), '/plugin-market/index', 'POST')
    assert.equal(post.status, 405)
    assert.equal(post.headers.allow, 'GET, HEAD')
  } finally {
    restore()
  }
})

test('a sitemap outage degrades to the curated catalog instead of failing', async () => {
  process.env.DSH_HOME = freshHome()
  const restore = stubFetch()
  try {
    const routes = mount()
    // warm the curated cache first
    await call(routes.get('/plugin-market/catalog'), '/plugin-market/catalog?lang=zh')
    // make the sitemap unreachable, keep the catalog reachable
    FIXTURES.delete('http://up/sitemap.xml')
    const out = await call(routes.get('/plugin-market/catalog'), '/plugin-market/catalog?lang=zh&scope=all')
    assert.equal(out.status, 200)
    assert.deepEqual(JSON.parse(out.body), CATALOG)
    assert.equal(out.headers['x-plugin-market-scope'], 'curated')
    assert.match(out.headers['x-plugin-market-index-error'], /unavailable|HTTP 404/)
  } finally {
    FIXTURES.set('http://up/sitemap.xml', SITEMAP_INDEX)
    restore()
  }
})

test('an unreachable catalog is a 502 with the upstream reason', async () => {
  process.env.DSH_HOME = freshHome()
  const restore = stubFetch()
  try {
    const routes = mount()
    const out = await call(routes.get('/plugin-market/catalog'), '/plugin-market/catalog?lang=en')
    assert.equal(out.status, 200) // served from the fixture
    FIXTURES.delete('http://up/catalog.json')
    const missing = await call(routes.get('/plugin-market/catalog'), '/plugin-market/catalog?lang=en&refresh=1')
    // refresh wipes the fresh-cache window but the fallback copy is still on disk
    assert.equal(missing.status, 200)
    assert.equal(missing.headers['x-plugin-market-stale'], '1')
  } finally {
    FIXTURES.set('http://up/catalog.json', JSON.stringify(CATALOG))
    restore()
  }
})
