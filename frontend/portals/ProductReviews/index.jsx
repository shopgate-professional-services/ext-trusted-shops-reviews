import React from 'react';
import PropTypes from 'prop-types';
import { useSelector } from 'react-redux';
import { getProductDataById } from '@shopgate/engage/product';
import { makeStyles } from '@shopgate/engage/styles';
import EtrustedWidget from '../../components/EtrustedWidget';
import { getProductIdentifier } from '../../helpers';
import { settings } from '../../settings';
import { REVIEWS_ANCHOR_ID } from '../../constants';

// The widget brings no outer spacing of its own, so it would sit flush against the edges of the
// screen. The values match the other blocks of the product detail page, e.g. the description.
const useStyles = makeStyles()(theme => ({
  container: {
    padding: theme.spacing(0, 2, 2),
  },
}));

/**
 * Replaces the review section of the product detail page with the Trusted Shops review widget.
 *
 * The component is registered on the product.reviews portal of the product detail page and on the
 * product.reviews.all portal of the page that lists all reviews. Both are override portals: the
 * original content arrives as children, and rendering it is how the component stays out of the way
 * whenever it has nothing to show.
 * @param {Object} props The component props.
 * @param {string} [props.productId] The id of the base product, passed along by the portal.
 * @param {JSX.Element} [props.children] The original content of the portal.
 * @returns {React.ReactNode} The Trusted Shops widget, the original content, or nothing.
 */
const ProductReviews = ({ productId, children }) => {
  const { classes } = useStyles();
  const product = useSelector(state => (
    productId ? getProductDataById(state, { productId }) : null
  ));

  // The page that lists all reviews takes its product from the route, which can be a variant when
  // it is opened through a deep link. Trusted Shops keeps the reviews of a product family on the
  // main product, so the widget has to be addressed with that one wherever the id comes from.
  const baseProductId = product ? product.baseProductId : null;
  const baseProduct = useSelector(state => (
    baseProductId ? getProductDataById(state, { productId: baseProductId }) : null
  ));

  if (!settings.showProductReviews) {
    return null;
  }

  if (!settings.productReviewWidgetId) {
    return children;
  }

  const identifier = getProductIdentifier(baseProduct || product, settings.identifierSource);

  if (!identifier) {
    return children;
  }

  // Whether a product has reviews at all is left to the widget - it hides itself when the Control
  // Center option "hide when empty" is set. Deciding that here from the rating count would misfire
  // whenever the backend step has not replaced the rating, and would hide real reviews.
  return (
    <div id={REVIEWS_ANCHOR_ID} className={classes.container}>
      <EtrustedWidget
        key={identifier}
        widgetId={settings.productReviewWidgetId}
        identifier={identifier}
        identifierType={settings.identifierType}
      />
    </div>
  );
};

ProductReviews.propTypes = {
  children: PropTypes.node,
  productId: PropTypes.string,
};

ProductReviews.defaultProps = {
  children: null,
  productId: null,
};

// No memo() here - the Portal component rebuilds the props on every render and spreads a freshly
// created children element into them, so the props identity always changes.
export default ProductReviews;
