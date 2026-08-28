'use strict'

const {
  getIdentifierType,
  getIdentifierSource,
  getProductIdentifier,
  encodeIdentifier
} = require('./lib/identifier')
const { getBaseIdentifiers } = require('./lib/baseProducts')
const { fetchGrades } = require('./lib/grades')

// The theme keeps rating.average on a 0..100 scale and divides it by 20 again before it draws the
// stars (RATING_SCALE_DIVISOR in @shopgate/pwa-ui-shared/RatingStars/constants.js), while Trusted
// Shops reports a rating from 0 to 5.
const RATING_SCALE_FACTOR = 20
const MAX_RATING = 5

const EMPTY_RATING = { average: 0, count: 0, reviewCount: 0 }

// Marks a variant whose base product the extension has not seen yet. Telling it apart from a
// product without an identifier matters: that one keeps the rating of the shop, this one must not.
const UNKNOWN_BASE_PRODUCT = Symbol('unknownBaseProduct')

const CHANNEL_ID_PATTERN = /^chl-[A-Za-z0-9-]+$/

/**
 * Turns a Trusted Shops grade into the rating object of a Shopgate product.
 *
 * Trusted Shops knows how many ratings a product has, but not how many of them carry a written
 * text, so count and reviewCount are the same number. Nothing in the theme reads reviewCount.
 * @param {Object} grade The grade as fetchGrades() returns it.
 * @returns {Object} The rating of the product.
 */
const toRating = (grade) => {
  const rating = Math.min(Math.max(grade.rating, 0), MAX_RATING)

  return {
    average: Math.round(rating * RATING_SCALE_FACTOR * 100) / 100,
    count: grade.count,
    reviewCount: grade.count
  }
}

/**
 * Replaces the rating of every product with the Trusted Shops rating.
 *
 * The theme renders the rating stars of product cards, grids and sliders without a portal around
 * them, so the only way to show Trusted Shops stars there is to replace the data the theme reads.
 * Doing it here covers every place at once: product lists, sliders, the product detail page,
 * favourites and search.
 *
 * Variants are looked up under the identifier of their base product, because that is where Trusted
 * Shops keeps the reviews of the whole product family and what the web shop and the product detail
 * page show.
 *
 * The step never lets Trusted Shops break the catalog. Without a channel, without an identifier,
 * when the feed cannot be read or as long as the channel has never delivered a rating, the products
 * are passed through with the rating of the shop.
 * @param {Object} context The step context.
 * @param {Object} input The step input.
 * @param {Object[]} input.products The products of the catalog pipeline.
 * @returns {Promise<Object>} The products with replaced ratings.
 */
module.exports = async (context, input) => {
  const { products } = input

  if (!Array.isArray(products) || products.length === 0) {
    return { products }
  }

  const config = context.config || {}
  const channelId = typeof config.etrustedChannelId === 'string'
    ? config.etrustedChannelId.trim()
    : ''

  if (!channelId) {
    return { products }
  }

  if (!CHANNEL_ID_PATTERN.test(channelId)) {
    context.log.warn(
      { channelId },
      'Trusted Shops channel id does not look like a channel id, the ratings of the shop are kept'
    )

    return { products }
  }

  const type = getIdentifierType(config)
  const source = getIdentifierSource(config)
  const baseIdentifiers = await getBaseIdentifiers(context, products, source)

  const lookups = products.map((product) => {
    if (!product) {
      return null
    }

    if (product.baseProductId) {
      const identifier = baseIdentifiers[product.baseProductId]

      return identifier ? encodeIdentifier(identifier, type) : UNKNOWN_BASE_PRODUCT
    }

    const identifier = getProductIdentifier(product, source)

    return identifier ? encodeIdentifier(identifier, type) : null
  })

  const unknown = products.filter((product, index) => lookups[index] === UNKNOWN_BASE_PRODUCT)

  if (unknown.length === products.length && Object.keys(baseIdentifiers).length === 0) {
    context.log.warn(
      { products: products.length },
      'Trusted Shops knows no base product at all, every product of this request is treated as a variant'
    )
  } else if (unknown.length) {
    context.log.debug(
      { productIds: unknown.map(product => product.id) },
      'Trusted Shops base product of these variants is not known yet'
    )
  }

  const uniqueIdentifiers = [...new Set(lookups.filter(lookup => typeof lookup === 'string'))]

  const { grades, verified } = await fetchGrades(context, channelId, type, uniqueIdentifiers)

  // The feed answers a request for an unknown channel with the same empty document it uses for a
  // product without reviews. Until a real rating has come back at least once, an empty answer is
  // therefore not proof that a product has no reviews, and clearing the stars on it would strip
  // them off the whole catalog over a mistyped channel id. This holds for a request of one product
  // as much as for a whole category page.
  if (!verified) {
    context.log.warn(
      { channelId, identifierType: type, identifierSource: source },
      'Trusted Shops has not delivered a single rating for this channel yet, so the ratings of the shop are kept - check the channel id and the identifier configuration'
    )

    return { products }
  }

  return {
    products: products.map((product, index) => {
      const lookup = lookups[index]

      // A variant whose base product has not passed through yet would be shown with the reviews of
      // that single variant, which is a different number than the one the web shop and the product
      // detail page show. No stars is the honest answer until the base product has been seen.
      if (lookup === UNKNOWN_BASE_PRODUCT) {
        return { ...product, rating: { ...EMPTY_RATING } }
      }

      if (!lookup) {
        return product
      }

      const grade = grades[lookup]

      // A failed lookup leaves the rating of the shop in place, an empty answer means Trusted
      // Shops has no reviews for this product and clears the stars.
      if (!grade) {
        return product
      }

      return {
        ...product,
        rating: grade.found ? toRating(grade) : { ...EMPTY_RATING }
      }
    })
  }
}
