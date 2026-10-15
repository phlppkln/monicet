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
}

export type MonicetInsightMode = "decline" | "species" | "seasonality";

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
