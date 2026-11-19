// Behaviour and life stage per encounter, from extendedmeasurementorfact.txt.
//
// Each measurement row hangs off one occurrence row. An "encounter" is a
// (sighting event, species) pair, and one encounter can have several
// occurrence rows: one per life stage (adult / juvenile / calf). So:
//
//   - behaviour is recorded once per species group; in this archive every
//     encounter has at most one behaviour value (checked below: a second,
//     different value throws instead of being silently overwritten);
//   - life stages are collected over all occurrence rows of the encounter,
//     so "had a calf" means "at least one occurrence row says calf".
//
// What the values mean and their limits: docs/dataset.md ("Behaviour",
// "Group size"). Behaviour is the state when the boat arrived.

import type { Behaviour } from "../../src/types/monicet.ts";
import type { Row } from "./dwca.ts";

export const BEHAVIOURS: readonly Behaviour[] = [
	"foraging",
	"socialising",
	"travelling",
	"resting",
];

const LIFE_STAGES = ["adult", "juvenile", "calf"] as const;
type LifeStage = (typeof LIFE_STAGES)[number];

export interface EncounterMeasurements {
	behaviour: Behaviour | null;
	lifeStages: Set<LifeStage>;
}

/** Same key the build uses to collapse occurrence rows into encounters. */
export function encounterKey(eventID: string, scientificNameID: string) {
	return `${eventID}::${scientificNameID}`;
}

function isBehaviour(value: string): value is Behaviour {
	return (BEHAVIOURS as readonly string[]).includes(value);
}

function isLifeStage(value: string): value is LifeStage {
	return (LIFE_STAGES as readonly string[]).includes(value);
}

/**
 * Encounter key → behaviour and life stages. Measurements of other types
 * (count, Beaufort, visibility, …) are ignored. Unknown behaviour or life
 * stage values throw: a new vocabulary in a later archive version should
 * fail the build, not vanish from the charts.
 */
export function indexEncounterMeasurements(
	emofRows: Row[],
	occurrenceRows: Row[]
): Map<string, EncounterMeasurements> {
	const occurrenceById = new Map(
		occurrenceRows.map((row) => [row.occurrenceID, row])
	);
	const byEncounter = new Map<string, EncounterMeasurements>();

	for (const m of emofRows) {
		const isBehaviourRow = m.measurementType === "behavior";
		const isLifeStageRow = m.measurementType === "life stage";
		if (!isBehaviourRow && !isLifeStageRow) continue;

		const occurrence = occurrenceById.get(m.occurrenceID);
		if (!occurrence) continue;
		const key = encounterKey(
			occurrence.eventID,
			occurrence.scientificNameID
		);
		let entry = byEncounter.get(key);
		if (!entry) {
			entry = { behaviour: null, lifeStages: new Set() };
			byEncounter.set(key, entry);
		}

		const value = m.measurementValue;
		if (isBehaviourRow) {
			if (!isBehaviour(value)) {
				throw new Error(`Unknown behaviour value "${value}"`);
			}
			if (entry.behaviour && entry.behaviour !== value) {
				throw new Error(
					`Encounter ${key} has two behaviours: ${entry.behaviour}, ${value}`
				);
			}
			entry.behaviour = value;
		} else {
			if (!isLifeStage(value)) {
				throw new Error(`Unknown life stage value "${value}"`);
			}
			entry.lifeStages.add(value);
		}
	}
	return byEncounter;
}
