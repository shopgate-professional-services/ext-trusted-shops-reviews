'use strict'

const IDENTIFIER_TYPE_SKU = 'sku'
const IDENTIFIER_TYPES = [IDENTIFIER_TYPE_SKU, 'gtin', 'mpn']
const DEFAULT_IDENTIFIER_TYPE = IDENTIFIER_TYPE_SKU

const SOURCE_PRODUCT_ID = 'id'
const SOURCE_PREFIX_IDENTIFIERS = 'identifiers.'
const IDENTIFIER_SOURCES = [
  'identifiers.sku',
  'identifiers.ean',
  'identifiers.mpn',
  SOURCE_PRODUCT_ID
]
const DEFAULT_IDENTIFIER_SOURCE = 'identifiers.sku'

/**
 * Falls back to a default whenever the configured value is not one of the supported ones. An
 * admin config value only reaches the extension once it has been saved in the Developer Center,
 * so every key needs a working fallback.
 * @param {*} value The raw config value.
 * @param {string[]} supported The supported values.
 * @param {string} fallback The value to use when the config value is not supported.
 * @returns {string}
 */
const toOneOf = (value, supported, fallback) => (
  supported.includes(value) ? value : fallback
)

/**
 * @param {Object} config The extension config.
 * @returns {string} One of 'sku', 'gtin', 'mpn'.
 */
const getIdentifierType = config => toOneOf(
  config.productIdentifierType, IDENTIFIER_TYPES, DEFAULT_IDENTIFIER_TYPE
)

/**
 * @param {Object} config The extension config.
 * @returns {string} One of the entries of IDENTIFIER_SOURCES.
 */
const getIdentifierSource = config => toOneOf(
  config.productIdentifierSource, IDENTIFIER_SOURCES, DEFAULT_IDENTIFIER_SOURCE
)

/**
 * Reads the Trusted Shops product identifier out of a Shopgate product. Shops deliver identifiers
 * in their native type, so numbers are accepted as well as strings.
 * @param {Object} product The product as it comes out of the catalog pipeline.
 * @param {string} source One of the entries of IDENTIFIER_SOURCES.
 * @returns {string|null} The identifier, or null when the product does not carry one.
 */
const getProductIdentifier = (product, source) => {
  if (!product) {
    return null
  }

  const raw = source === SOURCE_PRODUCT_ID
    ? product.id
    : (product.identifiers || {})[source.slice(SOURCE_PREFIX_IDENTIFIERS.length)]

  if (typeof raw !== 'string' && typeof raw !== 'number') {
    return null
  }

  return String(raw).trim() || null
}

/**
 * Brings an identifier into the form the eTrusted feed URL expects. SKUs go in as the hex
 * representation of their UTF-8 bytes, GTIN and MPN go in unchanged - this mirrors
 * getEncodedIdentifiers() of the Trusted Shops widget, and a plain SKU returns an empty feed.
 * @param {string} identifier The identifier of the product.
 * @param {string} type One of 'sku', 'gtin', 'mpn'.
 * @returns {string}
 */
const encodeIdentifier = (identifier, type) => (
  type === IDENTIFIER_TYPE_SKU
    ? Buffer.from(identifier, 'utf8').toString('hex')
    : identifier
)

module.exports = {
  IDENTIFIER_TYPES,
  IDENTIFIER_SOURCES,
  DEFAULT_IDENTIFIER_TYPE,
  DEFAULT_IDENTIFIER_SOURCE,
  getIdentifierType,
  getIdentifierSource,
  getProductIdentifier,
  encodeIdentifier
}
