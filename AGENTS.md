# AGENTS.md

Instructions for AI coding agents (and humans) working in this repository.
This is the single source of truth; `CLAUDE.md` and `GEMINI.md` only import
it. Keep tool-specific content out of this file.

## Project

An information-visualisation study of the **MONICET** whale-watching archive
(Azores, 2009–2020), split into two independent **directions**
(sub-projects). Each has its own goal and its own view, both reached from a
landing page:

| Direction                 | Route                     | Goal                                                                                                                                                                                                                                           |
| ------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Three Ways of Looking** | `#/three-ways-of-looking` | Show how the _goal_ behind a visualisation decides what it shows, and so which visualisation is interesting to which target group. One archive, three questions, three maps. Built.                                                            |
| **Filling the Gaps**      | `#/filling-the-gaps`      | Show how different _data-filling algorithms_ change the end result: where they agree and disagree, and their strengths and weaknesses. Title and subtitle only so far; plan in [`docs/ideas/imputation-lab.md`](docs/ideas/imputation-lab.md). |

Keep the two directions distinct. Shared code belongs in `shared-ui/`,
`data/`, `lib/` and `types/`; a direction never imports from the other
direction's component folder.

### The owner's goal

This is Philipp's **learning project**. He wants to work on it in depth and
learn about **information visualisation** and **data handling**, especially
**how missing data can be filled**, because the MONICET dataset is patchy.
In practice:

- Prefer changes that make the reasoning visible: clear names, small pure
  functions, notes in `docs/`. Avoid clever, compact code.
- When you choose a method (scale, encoding, fill algorithm, threshold),
  state why and name the alternatives in a comment or in `docs/`.
- Don't hide data problems. Surface them in the UI or record them in
  `ISSUES.md`.
- Ask before making product decisions; don't guess.

### Naming: directions and views

The two sub-projects are called **directions**. Inside Three Ways of
Looking, the three visualisations are the **views**, shown in this order:

| View         | Component                                                           | Question                     | Old name                       |
| ------------ | ------------------------------------------------------------------- | ---------------------------- | ------------------------------ |
| The Observer | `FieldJournal.vue`                                                  | "What did I see?"            | D4, "The Field Journal"        |
| The External | `shared-ui/CellMapExplorer.vue` (species, seasonality, boats modes) | still open                   | D1, "Honest Instability"       |
| The Animal   | `SpeciesAsCharacter.vue`                                            | "Where will I meet my kind?" | D3, "The Species as Character" |

Older notes (`ISSUES.md`, `docs/`) still say D1, D3 and D4; use the table
to translate.

Stack: **Vue 3 (`<script setup>`) + TypeScript + Vite**, **D3 v7** (full
package), **Sass**. Routing is a ~30-line hash router (`src/router.ts`); there
is no vue-router, UI kit, state library or CSS framework. Don't add
dependencies without asking the user first.

## Commands

Use **pnpm** and **Node ≥ 24** (`.mise.toml` pins both). Scripts run `.ts`
files directly with Node's built-in type stripping; there is no ts-node or
tsx.

| Command                        | What it does                                                          |
| ------------------------------ | --------------------------------------------------------------------- |
| `pnpm dev`                     | Vite dev server                                                       |
| `pnpm build`                   | type-check + production build to `dist/`                              |
| `pnpm typecheck`               | `vue-tsc --noEmit` (covers `src/` and `scripts/`)                     |
| `pnpm test`                    | `node --test` on `src/**/*.test.ts` and `scripts/**/*.test.ts`        |
| `pnpm format` / `format:check` | Prettier (tabs, double quotes, ES5 trailing commas)                   |
| `pnpm check`                   | typecheck + test + format check — **run before finishing any change** |
| `pnpm data:fetch`              | download and validate the raw Darwin Core Archive into `data/raw/`    |
| `pnpm data:build`              | regenerate `public/data/monicet-map-data.json` from `data/raw/`       |
| `pnpm data:check`              | rebuild in memory and fail if the committed JSON differs              |
| `pnpm data:profile`            | regenerate `docs/data-profile.md` (coverage and gap tables)           |

The `data:*` commands need `data/raw/`, which is gitignored. Run
`pnpm data:fetch` once.

## Architecture

```
src/
  App.vue                      renders the view for the current route
  router.ts                    hash router: route → view
  routes.ts                    route paths + href() (no imports, safe to use anywhere)
  views/                       one view per page; views hold page copy
    LandingView.vue            title, intro, one button per direction
    ThreeWaysOfLookingView.vue intro, comparison cards, the three visualisations, footer
    FillingTheGapsView.vue     title, subtitle, the decline map (dataset to fill)
  components/
    directions/
      three-ways-of-looking/   components used only by this direction
        FieldJournal.vue       The Observer — active years per cell, click → logbook panel
        SpeciesAsCharacter.vue The Animal — one species: distribution / dominance, sparkline
        ViewSection.vue        heading + framing text around one view
      filling-the-gaps/        components used only by this direction (empty)
    shared-ui/                 components used by more than one view
      CellMapExplorer.vue      grid-cell map with modes (prop), basemaps, layer toggle:
                               The External (species / seasonality / boats) and
                               Filling the Gaps (decline: the dataset to fill)
      BasemapControls.vue      basemap switch + data-layer toggle + opacity (v-model)
      MapAttribution.vue       tile provider credits under a map
      ModeSwitch.vue           pill-button option group (v-model)
      BackLink.vue             "← MONICET" link to the landing page
  data/
    useMonicetData.ts          fetch + module-level cache (one request per page load)
    selectors.ts               pure derivations over the dataset (+ selectors.test.ts)
  lib/                         framework-free helpers
    map.ts                     shared D3 basemap: projection, graticule, islands, tiles, zoom, cell paths
    legend.ts, tooltip.ts      gradient legend, hover tooltip
    format.ts, chartTokens.ts  number/label formatting, chart colors
  types/monicet.ts             JSON schema types — shared with scripts/
  styles/                      _tokens.scss (auto-injected), global.scss
scripts/
  build-data.ts                raw DwC-A → public/data/monicet-map-data.json
  fetch-data.ts                download + unzip + validate raw archive
  profile-data.ts              raw archive → docs/data-profile.md
  lib/dwca.ts                  TSV reader with header validation
public/data/                   committed, app-loaded data (JSON + basemap GeoJSON)
data/raw/                      raw archive (gitignored)
docs/                          dataset notes, data dictionary, learning material, ideas/
ISSUES.md                      known problems and ideas — the backlog
```

Layer rules:

- **Views** compose components and hold page copy. No data logic. Adding a
  page means a view in `views/`, a path in `routes.ts` and an entry in
  `router.ts`.
- **Direction folders** (`components/directions/<name>/`) hold components
  used by that direction only. Once a component is needed by a second
  view, move it to `shared-ui/`.
- **Components** own their D3 rendering and local UI state. They get data
  from `data/` and helpers from `lib/`.
- **`data/selectors.ts` and `lib/format.ts` stay pure.** No Vue, no D3, no
  DOM, and relative imports **with `.ts` extensions**, so that `node --test`
  can run them.
- **Every derived number comes from `scripts/build-data.ts`.** If a
  component needs a new metric over the whole dataset, add it to the build
  and to `src/types/monicet.ts`. Don't recompute it from raw data in the
  browser. The one open exception: Filling the Gaps may need to run fill
  algorithms in the browser. That is an undecided design question
  (`docs/ideas/imputation-lab.md`), so ask the user before building it.
- **Scripts** may import types from `src/types/` (`import type … from
"../src/types/monicet.ts"`) and values from the pure `src/lib/format.ts`
  (e.g. `MONTH_LABELS`), and must use only erasable TypeScript syntax
  (no `enum`, no `namespace`, no parameter properties). `tsconfig` enforces
  this with `erasableSyntaxOnly`.

## Conventions

- Styling: use the tokens in `src/styles/_tokens.scss` (auto-injected; don't
  `@use` it). Scoped `<style lang="scss">` per component. D3 code needs raw
  hex values; take them from `src/lib/chartTokens.ts`, which must stay in
  sync with the SCSS tokens.
- D3 pattern: each direction has a `renderMap()` that clears its container
  and redraws everything, called from `onMounted`, from watchers and on
  `resize`. Map basics (projection, polygon rewinding, zoom) come from
  `drawBaseMap()` in `src/lib/map.ts`.
- GeoJSON polygons must be **rewound** before d3-geo draws them (see the
  comment in `src/lib/map.ts`). Otherwise they fill the whole globe.
- Match the surrounding code's comment density and naming. Section dividers
  in long components use `// ─── Name ───`.

## Behaviour contract

The port from the portfolio (Nuxt) kept functionality **identical**, quirks
included. Known defects are listed in `ISSUES.md`, not fixed. When you work
on something:

- If you fix an `ISSUES.md` entry, delete it (or strike it through with a
  one-line note) in the same change.
- If you find a new problem you are not fixing, **add it to `ISSUES.md`**
  under the right section, with the file and the reason it matters.
- Changing build logic changes the data: run `pnpm data:build`, commit the
  regenerated JSON, and make sure `pnpm data:check` passes afterwards.

## Data — read before touching numbers

- [`docs/dataset.md`](docs/dataset.md) — source, citation, licence,
  collection method, archive structure, author-stated limitations.
- [`docs/data-dictionary.md`](docs/data-dictionary.md) — every field of the
  app JSON and how it is computed.
- [`docs/data-profile.md`](docs/data-profile.md) — generated coverage and gap
  tables.
- [`docs/basemaps.md`](docs/basemaps.md) — tile basemaps (satellite, terrain, …) under the D3 maps: how, sources, licences.
- [`docs/missing-data.md`](docs/missing-data.md) — learning guide on
  gap-filling, with exercises mapped to files in this repo.

Key facts an agent will otherwise get wrong:

- An **"encounter"** is a _(sighting event, species)_ pair, not an animal
  and not an occurrence row.
- **There is no spatial effort data and there are no absences.** Never
  present a count as abundance or an empty cell as "no animals".
- The contributing companies and islands changed over the years. Any
  year-over-year comparison must account for that (`ISSUES.md` D-1).
- Raw timestamps carry no timezone (`ISSUES.md` D-7).
- Data paper: González García et al. 2023, Biodiversity Data Journal 11:
  e106991, <https://doi.org/10.3897/BDJ.11.e106991>. Dataset DOI:
  <https://doi.org/10.14284/599>.

## Verifying UI changes

There are no browser tests. After a UI change run `pnpm check` and
`pnpm build`. Then open the affected pages (`pnpm dev`: the landing page,
`#/three-ways-of-looking`, `#/filling-the-gaps`) and exercise every mode of
the visualisations you touched. If you cannot open a browser, say so explicitly instead of
claiming the UI works.
