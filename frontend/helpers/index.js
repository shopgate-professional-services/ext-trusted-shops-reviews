import { SOURCE_PRODUCT_ID, SOURCE_PREFIX_IDENTIFIERS } from '../constants';

/**
 * Turns a config value into a trimmed string.
 * @param {*} value The raw config value.
 * @returns {string}
 */
export const toText = value => (typeof value === 'string' ? value.trim() : '');

/**
 * Falls back to a default whenever the configured value is not one of the supported ones. An
 * admin config value only reaches the extension once it has been saved in the Developer Center,
 * so every key needs a working fallback.
 * @param {*} value The raw config value.
 * @param {string[]} supported The supported values.
 * @param {string} fallback The value to use when the config value is not supported.
 * @returns {string}
 */
export const toOneOf = (value, supported, fallback) => (
  supported.includes(value) ? value : fallback
);

/**
 * Reads the Trusted Shops product identifier out of a Shopgate product. Shops deliver identifiers
 * in their native type, so numbers are accepted as well as strings.
 * @param {Object} product The product data.
 * @param {string} source One of the entries of IDENTIFIER_SOURCES.
 * @returns {string|null} The identifier, or null when the product does not carry one.
 */
export const getProductIdentifier = (product, source) => {
  if (!product) {
    return null;
  }

  const raw = source === SOURCE_PRODUCT_ID
    ? product.id
    : (product.identifiers || {})[source.slice(SOURCE_PREFIX_IDENTIFIERS.length)];

  if (typeof raw !== 'string' && typeof raw !== 'number') {
    return null;
  }

  return String(raw).trim() || null;
};
