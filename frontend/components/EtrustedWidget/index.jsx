import React, { useEffect } from 'react';
import PropTypes from 'prop-types';
import loadWidgetScript from '../../helpers/widgetScript';
import { WIDGET_TAG_NAME, WIDGET_ID_ATTRIBUTE, IDENTIFIER_TYPES } from '../../constants';

/**
 * Renders a Trusted Shops widget.
 *
 * <etrusted-widget> is a custom element that the widget script registers. It picks the product up
 * from a data attribute whose name says which kind of identifier it carries, which is why the
 * element is built with createElement instead of JSX.
 *
 * The element renders into a closed shadow root, so its appearance cannot be changed from the app
 * - colours, theme and language come from the Trusted Shops Control Center.
 * @param {Object} props The component props.
 * @param {string} props.widgetId The widget id from the Trusted Shops Control Center.
 * @param {string} [props.identifier] The product identifier, for product related widgets.
 * @param {string} [props.identifierType] The kind of the identifier.
 * @returns {JSX.Element}
 */
const EtrustedWidget = ({ widgetId, identifier, identifierType }) => {
  // The subscriber injects the script at app start, but only when a widget id is configured. A
  // badge that a page builder widget carries its own id for would otherwise render an element that
  // nothing ever upgrades.
  useEffect(() => {
    loadWidgetScript();
  }, []);

  const attributes = { [WIDGET_ID_ATTRIBUTE]: widgetId };

  if (identifier) {
    attributes[`data-${identifierType}`] = identifier;
  }

  return React.createElement(WIDGET_TAG_NAME, attributes);
};

EtrustedWidget.propTypes = {
  widgetId: PropTypes.string.isRequired,
  identifier: PropTypes.string,
  identifierType: PropTypes.oneOf(IDENTIFIER_TYPES),
};

EtrustedWidget.defaultProps = {
  identifier: null,
  identifierType: null,
};

export default EtrustedWidget;
