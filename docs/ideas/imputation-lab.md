# Idea: Imputation Lab — compare gap-filling methods on the live page

Status: **idea, not started** (noted 2026-10-15). It now has a home: the
**Filling the Gaps** direction (`#/filling-the-gaps`,
`src/views/FillingTheGapsView.vue`, components in
`src/components/directions/filling-the-gaps/`).

## The idea

Somewhere on the page:

1. The user can **see the dataset**, including where it is incomplete.
2. They can **select a data-filling approach**: an imputation technique,
   algorithm or model.
3. When they select one, **the page is rebuilt with the filled data**, i.e.
   the visualisations re-render from the filled dataset.

**Goal:** see how different filling algorithms change the end result, where
they disagree, and what each method's strengths and weaknesses are.

Reference list of techniques:
<https://editverse.com/handle-missing-data-like-a-pro-10-imputation-techniques-that-salvage-incomplete-datasets/>

## Candidate methods

The reference article's techniques, matched to the MONICET gaps they could
fill (see [`../missing-data.md`](../missing-data.md) §1 for the gap list):

| Method (reference)                           | Plausible MONICET target                               | Expected weakness to make visible                            |
| -------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------ |
| Mean / median                                | group size, Beaufort, visibility                       | shrinks variance; ignores species/season                     |
| Last observation carried forward (LOCF)      | Beaufort/visibility within one trip; empty year-months | flat steps; wrong across season changes                      |
| K-nearest neighbours                         | cell × year rates from neighbouring cells/years        | sensitive to _k_; borrows from cells that boats rarely reach |
| Regression                                   | rates ~ year + month + island (+ Beaufort)             | underestimates spread when used as a single fill             |
| Interpolation (linear / polynomial / spline) | missing months or years in a cell or species series    | polynomial/spline overshoot; extrapolation is unfounded      |
| Multiple imputation                          | any of the above, repeated with noise                  | needs pooled results and intervals in the UI                 |
| Machine learning (random forest, NN)         | rates from many covariates                             | opaque; heavy for the browser; small data                    |

Methods from the guide that fit opportunistic data especially well:
effort normalisation, empirical-Bayes shrinkage, a seasonal × level time
model, and target-group background (`missing-data.md` §4).

Hot-deck and mode imputation are tagged on the reference page but not
described there.

## Things to decide before building

- **What exactly gets filled?** Cells × years, cells × months, measurement
  attributes, or the effort surface? Each method needs a clearly defined
  "hole".
- **Where does filling run?** In the browser, which needs a compact
  observation table (cell × year × month × island counts + cruises) shipped
  instead of only the aggregated JSON, or precomputed per method in
  `scripts/build-data.ts`. The browser fits "select and watch it rebuild".
- **How to show the difference:** observed vs filled marked distinctly;
  a "difference to observed / to method B" map; a side-by-side or toggle;
  per-method summary numbers (e.g. D1 "Average change").
- **How to show strengths and weaknesses honestly:** a hold-out test (mask
  known values, fill, measure error) shown per method, so "better" is
  measured, not asserted (`missing-data.md` §5).
- **Which visualisations get rebuilt?** The Filling the Gaps view is
  separate from Three Ways of Looking. Should it reuse D1/D3/D4 (the
  components would move to `shared-ui/`), or get its own visualisations
  designed for comparing fills?
- **Dependencies:** simple methods can be written by hand in TypeScript.
  Random forests and neural nets would need a library or precomputation,
  which conflicts with the minimal-dependency rule, so ask first.
