'use strict'

const { getProductIdentifier } = require('./identifier')
const { capEntries } = require('./storage')

const STORAGE_KEY_PREFIX = 'baseIdentifiers'

// The learned identifiers live in a single storage entry, so resolving them costs one read per
// request. The number of entries is capped to keep that entry small; the least recently seen ones
// are dropped and learned again the next time their product passes through.
const MAX_KNOWN_IDENTIFIERS = 500

// An entry that is still being seen is written again after this time, so that a base product which
// keeps appearing stays young and is not evicted before one that was learned once and never again.
const TOUCH_INTERVAL_MS = 60 * 60 * 1000

/**
 * Builds the storage key the learned identifiers are kept under. The source is part of it - a shop
 * that switches the product field its identifiers come from would otherwise keep being served the
 * values of the old field.
 * @param {string} source One of the entries of IDENTIFIER_SOURCES.
 * @returns {string}
 */
const buildStorageKey = source => (
  `${STORAGE_KEY_PREFIX}_${source.replace(/[^a-zA-Z0-9]/g, '_')}`
)

/**
 * Tells whether a product can be the base product of a variant. Connectors express that either
 * through the product type or through the flags, so both are accepted, and so is a product that
 * another product of the same request points at.
 * @param {Object} product The product as it comes out of the catalog pipeline.
 * @param {Set} referencedIds The base product ids the current request points at.
 * @returns {boolean}
 */
const isBaseProduct = (product, referencedIds) => {
  if (!product || product.baseProductId) {
    return false
  }

  const flags = product.flags || {}

  return product.type === 'parent' ||
    flags.hasVariants === true ||
    flags.hasChildren === true ||
    referencedIds.has(product.id)
}

/**
 * Maps the id of every base product of a request to its Trusted Shops identifier.
 * @param {Object[]} products The products of the catalog pipeline.
 * @param {string} source One of the entries of IDENTIFIER_SOURCES.
 * @returns {Object} Map of product id to identifier.
 */
const collectBaseIdentifiers = (products, source) => {
  const referencedIds = new Set(
    products.map(product => product && product.baseProductId).filter(Boolean)
  )

  return products.reduce((identifiers, product) => {
    if (!isBaseProduct(product, referencedIds)) {
      return identifiers
    }

    const identifier = getProductIdentifier(product, source)

    return identifier
      ? Object.assign(identifiers, { [product.id]: identifier })
      : identifiers
  }, {})
}

/**
 * Reads the entries learned so far.
 *
 * A storage that is unavailable must not take the pipeline down, and it must not be mistaken for
 * an empty memory either: null tells the caller that the memory could not be read, so that it does
 * not overwrite what is stored with the little it knows itself.
 * @param {Object} context The step context.
 * @param {string} source One of the entries of IDENTIFIER_SOURCES.
 * @returns {Promise<Object|null>} Map of product id to { ts, identifier }, or null on failure.
 */
const readEntries = async (context, source) => {
  try {
    const stored = await context.storage.extension.get(buildStorageKey(source))

    if (!stored || typeof stored !== 'object') {
      return {}
    }

    return Object.keys(stored).reduce((entries, id) => {
      const entry = stored[id]

      if (!entry || typeof entry.ts !== 'number' || typeof entry.identifier !== 'string') {
        return entries
      }

      return Object.assign(entries, { [id]: entry })
    }, {})
  } catch (err) {
    context.log.debug(
      { message: err.message },
      'Trusted Shops base product identifiers could not be read'
    )

    return null
  }
}

/**
 * Stores the learned entries.
 * @param {Object} context The step context.
 * @param {string} source One of the entries of IDENTIFIER_SOURCES.
 * @param {Object} entries Map of product id to { ts, identifier }.
 * @returns {Promise<void>}
 */
const writeEntries = async (context, source, entries) => {
  try {
    await context.storage.extension.set(
      buildStorageKey(source),
      capEntries(entries, MAX_KNOWN_IDENTIFIERS)
    )
  } catch (err) {
    context.log.debug(
      { message: err.message },
      'Trusted Shops base product identifiers could not be written'
    )
  }
}

/**
 * Resolves the identifiers of the base products the extension knows about.
 *
 * Trusted Shops keeps the reviews of a product family on the base product, and so does the web
 * shop, but a variant rarely travels together with its base product - a single product tile on the
 * start page and a search result carry the variant alone. Every request therefore teaches the
 * extension the identifiers of the base products it carries, and those are read back here.
 * @param {Object} context The step context.
 * @param {Object[]} products The products of the catalog pipeline.
 * @param {string} source One of the entries of IDENTIFIER_SOURCES.
 * @returns {Promise<Object>} Map of product id to identifier.
 */
const getBaseIdentifiers = async (context, products, source) => {
  const stored = await readEntries(context, source)
  const known = stored || {}
  const learned = collectBaseIdentifiers(products, source)
  const now = Date.now()

  const changed = Object.keys(learned).filter((id) => {
    const entry = known[id]

    return !entry ||
      entry.identifier !== learned[id] ||
      now - entry.ts > TOUCH_INTERVAL_MS
  })

  const entries = changed.reduce((updated, id) => (
    Object.assign(updated, { [id]: { ts: now, identifier: learned[id] } })
  ), { ...known })

  // Writing what was just read back would replace the stored entries with the handful this request
  // happens to know, so a single failed read must not lead to a write.
  if (stored && changed.length) {
    await writeEntries(context, source, entries)
  }

  return Object.keys(entries).reduce((identifiers, id) => (
    Object.assign(identifiers, { [id]: entries[id].identifier })
  ), {})
}

module.exports = {
  MAX_KNOWN_IDENTIFIERS,
  TOUCH_INTERVAL_MS,
  buildStorageKey,
  collectBaseIdentifiers,
  getBaseIdentifiers
}
