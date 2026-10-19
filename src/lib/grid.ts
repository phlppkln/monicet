// Geometry of the observation grid: the square cells the build puts every
// sighting and cruise position into (scripts/build-data.ts). Pure — no Vue,
// no D3, no DOM — so it runs under `node --test`.

/**
 * Positions, in degrees, of the observation grid's lines along one axis
 * (latitude or longitude), covering at least `from`…`to`.
 *
 * The build puts every sighting and cruise position into a square cell of
 * `binSize` degrees, counted from the grid origin (`bounds.minLatGrid` /
 * `bounds.minLonGrid`; see getCellGeometry in scripts/build-data.ts). Cell
 * edges therefore sit at origin + k × binSize for whole k, including k < 0
 * outside the sightings' extent. Each position is computed exactly that way,
 * as the build does, rather than by adding binSize repeatedly, so
 * floating-point error does not build up along the axis. Lines and the
 * committed cells' corners agree to within ~1e-14°: the build gets a cell's
 * far edge as lon0 + binSize, which can round differently.
 */
export function gridLinePositions(
	origin: number,
	binSize: number,
	from: number,
	to: number
): number[] {
	if (!(binSize > 0) || to < from) return [];
	const first = Math.floor((from - origin) / binSize);
	const last = Math.ceil((to - origin) / binSize);
	const positions: number[] = [];
	for (let k = first; k <= last; k++) positions.push(origin + k * binSize);
	return positions;
}
