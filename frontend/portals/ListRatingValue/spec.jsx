import React from 'react';
import { mount } from 'enzyme';
import ListRatingValue from './index';

const PRODUCT_ID = 'product-1';

// jest hoists the mock factories above the module scope, so the variables they read have to be
// prefixed with "mock".
let mockProduct = null;
let mockSettings = {};

jest.mock('react-redux', () => ({
  useSelector: selector => selector({}),
}));

jest.mock('@shopgate/engage/product/selectors/product', () => ({
  getProductDataById: () => mockProduct,
}));

jest.mock('@shopgate/engage/core/helpers', () => ({
  i18n: {
    number: (value, fractions) => value.toFixed(fractions).replace('.', ','),
  },
}));

jest.mock('@shopgate/pwa-common/helpers/config', () => ({
  __esModule: true,
  default: { hasReviews: true },
  themeConfig: { colors: { shade3: '#9a9a9a' } },
}));

jest.mock('../../settings', () => ({
  get settings() {
    return mockSettings;
  },
}));

jest.mock('@shopgate/engage/styles', () => ({
  makeStyles: () => () => () => ({
    classes: {},
    cx: (...names) => names.filter(Boolean).join(' '),
  }),
}));

/**
 * Builds a product card the way the theme builds it: the stars and, further down, the position the
 * portal renders into.
 * @param {boolean} withStars Whether the card carries rating stars.
 * @returns {Object} The card and the position to mount into.
 */
const createCard = (withStars = true) => {
  const card = document.createElement('div');

  card.innerHTML = `
    <div class="information">
      ${withStars ? '<div class="ui-shared__rating-stars"></div>' : ''}
      <div class="name">Product</div>
      <div class="price-portal"></div>
    </div>
  `;
  document.body.appendChild(card);

  return {
    card,
    position: card.querySelector('.price-portal'),
  };
};

/**
 * Gives the card a width and lets the stars report how much room their content needs, so that the
 * component can measure like it does in a browser: the full form is the widest, the average alone
 * is narrower, the stars on their own are the narrowest.
 * @param {Element} card The card.
 * @param {number} width The width available in the card.
 * @returns {void}
 */
const setWidths = (card, width) => {
  const stars = card.querySelector('.ui-shared__rating-stars');

  // The component measures the element the stars sit in, not the card element itself.
  Object.defineProperty(stars.parentElement, 'clientWidth', {
    value: width,
    configurable: true,
  });
  Object.defineProperty(stars, 'scrollWidth', {
    configurable: true,
    get: () => {
      if (card.querySelector('.trusted-shops-reviews__rating-count')) {
        return 200;
      }

      return card.querySelector('.trusted-shops-reviews__list-rating') ? 120 : 90;
    },
  });
};

/**
 * Puts the favourites button over the top edge of the details, the way the theme places it: half
 * over the image, half over the details underneath, where it hangs into the row of stars.
 * @param {Element} card The card.
 * @param {number} bottom How far the button reaches below the top edge of the details.
 * @returns {void}
 */
const addHangingButton = (card, bottom) => {
  const stars = card.querySelector('.ui-shared__rating-stars');
  const button = document.createElement('div');

  button.className = 'ui-shared__favorites-button';
  card.appendChild(button);

  stars.getBoundingClientRect = () => ({
    top: 12,
    bottom: 24,
    height: 12,
  });
  button.getBoundingClientRect = () => ({
    top: bottom - 36,
    bottom,
    height: 36,
  });
};

describe('<ListRatingValue />', () => {
  beforeEach(() => {
    mockSettings = { showRatingValueInLists: true };
    mockProduct = {
      rating: {
        average: 96.6,
        count: 18,
        reviewCount: 18,
      },
    };
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('should put the value right behind the stars of its own card', () => {
    const { card, position } = createCard();

    mount(<ListRatingValue productId={PRODUCT_ID} />, { attachTo: position });

    const stars = card.querySelector('.ui-shared__rating-stars');
    const inserted = stars.lastElementChild;

    expect(inserted.querySelector('.trusted-shops-reviews__rating-value').textContent).toBe('4,83');
    expect(inserted.querySelector('.trusted-shops-reviews__rating-count').textContent).toBe('(18)');
  });

  it('should drop the number of ratings when the card is too narrow for it', () => {
    const { card, position } = createCard();

    setWidths(card, 150);

    mount(<ListRatingValue productId={PRODUCT_ID} />, { attachTo: position });

    expect(card.querySelector('.trusted-shops-reviews__rating-value').textContent).toBe('4,83');
    expect(card.querySelector('.trusted-shops-reviews__rating-count')).toBeNull();
  });

  it('should drop the value as well when even that does not fit', () => {
    const { card, position } = createCard();

    setWidths(card, 80);

    mount(<ListRatingValue productId={PRODUCT_ID} />, { attachTo: position });

    expect(card.querySelector('.trusted-shops-reviews__list-rating')).toBeNull();
  });

  it('should move the row out from under a button that hangs into it', () => {
    const { card, position } = createCard();

    addHangingButton(card, 18);

    const wrapper = mount(<ListRatingValue productId={PRODUCT_ID} />, { attachTo: position });
    const stars = card.querySelector('.ui-shared__rating-stars');

    expect(stars.style.marginTop).toBe('8px');

    wrapper.unmount();

    expect(stars.style.marginTop).toBe('');
  });

  it('should leave the row where it is when the button stays above it', () => {
    const { card, position } = createCard();

    addHangingButton(card, 10);

    mount(<ListRatingValue productId={PRODUCT_ID} />, { attachTo: position });

    expect(card.querySelector('.ui-shared__rating-stars').style.marginTop).toBe('');
  });

  it('should ignore a neighbour that only just touches the row', () => {
    const { card, position } = createCard();

    addHangingButton(card, 14);

    mount(<ListRatingValue productId={PRODUCT_ID} />, { attachTo: position });

    expect(card.querySelector('.ui-shared__rating-stars').style.marginTop).toBe('');
  });

  it('should stay out of the card while the setting is off', () => {
    mockSettings = {};
    const { card, position } = createCard();

    mount(<ListRatingValue productId={PRODUCT_ID} />, { attachTo: position });

    expect(card.querySelector('.trusted-shops-reviews__rating-value')).toBeNull();
  });

  it('should do nothing when the card has no stars to attach to', () => {
    const { card, position } = createCard(false);

    mount(<ListRatingValue productId={PRODUCT_ID} />, { attachTo: position });

    expect(card.querySelector('.trusted-shops-reviews__rating-value')).toBeNull();
  });

  it('should do nothing for a product without ratings', () => {
    mockProduct = {
      rating: {
        average: 0,
        count: 0,
        reviewCount: 0,
      },
    };

    const { card, position } = createCard();

    mount(<ListRatingValue productId={PRODUCT_ID} />, { attachTo: position });

    expect(card.querySelector('.trusted-shops-reviews__rating-value')).toBeNull();
  });

  it('should take its anchor with it when the card goes away', () => {
    const { card, position } = createCard();

    const wrapper = mount(<ListRatingValue productId={PRODUCT_ID} />, { attachTo: position });
    const stars = card.querySelector('.ui-shared__rating-stars');

    expect(stars.querySelector('.trusted-shops-reviews__list-rating')).not.toBeNull();

    wrapper.unmount();

    expect(card.querySelector('.trusted-shops-reviews__list-rating')).toBeNull();
    expect(stars.children).toHaveLength(0);
  });
});
