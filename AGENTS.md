# AGENTS.md

Instructions for AI coding agents (and humans) working in this repository.
This is the single source of truth; `CLAUDE.md` and `GEMINI.md` only import
it. Keep tool-specific content out of this file.

## Project

An interactive information-visualisation study of the **MONICET**
whale-watching archive (Azores, 2009–2020): three D3 maps that each ask a
different question of the same data. It is also a **learning project** about
infovis and about handling patchy data. Prefer changes that make the
reasoning visible (clear names, small pure functions, notes in `docs/`) over
clever compact code.

Stack: **Vue 3 (`<script setup>`) + TypeScript + Vite**, **D3 v7** (full
package), **Sass**. No router, UI kit, state library or CSS framework —
don't add dependencies without asking the user first.

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
  views/MonicetView.vue        page: intro, comparison cards, three directions, footer
  components/
    directions/                one component per visualisation ("direction")
      HonestInstability.vue    D1 — encounter-rate change, reliability as opacity
      SpeciesAsCharacter.vue   D3 — one species: distribution / dominance, sparkline
      FieldJournal.vue         D4 — active years per cell, click → logbook panel
    ui/                        small presentational pieces (ModeSwitch, DirectionSection)
  data/
    useMonicetData.ts          fetch + module-level cache (one request for all directions)
    selectors.ts               pure derivations over the dataset (+ selectors.test.ts)
  lib/                         framework-free helpers
    map.ts                     shared D3 basemap: projection, graticule, islands, zoom, cell paths
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
docs/                          dataset notes, data dictionary, learning material
ISSUES.md                      known problems and ideas — the backlog
```

Layer rules:

- **Views** compose components and hold page copy. No data logic.
- **Components** own their D3 rendering and local UI state. They get data
  from `data/` and helpers from `lib/`.
- **`data/selectors.ts` and `lib/format.ts` stay pure.** No Vue, no D3, no
  DOM, and relative imports **with `.ts` extensions**, so that `node --test`
  can run them.
- **Every derived number comes from `scripts/build-data.ts`.** If a
  component needs a new metric over the whole dataset, add it to the build
  and to `src/types/monicet.ts`. Don't recompute it from raw data in the
  browser.
- **Scripts** may import types from `src/types/` (`import type … from
"../src/types/monicet.ts"`) and must use only erasable TypeScript syntax
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
`pnpm build`. Then look at the page (`pnpm dev`) with each direction's modes
exercised. If you cannot open a browser, say so explicitly instead of
claiming the UI works.
