import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { assertTable, parseTsv } from "./dwca.ts";

const dir = mkdtempSync(path.join(tmpdir(), "dwca-"));

test("parseTsv maps rows to header keys and pads missing values", () => {
	const file = path.join(dir, "t.tsv");
	writeFileSync(file, "a\tb\tc\n1\t2\t3\n4\t5\n\n");
	assert.deepEqual(parseTsv(file), [
		{ a: "1", b: "2", c: "3" },
		{ a: "4", b: "5", c: "" },
	]);
});

test("assertTable rejects a file whose header belongs to another table", () => {
	const file = path.join(dir, "event.txt");
	writeFileSync(file, "<eml:eml>\n");
	assert.throws(() => assertTable("event", file), /does not look like/);
});
