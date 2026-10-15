import assert from "node:assert/strict";
import { test } from "node:test";

import type { MonicetGridCell } from "../types/monicet.ts";
import {
	activeYearRange,
	averageDecline,
	bestMonthIndex,
	cellDominance,
	topDecliningCells,
} from "./selectors.ts";

function cell(overrides: Partial<MonicetGridCell>): MonicetGridCell {
	return {
		id: "0:0",
		row: 0,
		col: 0,
		lat0: 37.6,
		lon0: -25.8,
		centerLat: 37.7,
		centerLon: -25.7,
		polygon: [],
		encounterCount: 0,
		yearlyEncounters: {},
		monthlyEncounters: Array(12).fill(0),
		speciesCounts: {},
		earlyRate: null,
		lateRate: null,
		declinePct: null,
		trendSlope: 0,
		yearsWithEncounters: 0,
		confidenceScore: 0,
		isReliable: false,
		topSpecies: [],
		...overrides,
	};
}

const top = (ids: string[]) =>
	ids.map((speciesId) => ({
		speciesId,
		count: 1,
		scientificName: speciesId,
		commonName: speciesId,
	}));

test("averageDecline only uses reliable cells with a defined change", () => {
	const cells = [
		cell({ isReliable: true, declinePct: -20 }),
		cell({ isReliable: true, declinePct: 10 }),
		cell({ isReliable: false, declinePct: -90 }),
		cell({ isReliable: true, declinePct: null }),
	];
	assert.equal(averageDecline(cells), -5);
	assert.equal(averageDecline([]), null);
});

test("topDecliningCells sorts strongest decline first and limits", () => {
	const cells = [5, -30, -10, 20].map((d, i) =>
		cell({ id: String(i), isReliable: true, declinePct: d })
	);
	assert.deepEqual(
		topDecliningCells(cells, 2).map((c) => c.declinePct),
		[-30, -10]
	);
});

test("cellDominance buckets a species by its rank in the cell", () => {
	const c = cell({
		speciesCounts: { a: 9, b: 5, c: 3, d: 1 },
		topSpecies: top(["a", "b", "c"]),
	});
	assert.equal(cellDominance(c, "a"), "dominant");
	assert.equal(cellDominance(c, "c"), "notable");
	assert.equal(cellDominance(c, "d"), "occasional");
	assert.equal(cellDominance(c, "x"), "absent");
});

test("bestMonthIndex returns the first maximum", () => {
	assert.equal(bestMonthIndex([1, 4, 4, 2]), 1);
});

test("activeYearRange spans first to last year with encounters", () => {
	const c = cell({ yearlyEncounters: { "2010": 2, "2013": 1 } });
	assert.equal(
		activeYearRange(c, [2009, 2010, 2011, 2012, 2013]),
		"2010 – 2013"
	);
	assert.equal(activeYearRange(cell({}), [2009]), "no active years recorded");
});
