import assert from "node:assert/strict";
import { test } from "node:test";

import {
	encounterKey,
	indexEncounterMeasurements,
} from "./encounter-measurements.ts";

const occurrences = [
	{ occurrenceID: "o1", eventID: "e1", scientificNameID: "sp" },
	{ occurrenceID: "o2", eventID: "e1", scientificNameID: "sp" },
	{ occurrenceID: "o3", eventID: "e2", scientificNameID: "sp" },
];

test("collects life stages over all occurrence rows of an encounter", () => {
	const index = indexEncounterMeasurements(
		[
			{
				occurrenceID: "o1",
				measurementType: "life stage",
				measurementValue: "adult",
			},
			{
				occurrenceID: "o2",
				measurementType: "life stage",
				measurementValue: "calf",
			},
			{
				occurrenceID: "o1",
				measurementType: "behavior",
				measurementValue: "foraging",
			},
			{
				occurrenceID: "o1",
				measurementType: "Beaufort wind force",
				measurementValue: "2",
			},
		],
		occurrences
	);
	const e1 = index.get(encounterKey("e1", "sp"));
	assert.equal(e1?.behaviour, "foraging");
	assert.deepEqual([...(e1?.lifeStages ?? [])].sort(), ["adult", "calf"]);
	assert.equal(index.has(encounterKey("e2", "sp")), false);
});

test("throws on an unknown behaviour value", () => {
	assert.throws(() =>
		indexEncounterMeasurements(
			[
				{
					occurrenceID: "o3",
					measurementType: "behavior",
					measurementValue: "milling",
				},
			],
			occurrences
		)
	);
});

test("throws when one encounter has two different behaviours", () => {
	assert.throws(() =>
		indexEncounterMeasurements(
			[
				{
					occurrenceID: "o1",
					measurementType: "behavior",
					measurementValue: "resting",
				},
				{
					occurrenceID: "o2",
					measurementType: "behavior",
					measurementValue: "travelling",
				},
			],
			occurrences
		)
	);
});
