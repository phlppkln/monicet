// Effort-normalised early→late change per grid cell (fixes ISSUES.md D-1 and D-2).
//
// Why this exists:
// The naive decline metric in build-data.ts divides every cell's encounters by
// *all* cruises across all islands, then computes raw percent change
// `(late - early) / early`. Because São Miguel was the only island contributing
// in 2009–2010, Faial/Pico joined in 2011, and Terceira joined in 2015, that
// naive metric mostly measures who was recording (D-1) and explodes on tiny
// early baselines (D-2).
//
// What we do instead:
// 1. D-1 (Island-group reach): attribute each cell to the island group(s) whose
//    cruises ever logged a sighting there (`cruisesByIsland > 0`), and divide
//    its early/late encounters by total cruises from *only those island groups*
//    in each period.
//    Alternative: divide by cruises that visited the exact cell (used by The
//    External's species/seasonality maps), but that only counts cruises that
//    logged a sighting inside the cell (D-10) and hides zero-sighting visits.
// 2. D-2 (Symmetric log2 ratio + baseline guard): compute
//    `log2(reachLateRate / reachEarlyRate)` only when both periods have at least
//    `CHANGE_MIN_PERIOD_CRUISES` reachable cruises and at least
//    `CHANGE_MIN_PERIOD_ENCOUNTERS` encounters.
//    - Symmetric: +1 = doubled (2×), −1 = halved (0.5×), 0 = unchanged.
//    - Cells without enough early or late baseline return `null` (shown as
//      hatched "no baseline" on the map rather than invented).
//    Alternative: empirical-Bayes shrinkage toward the island-group mean (keeps
//    sparse cells by pulling them toward 0, at the cost of a prior assumption).

import type { IslandGroup } from "../../src/types/monicet.ts";
import { ISLAND_GROUPS } from "./certainty.ts";

/**
 * Minimum cruises from reachable island group(s) in *each* period (early and
 * late). Prevents cells off Terceira (0 cruises in 2009–2014) or barely
 * sampled harbours from producing a spurious rate.
 */
export const CHANGE_MIN_PERIOD_CRUISES = 50;

/**
 * Minimum encounters in *each* period (early and late). Prevents `log2(0)` and
 * stops a 1 → 5 sighting jump from reading as a 2.3-fold boom.
 */
export const CHANGE_MIN_PERIOD_ENCOUNTERS = 5;

export interface CellChangeResult {
	reachableIslands: IslandGroup[];
	earlyEncounters: number;
	lateEncounters: number;
	earlyReachCruises: number;
	lateReachCruises: number;
	reachEarlyRate: number | null;
	reachLateRate: number | null;
	changeLog2Ratio: number | null;
}

/**
 * Cruises per year split by island group, for every year in `years`.
 * Missing island/year pairs are explicitly set to 0 so downstream charts can
 * render gaps without guessing.
 */
export function buildYearlyCruisesByIsland(
	cruises: { island: IslandGroup; year: number }[],
	years: number[]
): Record<IslandGroup, Record<string, number>> {
	const result = {} as Record<IslandGroup, Record<string, number>>;
	for (const island of ISLAND_GROUPS) {
		result[island] = {};
		for (const year of years) {
			result[island][String(year)] = 0;
		}
	}
	for (const cruise of cruises) {
		const key = String(cruise.year);
		if (key in result[cruise.island]) {
			result[cruise.island][key] += 1;
		}
	}
	return result;
}

/**
 * Minimum share of a cell's visiting cruises an island group must contribute
 * to count as "able to reach" that cell.
 *
 * Why a 5% share floor instead of `> 0`: nine cells in the archive have a
 * single stray cruise (1–2 trips out of 70–2,169, < 0.8%) from an island
 * 150–250 km away (data-entry / D-18 merge slips). Without this guard, one
 * stray São Miguel record in a Terceira cell (`6:8`) would pull all 5,500
 * São Miguel cruises into that Terceira cell's denominator.
 */
export const MIN_REACH_ISLAND_SHARE = 0.05;

/** Island groups that regularly reach a cell (≥ 5% of cruises visiting it). */
export function reachableIslandsForCell(
	cruisesByIsland: Record<IslandGroup, number> | undefined,
	minShare = MIN_REACH_ISLAND_SHARE
): IslandGroup[] {
	if (!cruisesByIsland) return [];
	const total = ISLAND_GROUPS.reduce(
		(sum, island) => sum + (cruisesByIsland[island] ?? 0),
		0
	);
	if (total <= 0) return [];
	return ISLAND_GROUPS.filter(
		(island) => (cruisesByIsland[island] ?? 0) / total >= minShare
	);
}

function sumIslandCruises(
	yearlyCruisesByIsland: Record<IslandGroup, Record<string, number>>,
	islands: IslandGroup[],
	years: number[]
): number {
	let total = 0;
	for (const island of islands) {
		const byYear = yearlyCruisesByIsland[island];
		if (!byYear) continue;
		for (const year of years) {
			total += byYear[String(year)] ?? 0;
		}
	}
	return total;
}

function sumEncounters(
	yearlyEncounters: Record<string, number>,
	years: number[]
): number {
	let total = 0;
	for (const year of years) {
		total += yearlyEncounters[String(year)] ?? 0;
	}
	return total;
}

/**
 * Compute D-1 reachable-island rates and D-2 guarded log2 ratio for one cell.
 */
export function computeCellChange(params: {
	yearlyEncounters: Record<string, number>;
	cruisesByIsland: Record<IslandGroup, number> | undefined;
	yearlyCruisesByIsland: Record<IslandGroup, Record<string, number>>;
	earlyYears: number[];
	lateYears: number[];
	minPeriodCruises?: number;
	minPeriodEncounters?: number;
}): CellChangeResult {
	const {
		yearlyEncounters,
		cruisesByIsland,
		yearlyCruisesByIsland,
		earlyYears,
		lateYears,
		minPeriodCruises = CHANGE_MIN_PERIOD_CRUISES,
		minPeriodEncounters = CHANGE_MIN_PERIOD_ENCOUNTERS,
	} = params;

	const reachableIslands = reachableIslandsForCell(cruisesByIsland);
	const earlyEncounters = sumEncounters(yearlyEncounters, earlyYears);
	const lateEncounters = sumEncounters(yearlyEncounters, lateYears);
	const earlyReachCruises = sumIslandCruises(
		yearlyCruisesByIsland,
		reachableIslands,
		earlyYears
	);
	const lateReachCruises = sumIslandCruises(
		yearlyCruisesByIsland,
		reachableIslands,
		lateYears
	);

	const reachEarlyRate =
		earlyReachCruises > 0 ? earlyEncounters / earlyReachCruises : null;
	const reachLateRate =
		lateReachCruises > 0 ? lateEncounters / lateReachCruises : null;

	const hasBaseline =
		earlyReachCruises >= minPeriodCruises &&
		lateReachCruises >= minPeriodCruises &&
		earlyEncounters >= minPeriodEncounters &&
		lateEncounters >= minPeriodEncounters &&
		reachEarlyRate !== null &&
		reachLateRate !== null &&
		reachEarlyRate > 0 &&
		reachLateRate > 0;

	const changeLog2Ratio = hasBaseline
		? Math.log2(reachLateRate / reachEarlyRate)
		: null;

	return {
		reachableIslands,
		earlyEncounters,
		lateEncounters,
		earlyReachCruises,
		lateReachCruises,
		reachEarlyRate,
		reachLateRate,
		changeLog2Ratio,
	};
}
