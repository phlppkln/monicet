# The MONICET dataset

What the raw data is, how it was collected, and what it can and cannot tell
you. Summarised from the data paper. Read the paper itself before drawing
conclusions.

## Sources

- **Data paper:** González García L., Fernández M., Azevedo J. M. N. (2023).
  _MONICET: The Azores whale watching contribution to cetacean monitoring._
  Biodiversity Data Journal 11: e106991.
  <https://doi.org/10.3897/BDJ.11.e106991> ·
  [PMC PDF](https://pmc.ncbi.nlm.nih.gov/articles/PMC10840504/pdf/bdj-11-e106991.pdf)
- **Dataset:** Azevedo J. M. N., Fernández M., González García L. (2023).
  _MONICET: long-term cetacean monitoring in the Azores based on whale
  watching observations (2009–2020)._ Darwin Core Archive v1.8.2.
  <https://doi.org/10.14284/599> · IPT:
  <https://ipt.vliz.be/eurobis/resource?r=monicet>
- **Project site:** <http://www.monicet.net/>
- **Licence:** see [ISSUES.md D-15](../ISSUES.md). `eml.xml` says CC BY-SA,
  the paper says CC BY 4.0. Until that is resolved, attribute the authors and
  share derived data under CC BY-SA.

## How the data was collected

- **Who:** guides on board whale-watching boats from 11 of the 23 registered
  companies (12 `recordedBy` values, because Picos de Aventura runs on two
  islands). The guides are often biologists. Companies take part
  voluntarily, and they joined and left over the years (see
  `data-profile.md`).
- **Where:** four islands: São Miguel (Ponta Delgada, Vila Franca do Campo),
  Terceira (Angra do Heroísmo), Faial (Horta) and Pico (Lajes, Madalena).
  The paper's coverage box is 37.31–39.91° N, 25.01–29.00° W.
- **When:** Jan 2009 – Dec 2020. São Miguel operates year-round; the other
  islands mainly May–September.
- **How animals are found:** lookouts (_vigias_) on land spot animals with
  binoculars and guide the boats to them. The boat crew also searches.
  **Detection is therefore steered from land and by commercial interest.**
  Boats prefer short distances, calm seas and "attractive" species and
  behaviour.
- **Trips:** 2.5–3 h, usually twice a day (around 09:00 and 13:30), with an
  occasional third trip in high season.
- **What is recorded:** departure and arrival times; for each sighting, the
  time, GPS position (usually on arrival and on leaving, sometimes in
  between, and a single point if the boat did not stop) and species. Where
  possible also group size, life stages, behaviour at arrival, Beaufort sea
  state and visibility.
- **Data entry:** written on paper at sea and typed in on land, sometimes
  later and by another person. A central team then validates the records,
  mainly for location and time mismatches.

## Archive structure (Darwin Core Archive)

```
event.txt   (core)  ─┬─ type = "cruise"   one whale-watching trip   8,455 rows
                     └─ type = "sample"   one sighting/encounter   29,400 rows
                          parentEventID → the cruise
occurrence.txt       one row per species × life stage in a sighting  77,572 rows
                          eventID → the sample
extendedmeasurementorfact.txt  measurements per occurrence           199,792 rows
                          occurrenceID → the occurrence; id = eventID
eml.xml              dataset metadata (authors, licence, coverage)
meta.xml             column → Darwin Core term mapping
```

### event.txt

| Column                      | Meaning                                                                                                   |
| --------------------------- | --------------------------------------------------------------------------------------------------------- |
| `type`                      | `cruise` (trip) or `sample` (sighting)                                                                    |
| `eventID`                   | `UAc_MONICET_cruise0001` or `…cruise0001:encounter00001`                                                  |
| `parentEventID`             | sample → its cruise                                                                                       |
| `eventDate`                 | ISO time or `start/end` interval, **no timezone**                                                         |
| `decimalLatitude/Longitude` | cruise: home harbour · sample: first position                                                             |
| `footprintWKT`              | cruise: `MULTIPOINT` of all positions on the trip · sample: `POINT` or `LINESTRING` (arrival → departure) |
| `samplingProtocol`          | always "visual observation from whale watching boat"                                                      |

### occurrence.txt

| Column                                | Meaning                                                            |
| ------------------------------------- | ------------------------------------------------------------------ |
| `occurrenceID`                        | eventID + species code + AphiaID (+ life stage)                    |
| `recordedBy`                          | contributing company                                               |
| `scientificName` / `scientificNameID` | WoRMS name / LSID (`urn:lsid:marinespecies.org:taxname:<AphiaID>`) |
| `occurrenceStatus`                    | always `present` — **the archive has no absence records**          |

### extendedmeasurementorfact.txt

| `measurementType`          | Values                                                           | Describes     |
| -------------------------- | ---------------------------------------------------------------- | ------------- |
| `count (best estimate)`    | integer, individuals seen from the boat                          | species group |
| `life stage`               | adult / juvenile / calf                                          | occurrence    |
| `behavior`                 | foraging / resting / socialising / travelling (state on arrival) | species group |
| `Beaufort wind force`      | 1–6 in this archive                                              | sighting      |
| `visibility`               | 0-1000 / 1000-5000 / 5000-10000 / >10000 m                       | sighting      |
| `sampling instrument name` | always `observers`                                               | sighting      |

Every row hangs off an `occurrenceID`, even the sighting-level measurements.
Those are attached to just one occurrence per sighting. Measure completeness
per sighting event, not per occurrence row (see `data-profile.md`).

## Limitations stated by the authors

1. **There is no absolute measure of effort.** There are no boat tracks and
   no lookout logs. Cruises are the only effort proxy.
2. **Selection bias.** Where boats go depends on lookouts, the weather and
   what customers want to see. Elusive or distant species are
   under-recorded.
3. **Identification.** Beaked whales (_Mesoplodon_), Bryde's vs sei whale,
   and short- vs long-finned pilot whales are hard to tell apart at sea.
4. **Behaviour.** What is recorded is the state at arrival, which the boat
   itself (or earlier boats) may have influenced. Encounters are short.
5. **Group size** is what the boat could see. Part of a larger group may be
   missed, and one group may be logged as several sightings (common with
   sperm whales).
6. **Duplicates.** Several boats often watch the same animals and each
   records its own sighting.
7. **Position errors** can creep in through the paper-then-keyboard workflow.

The authors suggest the data can support studies of habitat preference,
seasonality, long-term changes in distribution and relative abundance, and
rare events. In every case they ask for care because the data is
opportunistic.
