import React from 'react';
import PropTypes from 'prop-types';
import EtrustedWidget from '../../components/EtrustedWidget';
import { toText } from '../../helpers';
import { settings } from '../../settings';

/**
 * Renders a shop wide Trusted Shops widget - the trust badge or the shop rating - on any page the
 * merchant places it on via the page builder.
 *
 * The widget id of the extension configuration is used by default; a widget instance can point to
 * a different one through its own settings, which is what makes several badges on one page work.
 * @param {Object} props The component props.
 * @param {Object} [props.settings] The settings of this widget instance.
 * @returns {JSX.Element|null}
 */
const ShopReviews = ({ settings: widgetSettings }) => {
  const widgetId = toText(widgetSettings.widgetId) || settings.shopReviewsWidgetId;

  if (!widgetId) {
    return null;
  }

  return <EtrustedWidget widgetId={widgetId} />;
};

ShopReviews.propTypes = {
  settings: PropTypes.shape({
    widgetId: PropTypes.string,
  }),
};

ShopReviews.defaultProps = {
  settings: {},
};

export default ShopReviews;
