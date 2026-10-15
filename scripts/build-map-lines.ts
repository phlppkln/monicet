// Builds public/data/azores-lines.geojson: real coastlines for the
// wireframe basemap. (public/data/azores.geojson only has a rectangle per
// island.)
//
//   pnpm data:map-lines
//
// Source: Natural Earth 1:10m (public domain, https://www.naturalearthdata.com),
// read from the project's GitHub mirror. Nothing is cached; the files are
// streamed, clipped to the study area and only the result is written.
//
// Depth contours (Natural Earth bathymetry layers) were tried and dropped:
// the wireframe should stay minimal, and the Terrain basemap already shows
// the seafloor.

import { writeFileSync } from "node:fs";
import path from "node:path";

import type {
	MapLineCollection,
	MapLineFeature,
} from "../src/types/monicet.ts";
import {
	clipLine,
	ringsOf,
	roundLine,
	type BBox,
	type Line,
} from "./lib/clip-lines.ts";

const SOURCE =
	"https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson";

const OUT_FILE = path.join(
	import.meta.dirname,
	"..",
	"public/data/azores-lines.geojson"
);

// Study envelope (public/data/azores.geojson) is 31.6–24.5° W, 36.7–39.9° N.
// The box is 1.5° larger on each side so clipped line ends stay off-screen.
const BOX: BBox = { west: -33.1, south: 35.2, east: -23.0, north: 41.4 };

const COAST_LAYERS = ["ne_10m_land", "ne_10m_minor_islands"];

interface SourceCollection {
	features: { geometry: { type: string; coordinates: unknown } | null }[];
}

async function fetchLayer(layer: string): Promise<SourceCollection> {
	const url = `${SOURCE}/${layer}.geojson`;
	const res = await fetch(url);
	if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
	return (await res.json()) as SourceCollection;
}

async function linesInBox(layers: string[]): Promise<Line[]> {
	const lines: Line[] = [];
	for (const layer of layers) {
		const collection = await fetchLayer(layer);
		for (const feature of collection.features) {
			if (!feature.geometry) continue;
			for (const ring of ringsOf(feature.geometry)) {
				lines.push(...clipLine(ring, BOX).map((l) => roundLine(l)));
			}
		}
		console.log(`${layer}: ${lines.length} line pieces so far`);
	}
	return lines;
}

const features: MapLineFeature[] = [];

const coast = await linesInBox(COAST_LAYERS);
if (coast.length === 0) {
	throw new Error("No coastline inside the study box — check BOX/sources.");
}
features.push({
	type: "Feature",
	properties: { kind: "coast" },
	geometry: { type: "MultiLineString", coordinates: coast },
});

const output: MapLineCollection = { type: "FeatureCollection", features };
writeFileSync(OUT_FILE, JSON.stringify(output) + "\n");

for (const f of features) {
	const points = f.geometry.coordinates.reduce((n, l) => n + l.length, 0);
	console.log(
		`${f.properties.kind}: ${f.geometry.coordinates.length} lines, ${points} points`
	);
}
console.log(`Wrote ${path.relative(process.cwd(), OUT_FILE)}`);
