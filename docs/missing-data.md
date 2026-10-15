# Filling the gaps — a learning guide for MONICET

MONICET is opportunistic data: boats go where whales are likely and
customers are happy, not where a survey design would send them. This guide
covers what is missing, why that matters, and a ladder of techniques that go
from "show the gap honestly" to "model what was never observed". Each rung
ends with an exercise on this codebase.

Facts and numbers come from [`data-profile.md`](data-profile.md) (regenerate
with `pnpm data:profile`) and the data paper ([`dataset.md`](dataset.md)).

---

## 0. First principles

1. **Missing is not zero.** A cell with no sightings may be empty, or nobody
   looked there. The archive cannot tell the two apart (see §1).
2. **Decide the question first.** "Where are sperm whales?" and "How many
   sperm whales are there?" need different fills. The second one cannot be
   answered from this data.
3. **Every filled value is a claim.** Prefer methods that come with an
   uncertainty, and always make filled values visibly different from
   observed ones.
4. **Validate by hiding what you know.** Mask real values, fill them, and
   compare (§5). If a method can't recover known values, don't trust it on
   unknown ones.

---

## 1. Inventory: what is missing here

| Gap                                       | Evidence                                                                                                                     | Recoverable?                                                                      |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| **Where boats searched** (spatial effort) | No tracks or lookout logs (paper). The cruise `footprintWKT` holds only harbour + sighting points.                           | Only through proxies: sightings of _all_ species, trip duration, harbour distance |
| **Absences**                              | `occurrenceStatus` is always `present`. Only 76 of 8,455 trips have zero sightings.                                          | No. Model detection instead (§4f)                                                 |
| **Time coverage**                         | 7 of 144 year-months have no cruise; Faial/Pico/Terceira mostly May–Sep; 2020 Apr–Jun ≈ COVID gap                            | Partially: interpolate within the range of the data, never outside it             |
| **Who was contributing**                  | 2 companies in 2009 → 9 in 2019; Terceira only from 2015                                                                     | Yes, as a covariate: record the island group / company and normalise by it        |
| **Attributes**                            | Per sighting: Beaufort 88.6%, behaviour 93.0%, visibility 97.7%. Group size 52.8% of occurrence rows, but 99.4% of sightings | Mostly yes: impute within the same trip or species (§4g)                          |
| **Taxonomic resolution**                  | 361 family-only rows (mostly beaked whales, Ziphiidae)                                                                       | Partially: probabilistic assignment from local species mix                        |
| **Duplicates** (too much, not too little) | Several boats log the same animals (paper)                                                                                   | Heuristically: same species, close in time and space, different company           |

**Unit matters.** Behaviour looks 35% complete per occurrence row but 93%
per sighting, because it is attached to one occurrence per sighting.
Measure missingness in the unit you analyse.

---

## 2. Why data is missing — and why that decides the method

Statistics uses three mechanisms (Rubin; see Little & Rubin):

| Mechanism                                   | Meaning                                           | MONICET example                                                                                                         | Naive fill (mean, drop rows)…                                                       |
| ------------------------------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| **MCAR** — completely at random             | missingness unrelated to anything                 | a guide forgot to type the visibility field                                                                             | …is unbiased, just less precise                                                     |
| **MAR** — at random given what you observed | missingness depends on _recorded_ variables       | Terceira has no data before 2015 because no company there contributed — and you know the island                         | …is biased, but fixable by conditioning on island/year                              |
| **MNAR** — not at random                    | missingness depends on the _missing value itself_ | elusive species are under-recorded _because_ they are elusive; far cells are unvisited _because_ boats avoid long trips | …is biased, and no data-only method fixes it; you need assumptions or external data |

Most MONICET gaps are MAR at best and often MNAR. That is why "average the
neighbours" can be dangerously wrong here.

---

## 3. The visualisation side: showing gaps honestly

Before filling anything, make the gap visible. D1 "Honest Instability" is
the first attempt at this.

- Encode **zero** and **no data** differently. Today both are near-gray
  (ISSUES V-2, V-3). Try hatching or "no fill + outline" for no data.
- Encode **sample size** next to the value: opacity (as D1 does), a
  dot-density overlay, or the literal _n_ in tooltips.
- Mark **imputed values** differently from observed ones: dashed line
  segments, hollow markers, lighter tone, and a legend entry for "estimated".
- Show **intervals**, not just points: bands on the sparkline, or per-cell
  intervals shown as a value-suppressing uncertainty palette (VSUP — Correll
  et al. 2018).
- Offer an **observed ↔ filled toggle** so readers can see what the method
  added.

**Exercise 3.1** — In D3's sparkline, plot `encounters / cruises` instead of
raw counts, and draw 2020 dashed with a "COVID — 287 cruises" annotation.
_Files:_ `src/components/directions/SpeciesAsCharacter.vue`. Cruises per
year already exist inside the build (`cruisesByYear` in
`scripts/build-data.ts`) but are not exported yet, so add them to the JSON
`meta` and to `src/types/monicet.ts`.

---

## 4. The ladder: from least to most invented

### 4a. Normalise by effort (fix the denominator)

A count means nothing without effort. The current decline metric divides by
**all** cruises (ISSUES D-1), but a São Miguel cell can only be reached by
São Miguel boats.

`rate(cell, period) = encounters(cell, period) / cruises(island group serving the cell, period)`

The island group of a cruise comes from its harbour longitude (see
`islandGroup()` in `scripts/profile-data.ts`). The island group of a cell
comes from the cruises whose sightings fall in it.

**Exercise 4a** — Add `island` to each sighting in the build (via
`parentEventID` → cruise → harbour). Assign each cell its dominant island
and normalise early/late rates by that island's cruises. Compare the new
"Average change" with +1037.3%.

### 4b. Aggregate (trade resolution for stability)

Fewer, bigger bins have more data each. Options: 0.4° cells or hexbins;
seasons instead of months; three periods instead of two. The cost is
spatial detail; the gain is fewer cells resting on 3 sightings.

**Exercise 4b** — Make `BIN_SIZE_DEGREES` a CLI flag in `build-data.ts` and
compare how many cells pass `isReliable` at 0.1 / 0.2 / 0.4°.

### 4c. Shrink small samples toward the mean (empirical Bayes)

A cell with 2 encounters in 10 cruises (rate 0.2) is much less certain than
one with 200 in 1,000. Shrinkage pulls noisy rates toward a regional mean in
proportion to their uncertainty.

With counts `yᵢ` and effort `Eᵢ` (cruises), assume `yᵢ ~ Poisson(λᵢ·Eᵢ)` and
`λᵢ ~ Gamma(α, β)` across cells. Then:

```
λ̂ᵢ = (yᵢ + α) / (Eᵢ + β)          # posterior mean
```

Estimate `α, β` from all cells by the method of moments, using the mean `m`
and variance `v` of the raw rates `yᵢ/Eᵢ`:

```
β ≈ m / (v − m / Ē)      α ≈ m · β       (Ē = mean effort)
```

(This only works when `v > m / Ē`, i.e. rates vary more than Poisson noise
alone would explain. If not, every cell is consistent with the mean, and
shrinking fully to `m` is the honest answer.)

Small cells move a lot toward `m`; large cells barely move. This replaces
the hard `isReliable` threshold with a continuous adjustment, and it fixes
the exploding % changes (ISSUES D-2) when applied to `earlyRate` and
`lateRate` separately.

**Exercise 4c** — Implement `shrinkRates(cells)` as a pure function in
`src/data/selectors.ts` with a `node:test` case. Show raw vs shrunk rates in
the D1 tooltip.

### 4d. Interpolate in time

For a cell or species with a missing year:

- **Linear** between neighbouring years: simple, and assumes smooth change.
- **Seasonal profile × annual level**: estimate a month shape from all years
  and an annual level from the months you have. The missing month is
  `level(year) · shape(month)`. This works well for the off-season islands.
- **Never extrapolate** past the first or last observed year, or into months
  an island's boats don't run.

**Exercise 4d** — Mask 2020 April–June, fill with seasonal × level, and
compare with the (near-empty) real values. Then do the same for a normal
year, where you know the answer.

### 4e. Interpolate in space

- **Inverse-distance weighting (IDW)**: the value at a point is a
  distance-weighted average of its neighbours. Easy, and blind to effort.
- **Kernel smoothing** of _both_ encounters and effort, then divide. This
  smooths the rate rather than the counts.
- **Kriging / Gaussian processes**: model spatial correlation and return a
  variance. This is the principled version, and usually needs R or Python.

**Effort guard:** only interpolate inside the area boats can reach (for
example within the convex hull of an island group's sightings, or within N km
of its harbours). Outside that area the honest value is "unknown".

### 4f. Model the observation process

When you want "where/when is species X more likely, given how data was
collected", fit a model instead of filling cells:

- **Poisson / negative-binomial GLM** with an effort offset:
  `log E[y] = log(cruises) + year + month + island + Beaufort`. Predictions
  for any combination fill gaps _with intervals_. Without dependencies,
  a small IRLS loop in TypeScript is a good learning project; otherwise use a
  notebook in R or Python.
- **Presence-only SDMs with target-group background**: use sightings of
  _all_ species as a proxy for where boats looked, and compare species X
  against that background. This is a standard bias correction for
  opportunistic data (Phillips et al. 2009). For MONICET it turns "no tracks"
  into a usable effort surface.
- **Occupancy / detection models** separate "absent" from "present but
  missed". They need repeated visits to the same site, which the archive
  partly provides (many cruises to the same cells), but no recorded
  non-detections. Read Fernández et al. 2022 on the role of absences.

### 4g. Impute missing attributes

- **Within-trip carry-over:** Beaufort and visibility rarely change much
  within a 3-hour trip. Fill a missing value from the nearest-in-time
  sighting of the same `parentEventID` and flag it as imputed.
- **Group size:** use the per-species median (by month/island), or better,
  **multiple imputation**: draw several plausible values, run the analysis
  on each and pool the results. This keeps the uncertainty instead of
  hiding it (van Buuren, ch. 1–3).
- **Family-only records:** assign Ziphiidae sightings to species in
  proportion to the local species mix as weights, never as hard labels.

---

## 5. Validating a fill

1. Take a complete subset, e.g. São Miguel 2016–2019.
2. Mask 10–20% of values the way real gaps occur: whole months, whole
   cells, not random points.
3. Fill with each method and compute error (MAE, and coverage of the
   intervals).
4. Repeat with different masks (cross-validation).
5. Keep the simplest method that is not clearly worse.

**Exercise 5** — Write `scripts/validate-fill.ts` that masks year-cells,
runs linear vs seasonal × level vs shrinkage, and prints an error table.

---

## 6. Suggested path through this repo

1. Fix the denominator (4a) → re-read D1 and see what the map now says.
2. Make sample size visible everywhere (§3).
3. Add empirical-Bayes shrinkage (4c) and compare with `isReliable`.
4. Temporal fill + validation (4d, §5) on the species sparkline.
5. Target-group effort surface (4f) as a new direction.

Put data work in `scripts/build-data.ts` (new JSON fields + `src/types`),
derived logic in `src/data/selectors.ts` (with tests), and encoding in the
components. Note each conscious trade-off in `ISSUES.md` or a short
decision note in `docs/`.

---

Planned feature that turns this guide into an interactive comparison:
[`ideas/imputation-lab.md`](ideas/imputation-lab.md).

---

## Further reading

- Little & Rubin, _Statistical Analysis with Missing Data_ (3rd ed., 2019) —
  the MCAR / MAR / MNAR framework.
- van Buuren, _Flexible Imputation of Missing Data_ (2nd ed., 2018) — free at
  <https://stefvanbuuren.name/fimd/>.
- Phillips et al. (2009), _Sample selection bias and presence-only
  distribution models_, Ecological Applications 19(1) — target-group
  background.
- Fernández, Sillero & Yesson (2022), _To be or not to be: the role of
  absences in niche modelling for highly mobile species_, Ecological
  Modelling 471 — cited in the MONICET paper.
- Robinson, _Introduction to Empirical Bayes_ (2017) — a gentle,
  example-driven introduction to shrinkage.
- Wilke, _Fundamentals of Data Visualization_ (2019), ch. 16 "Visualizing
  uncertainty" — free at <https://clauswilke.com/dataviz/>.
- Correll, Moritz & Heer (2018), _Value-Suppressing Uncertainty Palettes_,
  CHI '18.
