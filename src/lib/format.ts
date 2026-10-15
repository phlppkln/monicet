// Display formatting shared by the three directions.

import type { MonicetGridCell } from "../types/monicet.ts";

/** "37.70N, 25.70W" — or with degree signs: "37.70°N, 25.70°W". */
export function formatCellLabel(
	cell: Pick<MonicetGridCell, "centerLat" | "centerLon">,
	{ degrees = false, separator = ", " } = {}
) {
	const deg = degrees ? "°" : "";
	const lat = `${cell.centerLat.toFixed(2)}${deg}N`;
	const lon = `${Math.abs(cell.centerLon).toFixed(2)}${deg}W`;
	return `${lat}${separator}${lon}`;
}

export function formatRate(value: number | null) {
	if (value === null || Number.isNaN(value)) return "n/a";
	return `${value.toFixed(2)} encounters/cruise`;
}

export function formatSignedPercent(value: number | null) {
	if (value === null || Number.isNaN(value)) return "n/a";
	return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

/** 0.123 → "12.3%" */
export function toPercent(value = 0) {
	return `${(value * 100).toFixed(1)}%`;
}

export const MONTH_LABELS = [
	"Jan",
	"Feb",
	"Mar",
	"Apr",
	"May",
	"Jun",
	"Jul",
	"Aug",
	"Sep",
	"Oct",
	"Nov",
	"Dec",
];

export const MONTH_NAMES = [
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December",
];
