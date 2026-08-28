'use strict'

const assert = require('assert')

// The step is loaded with a stubbed grades module, so the tests cover the mapping without touching
// the network. The real module is loaded first and put back afterwards, so that this file works no
// matter in which order the specs are loaded.
const gradesPath = require.resolve('../../lib/grades')
const realGrades = require('../../lib/grades')
let fetchGradesCalls = []
let gradesResult = {}
let gradesVerified = true

const asCacheEntry = exports => ({
  id: gradesPath,
  filename: gradesPath,
  loaded: true,
  exports
})

require.cache[gradesPath] = asCacheEntry({
  fetchGrades: async (context, channelId, type, identifiers) => {
    fetchGradesCalls.push({ channelId, type, identifiers })

    return { grades: gradesResult, verified: gradesVerified }
  }
})

const overrideProductRating = require('../../overrideProductRating')

require.cache[gradesPath] = asCacheEntry(realGrades)

const SHOP_RATING = { average: 60, count: 3, reviewCount: 3 }

let storage = {}

/**
 * @param {Object} [config] The extension config.
 * @returns {Object} A step context.
 */
const createContext = config => ({
  config: { etrustedChannelId: 'chl-1', ...config },
  storage: {
    extension: {
      get: async key => storage[key],
      set: async (key, value) => { storage[key] = value }
    }
  },
  log: { debug: () => {}, warn: () => {}, info: () => {}, error: () => {} }
})

/**
 * @param {string} sku The sku of the product.
 * @returns {Object} A product.
 */
const createProduct = sku => ({
  id: `id-${sku}`,
  identifiers: { sku },
  rating: { ...SHOP_RATING }
})

/**
 * @param {string} sku The sku of the base product.
 * @returns {Object} A base product.
 */
const createBaseProduct = sku => ({
  ...createProduct(sku),
  type: 'parent'
})

/**
 * @param {string} sku The sku of the variant.
 * @param {string} baseSku The sku of its base product.
 * @returns {Object} A variant product.
 */
const createVariant = (sku, baseSku) => ({
  ...createProduct(sku),
  type: 'variant',
  baseProductId: `id-${baseSku}`
})

describe('overrideProductRating', () => {
  beforeEach(() => {
    fetchGradesCalls = []
    gradesResult = {}
    gradesVerified = true
    storage = {}
  })

  it('passes the products through when no channel is configured', async () => {
    const products = [createProduct('A')]
    const result = await overrideProductRating(
      createContext({ etrustedChannelId: '  ' }),
      { products }
    )

    assert.deepStrictEqual(result.products[0].rating, SHOP_RATING)
    assert.strictEqual(fetchGradesCalls.length, 0)
  })

  it('passes an empty or missing product list through', async () => {
    assert.deepStrictEqual(await overrideProductRating(createContext(), { products: [] }), { products: [] })
    assert.deepStrictEqual(await overrideProductRating(createContext(), {}), { products: undefined })
    assert.strictEqual(fetchGradesCalls.length, 0)
  })

  it('looks every identifier up only once', async () => {
    await overrideProductRating(
      createContext(),
      { products: [createProduct('A'), createProduct('A'), createProduct('B')] }
    )

    assert.strictEqual(fetchGradesCalls.length, 1)
    assert.deepStrictEqual(fetchGradesCalls[0].identifiers, ['41', '42'])
    assert.strictEqual(fetchGradesCalls[0].type, 'sku')
  })

  it('scales the Trusted Shops rating onto the 0..100 scale of the theme', async () => {
    gradesResult = { 41: { found: true, rating: 4.73, count: 41 } }

    const { products } = await overrideProductRating(
      createContext(),
      { products: [createProduct('A')] }
    )

    assert.deepStrictEqual(products[0].rating, { average: 94.6, count: 41, reviewCount: 41 })
  })

  it('clears the rating when Trusted Shops has no reviews for the product', async () => {
    gradesResult = { 41: { found: false } }

    const { products } = await overrideProductRating(
      createContext(),
      { products: [createProduct('A')] }
    )

    assert.deepStrictEqual(products[0].rating, { average: 0, count: 0, reviewCount: 0 })
  })

  it('keeps the rating of the shop when the feed could not be read', async () => {
    gradesResult = { 41: null }

    const { products } = await overrideProductRating(
      createContext(),
      { products: [createProduct('A')] }
    )

    assert.deepStrictEqual(products[0].rating, SHOP_RATING)
  })

  it('keeps the rating of products without an identifier', async () => {
    gradesResult = { 41: { found: true, rating: 5, count: 2 } }

    const { products } = await overrideProductRating(
      createContext(),
      { products: [{ id: 'no-sku', rating: { ...SHOP_RATING } }, createProduct('A')] }
    )

    assert.deepStrictEqual(products[0].rating, SHOP_RATING)
    assert.deepStrictEqual(products[1].rating, { average: 100, count: 2, reviewCount: 2 })
  })

  it('looks a variant up under the identifier of its base product', async () => {
    gradesResult = { 50: { found: true, rating: 4.5, count: 10 } }

    const { products } = await overrideProductRating(
      createContext(),
      { products: [createBaseProduct('P'), createVariant('V', 'P')] }
    )

    assert.deepStrictEqual(fetchGradesCalls[0].identifiers, ['50'])
    assert.deepStrictEqual(products[0].rating, { average: 90, count: 10, reviewCount: 10 })
    assert.deepStrictEqual(products[1].rating, { average: 90, count: 10, reviewCount: 10 })
  })

  it('remembers the identifier of a base product for later requests', async () => {
    gradesResult = { 50: { found: true, rating: 5, count: 4 } }

    await overrideProductRating(createContext(), { products: [createBaseProduct('P')] })

    const { products } = await overrideProductRating(
      createContext(),
      { products: [createVariant('V', 'P')] }
    )

    assert.deepStrictEqual(fetchGradesCalls[1].identifiers, ['50'])
    assert.deepStrictEqual(products[0].rating, { average: 100, count: 4, reviewCount: 4 })
  })

  it('clears the stars of a variant whose base product is not known yet', async () => {
    const { products } = await overrideProductRating(
      createContext(),
      { products: [createVariant('V', 'P')] }
    )

    assert.deepStrictEqual(products[0].rating, { average: 0, count: 0, reviewCount: 0 })

    // Nothing to look up, but the channel verdict is still needed before anything is cleared.
    assert.deepStrictEqual(fetchGradesCalls[0].identifiers, [])
  })

  it('never looks a variant up under its own identifier', async () => {
    gradesResult = { 56: { found: true, rating: 5, count: 1 } }

    const { products } = await overrideProductRating(
      createContext(),
      { products: [createVariant('V', 'P')] }
    )

    assert.deepStrictEqual(products[0].rating, { average: 0, count: 0, reviewCount: 0 })
  })

  it('keeps the ratings of the shop until the channel has delivered a rating', async () => {
    // The feed answers a request for an unknown channel with the same empty document it uses for a
    // product without reviews, so this is what a mistyped channel id looks like.
    gradesVerified = false
    gradesResult = { 41: { found: false } }

    const { products } = await overrideProductRating(
      createContext(),
      { products: [createProduct('A')] }
    )

    assert.deepStrictEqual(products[0].rating, SHOP_RATING)
  })

  it('holds a single product back as well, not only whole lists', async () => {
    gradesVerified = false

    const { products } = await overrideProductRating(
      createContext(),
      { products: [{ ...createProduct('V'), type: 'variant', baseProductId: 'id-P' }] }
    )

    assert.deepStrictEqual(products[0].rating, SHOP_RATING)
  })

  it('clears the stars of a single product once the channel is known to work', async () => {
    gradesResult = { 41: { found: false } }

    const { products } = await overrideProductRating(
      createContext(),
      { products: [createProduct('A')] }
    )

    assert.deepStrictEqual(products[0].rating, { average: 0, count: 0, reviewCount: 0 })
  })

  it('passes the products through when the channel id is not a channel id', async () => {
    const { products } = await overrideProductRating(
      createContext({ etrustedChannelId: 'chl-1/../../evil' }),
      { products: [createProduct('A')] }
    )

    assert.deepStrictEqual(products[0].rating, SHOP_RATING)
    assert.strictEqual(fetchGradesCalls.length, 0)
  })

  it('survives a broken entry in the product list', async () => {
    gradesResult = { 41: { found: true, rating: 5, count: 2 } }

    const { products } = await overrideProductRating(
      createContext(),
      { products: [null, createProduct('A')] }
    )

    assert.strictEqual(products[0], null)
    assert.deepStrictEqual(products[1].rating, { average: 100, count: 2, reviewCount: 2 })
  })

  it('clamps a rating outside of the Trusted Shops scale', async () => {
    gradesResult = { 41: { found: true, rating: 6.2, count: 1 } }

    const { products } = await overrideProductRating(
      createContext(),
      { products: [createProduct('A')] }
    )

    assert.deepStrictEqual(products[0].rating, { average: 100, count: 1, reviewCount: 1 })
  })

  it('sends gtin identifiers unencoded', async () => {
    await overrideProductRating(
      createContext({
        productIdentifierType: 'gtin',
        productIdentifierSource: 'identifiers.ean'
      }),
      { products: [{ id: 'x', identifiers: { ean: '4001234567890' }, rating: { ...SHOP_RATING } }] }
    )

    assert.deepStrictEqual(fetchGradesCalls[0].identifiers, ['4001234567890'])
    assert.strictEqual(fetchGradesCalls[0].type, 'gtin')
  })
})
