// Cuts polygon rings into the line pieces that fall inside a bounding box.
//
// Used for the wireframe basemap: coastlines and depth contours are drawn as
// strokes, so a polygon's ring is all we need, and a line has no winding
// order to get wrong (see rewindRing in src/lib/map.ts).
//
// Simplification: a piece ends at the last point inside the box rather than
// at the exact point where it crosses the edge. That leaves a gap of at most
// one segment at the box edge, which is invisible as long as the box is a
// little larger than the area shown on screen.

export type Point = [number, number];
export type Line = Point[];

export interface BBox {
	west: number;
	south: number;
	east: number;
	north: number;
}

export function isInside([lon, lat]: Point, box: BBox): boolean {
	return (
		lon >= box.west &&
		lon <= box.east &&
		lat >= box.south &&
		lat <= box.north
	);
}

/** Splits one line into the runs of consecutive points inside the box. */
export function clipLine(line: Line, box: BBox): Line[] {
	const pieces: Line[] = [];
	let current: Line = [];
	for (const point of line) {
		if (isInside(point, box)) {
			current.push(point);
		} else {
			if (current.length >= 2) pieces.push(current);
			current = [];
		}
	}
	if (current.length >= 2) pieces.push(current);
	return pieces;
}

/** Rounds coordinates; 3 decimals ≈ 100 m, far below one screen pixel here. */
export function roundLine(line: Line, decimals = 3): Line {
	const f = 10 ** decimals;
	return line.map(
		([lon, lat]) =>
			[Math.round(lon * f) / f, Math.round(lat * f) / f] as Point
	);
}

/** All rings of a GeoJSON Polygon or MultiPolygon, as lines. */
export function ringsOf(geometry: {
	type: string;
	coordinates: unknown;
}): Line[] {
	if (geometry.type === "Polygon") return geometry.coordinates as Line[];
	if (geometry.type === "MultiPolygon")
		return (geometry.coordinates as Line[][]).flat();
	return [];
}
