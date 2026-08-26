'use strict'

const assert = require('assert')

const {
  MAX_KNOWN_IDENTIFIERS,
  TOUCH_INTERVAL_MS,
  buildStorageKey,
  collectBaseIdentifiers,
  getBaseIdentifiers
} = require('../../lib/baseProducts')

const SOURCE = 'identifiers.sku'

let storage = {}
let setCalls = 0

/**
 * @returns {Object} A step context.
 */
const createContext = () => ({
  storage: {
    extension: {
      get: async key => storage[key],
      set: async (key, value) => {
        setCalls += 1
        storage[key] = value
      }
    }
  },
  log: { debug: () => {}, warn: () => {}, info: () => {}, error: () => {} }
})

describe('baseProducts', () => {
  beforeEach(() => {
    storage = {}
    setCalls = 0
  })

  describe('buildStorageKey', () => {
    it('keeps the identifier source apart', () => {
      assert.notStrictEqual(buildStorageKey('identifiers.sku'), buildStorageKey('identifiers.ean'))
      assert.strictEqual(buildStorageKey('identifiers.sku').includes('.'), false)
    })
  })

  describe('collectBaseIdentifiers', () => {
    it('picks base products up by their type', () => {
      const identifiers = collectBaseIdentifiers([
        { id: 'a', type: 'parent', identifiers: { sku: 'A' } },
        { id: 'b', type: 'simple', identifiers: { sku: 'B' } }
      ], SOURCE)

      assert.deepStrictEqual(identifiers, { a: 'A' })
    })

    it('picks base products up by their flags', () => {
      const identifiers = collectBaseIdentifiers([
        { id: 'a', flags: { hasVariants: true }, identifiers: { sku: 'A' } },
        { id: 'b', flags: { hasChildren: true }, identifiers: { sku: 'B' } }
      ], SOURCE)

      assert.deepStrictEqual(identifiers, { a: 'A', b: 'B' })
    })

    it('picks a base product up when a variant of the same request points at it', () => {
      const identifiers = collectBaseIdentifiers([
        { id: 'a', identifiers: { sku: 'A' } },
        { id: 'b', baseProductId: 'a', identifiers: { sku: 'B' } }
      ], SOURCE)

      assert.deepStrictEqual(identifiers, { a: 'A' })
    })

    it('ignores variants and products without an identifier', () => {
      const identifiers = collectBaseIdentifiers([
        { id: 'a', type: 'parent' },
        { id: 'b', type: 'variant', baseProductId: 'a', identifiers: { sku: 'B' } }
      ], SOURCE)

      assert.deepStrictEqual(identifiers, {})
    })
  })

  describe('getBaseIdentifiers', () => {
    it('writes only when it has learned something new', async () => {
      const products = [{ id: 'a', type: 'parent', identifiers: { sku: 'A' } }]

      await getBaseIdentifiers(createContext(), products, SOURCE)
      assert.strictEqual(setCalls, 1)

      await getBaseIdentifiers(createContext(), products, SOURCE)
      assert.strictEqual(setCalls, 1)
    })

    it('writes again when the identifier of a base product changed', async () => {
      await getBaseIdentifiers(
        createContext(),
        [{ id: 'a', type: 'parent', identifiers: { sku: 'A' } }],
        SOURCE
      )

      const identifiers = await getBaseIdentifiers(
        createContext(),
        [{ id: 'a', type: 'parent', identifiers: { sku: 'A2' } }],
        SOURCE
      )

      assert.strictEqual(setCalls, 2)
      assert.strictEqual(identifiers.a, 'A2')
    })

    it('drops the oldest entries once the memory is full', async () => {
      const stored = {}

      for (let i = 0; i < MAX_KNOWN_IDENTIFIERS; i += 1) {
        stored[`old-${i}`] = { ts: 1, identifier: `sku-old-${i}` }
      }

      storage[buildStorageKey(SOURCE)] = stored

      const products = Array.from({ length: 10 }, (unused, index) => ({
        id: `new-${index}`,
        type: 'parent',
        identifiers: { sku: `sku-new-${index}` }
      }))

      await getBaseIdentifiers(createContext(), products, SOURCE)

      const written = storage[buildStorageKey(SOURCE)]

      assert.strictEqual(Object.keys(written).length, MAX_KNOWN_IDENTIFIERS)
      assert.strictEqual(written['new-9'].identifier, 'sku-new-9')
      assert.strictEqual(written['new-0'].identifier, 'sku-new-0')
    })

    it('refreshes an entry that keeps being seen, so that it does not age out', async () => {
      const products = [{ id: 'a', type: 'parent', identifiers: { sku: 'A' } }]

      storage[buildStorageKey(SOURCE)] = {
        a: { ts: Date.now() - (TOUCH_INTERVAL_MS + 1000), identifier: 'A' }
      }

      await getBaseIdentifiers(createContext(), products, SOURCE)

      assert.strictEqual(setCalls, 1)
      assert.ok(storage[buildStorageKey(SOURCE)].a.ts > Date.now() - 1000)
    })

    it('does not overwrite the memory when it could not be read', async () => {
      const context = {
        storage: {
          extension: {
            get: async () => { throw new Error('down') },
            set: async () => { setCalls += 1 }
          }
        },
        log: { debug: () => {}, warn: () => {}, info: () => {}, error: () => {} }
      }

      const identifiers = await getBaseIdentifiers(
        context,
        [{ id: 'a', type: 'parent', identifiers: { sku: 'A' } }],
        SOURCE
      )

      assert.deepStrictEqual(identifiers, { a: 'A' })
      assert.strictEqual(setCalls, 0)
    })

    it('ignores stored entries that do not carry a usable shape', async () => {
      storage[buildStorageKey(SOURCE)] = { a: 'plain-string', b: { identifier: 'B' }, c: { ts: 1, identifier: 'C' } }

      const identifiers = await getBaseIdentifiers(createContext(), [], SOURCE)

      assert.deepStrictEqual(identifiers, { c: 'C' })
    })
  })
})
