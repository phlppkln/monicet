# MONICET: Three Ways of Looking

Interactive visualisations of the MONICET whale-watching archive: 8,455
trips and 29,400 sightings of whales, dolphins and turtles around the Azores,
2009–2020. A landing page leads to two **directions**, each with its own
goal:

### Three Ways of Looking

How the goal behind a visualisation decides what it shows, and so which
visualisation interests which audience. The same data is mapped three times:

|     | Visualisation            | Question                       | Entry point |
| --- | ------------------------ | ------------------------------ | ----------- |
| D1  | Honest Instability       | Where is the data trustworthy? | the map     |
| D3  | The Species as Character | Who are the animals?           | a species   |
| D4  | The Field Journal        | Where did people look?         | a location  |

### Filling the Gaps

How different data-filling algorithms change the end result, where they
disagree, and what each one is good and bad at. _Not built yet_; see
[`docs/ideas/imputation-lab.md`](docs/ideas/imputation-lab.md) and the
learning guide [`docs/missing-data.md`](docs/missing-data.md).

The whole project is a sandbox for learning information visualisation and
for handling **patchy, opportunistic data**.

## Quick start

```sh
pnpm install
pnpm dev            # http://localhost:5173
```

The app only needs the committed `public/data/` files. To work on the data
pipeline:

```sh
pnpm data:fetch     # download the raw Darwin Core Archive into data/raw/
pnpm data:build     # rebuild public/data/monicet-map-data.json
pnpm data:check     # verify the committed JSON matches the raw data + build logic
pnpm data:profile   # regenerate docs/data-profile.md
```

Before committing, run `pnpm check` (types, tests, formatting).

Requires Node ≥ 24 and pnpm (`.mise.toml` pins both).

## Stack

Vue 3 + TypeScript + Vite, D3 v7, Sass. Nothing else at runtime.

## Documentation

- [`docs/dataset.md`](docs/dataset.md) — where the data comes from and how it
  was collected
- [`docs/data-dictionary.md`](docs/data-dictionary.md) — every field the app
  uses
- [`docs/data-profile.md`](docs/data-profile.md) — coverage and gaps, in
  numbers
- [`docs/missing-data.md`](docs/missing-data.md) — learning guide for filling
  gaps
- [`ISSUES.md`](ISSUES.md) — known problems, pitfalls and ideas
- [`AGENTS.md`](AGENTS.md) — architecture and conventions, written for AI
  coding agents but useful for humans too

## Data credit

Azevedo, Fernández & González García (2023), MONICET Darwin Core Archive,
<https://doi.org/10.14284/599>. Data paper: Biodiversity Data Journal 11:
e106991, <https://doi.org/10.3897/BDJ.11.e106991>. See
[`data/README.md`](data/README.md) for licence notes.

Originally built as a playground experiment in Philipp Klein's portfolio.
