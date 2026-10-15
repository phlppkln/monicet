import assert from "node:assert/strict";
import { test } from "node:test";

import {
	computeSpeciesCertainty,
	islandGroupOf,
	wilsonInterval,
	type CruiseInput,
	type EncounterInput,
} from "./certainty.ts";

test("wilsonInterval stays inside [0, 1] and is not empty at k = 0", () => {
	const { low, high } = wilsonInterval(0, 20);
	assert.equal(low, 0);
	assert.ok(high > 0.1 && high < 0.2); // ≈ 0.161
});

test("wilsonInterval narrows as n grows", () => {
	const small = wilsonInterval(5, 10);
	const large = wilsonInterval(500, 1000);
	assert.ok(large.high - large.low < small.high - small.low);
});

test("islandGroupOf splits by harbour longitude", () => {
	assert.equal(islandGroupOf(-25.67), "São Miguel");
	assert.equal(islandGroupOf(-27.22), "Terceira");
	assert.equal(islandGroupOf(-28.63), "Faial/Pico");
});

test("islandGroupOf rejects a missing longitude instead of guessing", () => {
	assert.throws(() => islandGroupOf(Number.NaN));
});

test("computeSpeciesCertainty counts cruises, not encounters", () => {
	const cruises: CruiseInput[] = [
		{ cruiseId: "c1", island: "São Miguel", year: 2010 },
		{ cruiseId: "c2", island: "São Miguel", year: 2011 },
		{ cruiseId: "c3", island: "Faial/Pico", year: 2011 },
	];
	// Sperm whale logged twice on c1 (one group split into two sightings).
	const encounters: EncounterInput[] = [
		{ speciesId: "sw", cruiseId: "c1", company: "A" },
		{ speciesId: "sw", cruiseId: "c1", company: "A" },
		{ speciesId: "sw", cruiseId: "c3", company: "B" },
	];
	const [sw] = computeSpeciesCertainty(cruises, encounters, () => "x");
	const sm = sw.byIsland.find((i) => i.island === "São Miguel")!;

	assert.equal(sw.encounters, 3);
	assert.equal(sw.cruisesWithSpecies, 2);
	assert.equal(sm.cruises, 2);
	assert.equal(sm.cruisesWithSpecies, 1);
	assert.equal(sm.share, 0.5);
	assert.equal(sm.yearsActive, 2);
	assert.equal(sm.yearsDetected, 1);
	assert.equal(sm.companies, 1);
	assert.equal(sm.topCompanyShare, 1);
});
