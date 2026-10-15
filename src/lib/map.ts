import * as d3 from "d3";

import type {
	BasemapFeature,
	BasemapFeatureCollection,
	MonicetGridCell,
} from "@/types/monicet";

// Shared D3 basemap for all three directions: background, graticule,
// study-region envelope, islands, and (optionally) zoom + island labels.
// Each direction draws its own grid cells into the returned `mapGroup`.

type Ring = [number, number][];

export interface MapTheme {
	background: string;
	graticule: { stroke: string; width: number; opacity: number };
	envelope: { fill: string; stroke: string };
	island: { fill: string; stroke: string };
	labelColor: string;
}

export interface BaseMapOptions {
	theme: MapTheme;
	/** Width used when the container has no layout width yet. */
	fallbackWidth: number;
	minHeight: number;
	/** height = max(minHeight, width × aspect) */
	aspect: number;
}

export const SAND_THEME: MapTheme = {
	background: "#f8f3ea",
	graticule: { stroke: "#d7dfd0", width: 0.7, opacity: 0.8 },
	envelope: { fill: "#eef4e9", stroke: "#c7d5c0" },
	island: { fill: "#d3be9b", stroke: "#a4895d" },
	labelColor: "#645742",
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
	{ theme, fallbackWidth, minHeight, aspect }: BaseMapOptions
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

	// Graticule sits outside mapGroup, so it does not follow zoom.
	const graticule = d3.geoGraticule().step([0.5, 0.5]);
	svg.append("path")
		.datum(graticule())
		.attr("d", geoPath as never)
		.attr("fill", "none")
		.attr("stroke", theme.graticule.stroke)
		.attr("stroke-width", theme.graticule.width)
		.attr("opacity", theme.graticule.opacity);

	const envelopeFeatures = rewound.features.filter(
		(f) => f.properties.kind === "envelope"
	);
	const islandFeatures = rewound.features.filter(
		(f) => f.properties.kind === "island"
	);

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

	mapGroup
		.append("g")
		.selectAll("path")
		.data(islandFeatures)
		.join("path")
		.attr("d", (f) => geoPath(asGeo(f)) ?? "")
		.attr("fill", theme.island.fill)
		.attr("stroke", theme.island.stroke)
		.attr("stroke-width", 0.9);

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
			.text((f) => f.properties.name ?? "");
	}

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
	function cellPath(cell: MonicetGridCell) {
		const feature = {
			type: "Feature",
			geometry: {
				type: "Polygon",
				coordinates: [rewindRing(cell.polygon)],
			},
		};
		return geoPath(asGeo(feature)) ?? "";
	}

	return { svg, mapGroup, cellPath, drawIslandLabels, enableZoom };
}
