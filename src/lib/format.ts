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

/**
 * Whole percents with a sign: "+12,809%", "-47%". A decimal would claim a
 * precision these early/late rate changes don't have (ISSUES.md D-2).
 */
export function formatSignedPercent(value: number | null) {
	if (value === null || Number.isNaN(value)) return "n/a";
	const rounded = Math.round(value);
	return `${rounded >= 0 ? "+" : ""}${rounded.toLocaleString("en-US")}%`;
}

/**
 * Symmetric log2 ratio formatted with both log2 and fold-change multiplier,
 * e.g. "+1.00 (2.0×)" or "−0.58 (0.7×)".
 */
export function formatLog2Ratio(value: number | null) {
	if (value === null || Number.isNaN(value)) return "no baseline";
	const sign = value > 0.005 ? "+" : value < -0.005 ? "−" : "";
	const abs = Math.abs(value).toFixed(2);
	const factor = Math.pow(2, value);
	const factorLabel =
		factor >= 10 ? `${Math.round(factor)}×` : `${factor.toFixed(1)}×`;
	return `${sign}${abs} (${factorLabel})`;
}

/**
 * 0.123 → "12%". Shares come from small monthly or per-cell samples, so a
 * decimal is noise. Shares that would round to 0% show as "<1%", so a cell
 * a few cruises reached doesn't read as "none".
 */
export function toPercent(value = 0) {
	if (value > 0 && value < 0.005) return "<1%";
	return `${Math.round(value * 100)}%`;
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
