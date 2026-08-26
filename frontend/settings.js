// Resolved values from the generated frontend/config.json (destination: frontend). The file is
// written by the SDK per environment and therefore not part of the repository.
import config from './config.json';
import { toText, toOneOf } from './helpers';
import {
  IDENTIFIER_TYPES,
  IDENTIFIER_TYPE_SKU,
  IDENTIFIER_SOURCES,
  IDENTIFIER_SOURCE_SKU,
} from './constants';

export const settings = {
  productReviewWidgetId: toText(config.productReviewWidgetId),
  shopReviewsWidgetId: toText(config.shopReviewsWidgetId),
  // The merchant has to be able to switch the reviews off, so anything but an explicit false
  // keeps them - including a config that has never been saved.
  showProductReviews: config.showProductReviews !== false,
  // Adding the rating value next to the stars changes what the theme renders, so it stays off
  // until a merchant asks for it.
  showRatingValue: config.showRatingValue === true,
  // Lists have no portal around their stars, so this one needs a hand written anchor. It stays a
  // separate switch, so that the product detail page can be used without it.
  showRatingValueInLists: config.showRatingValueInLists === true,
  identifierType: toOneOf(config.productIdentifierType, IDENTIFIER_TYPES, IDENTIFIER_TYPE_SKU),
  identifierSource: toOneOf(
    config.productIdentifierSource,
    IDENTIFIER_SOURCES,
    IDENTIFIER_SOURCE_SKU
  ),
};

/**
 * The widget script is only worth loading when at least one widget can be rendered with it.
 */
export const isWidgetScriptNeeded = !!(
  (settings.showProductReviews && settings.productReviewWidgetId) ||
  settings.shopReviewsWidgetId
);
