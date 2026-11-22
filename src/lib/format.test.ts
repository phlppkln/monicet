import assert from "node:assert/strict";
import { test } from "node:test";

import { formatSignedPercent, toPercent } from "./format.ts";

test("formatSignedPercent rounds to whole percents with a sign", () => {
	assert.equal(formatSignedPercent(12809.28), "+12,809%");
	assert.equal(formatSignedPercent(-47.36), "-47%");
	assert.equal(formatSignedPercent(0), "+0%");
	assert.equal(formatSignedPercent(null), "n/a");
});

test("toPercent rounds to whole percents and keeps tiny shares visible", () => {
	assert.equal(toPercent(0.123), "12%");
	assert.equal(toPercent(0.0002), "<1%");
	assert.equal(toPercent(0), "0%");
});
