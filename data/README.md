# Raw data

`data/raw/` holds the MONICET Darwin Core Archive v1.8.2. It is
**gitignored**; fetch it with:

```sh
pnpm data:fetch
```

The script downloads the versioned archive linked from the data paper,
unzips it with Node built-ins, and checks that each table's header matches
its file name.

| File                            | Rows    | Content                                                  |
| ------------------------------- | ------- | -------------------------------------------------------- |
| `event.txt`                     | 37,855  | cruises (trips) and samples (sightings)                  |
| `occurrence.txt`                | 77,572  | species × life stage per sighting                        |
| `extendedmeasurementorfact.txt` | 199,792 | group size, behaviour, life stage, sea state, visibility |
| `eml.xml`                       | —       | dataset metadata                                         |
| `meta.xml`                      | —       | column → Darwin Core term mapping                        |

Details: [`docs/dataset.md`](../docs/dataset.md).

## Attribution

Azevedo J. M. N., Fernández M., González García L. (2023). _MONICET:
long-term cetacean monitoring in the Azores based on whale watching
observations (2009–2020)._ <https://doi.org/10.14284/599>

Data paper: González García L., Fernández M., Azevedo J. M. N. (2023).
Biodiversity Data Journal 11: e106991.
<https://doi.org/10.3897/BDJ.11.e106991>

Licence: `eml.xml` states **CC BY-SA**, while the paper states CC BY 4.0. The
derived file `public/data/monicet-map-data.json` is shared under CC BY-SA
until this is clarified.
