// Pure derivations over the prebuilt dataset. No Vue, no D3, no DOM — so
// they run under `node --test` and are the place to experiment with new
// metrics before wiring them into a component.
//
// Imports use explicit .ts extensions so Node's type stripping can resolve
// them without a bundler.

import type {
	Behaviour,
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
/**
 * Encounters per cruise for each calendar month. Raw monthly counts mostly
 * follow how many trips ran (July has ~15× the cruises of January); dividing
 * by cruises asks "if I go out this month, how likely is a sighting?".
 * Months without cruises get 0.
 */
export function monthlyRates(
	monthlyEncounters: number[],
	monthlyCruises: number[]
): number[] {
	return monthlyEncounters.map((count, i) =>
		monthlyCruises[i] ? count / monthlyCruises[i] : 0
	);
}

/**
 * Encounters per cruise for each year in `years`, in that order. Same idea
 * as monthlyRates: the number of trips grew and shrank over the archive, so
 * raw yearly counts mostly follow effort. Years without cruises get 0.
 * Caveat (ISSUES D-1): the cruises pool all islands, and which companies
 * and islands contributed changed over the years.
 */
export function yearlyRates(
	yearlyEncounters: Record<string, number>,
	yearlyCruises: Record<string, number>,
	years: number[]
): number[] {
	return years.map((year) => {
		const cruises = yearlyCruises[String(year)] ?? 0;
		return cruises ? (yearlyEncounters[String(year)] ?? 0) / cruises : 0;
	});
}

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
	const count = cell.speciesCounts[speciesId] ?? 0;
	if (!count) return "absent";
	// Compare counts, not positions in topSpecies: species with equal counts
	// must get the same label, whatever order the archive listed them in.
	const counts = Object.values(cell.speciesCounts).sort((a, b) => b - a);
	const thirdHighest = counts[Math.min(2, counts.length - 1)];
	if (count >= counts[0]) return "dominant";
	return count >= thirdHighest ? "notable" : "occasional";
}

/** Per-year encounter counts for a cell, only years with > 0 encounters. */
/**
 * One row per year of the archive, zero years included, so that a gap in
 * the record shows as a gap (2011, –, 2013) instead of closing up.
 */
export function yearRecord(cell: MonicetGridCell, years: number[]) {
	return years.map((year) => ({
		year,
		count: cell.yearlyEncounters[String(year)] ?? 0,
	}));
}

/** Only the years with at least one encounter. */
export function activeYearRows(cell: MonicetGridCell, years: number[]) {
	return yearRecord(cell, years).filter((row) => row.count > 0);
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

// ─── The Animal: "my year in the Azores" ────────────────────────────────────

/** Display order of the behaviours, also the stacking order (bottom first). */
export const BEHAVIOUR_ORDER: readonly Behaviour[] = [
	"foraging",
	"socialising",
	"resting",
	"travelling",
];

/**
 * Below this many encounters with a behaviour record, a month's activity
 * mix is not shown as proportions (one or two groups would read as 50% /
 * 100%). A fixed cut-off is the simplest honest option; alternatives are a
 * confidence interval per share (as speciesCertainty does) or a Bayesian
 * shrinkage towards the species' all-year mix.
 */
export const MIN_BEHAVIOUR_RECORDS = 5;

/**
 * Below this many encounters with a life-stage record, a month's calf share
 * is shown as "too few". 20 keeps the binomial 95% interval of a ~25% share
 * narrower than roughly ±20 points; see docs/data-dictionary.md.
 */
export const MIN_LIFE_STAGE_RECORDS = 20;

export interface MonthActivity {
	/** Encounters with a behaviour record this month. */
	total: number;
	counts: Record<Behaviour, number>;
	/** null when total < MIN_BEHAVIOUR_RECORDS. */
	shares: Record<Behaviour, number> | null;
	/** Most frequent behaviour, null when there is none; first in BEHAVIOUR_ORDER wins ties. */
	dominant: Behaviour | null;
}

/** Activity mix for one calendar month (0–11) of one species. */
export function monthActivity(
	species: MonicetSpeciesSummary,
	monthIndex: number
): MonthActivity {
	const counts = Object.fromEntries(
		BEHAVIOUR_ORDER.map((b) => [b, species.monthlyBehaviour[b][monthIndex]])
	) as Record<Behaviour, number>;
	const total = BEHAVIOUR_ORDER.reduce((sum, b) => sum + counts[b], 0);
	const shares =
		total >= MIN_BEHAVIOUR_RECORDS
			? (Object.fromEntries(
					BEHAVIOUR_ORDER.map((b) => [b, counts[b] / total])
				) as Record<Behaviour, number>)
			: null;
	let dominant: Behaviour | null = null;
	for (const b of BEHAVIOUR_ORDER) {
		if (counts[b] > 0 && (!dominant || counts[b] > counts[dominant])) {
			dominant = b;
		}
	}
	return { total, counts, shares, dominant };
}

export interface CalfShare {
	/** Encounters with a life-stage record this month. */
	records: number;
	withCalf: number;
	/** withCalf / records, null when records < MIN_LIFE_STAGE_RECORDS. */
	share: number | null;
}

/**
 * Share of encounters in which a calf was recorded. Not calves per animal:
 * one group with three calves counts once, like a group with one.
 */
export function monthCalfShare(
	species: MonicetSpeciesSummary,
	monthIndex: number
): CalfShare {
	const records = species.monthlyWithLifeStage[monthIndex];
	const withCalf = species.monthlyWithCalf[monthIndex];
	return {
		records,
		withCalf,
		share: records >= MIN_LIFE_STAGE_RECORDS ? withCalf / records : null,
	};
}

/** `{ cellId: encounters }` for one month (0–11), or all year when month is null. */
export function speciesCellCountsFor(
	species: MonicetSpeciesSummary,
	monthIndex: number | null
): Record<string, number> {
	return monthIndex === null
		? species.cellCounts
		: species.monthlyCellCounts[monthIndex];
}
