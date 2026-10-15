import * as d3 from "d3";
import { tile } from "d3-tile";

import type {
	BasemapFeature,
	BasemapFeatureCollection,
	MapLineCollection,
	MonicetGridCell,
} from "@/types/monicet";

// Shared D3 basemap for all three directions: background, graticule,
// study-region envelope, islands, and (optionally) zoom + island labels.
// Each direction draws its own grid cells into the returned `mapGroup`.

type Ring = [number, number][];

export interface MapTheme {
	background: string;
	/** Lat/lon lines every 0.5°; null = no graticule. */
	graticule: { stroke: string; width: number; opacity: number } | null;
	envelope: { fill: string; stroke: string };
	island: { fill: string; stroke: string };
	labelColor: string;
	/** Outline behind label text, for readability on photo/tile basemaps. */
	labelHalo?: string;
	/** Stroke for real coastlines (see BaseMapOptions.lines). */
	lines?: { coast: string };
}

/**
 * A slippy-map tile server. `url` builds the image address for one tile;
 * servers differ in the order of x and y in the path, so each source
 * spells out its own template.
 */
export interface TileSource {
	url: (x: number, y: number, z: number) => string;
	/** Required by every provider's terms; shown under the map. */
	attribution: { text: string; href: string }[];
}

export interface BaseMapOptions {
	theme: MapTheme;
	/** Width used when the container has no layout width yet. */
	fallbackWidth: number;
	minHeight: number;
	/** height = max(minHeight, width × aspect) */
	aspect: number;
	/** Raster tiles drawn under the D3 layers; null = D3-drawn basemap only. */
	tiles?: TileSource | null;
	/** Real coastlines, drawn when the theme styles them. */
	lines?: MapLineCollection | null;
}

export const SAND_THEME: MapTheme = {
	background: "#f8f3ea",
	graticule: { stroke: "#d7dfd0", width: 0.7, opacity: 0.8 },
	envelope: { fill: "#eef4e9", stroke: "#c7d5c0" },
	island: { fill: "#d3be9b", stroke: "#a4895d" },
	labelColor: "#645742",
};

// ─── Basemap catalogue ──────────────────────────────────────────────────────
//
// Two kinds of basemap:
// - D3-drawn ("wireframe"): islands and envelope come from our own GeoJSON,
//   no network requests.
// - Tiled ("basic", "satellite", "terrain"): raster tiles from a public tile
//   server, with our islands reduced to labels so they don't double the
//   coastline. Sources, licences and alternatives: docs/basemaps.md.

export type BasemapId = "wireframe" | "basic" | "satellite" | "terrain";

export interface Basemap {
	label: string;
	theme: MapTheme;
	tiles: TileSource | null;
}

// Outlines only. Islands come from the real coastlines (lines option); the
// rectangles in azores.geojson are only a fallback until those have loaded.
export const WIREFRAME_THEME: MapTheme = {
	background: "#fbfbfa",
	graticule: null,
	envelope: { fill: "none", stroke: "none" },
	island: { fill: "none", stroke: "#3f454c" },
	labelColor: "#3f454c",
	labelHalo: "#fbfbfa",
	lines: { coast: "#3f454c" },
};

/** Base for tiled maps: the tiles draw land and sea, D3 adds only labels. */
const TILED_THEME: MapTheme = {
	// Visible only while tiles load or if a request fails.
	background: "#dde5e8",
	graticule: null,
	envelope: { fill: "none", stroke: "none" },
	island: { fill: "none", stroke: "none" },
	labelColor: "#1f2a30",
	labelHalo: "#ffffff",
};

export const BASEMAPS: Record<BasemapId, Basemap> = {
	wireframe: { label: "Wireframe", theme: WIREFRAME_THEME, tiles: null },
	basic: {
		label: "Basic",
		theme: TILED_THEME,
		tiles: {
			// Esri World Light Gray Canvas: grey land, no labels, so the data
			// colours stay dominant. (CARTO Positron now needs an API key.)
			// Path order is z/y/x.
			url: (x, y, z) =>
				`https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/${z}/${y}/${x}`,
			attribution: [
				{
					text: "Esri, HERE, Garmin, © OpenStreetMap contributors, and the GIS user community",
					href: "https://www.arcgis.com/home/item.html?id=8b3d38c0819547faa83f7b7aca80bd76",
				},
			],
		},
	},
	satellite: {
		label: "Satellite",
		theme: {
			...TILED_THEME,
			background: "#0b1d2a",
			labelColor: "#ffffff",
			labelHalo: "#0b1d2a",
		},
		tiles: {
			// EOX Sentinel-2 cloudless, 2016 edition — the only edition under
			// CC BY 4.0 (later years are CC BY-NC-SA). Path order is z/y/x.
			url: (x, y, z) =>
				`https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/${z}/${y}/${x}.jpg`,
			attribution: [
				{
					text: "Sentinel-2 cloudless by EOX IT Services GmbH (contains modified Copernicus Sentinel data 2016 & 2017)",
					href: "https://s2maps.eu",
				},
			],
		},
	},
	terrain: {
		label: "Terrain",
		theme: TILED_THEME,
		tiles: {
			// Esri World Ocean Base: bathymetry (seafloor relief), which matters
			// more for whale habitat than land terrain. Path order is z/y/x.
			url: (x, y, z) =>
				`https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/${z}/${y}/${x}`,
			attribution: [
				{
					text: "Esri, GEBCO, NOAA, National Geographic, Garmin, HERE, Geonames.org, and other contributors",
					href: "https://www.arcgis.com/home/item.html?id=1e126e7520f9466c9ca28b8f28b5e500",
				},
			],
		},
	},
};

// d3-geo uses spherical geometry where polygon winding decides which side
// is "inside". The GeoJSON here is wound counter-clockwise (RFC 7946), which
// d3 reads as "everything except this polygon" — so every ring is reversed
// before drawing.
export function rewindRing(ring: Ring): Ring {
	return [...ring].reverse() as Ring;
}

function rewindFeature(feature: BasemapFeature): BasemapFeature {
	if (feature.geometry.type !== "Polygon") return feature;
	return {
		...feature,
		geometry: {
			...feature.geometry,
			coordinates: (feature.geometry.coordinates as Ring[]).map(
				rewindRing
			),
		},
	} as BasemapFeature;
}

const asGeo = (value: unknown) => value as d3.GeoPermissibleObjects;

export function drawBaseMap(
	container: HTMLElement,
	basemap: BasemapFeatureCollection,
	{
		theme,
		fallbackWidth,
		minHeight,
		aspect,
		tiles = null,
		lines = null,
	}: BaseMapOptions
) {
	const rewound: BasemapFeatureCollection = {
		...basemap,
		features: basemap.features.map(rewindFeature),
	};

	d3.select(container).selectAll("*").remove();

	const width = container.clientWidth || fallbackWidth;
	const height = Math.max(minHeight, Math.round(width * aspect));

	const svg = d3
		.select(container)
		.append("svg")
		.attr("viewBox", `0 0 ${width} ${height}`)
		.style("width", "100%")
		.style("height", "auto");

	svg.append("rect")
		.attr("x", 0)
		.attr("y", 0)
		.attr("width", width)
		.attr("height", height)
		.attr("fill", theme.background);

	const projection = d3.geoMercator();
	const geoPath = d3.geoPath(projection);
	projection.fitExtent(
		[
			[24, 24],
			[width - 24, height - 24],
		],
		asGeo(rewound)
	);

	const envelopeFeatures = rewound.features.filter(
		(f) => f.properties.kind === "envelope"
	);
	const islandFeatures = rewound.features.filter(
		(f) => f.properties.kind === "island"
	);

	// Tiles sit between the background and everything D3 draws. Under them
	// goes a plain outline of the land, hidden once the (opaque) tiles load
	// but still there if they don't: offline, blocked, or a server outage.
	if (tiles) {
		const fallbackLand = svg.append("g").attr("pointer-events", "none");
		if (lines) {
			drawCoastlines(
				fallbackLand,
				lines,
				{ coast: theme.labelColor },
				geoPath
			);
		} else {
			fallbackLand
				.selectAll("path")
				.data(islandFeatures)
				.join("path")
				.attr("d", (f) => geoPath(asGeo(f)) ?? "")
				.attr("fill", "none")
				.attr("stroke", theme.labelColor)
				.attr("stroke-width", 0.9);
		}
		drawTiles(svg.append("g"), tiles, projection, width, height);
	}

	// Graticule sits outside mapGroup, so it does not follow zoom.
	if (theme.graticule) {
		svg.append("path")
			.datum(d3.geoGraticule().step([0.5, 0.5])())
			.attr("d", geoPath as never)
			.attr("fill", "none")
			.attr("stroke", theme.graticule.stroke)
			.attr("stroke-width", theme.graticule.width)
			.attr("opacity", theme.graticule.opacity);
	}

	const mapGroup = svg.append("g");

	mapGroup
		.append("g")
		.selectAll("path")
		.data(envelopeFeatures)
		.join("path")
		.attr("d", (f) => geoPath(asGeo(f)) ?? "")
		.attr("fill", theme.envelope.fill)
		.attr("stroke", theme.envelope.stroke)
		.attr("stroke-width", 1);

	const drawLines = Boolean(lines && theme.lines);
	// pointer-events: none, so that lines raised above the data layer
	// (raiseLines) don't steal hover from the cells underneath.
	const linesGroup = mapGroup.append("g").attr("pointer-events", "none");
	if (lines && theme.lines) {
		drawCoastlines(linesGroup, lines, theme.lines, geoPath);
	}

	mapGroup
		.append("g")
		.selectAll("path")
		// With real coastlines drawn, the island rectangles would only add
		// boxes around them; keep the features for labels only.
		.data(drawLines ? [] : islandFeatures)
		.join("path")
		.attr("d", (f) => geoPath(asGeo(f)) ?? "")
		.attr("fill", theme.island.fill)
		.attr("stroke", theme.island.stroke)
		.attr("stroke-width", 0.9);

	/**
	 * Moves the coastlines above everything drawn so far.
	 * Call after drawing the data layer to keep the map readable on top of
	 * it; no-op on basemaps without lines.
	 */
	function raiseLines() {
		linesGroup.raise();
	}

	function drawIslandLabels() {
		mapGroup
			.append("g")
			.selectAll("text")
			.data(islandFeatures)
			.join("text")
			.attr("x", (f) => geoPath.centroid(asGeo(f))[0])
			.attr("y", (f) => geoPath.centroid(asGeo(f))[1])
			.attr("font-size", 10)
			.attr("font-family", "'Space Grotesk', sans-serif")
			.attr("fill", theme.labelColor)
			.attr("text-anchor", "middle")
			.attr("pointer-events", "none")
			.attr("stroke", theme.labelHalo ?? null)
			.attr("stroke-width", theme.labelHalo ? 2.5 : null)
			.attr("stroke-linejoin", "round")
			.attr("paint-order", "stroke")
			.text((f) => f.properties.name ?? "");
	}

	// Note: tiles do not follow zoom yet. Zooming would need drawTiles()
	// called again from the zoom handler with event.transform applied to
	// the tile scale and translate (see docs/basemaps.md).
	function enableZoom() {
		const zoom = d3
			.zoom<SVGSVGElement, unknown>()
			.scaleExtent([1, 6])
			.translateExtent([
				[0, 0],
				[width, height],
			])
			.on("zoom", (event) => {
				mapGroup.attr("transform", event.transform);
			});
		(svg as d3.Selection<SVGSVGElement, unknown, null, undefined>).call(
			zoom
		);
	}

	/** SVG path for one 0.2° grid cell. */
	function cellPath(cell: Pick<MonicetGridCell, "polygon">) {
		const feature = {
			type: "Feature",
			geometry: {
				type: "Polygon",
				coordinates: [rewindRing(cell.polygon)],
			},
		};
		return geoPath(asGeo(feature)) ?? "";
	}

	/** On-screen width of one 0.2° grid cell, in pixels. */
	const [x0] = projection([0, 0]) ?? [0, 0];
	const [x1] = projection([0.2, 0]) ?? [0, 0];
	const cellWidthPx = Math.abs(x1 - x0);

	return {
		svg,
		mapGroup,
		cellPath,
		cellWidthPx,
		raiseLines,
		drawIslandLabels,
		enableZoom,
	};
}

// ─── Coastlines ─────────────────────────────────────────────────────────────
//
// Lines, not polygons, so there is no winding order to rewind.

function drawCoastlines(
	group: d3.Selection<SVGGElement, unknown, null, undefined>,
	lines: MapLineCollection,
	colors: { coast: string },
	geoPath: d3.GeoPath
) {
	group
		.selectAll("path")
		.data(lines.features)
		.join("path")
		.attr("d", (f) => geoPath(asGeo(f)) ?? "")
		.attr("fill", "none")
		.attr("stroke", colors.coast)
		.attr("stroke-width", 1.1)
		.attr("stroke-linejoin", "round");
}

// ─── Tiles ──────────────────────────────────────────────────────────────────
//
// d3-tile does no loading itself: it only works out which [x, y, z] tiles
// cover the viewport. It needs to know where the whole world sits on
// screen, in the same terms the tile servers use (Web Mercator, which is
// what d3.geoMercator is):
// - scale: the world's width in pixels = projection.scale() × 2π
//   (d3's Mercator scale is pixels per radian; the world is 2π radians wide)
// - translate: where longitude 0 / latitude 0 lands on screen
// The browser then loads each tile as a plain <image>.

function drawTiles(
	group: d3.Selection<SVGGElement, unknown, null, undefined>,
	source: TileSource,
	projection: d3.GeoProjection,
	width: number,
	height: number
) {
	const tiles = tile()
		.size([width, height])
		.scale(projection.scale() * 2 * Math.PI)
		.translate(projection([0, 0]) ?? [0, 0])
		// On high-DPI screens fetch one zoom level deeper, so tiles stay sharp.
		.zoomDelta(Math.round(Math.log2(window.devicePixelRatio || 1)))();

	const [tx, ty] = tiles.translate;
	const k = tiles.scale;

	group
		.selectAll("image")
		.data(tiles, (d) => (d as [number, number, number]).join("/"))
		.join("image")
		.attr("href", ([x, y, z]) => source.url(x, y, z))
		// A failed tile would show the browser's broken-image icon over the
		// fallback coastline; drop it instead.
		.on("error", function () {
			d3.select(this).remove();
		})
		.attr("x", ([x]) => (x + tx) * k)
		.attr("y", ([, y]) => (y + ty) * k)
		// Tile size is fractional; half a pixel of overlap hides hairline seams.
		.attr("width", k + 0.5)
		.attr("height", k + 0.5);
}
