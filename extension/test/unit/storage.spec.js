'use strict'

const assert = require('assert')

const { capEntries } = require('../../lib/storage')

describe('lib/storage', () => {
  describe('capEntries()', () => {
    it('keeps a map that is still small enough untouched', () => {
      const entries = { a: { ts: 1 }, b: { ts: 2 } }

      assert.strictEqual(capEntries(entries, 2), entries)
    })

    it('drops the least recently touched entries', () => {
      const entries = {
        old: { ts: 100 },
        newer: { ts: 300 },
        oldest: { ts: 50 },
        newest: { ts: 400 }
      }

      assert.deepStrictEqual(
        Object.keys(capEntries(entries, 2)).sort(),
        ['newer', 'newest']
      )
    })

    it('evicts by timestamp even when the keys are integer like', () => {
      // JavaScript sorts integer like keys to the front of Object.keys(), so an eviction that went
      // by key order would drop the lowest numbers instead of the oldest entries. Product ids and
      // hex encoded numeric skus both look like this.
      const entries = {
        500: { ts: 500 },
        400: { ts: 400 },
        300: { ts: 300 },
        200: { ts: 200 },
        100: { ts: 100 }
      }

      assert.deepStrictEqual(Object.keys(capEntries(entries, 2)).sort(), ['400', '500'])
    })

    it('treats an entry without a timestamp as the oldest one', () => {
      const entries = { broken: {}, kept: { ts: 1 } }

      assert.deepStrictEqual(Object.keys(capEntries(entries, 1)), ['kept'])
    })
  })
})
