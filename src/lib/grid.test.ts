import assert from "node:assert/strict";
import { test } from "node:test";

import { gridLinePositions } from "./grid.ts";

test("gridLinePositions covers the range with lines on the build's cell edges", () => {
	// Origin -26 with 0.2° cells: edges at -26 + k × 0.2, also for k < 0.
	const lines = gridLinePositions(-26, 0.2, -26.3, -25.5);
	assert.equal(lines.length, 6);
	assert.equal(lines[0], -26 + -2 * 0.2);
	assert.equal(lines.at(-1), -26 + 3 * 0.2);
	assert.ok(lines[0] <= -26.3 && lines.at(-1)! >= -25.5);
});

test("gridLinePositions returns nothing for an empty range or bin size", () => {
	assert.deepEqual(gridLinePositions(0, 0.2, 1, 0), []);
	assert.deepEqual(gridLinePositions(0, 0, 0, 1), []);
});
