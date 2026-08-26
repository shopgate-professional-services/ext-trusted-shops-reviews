'use strict'

const assert = require('assert')

const {
  CACHE_TTL_MS,
  FAILURE_TTL_MS,
  buildFeedUrl,
  buildCacheKey,
  pruneCache,
  fetchGrades
} = require('../../lib/grades')

const CHANNEL = 'chl-1'
const GRADE = { found: true, rating: 4.5, count: 12 }

let storage = {}
let reads = 0
let writes = 0

/**
 * @returns {Object} A step context.
 */
const createContext = () => ({
  storage: {
    extension: {
      get: async (key) => {
        reads += 1

        return storage[key]
      },
      set: async (key, value) => {
        writes += 1
        storage[key] = value
      }
    }
  },
  log: { debug: () => {}, warn: () => {}, info: () => {}, error: () => {} }
})

describe('grades', () => {
  beforeEach(() => {
    storage = {}
    reads = 0
    writes = 0
  })

  describe('buildFeedUrl', () => {
    it('builds the eTrusted grades feed url', () => {
      assert.strictEqual(
        buildFeedUrl(CHANNEL, 'sku', '534b552d34373131'),
        'https://integrations.etrusted.com/feeds/grades/v1/channels/chl-1/products/sku/534b552d34373131/feed.json'
      )
    })
  })

  describe('buildCacheKey', () => {
    it('keeps channel and identifier kind apart', () => {
      assert.notStrictEqual(buildCacheKey(CHANNEL, 'sku'), buildCacheKey('chl-2', 'sku'))
      assert.notStrictEqual(buildCacheKey(CHANNEL, 'sku'), buildCacheKey(CHANNEL, 'gtin'))
    })
  })

  describe('pruneCache', () => {
    it('keeps entries that are still valid', () => {
      const entries = { a: { ts: 1000, grade: GRADE } }

      assert.deepStrictEqual(pruneCache(entries, 1000 + CACHE_TTL_MS), entries)
    })

    it('drops expired, empty and malformed entries', () => {
      const entries = {
        expired: { ts: 1000, grade: GRADE },
        malformed: { grade: GRADE },
        empty: { ts: 1000 },
        broken: null,
        valid: { ts: 2000, grade: GRADE }
      }

      assert.deepStrictEqual(
        pruneCache(entries, 2000 + CACHE_TTL_MS),
        { valid: { ts: 2000, grade: GRADE } }
      )
    })

    it('keeps a remembered failure only for its own, much shorter time', () => {
      const entries = { failed: { ts: 1000, failed: true } }

      assert.deepStrictEqual(pruneCache(entries, 1000 + FAILURE_TTL_MS), entries)
      assert.deepStrictEqual(pruneCache(entries, 1000 + FAILURE_TTL_MS + 1), {})

      // Long expired as a failure, but still inside the lifetime of a real grade.
      assert.deepStrictEqual(pruneCache(entries, 1000 + CACHE_TTL_MS), {})
    })
  })

  describe('fetchGrades', () => {
    it('serves a warm cache with a single read and without writing', async () => {
      storage[buildCacheKey(CHANNEL, 'sku')] = {
        a: { ts: Date.now(), grade: GRADE },
        b: { ts: Date.now(), grade: { found: false } }
      }

      const { grades } = await fetchGrades(createContext(), CHANNEL, 'sku', ['a', 'b'])

      assert.deepStrictEqual(grades, { a: GRADE, b: { found: false } })
      assert.strictEqual(reads, 1)
      assert.strictEqual(writes, 0)
    })

    it('reads the cache once, no matter how many products are looked up', async () => {
      const entries = {}
      const identifiers = []

      for (let i = 0; i < 32; i += 1) {
        entries[`id-${i}`] = { ts: Date.now(), grade: GRADE }
        identifiers.push(`id-${i}`)
      }

      storage[buildCacheKey(CHANNEL, 'sku')] = entries

      await fetchGrades(createContext(), CHANNEL, 'sku', identifiers)

      assert.strictEqual(reads, 1)
    })

    it('serves the grades of the requested channel, not of another one', async () => {
      const other = { found: true, rating: 1, count: 1 }

      storage[buildCacheKey(CHANNEL, 'sku')] = { a: { ts: Date.now(), grade: GRADE } }
      storage[buildCacheKey('chl-2', 'sku')] = { a: { ts: Date.now(), grade: other } }
      storage[buildCacheKey(CHANNEL, 'gtin')] = { a: { ts: Date.now(), grade: other } }

      const { grades } = await fetchGrades(createContext(), CHANNEL, 'sku', ['a'])

      assert.deepStrictEqual(grades, { a: GRADE })
    })

    it('reports a channel as verified only once a real rating has been seen', async () => {
      storage[buildCacheKey(CHANNEL, 'sku')] = { a: { ts: Date.now(), grade: { found: false } } }

      const empty = await fetchGrades(createContext(), CHANNEL, 'sku', ['a'])

      assert.strictEqual(empty.verified, false)

      storage[buildCacheKey(CHANNEL, 'sku')].b = { ts: Date.now(), grade: GRADE }

      const withRating = await fetchGrades(createContext(), CHANNEL, 'sku', ['a', 'b'])

      assert.strictEqual(withRating.verified, true)
    })

    it('serves a remembered failure without asking the feed again', async () => {
      storage[buildCacheKey(CHANNEL, 'sku')] = { a: { ts: Date.now(), failed: true } }

      const { grades } = await fetchGrades(createContext(), CHANNEL, 'sku', ['a'])

      // null is what a fresh failure returns too, so the product keeps the rating of the shop.
      assert.deepStrictEqual(grades, { a: null })
      assert.strictEqual(writes, 0)
    })
  })
})
