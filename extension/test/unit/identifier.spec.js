'use strict'

const assert = require('assert')
const {
  getIdentifierType,
  getIdentifierSource,
  getProductIdentifier,
  encodeIdentifier
} = require('../../lib/identifier')

describe('lib/identifier', () => {
  describe('getIdentifierType()', () => {
    it('takes over a supported value', () => {
      assert.strictEqual(getIdentifierType({ productIdentifierType: 'gtin' }), 'gtin')
    })

    it('falls back to sku for an unsaved or unknown value', () => {
      assert.strictEqual(getIdentifierType({}), 'sku')
      assert.strictEqual(getIdentifierType({ productIdentifierType: 'ean' }), 'sku')
    })
  })

  describe('getIdentifierSource()', () => {
    it('takes over a supported value', () => {
      assert.strictEqual(
        getIdentifierSource({ productIdentifierSource: 'identifiers.ean' }),
        'identifiers.ean'
      )
    })

    it('falls back to identifiers.sku for an unsaved or unknown value', () => {
      assert.strictEqual(getIdentifierSource({}), 'identifiers.sku')
      assert.strictEqual(
        getIdentifierSource({ productIdentifierSource: 'identifiers.upc' }),
        'identifiers.sku'
      )
    })
  })

  describe('getProductIdentifier()', () => {
    const product = { id: 'SG117', identifiers: { sku: ' SKU-4711 ', ean: 4001234567890 } }

    it('reads a nested identifier and trims it', () => {
      assert.strictEqual(getProductIdentifier(product, 'identifiers.sku'), 'SKU-4711')
    })

    it('reads the product id', () => {
      assert.strictEqual(getProductIdentifier(product, 'id'), 'SG117')
    })

    it('accepts a numeric identifier', () => {
      assert.strictEqual(getProductIdentifier(product, 'identifiers.ean'), '4001234567890')
    })

    it('returns null when the field is missing, empty or not a product', () => {
      assert.strictEqual(getProductIdentifier(product, 'identifiers.mpn'), null)
      assert.strictEqual(getProductIdentifier({ identifiers: { sku: '   ' } }, 'identifiers.sku'), null)
      assert.strictEqual(getProductIdentifier({}, 'identifiers.sku'), null)
      assert.strictEqual(getProductIdentifier(null, 'identifiers.sku'), null)
    })
  })

  describe('encodeIdentifier()', () => {
    it('hex encodes a sku, as the eTrusted feed expects it', () => {
      assert.strictEqual(encodeIdentifier('SKU-4711', 'sku'), '534b552d34373131')
    })

    it('hex encodes non ascii characters as their utf-8 bytes', () => {
      assert.strictEqual(encodeIdentifier('Ä', 'sku'), 'c384')
    })

    it('leaves gtin and mpn untouched', () => {
      assert.strictEqual(encodeIdentifier('4001234567890', 'gtin'), '4001234567890')
      assert.strictEqual(encodeIdentifier('SKU-4711', 'mpn'), 'SKU-4711')
    })
  })
})
