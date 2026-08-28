import { toText, toOneOf, getProductIdentifier } from './index';

describe('helpers', () => {
  describe('toText()', () => {
    it('should trim a string and turn anything else into an empty string', () => {
      expect(toText('  chl-1 ')).toBe('chl-1');
      expect(toText('')).toBe('');
      expect(toText(null)).toBe('');
      expect(toText(5)).toBe('');
    });
  });

  describe('toOneOf()', () => {
    it('should take over a supported value', () => {
      expect(toOneOf('gtin', ['sku', 'gtin'], 'sku')).toBe('gtin');
    });

    it('should fall back for an unsupported value', () => {
      expect(toOneOf('ean', ['sku', 'gtin'], 'sku')).toBe('sku');
      expect(toOneOf(undefined, ['sku', 'gtin'], 'sku')).toBe('sku');
    });
  });

  describe('getProductIdentifier()', () => {
    const product = {
      id: 'SG117',
      identifiers: {
        sku: ' SKU-4711 ',
        ean: 4001234567890,
      },
    };

    it('should read a nested identifier and trim it', () => {
      expect(getProductIdentifier(product, 'identifiers.sku')).toBe('SKU-4711');
    });

    it('should read the product id', () => {
      expect(getProductIdentifier(product, 'id')).toBe('SG117');
    });

    it('should accept a numeric identifier', () => {
      expect(getProductIdentifier(product, 'identifiers.ean')).toBe('4001234567890');
    });

    it('should return null when there is nothing to read', () => {
      expect(getProductIdentifier(product, 'identifiers.mpn')).toBeNull();
      expect(getProductIdentifier({ identifiers: { sku: '  ' } }, 'identifiers.sku')).toBeNull();
      expect(getProductIdentifier({}, 'identifiers.sku')).toBeNull();
      expect(getProductIdentifier(null, 'identifiers.sku')).toBeNull();
    });
  });
});
