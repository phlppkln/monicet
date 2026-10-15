// "Where do boats go?" — which grid cells each cruise reached.
//
// The archive has no boat tracks. A cruise's footprintWKT is a MULTIPOINT of
// harbour → the positions logged at its sightings → harbour. So the only
// positions at sea are where the boat stopped for animals: a cruise that
// searched an area and found nothing leaves no trace there. This measures
// where boats *recorded* being, which is biased toward where animals were
// found (ISSUES.md D-10).
//
// Harbour points are dropped (see positionsAtSea); otherwise every cruise
// would count in its harbour cell and drown out everything else.

export type LonLat = [number, number];

/** Points of a WKT POINT / MULTIPOINT / LINESTRING. Other types → []. */
export function parseWktPoints(wkt: string): LonLat[] {
	const match = /^\s*(POINT|MULTIPOINT|LINESTRING)\s*\((.*)\)\s*$/i.exec(wkt);
	if (!match) return [];
	return match[2]
		.split(",")
		.map((pair) =>
			pair.replace(/[()]/g, "").trim().split(/\s+/).map(Number)
		)
		.filter(
			(xy) =>
				xy.length === 2 &&
				Number.isFinite(xy[0]) &&
				Number.isFinite(xy[1])
		) as LonLat[];
}

/**
 * Positions of a cruise away from the harbour: the footprint without its
 * first point (departure harbour) and last point (arrival harbour).
 *
 * Why by position and not by matching the harbour coordinates: the arrival
 * point is wrong for 5,261 of 8,455 cruises. It is Ponta Delgada even for
 * boats from Horta or Angra (ISSUES.md D-19), so a coordinate match would let
 * those through as "positions at sea" off São Miguel.
 */
export function positionsAtSea(footprint: LonLat[]): LonLat[] {
	return footprint.slice(1, -1);
}

/** Distinct cell ids a cruise reached; a cell counts once per cruise. */
export function cellsReached(
	positions: LonLat[],
	cellIdOf: (lon: number, lat: number) => string
): Set<string> {
	return new Set(positions.map(([lon, lat]) => cellIdOf(lon, lat)));
}
