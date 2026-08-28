'use strict'

/**
 * Drops the least recently touched entries of a storage map once it has grown past a limit.
 *
 * The extension keeps its learned data in single storage entries so that a request costs one read
 * instead of one per product. The price is that such an entry has to stay small. Eviction goes by
 * the timestamp every entry carries - relying on the key order of the object would evict by key
 * instead, because JavaScript sorts integer like keys to the front, and both product ids and hex
 * encoded numeric skus can be integer like.
 * @param {Object} entries Map of key to an entry carrying a numeric ts.
 * @param {number} max The number of entries to keep.
 * @returns {Object} The map, capped to max entries.
 */
const capEntries = (entries, max) => {
  const keys = Object.keys(entries)

  if (keys.length <= max) {
    return entries
  }

  return keys
    .sort((a, b) => (entries[b].ts || 0) - (entries[a].ts || 0))
    .slice(0, max)
    .reduce((capped, key) => Object.assign(capped, { [key]: entries[key] }), {})
}

module.exports = { capEntries }
