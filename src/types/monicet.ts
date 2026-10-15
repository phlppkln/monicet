// Shape of public/data/monicet-map-data.json.
// Produced by scripts/build-data.ts, consumed by src/. Both sides import these
// types, so a schema change shows up as a type error on both ends.
// Field semantics (how each number is computed): docs/data-dictionary.md

export interface MonicetSpeciesLookupEntry {
	scientificName: string;
	commonName: string;
}

export interface MonicetTopSpeciesEntry {
	speciesId: string;
	count: number;
	share?: number;
	scientificName: string;
	commonName: string;
}

export interface MonicetGridCell {
	id: string;
	row: number;
	col: number;
	lat0: number;
	lon0: number;
	centerLat: number;
	centerLon: number;
	polygon: [number, number][];
	encounterCount: number;
	yearlyEncounters: Record<string, number>;
	monthlyEncounters: number[];
	speciesCounts: Record<string, number>;
	earlyRate: number | null;
	lateRate: number | null;
	declinePct: number | null;
	trendSlope: number;
	yearsWithEncounters: number;
	confidenceScore: number;
	isReliable: boolean;
	topSpecies: MonicetTopSpeciesEntry[];
}

export interface MonicetMonthlySummary {
	month: number;
	label: string;
	encounters: number;
	cruises: number;
	rate: number | null;
	topSpecies: MonicetTopSpeciesEntry[];
}

export interface MonicetSpeciesSummary {
	speciesId: string;
	scientificName: string;
	commonName: string;
	totalEncounters: number;
	yearlyEncounters: Record<string, number>;
	monthlyEncounters: number[];
	cellCounts: Record<string, number>;
}

export interface MonicetMapMeta {
	source: string;
	generatedAt: string;
	binSizeDegrees: number;
	totalSampleEvents: number;
	totalCruiseEvents: number;
	totalOccurrenceRows: number;
	totalUniqueSpeciesEncounters: number;
	excludedNonSpeciesRows: number;
	rowsWithoutMatchingEvent: number;
	years: number[];
	dateRange: {
		start: string | null;
		end: string | null;
	};
	bestMonthOverall: {
		month: number;
		label: string;
		rate: number | null;
	} | null;
	thresholds: {
		reliableCellMinEncounters: number;
		reliableCellMinYears: number;
	};
	caveats: string[];
	/** Cruises with no logged position away from the harbour (see cruiseCells). */
	cruisesWithoutPositionsAtSea: number;
}

export interface MonicetMapData {
	meta: MonicetMapMeta;
	bounds: {
		minLat: number;
		maxLat: number;
		minLon: number;
		maxLon: number;
		minLatGrid: number;
		minLonGrid: number;
	};
	speciesLookup: Record<string, MonicetSpeciesLookupEntry>;
	monthlySummaries: MonicetMonthlySummary[];
	speciesSummaries: MonicetSpeciesSummary[];
	gridCells: MonicetGridCell[];
	speciesCertainty: SpeciesCertainty[];
	cruiseCells: MonicetCruiseCell[];
}

/**
 * "Where do boats go?" One 0.2° cell (same grid as gridCells) that at least
 * one cruise logged a position in. Positions are only logged at sightings,
 * so this is where boats stopped for animals, not where they searched.
 * Built by scripts/lib/cruise-reach.ts.
 */
export interface MonicetCruiseCell {
	id: string;
	row: number;
	col: number;
	centerLat: number;
	centerLon: number;
	polygon: [number, number][];
	/** Distinct cruises with ≥ 1 position in this cell. */
	cruises: number;
	/** cruises / all cruises in the archive. */
	share: number;
	cruisesByIsland: Record<IslandGroup, number>;
}

export type MonicetInsightMode =
	"decline" | "species" | "seasonality" | "boats";

// Shape of public/data/azores.geojson — hand-made basemap: one "envelope"
// rectangle for the study region plus simplified "island" polygons.
export interface BasemapFeature {
	type: "Feature";
	properties: {
		name?: string;
		kind?: string;
	};
	geometry: {
		type: string;
		coordinates: number[][][];
	};
}

export interface BasemapFeatureCollection {
	type: "FeatureCollection";
	features: BasemapFeature[];
}

/**
 * public/data/azores-lines.geojson — coastlines for the wireframe basemap,
 * built by scripts/build-map-lines.ts.
 */
export interface MapLineFeature {
	type: "Feature";
	properties: { kind: "coast" };
	geometry: {
		type: "MultiLineString";
		coordinates: [number, number][][];
	};
}

export interface MapLineCollection {
	type: "FeatureCollection";
	features: MapLineFeature[];
}

// ─── Species certainty ("how certain are the humans?") ─────────────────────
// Built by scripts/lib/certainty.ts; see docs/data-dictionary.md.

export type IslandGroup = "São Miguel" | "Terceira" | "Faial/Pico";

export interface IslandCertainty {
	island: IslandGroup;
	/** Cruises from this island group: the effort behind every number below. */
	cruises: number;
	/** Cruises that saw the species at least once. */
	cruisesWithSpecies: number;
	/** cruisesWithSpecies / cruises, with its 95% Wilson interval. */
	share: number;
	shareLow: number;
	shareHigh: number;
	/** Years this island group had any cruise. */
	yearsActive: number;
	/** Of those, years in which the species was seen. */
	yearsDetected: number;
	/** Companies that recorded the species here, of all active here. */
	companies: number;
	companiesActive: number;
	/** Share of this species' encounters here logged by the top company. */
	topCompanyShare: number | null;
}

export interface SpeciesCertainty {
	speciesId: string;
	encounters: number;
	/** Across all islands; the denominator is every cruise in the archive. */
	cruisesWithSpecies: number;
	share: number;
	shareLow: number;
	shareHigh: number;
	idCaution: string | null;
	byIsland: IslandCertainty[];
}
