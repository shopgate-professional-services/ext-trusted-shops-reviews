# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/) and this project adheres to [Semantic Versioning](http://semver.org/).

## [1.0.0] - 2026-08-26
### Added
- Trusted Shops reviews on the product detail page and on the page that lists all reviews of a
  product: the review sections of the theme (portals `product.reviews` and `product.reviews.all`)
  are replaced by the Trusted Shops review widget, and can be switched off entirely.
- Trusted Shops ratings wherever the theme draws stars - category lists, product grids, sliders,
  search results and the headline of the product detail page. A backend step replaces the rating in
  the catalog pipelines, so the stars keep the design of the theme and only the numbers change.
- Variants are looked up under the identifier of their main product, which is the rating Trusted
  Shops aggregates and the web shop shows. The identifiers of main products are learned from the
  requests that pass through, so a variant that appears without its main product - a single product
  tile, a search result - resolves as well.
- The rating of the product detail page can be shown the way the web shop shows it: stars, the
  average with two decimals and the number of ratings in brackets. Optionally on the product cards
  of lists and sliders as well, where every card shows as much of it as it has room for.
- A shop rating or trust badge can be placed on any page through a page builder widget.
- The product identifier Trusted Shops is addressed with is configurable by kind (`sku`, `gtin`,
  `mpn`) and by the product field it is read from.
- Ratings are cached in the extension storage for six hours and failed lookups for five minutes;
  the lookups of one request run within a fixed time budget, so a cold cache cannot hold a category
  page up.
- Fail-safe by design: without a configuration, without an identifier, when the feed cannot be
  read, when the time budget is used up, or as long as the configured channel has never delivered a
  rating at all, the ratings and reviews of the shop are left untouched.
- No runtime dependencies: the feeds are read with the built in `https` module, so the extension
  needs no npm install of its own.
