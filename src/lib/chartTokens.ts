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
export const CHART_SEQUENTIAL_TEAL: [string, string] = [
	"#eaf5f3",
	CHART_PRIMARY,
];

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
