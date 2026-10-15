import assert from "node:assert/strict";
import { test } from "node:test";

import { parseEventDate } from "./build-data.ts";

test("parseEventDate keeps the logged wall-clock time in any timezone", () => {
	// Late on the last day of a month: local-time parsing would move it
	// into the next month on machines east of UTC.
	const date = parseEventDate("2009-01-31T23:30/2009-02-01T01:00");
	assert.equal(date?.getUTCFullYear(), 2009);
	assert.equal(date?.getUTCMonth(), 0);
	assert.equal(date?.getUTCHours(), 23);
});

test("parseEventDate reads date-only values the same way", () => {
	assert.equal(
		parseEventDate("2010-07-04")?.toISOString(),
		"2010-07-04T00:00:00.000Z"
	);
	assert.equal(parseEventDate(""), null);
	assert.equal(parseEventDate("not a date"), null);
});
