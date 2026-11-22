// D3/SVG color constants.
//
// SVG fills set from TypeScript need raw hex — SCSS variables in
// src/styles/_tokens.scss aren't reachable from <script>. Keep these in sync
// with that file by hand; they mirror $text-primary, $text-secondary,
// $border, $background-darker, $primary and $secondary.
export const CHART_TEXT_PRIMARY = "#1a1a1a";
export const CHART_TEXT_SECONDARY = "#6b6b6b";
export const CHART_BORDER = "#e0e0e0";
export const CHART_SURFACE_MUTED = "#f0f0f0";
export const CHART_PRIMARY = "#0a6b64";
export const CHART_SECONDARY = "#c4443e";

// Diverging pair for polarity encodings (e.g. decline vs. growth).
// $secondary and $primary as-is fail CVD separation under protanopia
// (validated ΔE 5.5, below the 6 floor) and $primary reads as gray (chroma
// 0.081, below the 0.10 floor) — CHART_DIVERGING_POSITIVE re-steps the brand
// teal to a more saturated step so the pair clears every check:
// `validate_palette.js "#c4443e,#0f9c8e" --pairs all`
// -> CVD ΔE 10.9 (deutan), normal-vision ΔE 27.4, chroma/lightness/contrast all pass.
// Midpoint is neutral gray, never a hue, per the diverging color rule.
export const CHART_DIVERGING_NEGATIVE = CHART_SECONDARY;
export const CHART_DIVERGING_NEUTRAL = CHART_SURFACE_MUTED;
export const CHART_DIVERGING_POSITIVE = "#0f9c8e";

// Single-hue sequential ramp (magnitude encodings). Light tint -> brand teal,
// light->dark so it stays a one-hue ramp instead of a multi-hue D3 scheme
// (interpolateYlGnBu / interpolateYlOrRd etc. mix hues mid-ramp).
// The light end is the ordinal ramp's lightest step (validated >= 2:1 on
// white), not a near-white tint: the cells are drawn at partial opacity
// over a light-grey basemap, and the old #eaf5f3 came out at 1.09:1
// against it, so the lowest values vanished. #87b9b3 at the default 0.85
// layer opacity is 1.58:1. A light-to-dark ramp can't get its lowest step
// to 3:1 on a light map, so the tooltips carry every value as text.
export const CHART_SEQUENTIAL_TEAL: [string, string] = [
	"#87b9b3",
	CHART_PRIMARY,
];

// Cells that are on the map but off the colour scale. Two states, two
// styles, and neither is a step of any ramp, so neither reads as "low":
// - "none recorded": a real zero count for what is selected (other things
//   were seen in the cell). A flat neutral grey, no hue. Not "absent": the
//   archive has no absences, only nothing logged.
// - "no value": the metric can't be computed for the cell (e.g. no early
//   or late years to compare). Diagonal hatching from CHART_NO_VALUE_HATCH
//   (addNoValuePattern in src/lib/map.ts, .no-value swatch in MapMissingKey).
// The alternative, the scale's lightest step for both, is exactly what the
// "show missing data as missing" caveat warns against.
export const CHART_NONE_RECORDED = "#d4d7da";
export const CHART_NO_VALUE_HATCH = CHART_TEXT_SECONDARY;

// Ordinal ramp (discrete ordered buckets, e.g. dominance tiers) — one hue,
// monotone lightness, light end still >= 2:1 against a white surface:
// `validate_palette.js "#87b9b3,#5da09a,#32847e,#0a6b64" --ordinal`
// -> all checks pass (light-end contrast 2.13:1).
export const CHART_ORDINAL_TEAL_RAMP = [
	"#87b9b3",
	"#5da09a",
	"#32847e",
	CHART_PRIMARY,
] as const;

// Categorical: behaviour on arrival (The Animal's year chart). Slots 1–4 of
// the dataviz skill's default categorical palette, in the stacking order
// of BEHAVIOUR_ORDER (src/data/selectors.ts), because only neighbours in a
// stack need to be told apart:
// `validate_palette.js "#2a78d6,#eb6834,#1baf7a,#eda100" --surface "#ffffff"`
// -> worst adjacent CVD ΔE 9.1 (protan), normal-vision ΔE 22.9: pass.
// Contrast WARN for aqua (2.8:1) and yellow (2.2:1) against white: the
// legend and the month panel give every share as text, so colour is
// never the only carrier. Across *all* pairs yellow↔orange is only ΔE 13.7,
// so don't reuse this set for a non-stacked chart without re-validating.
export const CHART_BEHAVIOUR = {
	foraging: "#2a78d6",
	socialising: "#eb6834",
	resting: "#1baf7a",
	travelling: "#eda100",
} as const;
