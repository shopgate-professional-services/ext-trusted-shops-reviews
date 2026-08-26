import React from 'react';
import PropTypes from 'prop-types';
import { useSelector } from 'react-redux';
import appConfig, { themeConfig } from '@shopgate/pwa-common/helpers/config';
import { useCurrentProduct } from '@shopgate/engage/core';
import { i18n } from '@shopgate/engage/core/helpers';
import { RatingStars } from '@shopgate/engage/components';
import { getProductDataById } from '@shopgate/engage/product';
import { makeStyles } from '@shopgate/engage/styles';
import { settings } from '../../settings';
import {
  RATING_CLASS,
  RATING_COUNT_CLASS,
  RATING_DECIMALS,
  RATING_SCALE_DIVISOR,
  RATING_VALUE_CLASS,
  REVIEWS_ANCHOR_ID,
} from '../../constants';

const { colors } = themeConfig;

// starsAligned: the stars sit at the top of their own box, because the box is as tall as the line
// height while the icons are only as tall as the font size. Collapsing the box onto the icons puts
// them back into their middle, which is what the value next to them aligns to. The theme class is
// part of the selector so that this wins over the style of the component no matter which of the two
// is registered first.
const useStyles = makeStyles()(theme => ({
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    marginBottom: theme.spacing(1),
  },
  value: {
    fontSize: '1rem',
    fontWeight: 500,
    lineHeight: 1,
  },
  count: {
    fontSize: '1rem',
    lineHeight: 1,
    color: colors.shade3,
  },
  starsAligned: {
    '&.ui-shared__rating-stars': {
      display: 'inline-flex',
      verticalAlign: 'middle',
    },
  },
}));

/**
 * Scrolls the product detail page down to the reviews, which is what tapping the stars does in the
 * theme as well.
 * @returns {void}
 */
const scrollToReviews = () => {
  const anchor = document.getElementById(REVIEWS_ANCHOR_ID);
  const article = anchor && anchor.closest && anchor.closest('article');

  if (!article || !anchor.offsetTop) {
    return;
  }

  article.scroll(0, anchor.offsetTop - 30);
};

/**
 * Shows the rating of the product detail page the way the web shop shows it: the stars, the average
 * with two decimals and the number of ratings in brackets.
 *
 * The component is registered on the product.rating portal, which is an override portal and passes
 * no props of its own - the product comes from the product context of the page. Whenever the value
 * is switched off or there is nothing to show, the original content arrives as children and is
 * rendered instead.
 * @param {Object} props The component props.
 * @param {JSX.Element} [props.children] The original content of the portal.
 * @returns {React.ReactNode} The rating, or the original content.
 */
const ProductRating = ({ children }) => {
  const { classes, cx } = useStyles();
  const { productId } = useCurrentProduct();
  const product = useSelector(state => (
    productId ? getProductDataById(state, { productId }) : null
  ));

  if (!settings.showRatingValue || !appConfig.hasReviews) {
    return children;
  }

  const { rating } = product || {};

  // Without a rating the theme renders nothing, and a product without ratings has no average to
  // show - in both cases the theme decides, not this component.
  if (!rating || !rating.average || !rating.count) {
    return children;
  }

  return (
    <div className={cx(classes.container, RATING_CLASS)} onClick={scrollToReviews} role="presentation">
      <RatingStars value={rating.average} display="big" className={classes.starsAligned} />
      <span className={cx(classes.value, RATING_VALUE_CLASS)}>
        {i18n.number(rating.average / RATING_SCALE_DIVISOR, RATING_DECIMALS)}
      </span>
      <span className={cx(classes.count, RATING_COUNT_CLASS)}>
        {`(${rating.count})`}
      </span>
    </div>
  );
};

ProductRating.propTypes = {
  children: PropTypes.node,
};

ProductRating.defaultProps = {
  children: null,
};

export default ProductRating;
