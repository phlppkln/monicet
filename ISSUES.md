# Known issues, pitfalls and improvement ideas

Collected while porting MONICET from the Nuxt portfolio to this repo. **None of
these were fixed during the port** — behaviour was kept identical on purpose.
Each entry says where it lives and why it matters. Work through them one at a
time and strike or delete entries as they are resolved.

Labels: **[verified]** = observed in output or data · **[code]** = found by
reading the code, not yet reproduced in a browser · **[idea]** = improvement,
not a defect.

Numbers quoted below come from `docs/data-profile.md` (`pnpm data:profile`).

---

## 0. Feature ideas

- **Imputation Lab** — choose a gap-filling method and watch the whole page
  rebuild from the filled data, to compare methods' strengths and
  weaknesses. Full note: [`docs/ideas/imputation-lab.md`](docs/ideas/imputation-lab.md).

---

## 1. Data & methodology

### D-1 The "decline" metric mostly measures changes in who was recording [verified]

`scripts/build-data.ts` (§3–4) divides a cell's encounters by **all cruises
in the archive** for that period, from every island. But the set of islands
changed a lot: until 2010 only São Miguel contributed; Faial/Pico joined in
2011; Terceira in 2015; Faial/Pico cruises tripled in 2017
(see _Cruises per island group_ in the profile).

Consequences:

- São Miguel cells get a larger denominator in 2015–2020 just because other
  islands were added → an artificial "decline".
- Faial/Pico/Terceira cells had almost no early encounters → `earlyRate` is
  tiny and the % change explodes. This is why the legend runs to ±12,809% and
  the "Average change" reads **+1037.3%**.

Fix direction: normalise each cell by cruises from the island group(s) that
can actually reach it, or model it (see `docs/missing-data.md` §4).

### D-2 Percent change on tiny baselines is unstable [verified]

`declinePct = (late − early) / early`. With a near-zero `early` the ratio
becomes huge. The `isReliable` filter does not guard against this, because it
checks total encounters, not the early-period baseline. Consider a log ratio,
a minimum baseline, or shrinkage (empirical Bayes).

### D-3 Early/late split is arbitrary and includes the 2020 collapse [verified]

The years are split in half (2009–2014 vs 2015–2020). 2020 had 1–9 cruises
in April–June (COVID), and the late half also includes the 2017–2018 boom.
`trendSlope` (a per-year OLS slope) is computed but never used.

### D-4 "Encounter" can double-count the same animals [code]

One encounter = one (sighting event, species) pair. The paper notes that
several boats from different companies often watch the **same** group at the
same time, and each logs its own event. Nothing deduplicates across boats or
cruises.

### D-5 Family-level records are dropped; the count differs from the paper [verified]

`isSpeciesRank()` excludes 361 occurrence rows (Ziphiidae 349,
Balaenopteridae 8, Delphinidae 2, Kogiidae 2). The data paper says 374
occurrences are identified only to family. That gap is not explained yet.

### D-6 Only 14 of 25 species have common names [verified]

`COMMON_NAME_BY_SCIENTIFIC` in `scripts/build-data.ts` is maintained by hand.
False killer whale, Bryde's whale, orca, Sowerby's beaked whale and others
show their scientific name in the UI. Paper Table 2 lists all common names.

### ~~D-7 Timestamps are parsed in the build machine's timezone~~ [fixed]

Fixed: `parseEventDate()` now reads the offset-less wall-clock values as
UTC, so year/month bucketing and `pnpm data:check` give the same result on
any machine. The values remain Azores local time; nothing converts them.

### D-8 Only the start of an `eventDate` interval is used [code]

59% of sightings and 99% of cruises have a `start/end` interval. Durations
(time spent with the animals, trip length) are discarded, though they could
serve as an effort proxy.

### D-9 Reliability and confidence use undocumented magic numbers [code]

`isReliable` means ≥ 24 encounters and ≥ 3 active years.
`confidenceScore = min(1, n/80) · min(1, years/4)`. The 24/3 thresholds are
written into `meta.thresholds`, but the 80/4 constants of the confidence
score appear nowhere, and none of the numbers is justified.

### D-10 D4 labels "years with sightings" as survey coverage/effort [verified]

`yearsWithEncounters` counts years in which **something was seen** in the
cell. Under the labels "Survey coverage", "where people went" and "survey
activity" it reads as search effort. There is no spatial effort data at all:
no tracks, and only 76 of 8,455 trips have no sighting. A cell searched
every year with nothing seen would not exist on the map.

### D-11 Counts are not effort-normalised in D3 and D4 [verified]

This is acknowledged in the caveats, but the species sparkline basically
traces the cruise curve (2017 peak, 2020 drop). Readers will read it as
population change.

### D-12 Seasonal islands distort the monthly mix [code]

Only São Miguel operates year-round; the other islands mostly run May–Sep.
Monthly rates and the "what to expect" species shares pool all islands, so
summer composition is weighted toward the central-group species.

### D-13 The eMoF table is not used at all [idea]

Group size, behaviour, life stage, Beaufort and visibility (199,792 rows)
are ignored. Sea state and visibility affect detectability, so they matter
for any effort or reliability model.

### D-14 Known identification problems are not surfaced [idea]

The paper flags beaked whales (_Mesoplodon_ spp.), Bryde's vs sei whale, and
short- vs long-finned pilot whales as unreliable to identify at sea. The UI
treats every species as equally certain.

### D-15 The licence is stated differently in the paper and the archive [verified]

`eml.xml` says _Attribution-ShareAlike (CC BY-SA)_; the data paper says
_Creative Commons Attribution 4.0_. Until this is clarified, treat the data
as CC BY-SA, the stricter reading. The app footer does not cite the dataset
DOI (10.14284/599) or the paper.

### D-16 Grid cells exist only where species were seen [code]

The grid is built from encounter locations. Cells with surveys but no
species-rank sighting, and cells with only family-level sightings, are
absent rather than "zero". The grid origin is `floor(min / 0.2) · 0.2` of
the data, so new data could shift the whole grid. Cell coordinates also carry
floating-point noise (e.g. `37.400000000000006`).

### D-17 One company's name doesn't match where its cruises ran [verified]

`Terra_do_Pico` (named after Pico) has 131 cruises whose home harbour is on
São Miguel's north coast (−25.82, 37.89), and all 977 of its sightings are
off São Miguel too. Island grouping by harbour longitude is therefore right,
but anyone reading `recordedBy` as "the island" would put it on Pico.

### D-18 Seven cruises carry records from two companies [verified]

E.g. `cruise1201` (Picos_de_Aventura + Terra_Azul), `cruise4149`
(Horta_Cetaceos + Seacolors). One trip should have one operator; these look
like data-entry or merge slips. They make `companies` / `companiesActive` in
`speciesCertainty` slightly too high (Horta_Cetaceos, AquaAçores and
Picos_de_Aventura_-_Terceira each appear on São Miguel through a single
such cruise).

### D-19 Most cruise footprints end in Ponta Delgada, whatever the home port [verified]

A cruise's `footprintWKT` is departure harbour → sighting positions →
arrival harbour. The departure always matches the cruise's harbour, but the
arrival is `-25.66444 37.73472` (Ponta Delgada) for 5,261 of 8,455 cruises,
including all 2,027 Faial/Pico and 411 Terceira cruises, which cannot have
ended 100–300 km away. It looks like a data-entry default. The structure
isn't even consistent: 82 cruises end on a sighting position instead of a
harbour, and 66 have a harbour point in the middle. The build therefore
ignores cruise footprints and takes positions from the cruise's sighting
events (`scripts/build-data.ts`, `scripts/lib/cruise-reach.ts`); anything
else needing positions should do the same.

---

## 2. Visual encoding

### V-1 The decline color scale is dominated by outliers [verified]

The diverging domain is ±max(|declinePct|). With the D-1/D-2 outliers almost
every cell maps to near-gray. Clamp to a percentile, use a log ratio, or use
binned classes.

### V-2 Gray means both "no change" and "no value" [code]

`CHART_DIVERGING_NEUTRAL` is used for `declinePct === 0` and for `null`.

### V-3 Inconsistent "zero/no data" fills across directions [code]

D1 uses `#ecf0f2`, D3 uses `#e8eef2`, and D3 Dominance uses the first teal
ramp step for "Absent". The last makes absence look like weak presence.

### V-4 Linear sequential scales on highly skewed counts [verified]

Species counts per cell go up to 1,103 while most cells hold single or
double digits, so most cells end up pale. Consider sqrt/log or quantile
scales.

### V-5 D4 uses a different palette system [code]

D4 uses `d3.interpolateBlues`, while everything else uses the validated teal
tokens. Its legend shows "0 yr", which cannot occur (see D-16). Its tooltip
hard-codes "/ 12 years" (`MAX_YEARS`) instead of using `meta.years.length`.

### V-6 The graticule does not zoom with the map (D3, D4) [code]

In `src/lib/map.ts` the graticule is appended outside `mapGroup`, so zooming
shifts the map against the grid lines.

### V-7 Small, cramped labels [verified]

Month ticks are 7px, sparkline labels 8px, and island labels 10px (Corvo
overlaps Flores). The sparkline labels only the first and last year and the
max value, and has no hover.

### V-8 The basemap is a rough sketch [verified]

`public/data/azores.geojson` is hand-drawn boxes. The "envelope" edges curve
because d3 draws them as great-circle arcs. A real coastline (e.g. Natural
Earth 1:10m clipped to the region) would read far better.

_Partly done:_ The External's wireframe basemap now draws Natural Earth
coastlines (`public/data/azores-lines.geojson`, docs/basemaps.md). The Animal
and The Observer maps, and the island label positions everywhere, still use
the boxes.

---

## 3. Interaction & UX

### U-1 D4 never shows the selected-cell highlight [code]

The click handler sets `selectedCell`, but the map is not re-rendered, so
the teal outline only appears after a window resize.

### U-2 D3 legend goes blank after Dominance → Distribution [code]

`watch(showDominance)` runs `renderMap()` before Vue has re-mounted the
`v-else` legend container, so `legendContainer` is `null` and the gradient
is never drawn. A fix would use `nextTick` or `flush: "post"`.

### U-3 Every change rebuilds the whole SVG and resets zoom [code]

Resize, species change and mode change all clear and redraw the map. Zoom
level and tooltip state are lost. Resize events are not debounced.

### U-4 Opening the D4 logbook reflows the map without redrawing it [code]

The grid column changes from 1fr to 3fr/2fr. The SVG scales through its
viewBox, but the layout jumps.

### U-5 Hover-only information [verified]

Tooltips need a mouse. Touch devices and keyboard users get no cell details,
except through D4's click.

### U-6 The three directions do not talk to each other [idea]

Species are picked separately in D1 and D3. Selecting a cell in one map does
nothing in the others. Shared selection, brushing and linking would make
"three ways of looking" literal.

### U-7 The D1 legend domain changes when toggling "reliable only" [code]

Turning the filter on or off rescales the colours, so the same red means a
different value before and after.

### U-8 Plain loading and error states [code]

There is no retry button, although `useMonicetData().load()` supports
retrying after a failure.

### U-9 The D4 prompt sits under the map, wasting space [verified]

With no selection the layout is one column, and the "Select a cell" box
stretches the full width below the map.

---

## 4. Copy

- **C-1** The Direction 1 text says to uncheck _"Emphasise reliable cells"_,
  but the checkbox is labelled _"Show only reliable cells"_. [verified]
- **C-2** Directions are numbered 1, 3, 4. Direction 2 was dropped during
  ideation, and the gap looks like an error. [verified]
- **C-3** D4 copy says "years had any recorded survey activity"; it is years
  with sightings (see D-10). [verified]
- **C-4** The intro says "whale and dolphin encounters", but the loggerhead
  turtle is the 7th most-encountered species (1,199 encounters). [verified]
- **C-5** The footer calls the decline values "trends"; they are early/late
  % changes (see D-3). [verified]
- **C-6** D4's "Total occurrence records" shows deduplicated species
  encounters, not raw occurrence rows. [code]
- ~~**C-8** The word "direction" was used twice.~~ Fixed: the three
  visualisations are now the views The Observer / The External / The Animal,
  with no "Direction N" labels.
- **C-7** D1 only shows `meta.caveats[0]`; the other two caveats are never
  displayed. [code]

---

## 5. Accessibility

- **A-1** `role="tablist"` is used without `role="tab"` / `aria-selected` on
  the buttons (`src/components/shared-ui/ModeSwitch.vue`).
- **A-2** Map cells are not focusable and have no text alternative.
- **A-3** Some encodings rely on color alone (dominance, coverage); small grey
  text sits at low contrast.
- **A-4** Tooltips are built with `innerHTML` from data strings. That is safe
  today (our own JSON), but it is a risky pattern once data comes from
  elsewhere.

---

## 6. Code & project

- **K-1** `src/lib/chartTokens.ts` cites a `validate_palette.js` run that
  exists in neither repo, so the ΔE numbers cannot be re-checked.
- **K-2** Hex colors are duplicated between `_tokens.scss`, `chartTokens.ts`
  and the per-direction `MapTheme` objects.
- **K-3** `ModeSwitch` keeps two variants (`default` / `compact`) only to
  preserve small, probably accidental styling differences from the original
  components.
- **K-4** Global styles reproduce the Bootstrap reboot and portfolio
  `main.scss` by hand. Spacing and fonts match closely in a side-by-side
  screenshot but are not pixel-identical.
- **K-5** The same code still lives in the portfolio
  (`portfolio/pages/playground/monicet-map.vue` and friends), where it is a
  single page with no landing page. The two copies
  will drift until the portfolio links here instead.
- **K-6** No deployment target is configured yet (Vite `base` is `/`).
- **K-7** No lint step. Prettier and `vue-tsc` are the only static checks.
