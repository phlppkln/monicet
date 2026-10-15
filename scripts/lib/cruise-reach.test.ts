import assert from "node:assert/strict";
import { test } from "node:test";

import {
	cellsReached,
	parseWktPoints,
	positionsAtSea,
} from "./cruise-reach.ts";

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

test("positionsAtSea drops departure and arrival, even a wrong arrival", () => {
	// Horta cruise whose arrival is logged as Ponta Delgada (ISSUES D-19).
	const footprint = parseWktPoints(
		"MULTIPOINT (-28.62583 38.52889,-28.4719 38.3945,-25.66444 37.73472)"
	);
	assert.deepEqual(positionsAtSea(footprint), [[-28.4719, 38.3945]]);
	assert.deepEqual(positionsAtSea(footprint.slice(0, 2)), []);
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
