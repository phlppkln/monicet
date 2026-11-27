import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
	buildYearlyCruisesByIsland,
	computeCellChange,
	reachableIslandsForCell,
} from "./cell-change.ts";

const EARLY = [2009, 2010, 2011];
const LATE = [2015, 2016, 2017];
const ALL_YEARS = [...EARLY, ...LATE];

describe("buildYearlyCruisesByIsland", () => {
	it("fills missing island-year pairs with zero", () => {
		const counts = buildYearlyCruisesByIsland(
			[
				{ island: "São Miguel", year: 2009 },
				{ island: "São Miguel", year: 2009 },
				{ island: "Terceira", year: 2015 },
			],
			ALL_YEARS
		);

		assert.equal(counts["São Miguel"]["2009"], 2);
		assert.equal(counts["São Miguel"]["2015"], 0);
		assert.equal(counts["Terceira"]["2009"], 0);
		assert.equal(counts["Terceira"]["2015"], 1);
		assert.equal(counts["Faial/Pico"]["2009"], 0);
	});
});

describe("reachableIslandsForCell", () => {
	it("returns island groups that account for at least 5% of visiting cruises", () => {
		assert.deepEqual(
			reachableIslandsForCell({
				"São Miguel": 42,
				Terceira: 0,
				"Faial/Pico": 3,
			}),
			["São Miguel", "Faial/Pico"]
		);
		// A single stray cruise from 200 km away (< 5%) is ignored.
		assert.deepEqual(
			reachableIslandsForCell({
				"São Miguel": 1,
				Terceira: 235,
				"Faial/Pico": 0,
			}),
			["Terceira"]
		);
		assert.deepEqual(reachableIslandsForCell(undefined), []);
	});
});

describe("computeCellChange", () => {
	const yearlyCruisesByIsland = {
		"São Miguel": {
			"2009": 100,
			"2010": 100,
			"2011": 100,
			"2015": 100,
			"2016": 100,
			"2017": 100,
		},
		Terceira: {
			"2009": 0,
			"2010": 0,
			"2011": 0,
			"2015": 80,
			"2016": 80,
			"2017": 80,
		},
		"Faial/Pico": {
			"2009": 0,
			"2010": 0,
			"2011": 60,
			"2015": 200,
			"2016": 200,
			"2017": 200,
		},
	};

	it("returns log2(2) = +1 when reachable rate doubles and -1 when halved", () => {
		const doubled = computeCellChange({
			yearlyEncounters: { "2009": 15, "2015": 30 },
			cruisesByIsland: { "São Miguel": 40, Terceira: 0, "Faial/Pico": 0 },
			yearlyCruisesByIsland,
			earlyYears: EARLY,
			lateYears: LATE,
		});
		assert.equal(doubled.earlyReachCruises, 300);
		assert.equal(doubled.lateReachCruises, 300);
		assert.equal(doubled.reachEarlyRate, 0.05);
		assert.equal(doubled.reachLateRate, 0.1);
		assert.equal(doubled.changeLog2Ratio, 1);

		const halved = computeCellChange({
			yearlyEncounters: { "2009": 30, "2015": 15 },
			cruisesByIsland: { "São Miguel": 40, Terceira: 0, "Faial/Pico": 0 },
			yearlyCruisesByIsland,
			earlyYears: EARLY,
			lateYears: LATE,
		});
		assert.equal(halved.changeLog2Ratio, -1);
	});

	it("marks Terceira-only cells (0 early cruises) as null rather than exploding", () => {
		const terceira = computeCellChange({
			yearlyEncounters: { "2015": 20, "2016": 25 },
			cruisesByIsland: { "São Miguel": 0, Terceira: 30, "Faial/Pico": 0 },
			yearlyCruisesByIsland,
			earlyYears: EARLY,
			lateYears: LATE,
		});
		assert.deepEqual(terceira.reachableIslands, ["Terceira"]);
		assert.equal(terceira.earlyReachCruises, 0);
		assert.equal(terceira.reachEarlyRate, null);
		assert.equal(terceira.changeLog2Ratio, null);
	});

	it("guards against tiny early encounter baselines (D-2)", () => {
		const tinyBaseline = computeCellChange({
			yearlyEncounters: { "2011": 2, "2015": 40 },
			cruisesByIsland: { "São Miguel": 0, Terceira: 0, "Faial/Pico": 35 },
			yearlyCruisesByIsland,
			earlyYears: EARLY,
			lateYears: LATE,
		});
		assert.equal(tinyBaseline.earlyEncounters, 2);
		assert.equal(tinyBaseline.changeLog2Ratio, null);
	});
});
