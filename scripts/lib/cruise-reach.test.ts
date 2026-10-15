import assert from "node:assert/strict";
import { test } from "node:test";

import { cellsReached, parseWktPoints } from "./cruise-reach.ts";

test("parseWktPoints reads MULTIPOINT, POINT and LINESTRING", () => {
	assert.deepEqual(parseWktPoints("MULTIPOINT (-25.6 37.7,-25.7 37.6)"), [
		[-25.6, 37.7],
		[-25.7, 37.6],
	]);
	assert.deepEqual(parseWktPoints("POINT (-25.7 37.6)"), [[-25.7, 37.6]]);
	assert.deepEqual(parseWktPoints("LINESTRING (1 2,3 4)"), [
		[1, 2],
		[3, 4],
	]);
	assert.deepEqual(parseWktPoints(""), []);
	assert.deepEqual(parseWktPoints("POLYGON ((0 0,1 0,0 1,0 0))"), []);
});

test("cellsReached counts a cell once per cruise", () => {
	const cellIdOf = (lon: number, lat: number) =>
		`${Math.floor(lat)}:${Math.floor(lon)}`;
	const cells = cellsReached(
		[
			[0.1, 0.1],
			[0.2, 0.3],
			[1.5, 0.1],
		],
		cellIdOf
	);
	assert.deepEqual([...cells].sort(), ["0:0", "0:1"]);
});
