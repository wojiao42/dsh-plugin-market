/**
 * Offline tests for the host half's sitemap index + catalog merge.
 *
 * Run: node --test test/market.test.mjs
 *
 * The client half is browser code (`window.__ModuleLoader__`); its syntax is
 * checked with `node --check client.js` and its behaviour is exercised in the
 * live check (test/live-check.mjs) against real upstream data.
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { mergeCatalog, pluginPairs, sitemapLocs } from '../index.js'

const INDEX_XML = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex>
  <sitemap><loc>https://dsh-plugin.org/sitemaps/plugins/1.xml</loc></sitemap>
  <sitemap><loc>https://dsh-plugin.org/sitemaps/plugins/2.xml</loc></sitemap>
</sitemapindex>`

const PAGE_ONE = `<?xml version="1.0" encoding="UTF-8"?>
<urlset>
  <url><loc>https://dsh-plugin.org/plugins/wojiao42/dsh-memory-file</loc></url>
  <url><loc>https://dsh-plugin.org/zh/plugins/wojiao42/dsh-memory-file</loc></url>
  <url><loc>https://dsh-plugin.org/plugins/wojiao42/dsh-token-cost</loc></url>
</urlset>`

const PAGE_TWO = `<?xml version="1.0" encoding="UTF-8"?>
<urlset>
  <url><loc>https://dsh-plugin.org/plugins/others/kept</loc></url>
  <url><loc>https://dsh-plugin.org/plugins/others/with%20space</loc></url>
  <url><loc>https://dsh-plugin.org/plugins/not-a-plugin-url</loc></url>
</urlset>`

test('sitemapLocs reads every <loc> in document order', () => {
  assert.deepEqual(sitemapLocs(INDEX_XML), [
    'https://dsh-plugin.org/sitemaps/plugins/1.xml',
    'https://dsh-plugin.org/sitemaps/plugins/2.xml',
  ])
  assert.deepEqual(sitemapLocs(''), [])
  assert.deepEqual(sitemapLocs(undefined), [])
})

test('pluginPairs keeps english pages only and decodes both segments', () => {
  assert.deepEqual(pluginPairs(PAGE_ONE), [
    ['wojiao42', 'dsh-memory-file'],
    ['wojiao42', 'dsh-token-cost'],
  ])
  assert.deepEqual(pluginPairs(PAGE_TWO), [
    ['others', 'kept'],
    ['others', 'with space'],
  ])
  // a /plugins/ URL without an owner/slug pair is skipped, not crashed on
  assert.deepEqual(pluginPairs('<urlset><url><loc>https://x/plugins/nope</loc></url></urlset>'), [])
})

test('mergeCatalog keeps catalog rows and appends index-only rows', () => {
  const catalog = JSON.stringify([
    { s: 'dsh-memory-file', o: 'wojiao42', n: 'dsh-memory-file', v: 'verified', d: '记忆插件' },
  ])
  const index = JSON.stringify([
    ['wojiao42', 'dsh-memory-file'],
    ['wojiao42', 'dsh-token-cost'],
    ['others', 'kept'],
  ])
  const merged = JSON.parse(mergeCatalog(catalog, index))
  assert.equal(merged.length, 3)
  // curated row survives untouched
  assert.deepEqual(merged[0], { s: 'dsh-memory-file', o: 'wojiao42', n: 'dsh-memory-file', v: 'verified', d: '记忆插件' })
  // index-only rows are installable and labelled
  assert.deepEqual(merged[1], {
    s: 'dsh-token-cost',
    o: 'wojiao42',
    n: 'dsh-token-cost',
    ic: 'dsh plugin --profile web add github:wojiao42/dsh-token-cost',
    igc: 'dsh plugin --profile web add github:wojiao42/dsh-token-cost',
    v: 'index',
  })
  assert.equal(merged[2].v, 'index')
})

test('mergeCatalog matches owner/slug case-insensitively and ignores junk rows', () => {
  const catalog = JSON.stringify([{ s: 'Known', o: 'Owner', v: 'verified' }])
  const index = JSON.stringify([['owner', 'known'], ['x'], null, ['owner', 'new']])
  const merged = JSON.parse(mergeCatalog(catalog, index))
  assert.equal(merged.length, 2)
  assert.equal(merged[0].v, 'verified')
  assert.equal(merged[1].s, 'new')
})

test('mergeCatalog refuses non-array inputs', () => {
  assert.throws(() => mergeCatalog('{}', '[]'), /unexpected catalog shape/)
  assert.throws(() => mergeCatalog('[]', '{}'), /unexpected index shape/)
})
