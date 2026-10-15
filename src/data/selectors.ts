// Pure derivations over the prebuilt dataset. No Vue, no D3, no DOM — so
// they run under `node --test` and are the place to experiment with new
// metrics before wiring them into a component.
//
// Imports use explicit .ts extensions so Node's type stripping can resolve
// them without a bundler.

import type {
	MonicetCruiseCell,
	MonicetGridCell,
	MonicetMapData,
	MonicetMonthlySummary,
	MonicetSpeciesSummary,
} from "../types/monicet.ts";

/** Cells reached by the most cruises, most first. */
export function topCruiseCells(cells: MonicetCruiseCell[], limit = 5) {
	return [...cells].sort((a, b) => b.cruises - a.cruises).slice(0, limit);
}

export type DominanceCategory =
	"absent" | "occasional" | "notable" | "dominant";

export function speciesOptions(data: MonicetMapData) {
	return data.speciesSummaries.map((species) => ({
		id: species.speciesId,
		label: `${species.commonName} (${species.scientificName})`,
	}));
}

export function findSpecies(
	data: MonicetMapData,
	speciesId: string
): MonicetSpeciesSummary | null {
	return data.speciesSummaries.find((s) => s.speciesId === speciesId) ?? null;
}

export function findMonth(
	data: MonicetMapData,
	month: number
): MonicetMonthlySummary | null {
	return data.monthlySummaries.find((m) => m.month === month) ?? null;
}

export function indexCells(cells: MonicetGridCell[]) {
	return new Map(cells.map((cell) => [cell.id, cell]));
}

/** Reliable cells that have a defined early→late change. */
export function reliableDeclineCells(cells: MonicetGridCell[]) {
	return cells.filter((c) => c.isReliable && c.declinePct !== null);
}

/** Arithmetic mean of declinePct over reliable cells; null if none. */
export function averageDecline(cells: MonicetGridCell[]): number | null {
	const values = reliableDeclineCells(cells).map((c) => c.declinePct ?? 0);
	if (!values.length) return null;
	return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Reliable cells sorted from strongest decline upwards. */
export function topDecliningCells(cells: MonicetGridCell[], limit = 6) {
	return reliableDeclineCells(cells)
		.sort((a, b) => (a.declinePct ?? 0) - (b.declinePct ?? 0))
		.slice(0, limit);
}

/** Cells where a species was encountered most often: [cellId, count][]. */
export function speciesHotspots(
	species: MonicetSpeciesSummary,
	limit = 6
): [string, number][] {
	return Object.entries(species.cellCounts)
		.sort((a, b) => b[1] - a[1])
		.slice(0, limit);
}

/** Index (0–11) of the month with the most encounters; first wins ties. */
export function bestMonthIndex(monthly: number[]): number {
	return monthly.indexOf(Math.max(...monthly));
}

/**
 * Habitat role of a species in one cell:
 * dominant = #1 species there, notable = in the cell's top 3,
 * occasional = present but outside the top 3, absent = never recorded.
 */
export function cellDominance(
	cell: MonicetGridCell,
	speciesId: string
): DominanceCategory {
	if (!cell.speciesCounts[speciesId]) return "absent";
	if (cell.topSpecies[0]?.speciesId === speciesId) return "dominant";
	return cell.topSpecies.some((t) => t.speciesId === speciesId)
		? "notable"
		: "occasional";
}

/** Per-year encounter counts for a cell, only years with > 0 encounters. */
export function activeYearRows(cell: MonicetGridCell, years: number[]) {
	return years
		.map((year) => ({
			year,
			count: cell.yearlyEncounters[String(year)] ?? 0,
		}))
		.filter((row) => row.count > 0);
}

/** "first – last" active year of a cell, or a fallback sentence. */
export function activeYearRange(cell: MonicetGridCell, years: number[]) {
	const active = activeYearRows(cell, years);
	if (!active.length) return "no active years recorded";
	return `${active[0].year} – ${active[active.length - 1].year}`;
}

/** All species seen in a cell, most frequent first, with display names. */
export function cellSpeciesList(cell: MonicetGridCell, data: MonicetMapData) {
	return Object.entries(cell.speciesCounts)
		.map(([id, count]) => ({
			id,
			count,
			name:
				data.speciesLookup[id]?.commonName ??
				data.speciesLookup[id]?.scientificName ??
				id,
		}))
		.sort((a, b) => b.count - a.count);
}
