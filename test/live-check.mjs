/**
 * Live check: real upstream data, no mocks.
 *
 * Run: node test/live-check.mjs
 *
 * Asserts the two things the merge exists for:
 *   1. the sitemap index enumerates far more plugins than the curated export;
 *   2. the author's own repositories (which the export dropped on 2026-10-19)
 *      are still enumerable and therefore still installable from the panel.
 */

import { sitemapLocs, pluginPairs, mergeCatalog } from '../index.js'

const SITEMAP_INDEX = 'https://dsh-plugin.org/sitemaps/plugins.xml'
const CATALOG_URL = 'https://api.dsh-plugin.org/plugins.zh.json'

const get = async (url, tries = 4) => {
  let lastError
  for (let attempt = 1; attempt <= tries; attempt++) {
    try {
      const response = await fetch(url, { headers: { accept: 'application/json' } })
      if (!response.ok) throw new Error(`${url} → HTTP ${String(response.status)}`)
      return await response.text()
    } catch (error) {
      lastError = error
      await new Promise((resolve) => setTimeout(resolve, 500 * attempt))
    }
  }
  throw lastError
}

const indexXml = await get(SITEMAP_INDEX)
const pages = sitemapLocs(indexXml).filter((url) => /\/sitemaps\/plugins\/\d+\.xml$/.test(url))
console.log(`sitemap index: ${String(pages.length)} pages`)

const documents = await Promise.all(pages.map((page) => get(page)))
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
console.log(`sitemap rows: ${String(rows.length)}`)

const catalogBody = await get(CATALOG_URL)
const catalog = JSON.parse(catalogBody)
console.log(`curated catalog: ${String(catalog.length)} rows`)

const merged = JSON.parse(mergeCatalog(catalogBody, JSON.stringify(rows)))
console.log(`merged: ${String(merged.length)} rows (${String(merged.length - catalog.length)} index-only)`)

const mine = merged.filter((entry) => entry.o === 'wojiao42')
console.log(`wojiao42 rows: ${String(mine.length)} → ${mine.map((entry) => `${entry.s}:${entry.v}`).join(', ')}`)

const problems = []
if (rows.length < 10000) problems.push(`sitemap rows too small: ${String(rows.length)}`)
if (merged.length < catalog.length) problems.push('merge dropped rows')
if (mine.length !== 3) problems.push(`expected 3 wojiao42 rows, got ${String(mine.length)}`)
for (const slug of ['dsh-memory-file', 'dsh-token-cost', 'dsh-space-optimizer']) {
  if (!mine.some((entry) => entry.s === slug)) problems.push(`missing ${slug} in merged index`)
}

if (problems.length > 0) {
  console.error('FAIL')
  for (const problem of problems) console.error(` - ${problem}`)
  process.exitCode = 1
} else {
  console.log('OK')
}
