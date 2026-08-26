// The one script the Trusted Shops integration needs. It registers the <etrusted-widget> custom
// element, which then loads the actual widget for the configured widget id.
export const WIDGET_SCRIPT_URL = 'https://integrations.etrusted.com/applications/widget.js/v2';
export const WIDGET_SCRIPT_ID = 'trusted-shops-widgets';

export const WIDGET_TAG_NAME = 'etrusted-widget';
export const WIDGET_ID_ATTRIBUTE = 'data-etrusted-widget-id';

export const IDENTIFIER_TYPE_SKU = 'sku';
export const IDENTIFIER_TYPE_GTIN = 'gtin';
export const IDENTIFIER_TYPE_MPN = 'mpn';
export const IDENTIFIER_TYPES = [
  IDENTIFIER_TYPE_SKU,
  IDENTIFIER_TYPE_GTIN,
  IDENTIFIER_TYPE_MPN,
];

export const SOURCE_PRODUCT_ID = 'id';
export const SOURCE_PREFIX_IDENTIFIERS = 'identifiers.';
export const IDENTIFIER_SOURCE_SKU = 'identifiers.sku';
export const IDENTIFIER_SOURCES = [
  IDENTIFIER_SOURCE_SKU,
  'identifiers.ean',
  'identifiers.mpn',
  SOURCE_PRODUCT_ID,
];

// The theme keeps rating.average on a 0..100 scale (RATING_SCALE_DIVISOR in
// @shopgate/pwa-ui-shared/RatingStars/constants.js), while a rating is read as 0 to 5.
export const RATING_SCALE_DIVISOR = 20;
export const RATING_DECIMALS = 2;

// Stable class names, so that the appearance can be adjusted from outside - for example with
// @shopgate-project/content-styling - without touching this extension.
export const RATING_CLASS = 'trusted-shops-reviews__rating';
export const RATING_VALUE_CLASS = 'trusted-shops-reviews__rating-value';
export const RATING_COUNT_CLASS = 'trusted-shops-reviews__rating-count';
export const LIST_RATING_CLASS = 'trusted-shops-reviews__list-rating';

// The rating stars of the theme, the element the list rating attaches itself to.
export const RATING_STARS_SELECTOR = '.ui-shared__rating-stars';

// How far to walk up from the portal position while looking for the stars of the same card. Deep
// enough for both card layouts, shallow enough not to reach a neighbouring card.
export const RATING_STARS_MAX_DEPTH = 4;

// The rating stars of the product detail page scroll to this element when they are tapped.
export const REVIEWS_ANCHOR_ID = 'reviewsExcerpt';
