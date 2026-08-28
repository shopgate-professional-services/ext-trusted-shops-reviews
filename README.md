# Trusted Shops reviews

## What it does

Shops that collect their reviews with Trusted Shops end up with two sets of ratings: the ones
Trusted Shops holds, which the web shop shows, and the ones the shop system holds, which the app
shows. The numbers differ, and customers notice.

This extension makes the app show the Trusted Shops data instead:

* **On the product detail page** the review section is replaced by the Trusted Shops product review
  widget - the same widget the web shop renders, with the same reviews, the same verified badges and
  the same look. The separate page that lists all reviews of a product is replaced as well.
* **Everywhere rating stars appear** - category lists, product grids, product sliders, search
  results and the headline of the product detail page - the stars and the number next to them are
  the Trusted Shops rating. They keep the design of the app; only the numbers behind them change.
  The favourites list is not among them: the theme draws no stars there to begin with.
* **Variants carry the rating of their main product** - the number the web shop and the product
  detail page show - instead of the handful of reviews that happen to sit on the single variant.
* **The rating can be shown the way the web shop shows it** - stars, the average with two decimals
  and the number of ratings in brackets on the product detail page, and as much of that as a
  product card has room for in lists and sliders.
* **The review section can be switched off** entirely, for shops that would rather not show reviews
  in the app at all.
* **A shop rating or trust badge** can be placed on any page through the page builder.

The extension has a frontend and a backend part, and it needs both: the review widget comes from the
frontend, the rating stars from the backend. With only the frontend deployed, the stars keep showing
the ratings of the shop.

Where the extension has nothing to say - it is not configured, a product carries no identifier,
Trusted Shops cannot be reached, or the configured channel has never delivered a rating at all -
the app keeps showing what the shop delivers.

It clears the stars in two cases, both deliberately. When Trusted Shops answers that it has no
reviews for a product, that product ends up without stars, because a rating of the shop would
contradict what the web shop shows. And a variant whose main product the extension has not seen yet
stays without stars rather than showing a number that the product detail page contradicts.

## Requirements

* Trusted Shops is connected to the shop and collects product reviews. For Shopware 6 that is the
  *Trusted Shops Easy Integration* app.
* Product reviews are switched on for the app (`hasReviews`). With that setting off, the category
  grid, the product sliders and the headline of the product detail page draw no stars at all, so
  there is nothing for the Trusted Shops ratings to appear in. The review section is the exception:
  its portal sits outside that switch, so the Trusted Shops widget keeps rendering even then.
* theme-ios11 **7.31 or newer** for rating stars in category lists. Older themes render no stars in
  the category grid at all, so there is nothing to fill there; product detail page, sliders and the
  home page work from 7.30 on.
* A Trusted Shops account with access to the Control Center, to read the channel and widget IDs.

## Configuration

All values are set in the Shopgate Merchant Admin.

| Key | Type | Read by | Purpose |
|---|---|---|---|
| `etrustedChannelId` | text | backend | The eTrusted channel of the shop, in the form `chl-…`. The ratings are read from it - without it, or with a value that is not a channel id, the rating stars keep showing the ratings of the shop. |
| `productReviewWidgetId` | text | frontend | Widget ID of the *Product review list* widget, shown on the product detail page. Without it the review section of the shop is kept. |
| `showProductReviews` | checkbox | frontend | Switches the review section on the product detail page off. The rating stars are not affected. |
| `showRatingValue` | checkbox | frontend | Shows the average and the number of ratings next to the stars on the product detail page. Off by default, because it changes what the theme renders. |
| `showRatingValueInLists` | checkbox | frontend | Does the same on product cards, grids and sliders, as far as the width of a card allows. Off by default, and it depends on how the theme renders its cards - see *Rating in lists* below. |
| `productIdentifierType` | select | both | The identifier Trusted Shops stores the reviews under: `sku`, `gtin` or `mpn`. |
| `productIdentifierSource` | select | both | The field of the Shopgate product the identifier is read from: `identifiers.sku`, `identifiers.ean`, `identifiers.mpn` or the product ID. |
| `shopReviewsWidgetId` | text | frontend | Widget ID of a shop wide widget, for example the trust badge or the shop rating. |

### Where to find the IDs

The widget IDs come from the Trusted Shops Control Center, under *Widgets*. Opening a widget shows
its integration snippet:

```html
<etrusted-widget data-etrusted-widget-id="wdg-00000000-0000-0000-0000-000000000000"></etrusted-widget>
```

The value of `data-etrusted-widget-id` is what goes into `productReviewWidgetId` or
`shopReviewsWidgetId`. The channel ID starts with `chl-` and is shown in the channel settings. If it
cannot be found there, any widget of that channel reveals it:

```bash
curl -s "https://integrations.etrusted.com/manifests/v1/<widgetId>.json"
```

The `reference.id` of the answer is the channel ID.

### Choosing the right identifier

`productIdentifierType` has to match what the shop sends to Trusted Shops, and
`productIdentifierSource` has to point at the field that carries that same value in the app. For a
Shopware 6 shop with the default setting of the Trusted Shops app, that is the product number,
which reaches the app as `identifiers.sku` - so `sku` and `identifiers.sku`.

To check a product by hand, hex encode its SKU and open the grades feed:

```bash
curl -s "https://integrations.etrusted.com/feeds/grades/v1/channels/<channelId>/products/sku/$(printf %s '<SKU>' | xxd -p)/feed.json"
```

An answer containing `grades.overall` means the combination is right. An empty object `{}` means
Trusted Shops has no reviews stored under that identifier. GTIN and MPN are not hex encoded - they
go into the URL as they are.

The same empty answer comes back for a channel that does not exist, so a single empty answer cannot
tell a wrong channel id apart from a product without reviews. The step therefore keeps the ratings
of the shop, and logs a warning, until that channel has delivered a real rating at least once - for
a request carrying a single product on the product detail page as much as for a category page.

## Placing the shop rating

The shop rating is a widget for the page builder. Create an *HTML / Text Editor* widget on the page
it should appear on and paste:

```html
<!--Widget
{
  "type": "@shopgate-project/trusted-shops-reviews/ShopReviews",
  "settings": {}
}
-->
```

It renders the widget configured in `shopReviewsWidgetId`. To show a different one in this spot -
several badges on one page, for instance, or a badge without touching the extension configuration
at all - name it explicitly:

```html
<!--Widget
{
  "type": "@shopgate-project/trusted-shops-reviews/ShopReviews",
  "settings": {
    "widgetId": "wdg-00000000-0000-0000-0000-000000000000"
  }
}
-->
```

## How it works

### Rating stars

The rating stars of product cards, grids and sliders are rendered by the theme without a portal
around them, so there is no place to hang a replacement on. The extension therefore replaces the
**data** rather than the markup: a backend step swaps the rating of every product for the Trusted
Shops rating before it ever reaches the app. That covers every place stars appear at once, and they
keep the design of the theme.

The step is hooked into the two catalog pipelines every product request ends up in:

| Pipeline | covers |
|---|---|
| `shopgate.catalog.getProductsByIds.v1` | product detail page, sliders, favourites, relations, and search and filter results - they all delegate to it |
| `shopgate.catalog.getProductsByCategory.v1` | category lists |

`shopgate.catalog.getProduct.v1` owns an `afterFetchProducts` hook as well, but it is deliberately
not used: the pipeline reaches that hook only after it has fetched its product through
`getProductsByIds.v1`, where the step has already run, so a second registration would do the same
work twice per product detail page. `shopgate.catalog.getProducts.v1` carries no hook at all and
only forwards to the pipelines above.

Variants are not looked up under their own identifier. Trusted Shops keeps the reviews of a product
family on the main product - that is what the web shop shows and what the product detail page of the
app shows - while the identifier of a single variant carries only the reviews that happen to sit on
it. The catalog pipelines hand a variant the id of its main product, but not its identifier, and the
main product is often not part of the same request: a single product tile on the start page and a
search result carry the variant alone. The step therefore remembers the identifier of every main
product that passes through it, in the extension storage, and reads it back when it meets one of its
variants. That costs no additional request. Until a main product has been seen once, its variants
are shown without stars rather than with a number that contradicts the product detail page.

The memory holds the main products that were seen most recently. In a catalog with more of them
than it keeps, the ones that stopped appearing are dropped and learned again the next time they
pass through.

Trusted Shops reports a rating from 0 to 5, the theme expects 0 to 100, so the step multiplies by 20.

Identifiers are deduplicated per request, and the grades of a channel are cached in a single
extension storage entry for six hours. Together with the memory of the main product identifiers, a
request therefore costs two storage reads, no matter how many products the list carries.

Whatever is not cached yet is fetched in parallel batches within a fixed budget of three seconds;
what does not fit into that budget keeps the rating of the shop and is fetched on one of the next
requests, so a cold cache can never hold a category page up. A lookup that fails is remembered for
five minutes, so an outage on the Trusted Shops side costs the budget once rather than on every
request. The step reads the feeds with the built in `https` module and therefore has **no runtime
dependencies** of its own.

### Review section

The product detail page is different - the review section sits behind a portal, so the original
Trusted Shops widget is put in its place. The same happens on the separate page that lists all
reviews of a product, which has a portal of its own (`product.reviews.all`); both are served by the
same component. That page takes its product from the route, which can be a variant on a deep link,
so the component resolves the main product itself before it addresses the widget. It is loaded by a single script that registers the
`<etrusted-widget>` custom element. The extension injects that script at app start when a widget is
configured, and every widget makes sure it is there when it renders, so a badge placed through the
page builder works on its own widget id alone.

The widget is wrapped in an element carrying the id the theme scrolls to, so tapping the stars in
the product headline still jumps to the reviews. The wrapper also carries the same spacing as the
other blocks of the product detail page, because the widget brings none of its own.

### Rating on the product detail page

With `showRatingValue` switched on, the rating in the headline of the product detail page is
rendered the way a Trusted Shops driven web shop renders it:

```
★★★★★  4,83  (18)
```

The average comes from the same rating the stars are drawn from, formatted with two decimals in the
language of the app, and the number in brackets is the number of ratings. Tapping it scrolls down
to the reviews, exactly as the rating of the theme does.

The elements carry stable class names - `trusted-shops-reviews__rating`,
`trusted-shops-reviews__rating-value` and `trusted-shops-reviews__rating-count` - so colours and
sizes can be adjusted from outside, for instance with `@shopgate-project/content-styling`, without
touching this extension.

Switched off, or for a product without ratings, the rating of the theme is rendered unchanged.

### Rating in lists

`showRatingValueInLists` puts the same value behind the stars of product cards, grids and sliders.
That one needs a word of warning.

Cards render their stars without a portal around them - the same reason the ratings themselves are
replaced through the backend rather than through a component. There is no position to render into,
so the extension takes the closest portal every card layout offers, `product-item.price.before`,
looks for the stars of that same card from there, and appends an anchor element inside them. Inside,
because two neighbouring elements may be broken apart at the end of a line - as a child of the stars
the value cannot be separated from them. Only that anchor is placed by hand; what it contains is a
regular React child and disappears with the card. It is marked `aria-hidden`, because the stars of
the theme are an `img` role whose label already reads the rating out.

**How much a card shows depends on how much room it has.** The extension renders the full form,
measures it against the width of the card and drops what does not fit - first the number of
ratings, then the average. A grid usually has room for everything, a slider that shows two and a
bit cards next to each other for the average alone, and a very narrow card for neither. The
measurement runs again when the layout changes, after a rotation for instance, so a card that grew
gets back what it lost. Nothing is ever cut off, and the stars keep their proportions - they are
rendered a little smaller in a card carrying a value, which is where the room for it comes from.

That makes it the one part of the extension that depends on how the theme builds its cards:

* The stars are found through their class name `ui-shared__rating-stars` and only within four levels
  above the portal position, so a neighbouring card cannot be hit.
* A theme that renders its stars differently, or a card without a rating, simply gets nothing - the
  card stays exactly as the theme built it.
* The portal it hangs on is the one around the price. A card whose price is switched off does not
  render that portal, so such a card keeps its stars but shows no value next to them.
* Product detail page and lists are separate switches on purpose. `showRatingValue` uses a real
  portal and is safe; this one is the one to turn off first if a theme update moves things around.

### What happens when

| Situation | Rating stars | Review section |
|---|---|---|
| Trusted Shops has reviews for the product | Trusted Shops rating | Trusted Shops widget |
| Trusted Shops has no reviews for the product | no stars, unless the theme is set to show empty ones | the widget hides itself, if "hide when empty" is set in the Control Center |
| Variant whose main product is known | rating of the main product | Trusted Shops widget |
| Variant whose main product has not passed through yet | no stars | Trusted Shops widget |
| Product carries no identifier | rating of the shop | review section of the shop |
| Trusted Shops cannot be reached | rating of the shop | empty widget |
| Channel has never delivered a rating, for instance a wrong channel id | rating of the shop, and a warning in the log | empty widget |
| Backend part not deployed | rating of the shop | Trusted Shops widget |
| `showProductReviews` switched off | unchanged | hidden |
| Not configured | rating of the shop | review section of the shop |

Whether products without reviews show five grey stars or none is the theme's decision, through the
`showEmptyRatingStars` widget setting of `@shopgate/engage/rating`.

## Limitations

* The Trusted Shops widget renders into a closed shadow root. Its appearance - colours, theme,
  language - can only be changed in the Trusted Shops Control Center, not from the app.
* Writing a review is not part of the widget. The review form of the shop is no longer reachable
  from the product detail page once the section is replaced.
* The average next to the stars of the product detail page uses a portal of the theme. In lists
  there is none, so that variant attaches itself to the markup of the card and is the first thing
  to check after a theme update. What a card shows there depends on its width, so the same product
  can carry the number of ratings in a category and only the average in a slider.
* Rating and reviews always belong to the main product, not to the selected variant - that is how
  Trusted Shops aggregates them and what the web shop shows. In lists a variant stays without stars
  until its main product has passed through the catalog once, see *Rating stars* above.
* The feeds the ratings come from are public but not part of a documented Trusted Shops API. The
  step is built to fail quietly, so a change on their side costs the Trusted Shops ratings, not the
  catalog.
