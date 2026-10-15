// Builds public/data/monicet-map-data.json from the raw Darwin Core Archive.
//
//   pnpm data:build                 # data/raw → public/data/monicet-map-data.json
//   pnpm data:check                 # rebuild in memory, diff against committed JSON
//   node scripts/build-data.ts <event.txt> <occurrence.txt> [out.json]
//
// Every derived number in the app is computed here. What each field means
// and its known weaknesses: docs/data-dictionary.md and ISSUES.md.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import type {
	IslandGroup,
	MonicetCruiseCell,
	MonicetGridCell,
	MonicetMapData,
	MonicetMonthlySummary,
	MonicetSpeciesLookupEntry,
	MonicetTopSpeciesEntry,
} from "../src/types/monicet.ts";
import {
	cellsReached,
	parseWktPoints,
	type LonLat,
} from "./lib/cruise-reach.ts";
import {
	computeSpeciesCertainty,
	islandGroupOf,
	type CruiseInput,
	type EncounterInput,
} from "./lib/certainty.ts";
import { MAP_DATA_PATH, readTable, tablePath, type Row } from "./lib/dwca.ts";

const BIN_SIZE_DEGREES = 0.2;
const RELIABLE_MIN_ENCOUNTERS = 24;
const RELIABLE_MIN_YEARS = 3;

const MONTH_LABELS = [
	"Jan",
	"Feb",
	"Mar",
	"Apr",
	"May",
	"Jun",
	"Jul",
	"Aug",
	"Sep",
	"Oct",
	"Nov",
	"Dec",
];

// The archive has no vernacular names; these cover the species seen.
// Anything missing falls back to the scientific name.
const COMMON_NAME_BY_SCIENTIFIC: Record<string, string> = {
	"Balaenoptera borealis": "Sei whale",
	"Balaenoptera physalus": "Fin whale",
	"Balaenoptera musculus": "Blue whale",
	"Caretta caretta": "Loggerhead sea turtle",
	"Delphinus delphis": "Common dolphin",
	"Globicephala macrorhynchus": "Short-finned pilot whale",
	"Grampus griseus": "Risso's dolphin",
	"Megaptera novaeangliae": "Humpback whale",
	"Mesoplodon mirus": "True's beaked whale",
	"Physeter macrocephalus": "Sperm whale",
	"Stenella coeruleoalba": "Striped dolphin",
	"Stenella frontalis": "Atlantic spotted dolphin",
	"Tursiops truncatus": "Common bottlenose dolphin",
	"Ziphius cavirostris": "Cuvier's beaked whale",
};

interface SampleEvent {
	eventID: string;
	parentEventID: string;
	lat: number;
	lon: number;
	date: Date;
	year: number;
	month: number;
}

interface CellGeometry {
	id: string;
	row: number;
	col: number;
	lat0: number;
	lon0: number;
	centerLat: number;
	centerLon: number;
	polygon: [number, number][];
}

interface CellAccumulator extends CellGeometry {
	encounterCount: number;
	yearlyEncounters: Record<string, number>;
	monthlyEncounters: number[];
	speciesCounts: Record<string, number>;
}

interface SpeciesAccumulator {
	scientificNameID: string;
	scientificName: string;
	commonName: string;
	totalEncounters: number;
	yearlyEncounters: Record<string, number>;
	monthlyEncounters: number[];
	cellCounts: Record<string, number>;
}

// eventDate is "start" or "start/end"; only the start is used.
//
// Values are Azores wall-clock times with no offset ("2009-01-06T10:55"),
// plus two date-only rows. `new Date()` would read the date-times in the
// build machine's timezone and the date-only ones as UTC. Appending "Z"
// reads every value as UTC, so getUTC* returns exactly the logged year,
// month and hour on any machine (ISSUES.md D-7, fixed).
export function parseEventDate(rawValue: string): Date | null {
	if (!rawValue) return null;
	const start = rawValue.split("/")[0].trim();
	const hasOffset = /T.*(Z|[+-]\d{2}:?\d{2})$/.test(start);
	const iso = start.includes("T") && !hasOffset ? `${start}Z` : start;
	const date = new Date(iso);
	return Number.isNaN(date.getTime()) ? null : date;
}

// "Genus species" binomials only; family-level records such as
// "Delphinidae" are excluded.
function isSpeciesRank(scientificName: string) {
	if (!scientificName) return false;
	const parts = scientificName.trim().split(/\s+/);
	if (parts.length < 2) return false;
	return /^[A-Z][a-z-]+$/.test(parts[0]) && /^[a-z-]+$/.test(parts[1]);
}

function getCommonName(scientificName: string) {
	return COMMON_NAME_BY_SCIENTIFIC[scientificName] ?? scientificName;
}

function getCellGeometry(
	lat: number,
	lon: number,
	minLatGrid: number,
	minLonGrid: number,
	binSize: number
): CellGeometry {
	const row = Math.floor((lat - minLatGrid) / binSize);
	const col = Math.floor((lon - minLonGrid) / binSize);
	const lat0 = minLatGrid + row * binSize;
	const lon0 = minLonGrid + col * binSize;
	const lat1 = lat0 + binSize;
	const lon1 = lon0 + binSize;

	return {
		id: `${row}:${col}`,
		row,
		col,
		lat0,
		lon0,
		centerLat: lat0 + binSize / 2,
		centerLon: lon0 + binSize / 2,
		polygon: [
			[lon0, lat0],
			[lon1, lat0],
			[lon1, lat1],
			[lon0, lat1],
			[lon0, lat0],
		],
	};
}

/** Ordinary least-squares slope of ys over xs. */
function linearSlope(xs: number[], ys: number[]) {
	if (!xs.length || xs.length !== ys.length) return 0;
	const n = xs.length;
	const sumX = xs.reduce((acc, v) => acc + v, 0);
	const sumY = ys.reduce((acc, v) => acc + v, 0);
	const sumXY = xs.reduce((acc, v, idx) => acc + v * ys[idx], 0);
	const sumXX = xs.reduce((acc, v) => acc + v * v, 0);
	const denominator = n * sumXX - sumX * sumX;
	if (denominator === 0) return 0;
	return (n * sumXY - sumX * sumY) / denominator;
}

function getSortedSpeciesEntries(speciesCountMap: Map<string, number>) {
	return [...speciesCountMap.entries()].sort((a, b) => b[1] - a[1]);
}

function toRate(encounters: number, cruises: number) {
	return cruises ? encounters / cruises : null;
}

function sumByYears(record: Record<string, number>, years: number[]) {
	let total = 0;
	for (const year of years) total += record[year] ?? 0;
	return total;
}

export function buildData(
	eventRows: Row[],
	occurrenceRows: Row[]
): MonicetMapData {
	// ── 1. Events: count cruises (effort proxy), index sightings ──────────
	const sampleEvents = new Map<string, SampleEvent>();
	const cruisesByYear = new Map<number, number>();
	const cruisesByMonth = new Map<string, number>();
	const cruiseInputs: CruiseInput[] = [];
	const cruisePositions = new Map<string, LonLat[]>();

	let minLat = Number.POSITIVE_INFINITY;
	let maxLat = Number.NEGATIVE_INFINITY;
	let minLon = Number.POSITIVE_INFINITY;
	let maxLon = Number.NEGATIVE_INFINITY;
	let earliestDate: Date | null = null;
	let latestDate: Date | null = null;

	for (const row of eventRows) {
		const eventDate = parseEventDate(row.eventDate);
		if (!eventDate) continue;
		const year = eventDate.getUTCFullYear();
		const month = eventDate.getUTCMonth() + 1;

		if (row.type === "cruise") {
			cruisesByYear.set(year, (cruisesByYear.get(year) ?? 0) + 1);
			const monthKey = `${year}-${String(month).padStart(2, "0")}`;
			cruisesByMonth.set(
				monthKey,
				(cruisesByMonth.get(monthKey) ?? 0) + 1
			);
			const harbour: LonLat = [
				Number.parseFloat(row.decimalLongitude),
				Number.parseFloat(row.decimalLatitude),
			];
			if (!Number.isFinite(harbour[0])) {
				throw new Error(
					`Cruise ${row.eventID} has no harbour longitude ("${row.decimalLongitude}"), so its island group is unknown`
				);
			}
			cruiseInputs.push({
				cruiseId: row.eventID,
				island: islandGroupOf(harbour[0]),
				year,
			});
			if (!cruisePositions.has(row.eventID)) {
				cruisePositions.set(row.eventID, []);
			}
			continue;
		}

		if (row.type !== "sample") continue;

		// Positions at sea come from the cruise's own sightings (POINT or
		// arrival → departure LINESTRING), not from the cruise footprint,
		// whose harbour points are unreliable (ISSUES.md D-19).
		const cruiseId = row.parentEventID;
		const positions = cruisePositions.get(cruiseId) ?? [];
		positions.push(...parseWktPoints(row.footprintWKT ?? ""));
		cruisePositions.set(cruiseId, positions);

		const lat = Number.parseFloat(row.decimalLatitude);
		const lon = Number.parseFloat(row.decimalLongitude);
		if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

		if (!earliestDate || eventDate < earliestDate) earliestDate = eventDate;
		if (!latestDate || eventDate > latestDate) latestDate = eventDate;

		minLat = Math.min(minLat, lat);
		maxLat = Math.max(maxLat, lat);
		minLon = Math.min(minLon, lon);
		maxLon = Math.max(maxLon, lon);

		sampleEvents.set(row.eventID, {
			eventID: row.eventID,
			parentEventID: row.parentEventID,
			lat,
			lon,
			date: eventDate,
			year,
			month,
		});
	}

	if (!sampleEvents.size) {
		throw new Error("No sample events found in event.txt");
	}

	const minLatGrid = Math.floor(minLat / BIN_SIZE_DEGREES) * BIN_SIZE_DEGREES;
	const minLonGrid = Math.floor(minLon / BIN_SIZE_DEGREES) * BIN_SIZE_DEGREES;

	// ── 2. Occurrences: one "encounter" per (sighting event, species) ─────
	const uniqueEncounterSpecies = new Set<string>();
	const cells = new Map<string, CellAccumulator>();
	const speciesStats = new Map<string, SpeciesAccumulator>();
	const monthlyStats = Array.from({ length: 12 }, () => ({
		encounters: 0,
		speciesCounts: new Map<string, number>(),
	}));

	const encounterInputs: EncounterInput[] = [];

	let excludedNonSpeciesRows = 0;
	let rowsWithoutEvent = 0;

	for (const row of occurrenceRows) {
		const event = sampleEvents.get(row.eventID);
		if (!event) {
			rowsWithoutEvent += 1;
			continue;
		}

		if (!isSpeciesRank(row.scientificName)) {
			excludedNonSpeciesRows += 1;
			continue;
		}

		// Life stages (adult/juvenile/calf) are separate occurrence rows of
		// the same species in the same event — collapse them.
		const dedupeKey = `${row.eventID}::${row.scientificNameID}`;
		if (uniqueEncounterSpecies.has(dedupeKey)) continue;
		uniqueEncounterSpecies.add(dedupeKey);
		encounterInputs.push({
			speciesId: row.scientificNameID,
			cruiseId: event.parentEventID,
			company: row.recordedBy,
		});

		const geometry = getCellGeometry(
			event.lat,
			event.lon,
			minLatGrid,
			minLonGrid,
			BIN_SIZE_DEGREES
		);

		let cell = cells.get(geometry.id);
		if (!cell) {
			cell = {
				...geometry,
				encounterCount: 0,
				yearlyEncounters: {},
				monthlyEncounters: Array.from({ length: 12 }, () => 0),
				speciesCounts: {},
			};
			cells.set(geometry.id, cell);
		}

		cell.encounterCount += 1;
		cell.yearlyEncounters[event.year] =
			(cell.yearlyEncounters[event.year] ?? 0) + 1;
		cell.monthlyEncounters[event.month - 1] += 1;
		cell.speciesCounts[row.scientificNameID] =
			(cell.speciesCounts[row.scientificNameID] ?? 0) + 1;

		let species = speciesStats.get(row.scientificNameID);
		if (!species) {
			species = {
				scientificNameID: row.scientificNameID,
				scientificName: row.scientificName,
				commonName: getCommonName(row.scientificName),
				totalEncounters: 0,
				yearlyEncounters: {},
				monthlyEncounters: Array.from({ length: 12 }, () => 0),
				cellCounts: {},
			};
			speciesStats.set(row.scientificNameID, species);
		}

		species.totalEncounters += 1;
		species.yearlyEncounters[event.year] =
			(species.yearlyEncounters[event.year] ?? 0) + 1;
		species.monthlyEncounters[event.month - 1] += 1;
		species.cellCounts[geometry.id] =
			(species.cellCounts[geometry.id] ?? 0) + 1;

		monthlyStats[event.month - 1].encounters += 1;
		const monthSpeciesCount = monthlyStats[event.month - 1].speciesCounts;
		monthSpeciesCount.set(
			row.scientificNameID,
			(monthSpeciesCount.get(row.scientificNameID) ?? 0) + 1
		);
	}

	// ── 3. Early vs. late split for the decline metric ────────────────────
	const years = [...cruisesByYear.keys()].sort((a, b) => a - b);
	const splitIndex = Math.floor(years.length / 2);
	const earlyYears = years.slice(0, splitIndex);
	const lateYears = years.slice(splitIndex);

	const monthlyCruiseTotals = Array.from({ length: 12 }, () => 0);
	for (const [yearMonth, count] of cruisesByMonth.entries()) {
		const month = Number.parseInt(yearMonth.split("-")[1], 10);
		monthlyCruiseTotals[month - 1] += count;
	}

	const speciesLookup: Record<string, MonicetSpeciesLookupEntry> = {};
	for (const value of speciesStats.values()) {
		speciesLookup[value.scientificNameID] = {
			scientificName: value.scientificName,
			commonName: value.commonName,
		};
	}

	const topSpeciesEntry = (
		speciesId: string,
		count: number
	): MonicetTopSpeciesEntry => ({
		speciesId,
		count,
		scientificName: speciesLookup[speciesId]?.scientificName ?? speciesId,
		commonName: speciesLookup[speciesId]?.commonName ?? speciesId,
	});

	const sumCruises = (ys: number[]) =>
		ys.reduce((acc, year) => acc + (cruisesByYear.get(year) ?? 0), 0);
	const earlyCruises = sumCruises(earlyYears);
	const lateCruises = sumCruises(lateYears);

	// ── 4. Per-cell metrics ───────────────────────────────────────────────
	const gridCells: MonicetGridCell[] = [...cells.values()].map((cell) => {
		const yearlyRates = years.map(
			(year) =>
				toRate(
					cell.yearlyEncounters[year] ?? 0,
					cruisesByYear.get(year) ?? 0
				) ?? 0
		);

		const earlyRate = toRate(
			sumByYears(cell.yearlyEncounters, earlyYears),
			earlyCruises
		);
		const lateRate = toRate(
			sumByYears(cell.yearlyEncounters, lateYears),
			lateCruises
		);
		const declinePct =
			earlyRate && earlyRate > 0 && lateRate !== null
				? ((lateRate - earlyRate) / earlyRate) * 100
				: null;

		const yearsWithEncounters = years.filter(
			(year) => (cell.yearlyEncounters[year] ?? 0) > 0
		).length;
		const confidenceScore =
			Math.min(1, cell.encounterCount / 80) *
			Math.min(1, yearsWithEncounters / 4);
		const isReliable =
			cell.encounterCount >= RELIABLE_MIN_ENCOUNTERS &&
			yearsWithEncounters >= RELIABLE_MIN_YEARS;

		const topSpecies = getSortedSpeciesEntries(
			new Map(Object.entries(cell.speciesCounts))
		)
			.slice(0, 3)
			.map(([speciesId, count]) => topSpeciesEntry(speciesId, count));

		return {
			id: cell.id,
			row: cell.row,
			col: cell.col,
			lat0: cell.lat0,
			lon0: cell.lon0,
			centerLat: cell.centerLat,
			centerLon: cell.centerLon,
			polygon: cell.polygon,
			encounterCount: cell.encounterCount,
			yearlyEncounters: cell.yearlyEncounters,
			monthlyEncounters: cell.monthlyEncounters,
			speciesCounts: cell.speciesCounts,
			earlyRate,
			lateRate,
			declinePct,
			trendSlope: linearSlope(years, yearlyRates),
			yearsWithEncounters,
			confidenceScore,
			isReliable,
			topSpecies,
		};
	});

	// ── 5. Species and month summaries ────────────────────────────────────
	const speciesSummaries = [...speciesStats.values()]
		.sort((a, b) => b.totalEncounters - a.totalEncounters)
		.map((species) => ({
			speciesId: species.scientificNameID,
			scientificName: species.scientificName,
			commonName: species.commonName,
			totalEncounters: species.totalEncounters,
			yearlyEncounters: species.yearlyEncounters,
			monthlyEncounters: species.monthlyEncounters,
			cellCounts: species.cellCounts,
		}));

	const monthlySummaries: MonicetMonthlySummary[] = monthlyStats.map(
		(monthData, monthIndex) => {
			const cruises = monthlyCruiseTotals[monthIndex];
			const encounters = monthData.encounters;
			const topSpecies = getSortedSpeciesEntries(monthData.speciesCounts)
				.slice(0, 5)
				.map(([speciesId, count]) => {
					const entry = topSpeciesEntry(speciesId, count);
					// key order kept identical to the original JSON output
					return {
						speciesId: entry.speciesId,
						count: entry.count,
						share: encounters ? count / encounters : 0,
						scientificName: entry.scientificName,
						commonName: entry.commonName,
					};
				});

			return {
				month: monthIndex + 1,
				label: MONTH_LABELS[monthIndex],
				encounters,
				cruises,
				rate: toRate(encounters, cruises),
				topSpecies,
			};
		}
	);

	const bestMonth = monthlySummaries.reduce<MonicetMonthlySummary | null>(
		(best, current) => {
			if (current.rate === null) return best;
			if (!best || current.rate > (best.rate ?? -Infinity))
				return current;
			return best;
		},
		null
	);

	return {
		meta: {
			source: "MONICET Darwin Core Archive",
			generatedAt: new Date().toISOString(),
			binSizeDegrees: BIN_SIZE_DEGREES,
			totalSampleEvents: sampleEvents.size,
			totalCruiseEvents: eventRows.filter((row) => row.type === "cruise")
				.length,
			totalOccurrenceRows: occurrenceRows.length,
			totalUniqueSpeciesEncounters: uniqueEncounterSpecies.size,
			excludedNonSpeciesRows,
			rowsWithoutMatchingEvent: rowsWithoutEvent,
			cruisesWithoutPositionsAtSea: [...cruisePositions.values()].filter(
				(positions) => positions.length === 0
			).length,
			years,
			dateRange: {
				start: earliestDate ? earliestDate.toISOString() : null,
				end: latestDate ? latestDate.toISOString() : null,
			},
			bestMonthOverall: bestMonth
				? {
						month: bestMonth.month,
						label: bestMonth.label,
						rate: bestMonth.rate,
					}
				: null,
			thresholds: {
				reliableCellMinEncounters: RELIABLE_MIN_ENCOUNTERS,
				reliableCellMinYears: RELIABLE_MIN_YEARS,
			},
			caveats: [
				"Decline is computed as encounter-rate trend, not direct population decline.",
				"Rates are normalized by total cruises per year/month from MONICET event records.",
				"Only species-rank records are included for map insights.",
			],
		},
		bounds: { minLat, maxLat, minLon, maxLon, minLatGrid, minLonGrid },
		speciesLookup,
		monthlySummaries,
		speciesSummaries,
		gridCells,
		cruiseCells: buildCruiseCells(
			cruiseInputs,
			cruisePositions,
			minLatGrid,
			minLonGrid
		),
		speciesCertainty: computeSpeciesCertainty(
			cruiseInputs,
			encounterInputs,
			(id) => speciesLookup[id]?.scientificName ?? id
		),
	};
}

// ── Where do boats go? ───────────────────────────────────────────────────
// Distinct cruises per grid cell, from positions logged at sea. Same grid
// origin as gridCells so the two layers line up.
function buildCruiseCells(
	cruises: CruiseInput[],
	positionsByCruise: Map<string, LonLat[]>,
	minLatGrid: number,
	minLonGrid: number
): MonicetCruiseCell[] {
	const geometryOf = (lon: number, lat: number) =>
		getCellGeometry(lat, lon, minLatGrid, minLonGrid, BIN_SIZE_DEGREES);
	const cells = new Map<string, MonicetCruiseCell>();

	for (const cruise of cruises) {
		const positions = positionsByCruise.get(cruise.cruiseId) ?? [];
		const reached = cellsReached(
			positions,
			(lon, lat) => geometryOf(lon, lat).id
		);
		for (const id of reached) {
			let cell = cells.get(id);
			if (!cell) {
				const [row, col] = id.split(":").map(Number);
				const g = getCellGeometry(
					minLatGrid + (row + 0.5) * BIN_SIZE_DEGREES,
					minLonGrid + (col + 0.5) * BIN_SIZE_DEGREES,
					minLatGrid,
					minLonGrid,
					BIN_SIZE_DEGREES
				);
				cell = {
					id: g.id,
					row: g.row,
					col: g.col,
					centerLat: g.centerLat,
					centerLon: g.centerLon,
					polygon: g.polygon,
					cruises: 0,
					share: 0,
					cruisesByIsland: {
						"São Miguel": 0,
						Terceira: 0,
						"Faial/Pico": 0,
					} satisfies Record<IslandGroup, number>,
				};
				cells.set(id, cell);
			}
			cell.cruises += 1;
			cell.cruisesByIsland[cruise.island] += 1;
		}
	}

	return [...cells.values()]
		.map((cell) => ({
			...cell,
			share: Number((cell.cruises / cruises.length).toFixed(4)),
		}))
		.sort((a, b) => a.row - b.row || a.col - b.col);
}

/** Compare two builds, ignoring the generatedAt timestamp. */
function sameData(a: MonicetMapData, b: MonicetMapData) {
	const strip = (d: MonicetMapData) =>
		JSON.stringify({ ...d, meta: { ...d.meta, generatedAt: "" } });
	return strip(a) === strip(b);
}

function main() {
	const args = process.argv.slice(2);
	const check = args.includes("--check");
	const [eventPath, occurrencePath, outputPath] = args.filter(
		(a) => !a.startsWith("--")
	);

	const output = buildData(
		readTable("event", eventPath ?? tablePath("event")),
		readTable("occurrence", occurrencePath ?? tablePath("occurrence"))
	);
	const target = outputPath ?? MAP_DATA_PATH;

	if (check) {
		const committed = JSON.parse(
			readFileSync(target, "utf8")
		) as MonicetMapData;
		if (!sameData(output, committed)) {
			console.error(
				`✗ ${path.relative(process.cwd(), target)} is out of date with the raw data or the build logic changed.\n` +
					"  Run `pnpm data:build` if the change is intended."
			);
			process.exit(1);
		}
		console.log(`✓ ${path.relative(process.cwd(), target)} is up to date`);
		return;
	}

	mkdirSync(path.dirname(target), { recursive: true });
	writeFileSync(target, JSON.stringify(output, null, 2), "utf8");

	console.log(`Wrote ${output.gridCells.length} grid cells to ${target}`);
	console.log(
		`Unique species encounters: ${output.meta.totalUniqueSpeciesEncounters} across ${output.meta.years.length} years`
	);
}

if (import.meta.main) main();
