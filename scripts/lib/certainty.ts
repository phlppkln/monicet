// "How certain are the humans?" — per-species measures of how much the
// MONICET records can be trusted, split by island group.
//
// The question comes from The Animal view. None of these numbers is about
// how many animals there are; they describe the *observers*: how often they
// went out, how consistently they reported a species, how many independent
// crews did, and whether the species is hard to identify at sea.
// Field meanings: docs/data-dictionary.md (speciesCertainty).

import type {
	IslandCertainty,
	IslandGroup,
	SpeciesCertainty,
} from "../../src/types/monicet.ts";

export const ISLAND_GROUPS: readonly IslandGroup[] = [
	"São Miguel",
	"Terceira",
	"Faial/Pico",
];

/**
 * Island group of a cruise, from its home-harbour longitude. Same rule as
 * scripts/profile-data.ts. Faial and Pico harbours are too close to split.
 */
export function islandGroupOf(lon: number): IslandGroup {
	if (lon > -26.5) return "São Miguel";
	if (lon > -27.6) return "Terceira";
	return "Faial/Pico";
}

/**
 * 95% Wilson score interval for a proportion k/n.
 *
 * Why Wilson and not the textbook p ± 1.96·√(p(1−p)/n): that one collapses
 * to [0, 0] when k = 0 and goes below 0 for small k, exactly the rare-species
 * cases that matter here. Wilson stays inside [0, 1] and is honest about
 * small n. Alternatives: Clopper–Pearson (exact, more conservative),
 * Jeffreys (Bayesian, similar to Wilson).
 */
export function wilsonInterval(k: number, n: number, z = 1.96) {
	if (n === 0) return { low: 0, high: 1 };
	const p = k / n;
	const z2 = z * z;
	const denom = 1 + z2 / n;
	const centre = (p + z2 / (2 * n)) / denom;
	const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom;
	return {
		low: Math.max(0, centre - half),
		high: Math.min(1, centre + half),
	};
}

// The data paper (González García et al. 2023) names these as hard to tell
// apart at sea. Keyed by scientific name.
export const ID_CAUTION: Record<string, string> = {
	"Mesoplodon bidens":
		"Mesoplodon beaked whales are hard to tell apart at sea",
	"Mesoplodon densirostris":
		"Mesoplodon beaked whales are hard to tell apart at sea",
	"Mesoplodon mirus":
		"Mesoplodon beaked whales are hard to tell apart at sea",
	"Balaenoptera edeni": "Easily confused with sei whale",
	"Balaenoptera borealis": "Easily confused with Bryde's whale",
	"Globicephala macrorhynchus":
		"Short- and long-finned pilot whales are hard to tell apart",
	"Globicephala melas":
		"Short- and long-finned pilot whales are hard to tell apart",
};

// ─── Inputs ─────────────────────────────────────────────────────────────────

export interface CruiseInput {
	cruiseId: string;
	island: IslandGroup;
	year: number;
}

/** One encounter = one (sighting event, species) pair, as in build-data. */
export interface EncounterInput {
	speciesId: string;
	cruiseId: string;
	company: string;
}

// ─── Computation ────────────────────────────────────────────────────────────

const round = (v: number, digits = 4) => Number(v.toFixed(digits));

export function computeSpeciesCertainty(
	cruises: CruiseInput[],
	encounters: EncounterInput[],
	scientificNameOf: (speciesId: string) => string
): SpeciesCertainty[] {
	const cruiseById = new Map(cruises.map((c) => [c.cruiseId, c]));

	// Effort per island: cruises, active years, companies seen there.
	const effort = new Map(
		ISLAND_GROUPS.map((island) => [
			island,
			{
				cruises: 0,
				years: new Set<number>(),
				companies: new Set<string>(),
			},
		])
	);
	for (const cruise of cruises) {
		const e = effort.get(cruise.island)!;
		e.cruises += 1;
		e.years.add(cruise.year);
	}
	for (const enc of encounters) {
		const cruise = cruiseById.get(enc.cruiseId);
		if (cruise) effort.get(cruise.island)!.companies.add(enc.company);
	}

	// Per species × island: which cruises, which years, which companies.
	interface Acc {
		encounters: number;
		cruises: Set<string>;
		years: Set<number>;
		companyCounts: Map<string, number>;
	}
	const newAcc = (): Acc => ({
		encounters: 0,
		cruises: new Set(),
		years: new Set(),
		companyCounts: new Map(),
	});
	const bySpecies = new Map<string, Map<IslandGroup, Acc>>();

	for (const enc of encounters) {
		const cruise = cruiseById.get(enc.cruiseId);
		if (!cruise) continue;
		let islands = bySpecies.get(enc.speciesId);
		if (!islands) {
			islands = new Map(ISLAND_GROUPS.map((i) => [i, newAcc()]));
			bySpecies.set(enc.speciesId, islands);
		}
		const acc = islands.get(cruise.island)!;
		acc.encounters += 1;
		acc.cruises.add(cruise.cruiseId);
		acc.years.add(cruise.year);
		acc.companyCounts.set(
			enc.company,
			(acc.companyCounts.get(enc.company) ?? 0) + 1
		);
	}

	const totalCruises = cruises.length;

	return [...bySpecies.entries()]
		.map(([speciesId, islands]) => {
			const byIsland = ISLAND_GROUPS.map((island): IslandCertainty => {
				const acc = islands.get(island)!;
				const e = effort.get(island)!;
				const k = acc.cruises.size;
				const ci = wilsonInterval(k, e.cruises);
				const topCount = Math.max(0, ...acc.companyCounts.values());
				return {
					island,
					cruises: e.cruises,
					cruisesWithSpecies: k,
					share: round(e.cruises ? k / e.cruises : 0),
					shareLow: round(ci.low),
					shareHigh: round(ci.high),
					yearsActive: e.years.size,
					yearsDetected: acc.years.size,
					companies: acc.companyCounts.size,
					companiesActive: e.companies.size,
					topCompanyShare: acc.encounters
						? round(topCount / acc.encounters)
						: null,
				};
			});

			const allAcc = [...islands.values()];
			const k = allAcc.reduce((n, a) => n + a.cruises.size, 0);
			const ci = wilsonInterval(k, totalCruises);
			return {
				speciesId,
				encounters: allAcc.reduce((n, a) => n + a.encounters, 0),
				cruisesWithSpecies: k,
				share: round(k / totalCruises),
				shareLow: round(ci.low),
				shareHigh: round(ci.high),
				idCaution: ID_CAUTION[scientificNameOf(speciesId)] ?? null,
				byIsland,
			};
		})
		.sort((a, b) => b.encounters - a.encounters);
}
