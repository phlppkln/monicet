// Downloads the MONICET Darwin Core Archive v1.8.2 and unpacks it into
// data/raw/. Raw files are gitignored; this script is how you get them.
//
//   pnpm data:fetch              # download + extract into data/raw/
//   pnpm data:fetch --dir <dir>  # extract somewhere else
//
// Uses only Node built-ins (fetch + zlib) — no unzip binary needed.

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { inflateRawSync } from "node:zlib";

import { assertTable, RAW_DIR, TABLES, type TableName } from "./lib/dwca.ts";

// Versioned download linked from the data paper (BDJ 11: e106991).
// Landing page: https://doi.org/10.14284/599
const ARCHIVE_URL =
	"https://mda.vliz.be/download.php?file=VLIZ_00000772_642fe989615ef444113174";
const ARCHIVE_NAME = "dwca-monicet-v1.8.2.zip";

/** Minimal ZIP reader: walks the central directory, supports stored + deflate. */
function unzip(buffer: Buffer): Map<string, Buffer> {
	const EOCD_SIG = 0x06054b50;
	let eocd = -1;
	for (let i = buffer.length - 22; i >= 0; i -= 1) {
		if (buffer.readUInt32LE(i) === EOCD_SIG) {
			eocd = i;
			break;
		}
	}
	if (eocd < 0)
		throw new Error("Not a zip file (no end-of-central-directory)");

	const entryCount = buffer.readUInt16LE(eocd + 10);
	let offset = buffer.readUInt32LE(eocd + 16);
	const files = new Map<string, Buffer>();

	for (let i = 0; i < entryCount; i += 1) {
		const method = buffer.readUInt16LE(offset + 10);
		const compressedSize = buffer.readUInt32LE(offset + 20);
		const nameLength = buffer.readUInt16LE(offset + 28);
		const extraLength = buffer.readUInt16LE(offset + 30);
		const commentLength = buffer.readUInt16LE(offset + 32);
		const localOffset = buffer.readUInt32LE(offset + 42);
		const name = buffer.toString(
			"utf8",
			offset + 46,
			offset + 46 + nameLength
		);

		const localNameLength = buffer.readUInt16LE(localOffset + 26);
		const localExtraLength = buffer.readUInt16LE(localOffset + 28);
		const dataStart = localOffset + 30 + localNameLength + localExtraLength;
		const data = buffer.subarray(dataStart, dataStart + compressedSize);

		if (!name.endsWith("/")) {
			if (method === 0) files.set(name, Buffer.from(data));
			else if (method === 8) files.set(name, inflateRawSync(data));
			else
				throw new Error(
					`${name}: unsupported compression method ${method}`
				);
		}
		offset += 46 + nameLength + extraLength + commentLength;
	}
	return files;
}

async function main() {
	const dirFlag = process.argv.indexOf("--dir");
	const outDir =
		dirFlag > -1 ? path.resolve(process.argv[dirFlag + 1]) : RAW_DIR;

	console.log(`Downloading ${ARCHIVE_URL}`);
	const res = await fetch(ARCHIVE_URL);
	if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
	const zip = Buffer.from(await res.arrayBuffer());

	mkdirSync(outDir, { recursive: true });
	writeFileSync(path.join(outDir, ARCHIVE_NAME), zip);

	for (const [name, content] of unzip(zip)) {
		const target = path.join(outDir, path.basename(name));
		writeFileSync(target, content);
		console.log(
			`  ${path.basename(name)} (${content.length.toLocaleString()} bytes)`
		);
	}

	for (const table of Object.keys(TABLES) as TableName[]) {
		assertTable(table, path.join(outDir, TABLES[table].file));
	}
	console.log(`✓ Archive extracted and validated in ${outDir}`);
}

main().catch((err: unknown) => {
	console.error(err instanceof Error ? err.message : err);
	process.exit(1);
});
