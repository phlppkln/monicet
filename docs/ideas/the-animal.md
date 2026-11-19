# The Animal: "If I were this species…"

The question behind the view is the animal's own: _if I were this species,
where would I go, when, and why?_ Mating is one possible reason to be in the
Azores, but for most species in the archive it is not the main one. The
view tries to let the data show the other reasons:

| Reason (literature)  | What the archive can show                                       | Example species                       |
| -------------------- | --------------------------------------------------------------- | ------------------------------------- |
| Refuelling stop      | short spring peak, mostly travelling, some foraging, few calves | blue, fin, sei whale                  |
| Living here, nursery | present all year, much foraging, calves in every month          | sperm whale                           |
| Following warm water | present only in the warm months                                 | Atlantic spotted dolphin              |
| Growing up           | mostly resting, almost no "calves" (they are juveniles already) | loggerhead turtle                     |
| Raising young        | high calf share in the months present                           | pilot whale, spotted, striped dolphin |

## Encodings and why

- **"My year": one bar per calendar month.** Height = encounters per cruise
  (same correction as before; raw counts mostly follow the number of trips).
  Alternative considered: a radial "year clock". It reads nicely as a cycle
  but makes heights harder to compare, and December–January adjacency is
  not important here because winter has so little data.
- **Stack colour = behaviour on arrival**, as shares of that month's bar.
  So the bar keeps meaning "how often am I met", and the colours say "what
  was I doing". Alternative: a separate 100% stacked chart. Clearer
  shares, but two charts to line up for one month. Months with fewer than
  5 behaviour records are drawn as a dashed outline, not split.
- **Calf dot row, area = share of groups with a calf.** Area, not radius,
  so twice the share looks twice as heavy. Hollow dot below 20 life-stage
  records. Alternative: a line. A line suggests continuity between months
  that the data (pooled over 12 years) does not have.
- **Map = the selected month.** One log colour domain for all twelve
  months (the largest single-month cell count), so months are comparable;
  "All year" uses its own domain because it sums months.
- **Why-card: literature, labelled as such**, with sources, kept apart
  from the charts. Species without a note show the data alone.

## Known limits

Behaviour is the state at arrival and boat-influenced; deep divers forage
out of sight. Winter bars come mostly from São Miguel (ISSUES D-12). Sea
state is not used, so part of a summer peak can be better sightability
(ISSUES D-13). Notes still need source checks (ISSUES D-20).

## Open ideas

- Season slider or animation for the map, instead of clicking months.
- Show `speciesCertainty` (cruise share with a Wilson interval) next to the
  rate.
- Compare two species' years side by side ("who arrives when").
