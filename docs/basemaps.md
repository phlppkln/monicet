# Basemaps

How real maps (satellite, terrain, …) get under the D3 visualisations, and
why it is done this way. Code: `src/lib/map.ts` (`BASEMAPS`, `drawTiles`).
Status: **pilot in `CellMapExplorer.vue` only** (The External and Filling
the Gaps), no zoom.

## How it works

Every web map (OpenStreetMap, Google, Esri, …) serves the world as square
256 px images ("tiles") in the **Web Mercator** projection. Zoom level `z`
splits the world into 2^z × 2^z tiles, addressed as `{z}/{x}/{y}`. A tile is
an ordinary image fetched by URL: no SDK, no handshake.

Our D3 basemap already uses `d3.geoMercator()`, which is the same
projection. So the tiles line up with the grid cells exactly. All that is
needed is to work out _which_ tiles cover the map and where to place them.
That is what [`d3-tile`](https://github.com/d3/d3-tile) does. It takes:

- **scale**: the width of the whole world in pixels. d3's Mercator scale is
  pixels per radian and the world is 2π radians wide, so
  `projection.scale() × 2π`.
- **translate**: where longitude 0 / latitude 0 lands on screen,
  `projection([0, 0])`.

It returns a list of `[x, y, z]` plus a `scale` and `translate` for placing
them. Each tile becomes an SVG `<image>` in a group drawn under everything
else. The zoom level is chosen from the scale; at the default map size this
is about z7 (z8 on high-DPI screens, via `zoomDelta`).

Layer order in the SVG: background → tiles → graticule (Sand theme only, not
used by The External) → envelope →
islands → data cells → coastlines (wireframe only) → island labels. The
wireframe coastlines sit above the data so the map stays readable through
it; they ignore the mouse so cell hover still works. On tiled basemaps the
D3 islands have no fill or stroke (the tiles show the coast) and only their
labels remain.

Under the tiles sits a plain coastline outline (or the island boxes until
the coastlines have loaded). The tiles are opaque, so it is only visible
when they fail to load: offline, behind a blocker, or during an outage.

The data layer toggle hides the cell group with `display: none` instead of
redrawing, so tiles are not requested again.

So that the basemap stays visible under the data, The External's cell layer is drawn
with an adjustable layer opacity (default 0.65) and a Gaussian blur of a
quarter cell width, and has no cell borders. The blur only softens edges.
It does **not** interpolate between cells, so cells without sightings stay
empty. Real spatial smoothing (kernel density, kriging) would estimate values
where nothing was recorded, which is a gap-filling decision for the Filling
the Gaps direction, not a styling choice.

## Sources

| Basemap   | Source                                                   | Licence / terms                                                                  |
| --------- | -------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Wireframe | Natural Earth 1:10m coastlines (`azores-lines.geojson`)  | public domain                                                                    |
| Basic     | Esri World Light Gray Canvas (`server.arcgisonline.com`) | attribution required; Esri's terms formally expect an ArcGIS account             |
| Satellite | EOX Sentinel-2 cloudless **2016** (`s2cloudless_3857`)   | CC BY 4.0. Later editions (2018+) are CC BY-NC-SA, so pick a new year with care. |
| Terrain   | Esri World Ocean Base (`server.arcgisonline.com`)        | attribution required; Esri's terms formally expect an ArcGIS account             |

"Terrain" is **bathymetry** (seafloor relief), not land relief: for whale
habitat the depth and the canyons around the islands are what matter.

Every tiled basemap must show its attribution; The External shows it under
the map.

### Wireframe lines

`public/data/azores.geojson` has only a rectangle per island, so the
wireframe uses `public/data/azores-lines.geojson`, built by
`pnpm data:map-lines` (`scripts/build-map-lines.ts`): the rings of Natural
Earth's land and minor-island polygons, one closed line per island (12–42
points each).

They are stored as lines, clipped to the study area plus a 1.5° margin
(`scripts/lib/clip-lines.ts`). Lines have no winding order, so the
rewinding needed for polygons does not apply. The file is about 4 KB and is
fetched only when the wireframe is first selected.

Depth contours (Natural Earth's 200–4000 m bathymetry rings) were tried and
removed: the wireframe should stay minimal, and Terrain already shows the
seafloor.

Natural Earth is generalised for 1:10 million maps. That is fine at today's
zoom but will look coarse once zoom is added; OSM coastlines (ODbL) would be
the finer source.

Not used:

- **CARTO Positron / Voyager**: now return an "API KEY REQUIRED" placeholder
  tile, with HTTP 200, so a status-code check does not catch it.

- **OSM's own tile servers** (`tile.openstreetmap.org`): their usage policy
  discourages use in apps.
- **Anything with an API key** (MapTiler, Mapbox, Stadia): the key would end up
  in a public repo.
- **EMODnet Bathymetry**: open and covers the Azores, but served as WMTS in
  its own tile matrix; worth trying as an alternative "terrain".

## Alternatives considered

- **Leaflet / MapLibre with D3 as an overlay.** Smoother zoom and vector
  styles, but the map library owns the view: the projection becomes a
  `d3.geoTransform` around `map.latLngToLayerPoint()`, zoom moves from
  `d3.zoom` to the library, and every visualisation has to be rewired.
- **Static images** (one stitched image per style). No network requests, but
  blurry when zoomed, several MB per style when sharp, and most providers
  forbid storing their tiles.

## Next step: zoom

`drawTiles()` is pure placement maths, so zoom is an extension, not a
rewrite. In the `d3.zoom` handler (`enableZoom()` in `map.ts`):

```ts
.on("zoom", (event) => {
	mapGroup.attr("transform", event.transform); // as today
	drawTiles(tileGroup, source, projection, width, height, event.transform);
});
```

and inside `drawTiles` apply the transform to both inputs:

```ts
.scale(projection.scale() * 2 * Math.PI * t.k)
.translate(t.apply(projection([0, 0])))
```

The `.data(tiles, key)` join already keeps tiles that stay visible and adds or
removes the rest. Things to handle at that point:

- the graticule currently does not follow zoom;
- providers have a maximum zoom (Esri Ocean is sparse beyond ~z10 in open
  water), so `scaleExtent` or a per-source `maxZoom` may be needed;
- D3 and D4 already zoom; give them tiles only once this works.
