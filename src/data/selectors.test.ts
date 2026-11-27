import assert from "node:assert/strict";
import { test } from "node:test";

import type {
	MonicetCruiseCell,
	MonicetGridCell,
	MonicetSpeciesSummary,
} from "../types/monicet.ts";
import {
	activeYearRange,
	averageDecline,
	bestMonthIndex,
	cellRate,
	MIN_CRUISES_FOR_RATE,
	cellDominance,
	islandCruiseShares,
	medianLog2Change,
	MIN_BEHAVIOUR_RECORDS,
	MIN_LIFE_STAGE_RECORDS,
	monthActivity,
	monthCalfShare,
	monthlyRates,
	speciesCellCountsFor,
	topCruiseCells,
	topDecliningCells,
	yearlyCellRate,
	yearlyIslandRates,
	yearlyRates,
	yearRecord,
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
		reachableIslands: [],
		earlyEncounters: 0,
		lateEncounters: 0,
		earlyReachCruises: 0,
		lateReachCruises: 0,
		reachEarlyRate: null,
		reachLateRate: null,
		changeLog2Ratio: null,
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

test("medianLog2Change ignores null cells and handles odd/even counts", () => {
	assert.equal(
		medianLog2Change([
			cell({ changeLog2Ratio: -1 }),
			cell({ changeLog2Ratio: 0.2 }),
			cell({ changeLog2Ratio: 3 }),
			cell({ changeLog2Ratio: null }),
		]),
		0.2
	);
	assert.equal(
		medianLog2Change([
			cell({ changeLog2Ratio: -1 }),
			cell({ changeLog2Ratio: 1 }),
		]),
		0
	);
	assert.equal(medianLog2Change([cell({ changeLog2Ratio: null })]), null);
});

test("islandCruiseShares computes cruise shares for a period", () => {
	const shares = islandCruiseShares(
		{
			"São Miguel": { "2009": 80, "2010": 0 },
			"Faial/Pico": { "2009": 20, "2010": 0 },
			Terceira: { "2009": 0, "2010": 0 },
		},
		[2009, 2010]
	);
	assert.equal(shares[0].island, "São Miguel");
	assert.equal(shares[0].share, 0.8);
	assert.equal(shares[1].island, "Faial/Pico");
	assert.equal(shares[1].share, 0.2);
	assert.equal(shares[2].island, "Terceira");
	assert.equal(shares[2].share, 0);
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

test("cellRate divides by cruises and gives no value below the minimum", () => {
	assert.equal(cellRate(5, 20), 0.25);
	assert.equal(cellRate(0, 20), 0);
	assert.equal(cellRate(3, MIN_CRUISES_FOR_RATE - 1), null);
	assert.equal(cellRate(0, 0, 0), null);
});

test("yearRecord keeps years without encounters as zero rows", () => {
	const c = cell({ yearlyEncounters: { "2010": 2, "2012": 1 } });
	assert.deepEqual(yearRecord(c, [2010, 2011, 2012]), [
		{ year: 2010, count: 2 },
		{ year: 2011, count: 0 },
		{ year: 2012, count: 1 },
	]);
});

test("topCruiseCells sorts by cruises and limits", () => {
	const make = (id: string, cruises: number) =>
		({ id, cruises }) as MonicetCruiseCell;
	const top = topCruiseCells([make("a", 3), make("b", 9), make("c", 5)], 2);
	assert.deepEqual(
		top.map((c) => c.id),
		["b", "c"]
	);
});

test("cellDominance gives tied species the same label", () => {
	const c = cell({
		speciesCounts: { a: 3, b: 3, c: 2, d: 2, e: 1 },
		topSpecies: top(["a", "b", "c"]),
	});
	assert.equal(cellDominance(c, "a"), "dominant");
	assert.equal(cellDominance(c, "b"), "dominant");
	assert.equal(cellDominance(c, "c"), "notable");
	assert.equal(cellDominance(c, "d"), "notable");
	assert.equal(cellDominance(c, "e"), "occasional");
});

test("monthlyRates divides by cruises and moves the best month", () => {
	// Many encounters in a busy month, a higher rate in a quiet one.
	const rates = monthlyRates([10, 100, 0], [20, 400, 0]);
	assert.deepEqual(rates, [0.5, 0.25, 0]);
	assert.equal(bestMonthIndex([10, 100, 0]), 1);
	assert.equal(bestMonthIndex(rates), 0);
});

test("yearlyRates divides by cruises and fills missing years with 0", () => {
	// 2010 has cruises but no encounters; 2011 has no cruises at all.
	const rates = yearlyRates(
		{ "2009": 30, "2012": 5 },
		{ "2009": 60, "2010": 40, "2012": 50 },
		[2009, 2010, 2011, 2012]
	);
	assert.deepEqual(rates, [0.5, 0, 0, 0.1]);
});

// ─── The Animal ─────────────────────────────────────────────────────────────

function species(
	overrides: Partial<MonicetSpeciesSummary>
): MonicetSpeciesSummary {
	const zeros = () => Array(12).fill(0);
	return {
		speciesId: "sp",
		scientificName: "Testus testus",
		commonName: "Test whale",
		totalEncounters: 0,
		yearlyEncounters: {},
		monthlyEncounters: zeros(),
		cellCounts: { a: 9 },
		monthlyCellCounts: Array.from({ length: 12 }, () => ({})),
		monthlyBehaviour: {
			foraging: zeros(),
			socialising: zeros(),
			travelling: zeros(),
			resting: zeros(),
		},
		monthlyWithLifeStage: zeros(),
		monthlyWithCalf: zeros(),
		...overrides,
	};
}

test("monthActivity: shares only from MIN_BEHAVIOUR_RECORDS on", () => {
	const s = species({});
	s.monthlyBehaviour.travelling[3] = 3;
	s.monthlyBehaviour.foraging[3] = 1;
	const few = monthActivity(s, 3);
	assert.equal(few.total, 4);
	assert.equal(few.shares, null);
	assert.equal(few.dominant, "travelling");

	s.monthlyBehaviour.foraging[3] = MIN_BEHAVIOUR_RECORDS;
	const enough = monthActivity(s, 3);
	assert.equal(enough.dominant, "foraging");
	assert.equal(enough.shares?.travelling, 3 / (3 + MIN_BEHAVIOUR_RECORDS));
});

test("monthActivity: no records means no dominant behaviour", () => {
	assert.equal(monthActivity(species({}), 0).dominant, null);
});

test("monthCalfShare: null below MIN_LIFE_STAGE_RECORDS", () => {
	const s = species({});
	s.monthlyWithLifeStage[6] = MIN_LIFE_STAGE_RECORDS - 1;
	s.monthlyWithCalf[6] = 5;
	assert.equal(monthCalfShare(s, 6).share, null);
	s.monthlyWithLifeStage[6] = 40;
	assert.equal(monthCalfShare(s, 6).share, 5 / 40);
});

test("speciesCellCountsFor: null month means all year", () => {
	const s = species({});
	s.monthlyCellCounts[1] = { b: 2 };
	assert.deepEqual(speciesCellCountsFor(s, null), { a: 9 });
	assert.deepEqual(speciesCellCountsFor(s, 1), { b: 2 });
});

test("yearlyIslandRates divides by each island's own cruises and leaves gaps null", () => {
	const cells = [
		cell({
			id: "sm",
			reachableIslands: ["São Miguel"],
			yearlyEncounters: { "2009": 100, "2010": 50 },
		}),
		cell({
			id: "te",
			reachableIslands: ["Terceira"],
			yearlyEncounters: { "2010": 40 },
		}),
	];
	const cruises = {
		"São Miguel": { "2009": 50, "2010": 25 },
		"Faial/Pico": { "2009": 0, "2010": 0 },
		Terceira: { "2009": 0, "2010": 20 },
	};
	const series = yearlyIslandRates(cells, cruises, [2009, 2010]);
	assert.equal(series[0].points[0].rate, 2);
	assert.equal(series[0].points[1].rate, 2);
	assert.equal(series[1].points[0].rate, null);
	assert.equal(series[2].points[0].rate, null);
	assert.equal(series[2].points[1].rate, 2);
});

test("yearlyCellRate guards against unmonitored years", () => {
	const c = cell({
		reachableIslands: ["Terceira"],
		yearlyEncounters: { "2014": 0, "2015": 20 },
	});
	const cruises = {
		"São Miguel": { "2014": 200, "2015": 200 },
		"Faial/Pico": { "2014": 100, "2015": 100 },
		Terceira: { "2014": 0, "2015": 80 },
	};
	assert.equal(yearlyCellRate(c, cruises, 2014).rate, null);
	assert.equal(yearlyCellRate(c, cruises, 2015).rate, 0.25);
});
