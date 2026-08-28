'use strict'

const https = require('https')

const { capEntries } = require('./storage')

const FEED_HOST = 'https://integrations.etrusted.com'
const CACHE_KEY_PREFIX = 'grades'
const CACHE_TTL_MS = 6 * 60 * 60 * 1000

// A lookup that failed is remembered too, for a much shorter time. Without it an outage of Trusted
// Shops would cost every single catalog request the full time budget, over and over.
const FAILURE_TTL_MS = 5 * 60 * 1000

// The grades of a channel live in a single storage entry, so a product list costs one read instead
// of one per product. The entry is capped for the same reason it is shared: it has to stay small.
const MAX_CACHED_GRADES = 500

const REQUEST_TIMEOUT_MS = 2000

// Upper bound for everything the step spends on the feeds in one request. With a cold cache a
// category page would otherwise wait for one batch after the other; once the budget no longer holds
// a full request the remaining products keep the rating of the shop and are looked up on one of the
// next requests. Every request that is started gets the full timeout, so that the budget never
// produces a batch of near certain timeouts.
const TOTAL_BUDGET_MS = 3000

const MAX_PARALLEL_REQUESTS = 16

/**
 * Builds the URL of the eTrusted grades feed for a single product.
 * @param {string} channelId The eTrusted channel of the shop.
 * @param {string} type One of 'sku', 'gtin', 'mpn'.
 * @param {string} encodedIdentifier The identifier as encodeIdentifier() returns it.
 * @returns {string}
 */
const buildFeedUrl = (channelId, type, encodedIdentifier) => [
  FEED_HOST,
  'feeds/grades/v1/channels',
  encodeURIComponent(channelId),
  'products',
  type,
  encodeURIComponent(encodedIdentifier),
  'feed.json'
].join('/')

/**
 * Builds the storage key the grades are cached under. Channel and identifier kind are part of it -
 * a shop that switches either would otherwise keep being served the ratings of the old one until
 * the cache expires.
 * @param {string} channelId The eTrusted channel of the shop.
 * @param {string} type One of 'sku', 'gtin', 'mpn'.
 * @returns {string}
 */
const buildCacheKey = (channelId, type) => `${CACHE_KEY_PREFIX}_${channelId}_${type}`

/**
 * Drops the entries that have expired or that carry nothing usable. A remembered failure expires
 * much earlier than a remembered grade.
 * @param {Object} entries Map of encoded identifier to { ts, grade } or { ts, failed }.
 * @param {number} now The current timestamp.
 * @returns {Object} The entries that are still valid.
 */
const pruneCache = (entries, now) => Object.keys(entries).reduce((cache, identifier) => {
  const entry = entries[identifier]

  if (!entry || typeof entry.ts !== 'number') {
    return cache
  }

  if (entry.failed === true) {
    return now - entry.ts > FAILURE_TTL_MS
      ? cache
      : Object.assign(cache, { [identifier]: entry })
  }

  if (!entry.grade || now - entry.ts > CACHE_TTL_MS) {
    return cache
  }

  return Object.assign(cache, { [identifier]: entry })
}, {})

/**
 * Reads a JSON document over https.
 *
 * The feeds are plain GET requests against a CDN, so the built in https module is enough - that
 * keeps the extension free of runtime dependencies and therefore installable without an npm
 * install of its own.
 * @param {string} url The URL to read.
 * @param {number} timeout Milliseconds after which the request is given up on.
 * @returns {Promise<Object>} The parsed response body.
 */
const requestJson = (url, timeout) => new Promise((resolve, reject) => {
  let settled = false
  let timer = null

  const finish = (callback, value) => {
    if (settled) {
      return
    }

    settled = true
    clearTimeout(timer)
    callback(value)
  }

  const request = https.get(url, { timeout }, (response) => {
    if (response.statusCode !== 200) {
      response.resume()
      finish(reject, new Error(`Unexpected status code ${response.statusCode}`))
      return
    }

    response.setEncoding('utf8')

    let body = ''
    response.on('data', (chunk) => { body += chunk })
    response.on('error', err => finish(reject, err))
    response.on('end', () => {
      try {
        finish(resolve, JSON.parse(body))
      } catch (err) {
        finish(reject, new Error('Response is not valid JSON'))
      }
    })
  })

  // The timeout option only limits inactivity on the socket, so a response that trickles in slowly
  // would outlive the time budget of the whole step. This one is a hard limit.
  timer = setTimeout(() => {
    request.destroy()
    finish(reject, new Error('Request timed out'))
  }, timeout)

  request.on('timeout', () => request.destroy(new Error('Request timed out')))
  request.on('error', err => finish(reject, err))
})

/**
 * Reads the overall grade of a single product from the eTrusted feed.
 *
 * Trusted Shops answers with an empty object for products it has no reviews for. That is a
 * meaningful answer - such a product has no rating - and is told apart from a failed request,
 * which leaves the rating of the shop untouched.
 * @param {Object} context The step context.
 * @param {string} url The feed URL.
 * @param {number} timeout Milliseconds after which the request is given up on.
 * @returns {Promise<Object|null>} { found: false } or { found: true, rating, count }, and null
 *   when the feed could not be read.
 */
const requestGrade = async (context, url, timeout) => {
  try {
    const data = await requestJson(url, timeout)
    const overall = data && data.grades && data.grades.overall

    if (!overall || typeof overall.rating !== 'number') {
      return { found: false }
    }

    return {
      found: true,
      rating: overall.rating,
      count: typeof overall.count === 'number' ? overall.count : 0
    }
  } catch (err) {
    context.log.warn({ url, message: err.message }, 'Trusted Shops grades feed could not be read')
    return null
  }
}

/**
 * Tells whether Trusted Shops has ever answered with a real rating for this channel.
 *
 * The feed answers a request for an unknown channel with the same empty document it uses for a
 * product without reviews, so a single empty answer says nothing. Only once a rating has been seen
 * is it safe to read an empty answer as "this product has no reviews" rather than as "this channel
 * does not exist".
 * @param {Object} entries Map of encoded identifier to entry.
 * @returns {boolean}
 */
const hasSeenARating = entries => Object.keys(entries)
  .some(identifier => entries[identifier].grade && entries[identifier].grade.found)

/**
 * Reads the cached grades of a channel.
 *
 * A storage that is unavailable must not take the pipeline down, and it must not be mistaken for
 * an empty cache either: null tells the caller that the cache could not be read, so that it does
 * not overwrite what is stored with the handful of grades of this request.
 * @param {Object} context The step context.
 * @param {string} channelId The eTrusted channel of the shop.
 * @param {string} type One of 'sku', 'gtin', 'mpn'.
 * @returns {Promise<Object|null>} Map of encoded identifier to entry, or null on failure.
 */
const readCache = async (context, channelId, type) => {
  try {
    const stored = await context.storage.extension.get(buildCacheKey(channelId, type))

    return stored && typeof stored === 'object' ? pruneCache(stored, Date.now()) : {}
  } catch (err) {
    context.log.debug({ message: err.message }, 'Trusted Shops grade cache could not be read')

    return null
  }
}

/**
 * Stores the grades of a channel.
 * @param {Object} context The step context.
 * @param {string} channelId The eTrusted channel of the shop.
 * @param {string} type One of 'sku', 'gtin', 'mpn'.
 * @param {Object} entries Map of encoded identifier to entry.
 * @returns {Promise<void>}
 */
const writeCache = async (context, channelId, type, entries) => {
  try {
    await context.storage.extension.set(
      buildCacheKey(channelId, type),
      capEntries(entries, MAX_CACHED_GRADES)
    )
  } catch (err) {
    context.log.debug({ message: err.message }, 'Trusted Shops grade cache could not be written')
  }
}

/**
 * Resolves the Trusted Shops grades for a list of products.
 *
 * Cached grades are served from a single storage entry per channel; the rest is requested in
 * parallel batches within a fixed time budget, so that a cold cache cannot hold the catalog
 * pipeline up for longer than that budget.
 * @param {Object} context The step context.
 * @param {string} channelId The eTrusted channel of the shop.
 * @param {string} type One of 'sku', 'gtin', 'mpn'.
 * @param {string[]} encodedIdentifiers The unique encoded identifiers to look up.
 * @returns {Promise<Object>} The grades, keyed by encoded identifier and null for failed lookups,
 *   together with the information whether this channel has ever delivered a rating at all.
 */
const fetchGrades = async (context, channelId, type, encodedIdentifiers) => {
  const stored = await readCache(context, channelId, type)
  const cache = stored || {}
  const grades = {}
  const misses = []

  encodedIdentifiers.forEach((encodedIdentifier) => {
    const entry = cache[encodedIdentifier]

    if (!entry) {
      misses.push(encodedIdentifier)

      return
    }

    // A remembered failure keeps the rating of the shop, exactly like a fresh one, but spares the
    // request until it expires.
    grades[encodedIdentifier] = entry.failed === true ? null : entry.grade
  })

  if (misses.length === 0) {
    return { grades, verified: hasSeenARating(cache) }
  }

  const deadline = Date.now() + TOTAL_BUDGET_MS
  const fresh = {}
  let attempted = 0

  for (let i = 0; i < misses.length; i += MAX_PARALLEL_REQUESTS) {
    if (deadline - Date.now() < REQUEST_TIMEOUT_MS) {
      break
    }

    const batch = misses.slice(i, i + MAX_PARALLEL_REQUESTS)

    // eslint-disable-next-line no-await-in-loop -- batches are sequential on purpose
    await Promise.all(batch.map(async (encodedIdentifier) => {
      const grade = await requestGrade(
        context,
        buildFeedUrl(channelId, type, encodedIdentifier),
        REQUEST_TIMEOUT_MS
      )

      grades[encodedIdentifier] = grade
      fresh[encodedIdentifier] = grade
        ? { ts: Date.now(), grade }
        : { ts: Date.now(), failed: true }
    }))

    attempted += batch.length
  }

  if (attempted < misses.length) {
    context.log.debug(
      { skipped: misses.length - attempted, budget: TOTAL_BUDGET_MS },
      'Trusted Shops lookups were postponed to a later request, the time budget was used up'
    )
  }

  const entries = { ...cache, ...fresh }

  // Writing what was just read back would replace the stored grades with the handful of this
  // request, so a failed read must not lead to a write.
  if (stored && Object.keys(fresh).length) {
    await writeCache(context, channelId, type, entries)
  }

  return { grades, verified: hasSeenARating(entries) }
}

module.exports = {
  CACHE_TTL_MS,
  FAILURE_TTL_MS,
  MAX_CACHED_GRADES,
  MAX_PARALLEL_REQUESTS,
  REQUEST_TIMEOUT_MS,
  TOTAL_BUDGET_MS,
  buildFeedUrl,
  buildCacheKey,
  pruneCache,
  fetchGrades
}
