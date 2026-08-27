import React, {
  useEffect, useLayoutEffect, useRef, useState,
} from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import { useSelector } from 'react-redux';
import appConfig, { themeConfig } from '@shopgate/pwa-common/helpers/config';
import { i18n } from '@shopgate/engage/core/helpers';
import { getProductDataById } from '@shopgate/engage/product/selectors/product';
import { makeStyles } from '@shopgate/engage/styles';
import { settings } from '../../settings';
import {
  LIST_RATING_CLASS,
  RATING_COUNT_CLASS,
  RATING_DECIMALS,
  RATING_SCALE_DIVISOR,
  RATING_STARS_MAX_DEPTH,
  RATING_STARS_SELECTOR,
  RATING_VALUE_CLASS,
} from '../../constants';

const { colors } = themeConfig;

// How much a card shows depends on how much room it has: the full form as on the product detail
// page, the average on its own, or nothing at all. A grid usually fits the full form, a slider that
// shows two and a bit cards next to each other rarely does.
const FULL = 'full';
const VALUE = 'value';
const NONE = 'none';

// Breathing space between the row of stars and whatever hangs into it from above, and how far
// something has to reach into the row before it counts - the image of a card ends exactly where the
// details begin, and a rounded pixel there is not something to move out of the way of.
const CLEARANCE_GAP = 2;
const CLEARANCE_MIN_OVERLAP = 4;

const useStyles = makeStyles()({
  container: {
    display: 'inline-block',
    verticalAlign: 'middle',
    marginLeft: '0.4em',
    fontSize: '0.875rem',
    lineHeight: 1,
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  count: {
    color: colors.shade3,
    marginLeft: '0.25em',
  },
  anchor: {
    display: 'flex',
    alignItems: 'center',
    flexShrink: 0,
  },
  starsAligned: {
    '&.ui-shared__rating-stars': {
      display: 'inline-flex',
      alignItems: 'center',
      verticalAlign: 'middle',
      maxWidth: 'none',
      overflow: 'hidden',
      fontSize: '0.85em',
    },
    '&.ui-shared__rating-stars > *, &.ui-shared__rating-stars > * > *': {
      flexShrink: 0,
    },
  },
});

/**
 * Finds the rating stars of the card the component was rendered into.
 *
 * The search starts at the portal position and walks up a few levels, because the stars sit in the
 * same card but not in the same element - the depth is limited so that it cannot end up at the
 * stars of the card next door.
 * @param {Element} start The element the component rendered.
 * @returns {Element|null} The stars of this card.
 */
const findStars = (start) => {
  let node = start.parentElement;

  for (let depth = 0; node && depth < RATING_STARS_MAX_DEPTH; depth += 1) {
    const stars = node.querySelector(RATING_STARS_SELECTOR);

    if (stars) {
      return stars;
    }

    node = node.parentElement;
  }

  return null;
};

/**
 * Measures how far something that hangs over the top edge of a card reaches into the row of stars.
 *
 * The theme puts the favourites button of a product card half over the image and half over the
 * details underneath, where it covers the right hand end of the row the stars sit in - which is
 * exactly where the average and the number of ratings go. How far it reaches down depends on the
 * card layout and on which other extensions are attached, so it is measured instead of assumed.
 * @param {Element} card The element the stars sit in.
 * @returns {number} The pixels the row has to move down, 0 when nothing is in its way.
 */
const getClearance = (card) => {
  const container = card.parentElement;

  if (!container) {
    return 0;
  }

  // Where the row sits without a correction. Measuring against its current position would give a
  // different answer once it has moved, and the two answers would keep replacing each other.
  const paddingTop = parseFloat(window.getComputedStyle(card).paddingTop) || 0;
  const rowTop = card.getBoundingClientRect().top + paddingTop;

  return Array.from(container.children).reduce((clearance, child) => {
    if (child === card) {
      return clearance;
    }

    const rect = child.getBoundingClientRect();
    const overlap = rect.bottom - rowTop;

    if (!rect.height || rect.top > rowTop || overlap < CLEARANCE_MIN_OVERLAP) {
      return clearance;
    }

    return Math.max(clearance, overlap + CLEARANCE_GAP);
  }, 0);
};

/**
 * Puts the average and the number of ratings next to the stars of a product card.
 *
 * Product cards, grids and sliders render their stars without a portal around them, so there is no
 * position to render into. This component is registered on the closest portal that all card
 * layouts have, creates an anchor element right behind the stars and renders into it. The content
 * itself stays a React child, only the anchor is placed by hand, and it is removed again when the
 * card goes away.
 *
 * Whenever the stars cannot be found - a theme that renders them differently, a card without a
 * rating - nothing is rendered and the card stays exactly as the theme built it.
 * @param {Object} props The component props.
 * @param {string} [props.productId] The product of the card, passed along by the portal.
 * @returns {React.ReactNode}
 */
const ListRatingValue = ({ productId }) => {
  const { classes, cx } = useStyles();
  const marker = useRef(null);
  const [anchor, setAnchor] = useState(null);
  const [mode, setMode] = useState(FULL);
  const [pass, setPass] = useState(0);
  const product = useSelector(state => (
    productId ? getProductDataById(state, { productId }) : null
  ));

  const { rating } = product || {};
  const average = rating ? rating.average : 0;
  const count = rating ? rating.count : 0;
  const isEnabled = settings.showRatingValueInLists &&
    appConfig.hasReviews &&
    !!rating &&
    !!rating.average &&
    !!rating.count;

  useEffect(() => {
    if (!isEnabled || !marker.current) {
      return undefined;
    }

    const stars = findStars(marker.current);

    if (!stars || !stars.parentNode) {
      return undefined;
    }

    // The anchor goes inside the stars, not next to them. Two neighbouring inline boxes may be
    // broken apart at the end of a line, which is what made the value drop below the stars on
    // narrow cards; as a flex item of the stars it cannot be separated from them any more.
    const node = document.createElement('span');

    // The stars of the theme are a role="img" with an aria-label that already reads the rating out.
    // Everything inside that element is presentational; saying so explicitly keeps the markup valid
    // instead of leaving text in a place a screen reader has to ignore.
    node.setAttribute('aria-hidden', 'true');
    (classes.anchor || '').split(' ').filter(Boolean).forEach(name => node.classList.add(name));
    stars.appendChild(node);
    setAnchor(node);

    const alignment = (classes.starsAligned || '').split(' ').filter(Boolean);
    alignment.forEach(name => stars.classList.add(name));

    return () => {
      node.remove();
      alignment.forEach(name => stars.classList.remove(name));
      stars.style.removeProperty('margin-top');
    };
  }, [isEnabled, productId, classes.anchor, classes.starsAligned]);

  // Rendered first and measured afterwards: the row moves out from under anything that hangs into
  // it, and whatever then still does not fit into the card is dropped, the number of ratings before
  // the average. A cut off number would look broken, and the same card is wide enough for the full
  // form in a grid and too narrow for it in a slider.
  useLayoutEffect(() => {
    if (!anchor || !anchor.parentElement || !anchor.parentElement.parentElement) {
      return;
    }

    const stars = anchor.parentElement;
    const card = stars.parentElement;
    const clearance = getClearance(card);

    if (clearance) {
      stars.style.marginTop = `${clearance}px`;
    } else {
      stars.style.removeProperty('margin-top');
    }

    const { paddingLeft, paddingRight } = window.getComputedStyle(card);
    const padding = (parseFloat(paddingLeft) || 0) + (parseFloat(paddingRight) || 0);

    if (stars.scrollWidth > card.clientWidth - padding) {
      setMode(current => (current === FULL ? VALUE : NONE));
    }
  }, [anchor, mode, average, count, pass]);

  // A layout change starts the measurement over at the full form, so that a card which grew - after
  // a rotation for instance - gets everything back that it lost while it was narrow.
  useEffect(() => {
    if (!anchor || !anchor.parentElement || typeof ResizeObserver === 'undefined') {
      return undefined;
    }

    const card = anchor.parentElement.parentElement;

    if (!card) {
      return undefined;
    }

    const observer = new ResizeObserver(() => {
      setMode(FULL);
      setPass(current => current + 1);
    });

    observer.observe(card);

    return () => observer.disconnect();
  }, [anchor]);

  if (!isEnabled) {
    return null;
  }

  return (
    <>
      <span ref={marker} hidden />
      {anchor && mode !== NONE && createPortal((
        <span className={cx(classes.container, LIST_RATING_CLASS)}>
          <span className={RATING_VALUE_CLASS}>
            {i18n.number(rating.average / RATING_SCALE_DIVISOR, RATING_DECIMALS)}
          </span>
          {mode === FULL && (
            <span className={cx(classes.count, RATING_COUNT_CLASS)}>
              {`(${rating.count})`}
            </span>
          )}
        </span>
      ), anchor)}
    </>
  );
};

ListRatingValue.propTypes = {
  productId: PropTypes.string,
};

ListRatingValue.defaultProps = {
  productId: null,
};

export default ListRatingValue;
