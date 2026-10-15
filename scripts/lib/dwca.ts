// Reading the MONICET Darwin Core Archive (DwC-A) from data/raw/.
// See docs/dataset.md for what each table and column means.

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const PROJECT_ROOT = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"../.."
);
export const RAW_DIR = path.join(PROJECT_ROOT, "data/raw");
export const MAP_DATA_PATH = path.join(
	PROJECT_ROOT,
	"public/data/monicet-map-data.json"
);

export type Row = Record<string, string>;

// Leading columns we rely on per table. Checked on read so a renamed or
// swapped file fails loudly instead of producing a silently wrong build.
export const TABLES = {
	event: {
		file: "event.txt",
		columns: ["id", "type", "institutionCode", "datasetName", "eventID"],
	},
	occurrence: {
		file: "occurrence.txt",
		columns: ["id", "collectionCode", "basisOfRecord", "occurrenceID"],
	},
	emof: {
		file: "extendedmeasurementorfact.txt",
		columns: ["id", "measurementID", "occurrenceID", "measurementType"],
	},
} as const;

export type TableName = keyof typeof TABLES;

/** Tab-separated file → array of row objects keyed by header. */
export function parseTsv(filePath: string): Row[] {
	const raw = readFileSync(filePath, "utf8").trimEnd();
	const lines = raw.split(/\r?\n/);
	const headers = lines[0].split("\t");

	const rows: Row[] = [];
	for (let i = 1; i < lines.length; i += 1) {
		if (!lines[i]) continue;
		const values = lines[i].split("\t");
		const row: Row = {};
		for (let j = 0; j < headers.length; j += 1) {
			row[headers[j]] = values[j] ?? "";
		}
		rows.push(row);
	}
	return rows;
}

export function tablePath(name: TableName, dir = RAW_DIR) {
	return path.join(dir, TABLES[name].file);
}

/** Throws with a helpful message if the file is missing or not the table it claims to be. */
export function assertTable(name: TableName, filePath: string) {
	if (!existsSync(filePath)) {
		throw new Error(
			`Missing ${filePath}. Run \`pnpm data:fetch\` (see data/README.md).`
		);
	}
	const header = readFileSync(filePath, "utf8").split(/\r?\n/, 1)[0];
	const expected = TABLES[name].columns;
	const actual = header.split("\t").slice(0, expected.length);
	if (expected.some((col, i) => actual[i] !== col)) {
		throw new Error(
			`${filePath} does not look like the ${name} table.\n` +
				`  expected header to start with: ${expected.join(", ")}\n` +
				`  found: ${header.slice(0, 120)}\n` +
				`File names may be mixed up — re-run \`pnpm data:fetch\`.`
		);
	}
}

export function readTable(name: TableName, filePath = tablePath(name)) {
	assertTable(name, filePath);
	return parseTsv(filePath);
}
