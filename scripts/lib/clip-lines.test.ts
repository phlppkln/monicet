import assert from "node:assert/strict";
import { test } from "node:test";

import { clipLine, ringsOf, roundLine, type BBox } from "./clip-lines.ts";

const box: BBox = { west: 0, south: 0, east: 10, north: 10 };

test("clipLine keeps a line that is fully inside", () => {
	const line: [number, number][] = [
		[1, 1],
		[2, 2],
		[3, 1],
	];
	assert.deepEqual(clipLine(line, box), [line]);
});

test("clipLine splits a line that leaves and re-enters the box", () => {
	const pieces = clipLine(
		[
			[1, 1],
			[2, 2],
			[20, 2],
			[3, 3],
			[4, 4],
		],
		box
	);
	assert.deepEqual(pieces, [
		[
			[1, 1],
			[2, 2],
		],
		[
			[3, 3],
			[4, 4],
		],
	]);
});

test("clipLine drops single points left over at the edge", () => {
	assert.deepEqual(
		clipLine(
			[
				[20, 20],
				[5, 5],
				[30, 30],
			],
			box
		),
		[]
	);
});

test("roundLine rounds to the given decimals", () => {
	assert.deepEqual(roundLine([[1.23456, -2.98765]], 2), [[1.23, -2.99]]);
});

test("ringsOf flattens MultiPolygon rings", () => {
	const ring: [number, number][] = [
		[0, 0],
		[1, 0],
		[0, 1],
		[0, 0],
	];
	assert.equal(
		ringsOf({ type: "MultiPolygon", coordinates: [[ring], [ring, ring]] })
			.length,
		3
	);
});
