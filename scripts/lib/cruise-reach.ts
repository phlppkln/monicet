// "Where do boats go?" — which grid cells each cruise reached.
//
// The archive has no boat tracks. The only positions at sea are those logged
// at sightings (each sighting's footprintWKT: a POINT, or an arrival →
// departure LINESTRING). A cruise that searched an area and found nothing
// leaves no trace there. This measures where boats *recorded* being, which
// is biased toward where animals were found (ISSUES.md D-10).
//
// The cruise's own footprintWKT (harbour → sightings → harbour) is not used:
// its arrival point is wrong for most cruises, some cruises end on a
// sighting, and some have a harbour in the middle (ISSUES.md D-19).

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

/** Distinct cell ids a cruise reached; a cell counts once per cruise. */
export function cellsReached(
	positions: LonLat[],
	cellIdOf: (lon: number, lat: number) => string
): Set<string> {
	return new Set(positions.map(([lon, lat]) => cellIdOf(lon, lat)));
}
