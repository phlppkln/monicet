<template>
	<div class="d3-explorer">
		<div class="toolbar">
			<div class="controls-row">
				<div class="control">
					<label for="d3-species-select">Species</label>
					<select id="d3-species-select" v-model="selectedSpeciesId">
						<option
							v-for="opt in speciesList"
							:key="opt.id"
							:value="opt.id"
						>
							{{ opt.label }}
						</option>
					</select>
				</div>

				<ModeSwitch
					v-model="showDominance"
					:options="viewOptions"
					label="Map mode"
					variant="compact"
				/>
			</div>

			<BasemapControls
				v-model:basemap-id="basemapId"
				v-model:show-data-layer="showDataLayer"
				v-model:data-layer-opacity="dataLayerOpacity"
			/>
		</div>

		<div v-if="loading" class="status">Preparing species map…</div>
		<div v-else-if="error" class="status error">{{ error }}</div>

		<div v-else class="layout">
			<div class="map-shell">
				<div ref="mapContainer" class="map-container"></div>
				<MapAttribution :basemap-id="basemapId" />
				<div v-show="showDataLayer" class="legend-shell">
					<template v-if="showDominance">
						<div class="legend-title">Habitat role</div>
						<div class="dominance-legend">
							<span
								v-for="cat in dominanceLegend"
								:key="cat.label"
								class="swatch-item"
							>
								<span
									class="swatch"
									:style="{ background: cat.color }"
								></span>
								{{ cat.label }}
							</span>
						</div>
					</template>
					<template v-else>
						<div class="legend-title">
							Encounters (selected species)
						</div>
						<div
							ref="legendContainer"
							class="legend-container"
						></div>
					</template>
				</div>
				<div ref="tooltipRef" class="tooltip"></div>
			</div>

			<aside class="species-panel">
				<div v-if="selectedSpecies" class="panel-content">
					<div class="species-name">
						<strong>{{ selectedSpecies.commonName }}</strong>
						<em>{{ selectedSpecies.scientificName }}</em>
					</div>

					<div class="metric-row">
						<span>Total encounters</span>
						<strong>{{
							selectedSpecies.totalEncounters.toLocaleString()
						}}</strong>
					</div>
					<div class="metric-row">
						<span>Grid cells with sightings</span>
						<strong>{{ spatialCoverage }}</strong>
					</div>
					<div class="metric-row">
						<span>Best month (per cruise)</span>
						<strong>{{ bestMonthLabel }}</strong>
					</div>

					<div class="chart-section">
						<div class="chart-label">Year-by-year encounters</div>
						<div ref="sparklineContainer" class="sparkline"></div>
					</div>

					<div class="chart-section">
						<div class="chart-label">Monthly pattern</div>
						<div class="monthly-bars">
							<div
								v-for="(
									count, i
								) in selectedSpecies.monthlyEncounters"
								:key="i"
								class="month-col"
								:title="`${MONTH_LABELS[i]}: ${count.toLocaleString()}`"
							>
								<div
									class="month-bar"
									:style="{
										height: `${maxMonthly > 0 ? Math.max(2, (count / maxMonthly) * 52) : 2}px`,
									}"
								></div>
								<div class="month-tick">
									{{
										i % 3 === 0
											? (MONTH_LABELS[i] ?? "").slice(
													0,
													1
												)
											: ""
									}}
								</div>
							</div>
						</div>
					</div>

					<div v-if="showDominance" class="dominance-note">
						<strong>Dominant</strong> = this species is the
						most-sighted in that cell. <strong>Notable</strong> =
						top-3 but not #1. <strong>Occasional</strong> = present
						but rare.
					</div>
				</div>

				<div class="caveat">
					Encounter counts are absolute, not normalized by cruise
					effort. Species presence in a cell reflects the full
					2009–2020 archive.
				</div>
			</aside>
		</div>
	</div>
</template>

<script setup lang="ts">
// The Animal (formerly D3, "The Species as Character"). One species reorganises the
// map: raw encounter distribution or habitat role (dominance), plus a
// yearly sparkline and monthly bars in the side panel.
import * as d3 from "d3";
import {
	computed,
	nextTick,
	onBeforeUnmount,
	onMounted,
	ref,
	watch,
} from "vue";

import BasemapControls from "@/components/shared-ui/BasemapControls.vue";
import MapAttribution from "@/components/shared-ui/MapAttribution.vue";
import ModeSwitch from "@/components/shared-ui/ModeSwitch.vue";
import {
	bestMonthIndex,
	monthlyRates,
	cellDominance,
	findSpecies,
	speciesOptions,
	type DominanceCategory,
} from "@/data/selectors";
import { useMonicetData } from "@/data/useMonicetData";
import {
	CHART_ORDINAL_TEAL_RAMP,
	CHART_PRIMARY,
	CHART_SEQUENTIAL_TEAL,
	CHART_TEXT_SECONDARY,
} from "@/lib/chartTokens";
import { formatCellLabel, MONTH_LABELS } from "@/lib/format";
import { renderGradientLegend } from "@/lib/legend";
import { BASEMAPS, drawBaseMap, type BasemapId } from "@/lib/map";
import { hideTooltip, showTooltip } from "@/lib/tooltip";
import type { MonicetGridCell } from "@/types/monicet";

const { mapData, basemap, mapLines, error, load, loadMapLines } =
	useMonicetData();
const loading = ref(true);

const selectedSpeciesId = ref("");
const showDominance = ref(false);

// Same basemaps as The External (docs/basemaps.md), with the cells as a
// toggleable layer whose opacity lets the basemap show through.
const basemapId = ref<BasemapId>("basic");
const showDataLayer = ref(true);
const dataLayerOpacity = ref(0.65);

const mapContainer = ref<HTMLElement | null>(null);
const legendContainer = ref<HTMLElement | null>(null);
const sparklineContainer = ref<HTMLElement | null>(null);
const tooltipRef = ref<HTMLElement | null>(null);

const viewOptions = [
	{ value: false, label: "Distribution" },
	{ value: true, label: "Dominance" },
];

// Dominance is an ordinal magnitude bucket, so it takes one hue stepped
// light → dark rather than four unrelated categorical hues.
const DOMINANCE: Record<DominanceCategory, { label: string; color: string }> = {
	absent: { label: "Absent", color: CHART_ORDINAL_TEAL_RAMP[0] },
	occasional: { label: "Occasional", color: CHART_ORDINAL_TEAL_RAMP[1] },
	notable: { label: "Notable", color: CHART_ORDINAL_TEAL_RAMP[2] },
	dominant: { label: "Dominant", color: CHART_ORDINAL_TEAL_RAMP[3] },
};

const dominanceLegend = (
	["dominant", "notable", "occasional", "absent"] as DominanceCategory[]
).map((cat) => DOMINANCE[cat]);

// ─── Derived data ────────────────────────────────────────────────────────────

const speciesList = computed(() =>
	mapData.value ? speciesOptions(mapData.value) : []
);

const selectedSpecies = computed(() => {
	if (!mapData.value || !selectedSpeciesId.value) return null;
	return findSpecies(mapData.value, selectedSpeciesId.value);
});

const maxMonthly = computed(() =>
	Math.max(1, ...(selectedSpecies.value?.monthlyEncounters ?? []))
);

const spatialCoverage = computed(() =>
	selectedSpecies.value
		? Object.keys(selectedSpecies.value.cellCounts).length
		: 0
);

const bestMonthLabel = computed(() => {
	const monthly = selectedSpecies.value?.monthlyEncounters;
	if (!monthly || !mapData.value) return "n/a";
	// Per cruise, like The External's "Best month overall"; raw counts would
	// mostly show the month with the most trips.
	const cruises = mapData.value.monthlySummaries.map((m) => m.cruises);
	return (
		MONTH_LABELS[bestMonthIndex(monthlyRates(monthly, cruises))] ?? "n/a"
	);
});

// ─── Tooltip ─────────────────────────────────────────────────────────────────

function onCellHover(event: MouseEvent, cell: MonicetGridCell) {
	if (!tooltipRef.value || !mapContainer.value) return;
	const count = cell.speciesCounts[selectedSpeciesId.value] ?? 0;
	const cat = cellDominance(cell, selectedSpeciesId.value);
	const catLabel = cat.charAt(0).toUpperCase() + cat.slice(1);

	showTooltip(
		tooltipRef.value,
		mapContainer.value,
		event,
		`
		<div class="tip-title">${formatCellLabel(cell)}</div>
		<div class="tip-line">${count.toLocaleString()} encounters</div>
		<div class="tip-line">${catLabel} presence</div>
	`
	);
}

// ─── Render map ──────────────────────────────────────────────────────────────

let dataLayer: d3.Selection<SVGGElement, unknown, null, undefined> | null =
	null;

function applyDataLayerVisibility() {
	dataLayer
		?.attr("display", showDataLayer.value ? null : "none")
		.attr("opacity", dataLayerOpacity.value);
}

// Two levels of redraw, as in CellMapExplorer. renderMap() rebuilds the
// basemap (tiles, lines, labels, zoom) and is needed only when the basemap
// or the size changes. renderDataLayer() redraws cells and legend only, so
// species and mode changes don't re-create every tile or reset the zoom.
let base: {
	cellPath: ReturnType<typeof drawBaseMap>["cellPath"];
	insertDataLayer: ReturnType<typeof drawBaseMap>["insertDataLayer"];
} | null = null;

function renderMap() {
	if (!mapContainer.value || !mapData.value || !basemap.value) return;

	const { theme, tiles } = BASEMAPS[basemapId.value];
	const {
		cellPath,
		raiseLines,
		insertDataLayer,
		drawIslandLabels,
		enableZoom,
	} = drawBaseMap(mapContainer.value, basemap.value, {
		theme,
		tiles,
		lines: mapLines.value,
		fallbackWidth: 720,
		minHeight: 380,
		aspect: 0.68,
	});

	// Wireframe: coastlines and labels on top, cells inserted below them.
	raiseLines();
	drawIslandLabels();
	enableZoom();

	base = { cellPath, insertDataLayer };
	renderDataLayer();
}

function renderDataLayer() {
	if (!base || !mapData.value) return;
	hideTooltip(tooltipRef.value);

	dataLayer?.remove();
	dataLayer = base.insertDataLayer();
	applyDataLayerVisibility();

	const cells = mapData.value.gridCells;
	const spId = selectedSpeciesId.value;

	let fill: (cell: MonicetGridCell) => string;

	if (showDominance.value) {
		fill = (cell) => DOMINANCE[cellDominance(cell, spId)].color;
	} else {
		const maxCount = Math.max(
			1,
			d3.max(cells, (c) => c.speciesCounts[spId] ?? 0) ?? 1
		);
		const scale = d3
			.scaleSequential(d3.interpolateRgb(...CHART_SEQUENTIAL_TEAL))
			.domain([0, maxCount]);
		fill = (cell) => {
			const v = cell.speciesCounts[spId] ?? 0;
			return v > 0 ? scale(v) : "#e8eef2";
		};
		if (legendContainer.value) {
			renderGradientLegend(
				legendContainer.value,
				"d3-sp-legend",
				(t) => scale(t * maxCount),
				{ left: "0", right: `${maxCount}` }
			);
		}
	}

	dataLayer
		.selectAll("path")
		.data(cells)
		.join("path")
		.attr("d", base.cellPath)
		.attr("fill", fill)
		.attr("stroke", "#fff")
		.attr("stroke-width", 0.7)
		.on("mousemove", (event: MouseEvent, cell) => onCellHover(event, cell))
		.on("mouseleave", () => hideTooltip(tooltipRef.value));
}

// ─── Render sparkline ────────────────────────────────────────────────────────

function renderSparkline() {
	const species = selectedSpecies.value;
	if (!sparklineContainer.value || !species || !mapData.value) return;
	d3.select(sparklineContainer.value).selectAll("*").remove();

	type Point = { year: number; count: number };
	const years = mapData.value.meta.years;
	const data: Point[] = years.map((year) => ({
		year,
		count: species.yearlyEncounters[String(year)] ?? 0,
	}));

	const w = sparklineContainer.value.clientWidth || 240;
	const h = 68;
	const margin = { left: 28, right: 6, top: 6, bottom: 16 };

	const firstYear = years[0] ?? 2009;
	const lastYear = years[years.length - 1] ?? 2020;
	const x = d3
		.scaleLinear()
		.domain([firstYear, lastYear])
		.range([margin.left, w - margin.right]);
	const yMax = Math.max(1, d3.max(data, (d) => d.count) ?? 1);
	const y = d3
		.scaleLinear()
		.domain([0, yMax * 1.1])
		.range([h - margin.bottom, margin.top]);

	const svg = d3
		.select(sparklineContainer.value)
		.append("svg")
		.attr("viewBox", `0 0 ${w} ${h}`)
		.style("width", "100%")
		.style("overflow", "visible");

	const area = d3
		.area<Point>()
		.x((d) => x(d.year))
		.y0(y(0))
		.y1((d) => y(d.count))
		.curve(d3.curveMonotoneX);

	const line = d3
		.line<Point>()
		.x((d) => x(d.year))
		.y((d) => y(d.count))
		.curve(d3.curveMonotoneX);

	svg.append("path")
		.datum(data)
		.attr("d", area)
		.attr("fill", CHART_PRIMARY)
		.attr("fill-opacity", 0.12);

	svg.append("path")
		.datum(data)
		.attr("d", line)
		.attr("fill", "none")
		.attr("stroke", CHART_PRIMARY)
		.attr("stroke-width", 1.6);

	svg.selectAll("circle")
		.data(data)
		.join("circle")
		.attr("cx", (d) => x(d.year))
		.attr("cy", (d) => y(d.count))
		.attr("r", 2.5)
		.attr("fill", CHART_PRIMARY);

	const label = (lx: number, ly: number, text: string, anchor?: string) =>
		svg
			.append("text")
			.attr("x", lx)
			.attr("y", ly)
			.attr("text-anchor", anchor ?? null)
			.attr("font-size", 8)
			.attr("fill", CHART_TEXT_SECONDARY)
			.text(text);

	// Y axis: max and zero only; X axis: first and last year only.
	label(margin.left - 3, margin.top + 4, yMax.toLocaleString(), "end");
	label(margin.left - 3, h - margin.bottom, "0", "end");
	label(x(firstYear), h, String(firstYear));
	label(x(lastYear), h, String(lastYear), "end");
}

// ─── Lifecycle ───────────────────────────────────────────────────────────────

function handleResize() {
	renderMap();
	renderSparkline();
}

// The component can unmount while load() is still pending (e.g. a quick
// click on "← MONICET"); onBeforeUnmount has then already run, so nothing
// may be set up after an await once this is true.
let unmounted = false;

onMounted(async () => {
	await load();
	if (unmounted) return;
	// Coastlines: drawn by the wireframe and, on tiled basemaps, as the
	// fallback under the tiles. Not awaited; redraw once they arrive.
	void loadMapLines().then(() => {
		if (!unmounted && !loading.value) renderMap();
	});
	loading.value = false;
	if (mapData.value) {
		selectedSpeciesId.value =
			mapData.value.speciesSummaries[0]?.speciesId ?? "";
		await nextTick();
		if (unmounted) return;
		renderMap();
		renderSparkline();
		window.addEventListener("resize", handleResize, { passive: true });
	}
});

onBeforeUnmount(() => {
	unmounted = true;
	window.removeEventListener("resize", handleResize);
});

watch(selectedSpeciesId, async () => {
	if (loading.value) return;
	renderDataLayer();
	await nextTick();
	renderSparkline();
});

watch(showDominance, () => {
	if (loading.value) return;
	renderDataLayer();
});

watch(basemapId, () => {
	if (!loading.value) renderMap();
});

watch(dataLayerOpacity, applyDataLayerVisibility);

// Toggling the data layer only hides it: no redraw, so tiles don't reload.
watch(showDataLayer, () => {
	hideTooltip(tooltipRef.value);
	applyDataLayerVisibility();
});
</script>

<style scoped lang="scss">
.d3-explorer {
	position: relative;
	padding: 1.2rem;
	border: 1px solid rgba($primary, 0.22);
	background:
		radial-gradient(
			circle at 80% 10%,
			rgba($primary, 0.1),
			transparent 36%
		),
		linear-gradient(150deg, #f3f8f5, #f8f4ee);
	border-radius: 12px;
}

.toolbar {
	display: flex;
	flex-direction: column;
	gap: 0.75rem;
	margin-bottom: 1rem;
}

.controls-row {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 1rem;
}

.control {
	display: flex;
	align-items: center;
	gap: 0.5rem;

	label {
		font-size: 0.84rem;
		font-weight: 600;
		color: $text-primary;
		white-space: nowrap;
	}

	select {
		padding: 0.35rem 0.5rem;
		border-radius: 6px;
		border: 1px solid $border;
		font-size: 0.84rem;
		min-width: 200px;
		max-width: 320px;
		background-color: $surface;
	}
}

.status {
	padding: 2rem 0.5rem;
	font-size: 0.95rem;
	color: $text-secondary;

	&.error {
		color: $secondary;
	}
}

.layout {
	display: grid;
	grid-template-columns: minmax(0, 2fr) minmax(260px, 1fr);
	gap: 1rem;
}

.map-shell {
	position: relative;
	border-radius: 10px;
	overflow: hidden;
	border: 1px solid rgba($primary, 0.2);
	background: rgba($surface, 0.7);
}

.map-container {
	min-height: 380px;
}

.legend-shell {
	padding: 0.5rem 0.75rem 0.6rem;
	border-top: 1px solid rgba($primary, 0.16);
	background: rgba($surface, 0.92);
}

.legend-title {
	font-size: 0.78rem;
	font-weight: 700;
	letter-spacing: 0.02em;
	color: $text-primary;
	margin-bottom: 0.25rem;
}

.dominance-legend {
	display: flex;
	flex-wrap: wrap;
	gap: 0.6rem;
}

.swatch-item {
	display: flex;
	align-items: center;
	gap: 0.3rem;
	font-size: 0.76rem;
	color: $text-primary;
}

.swatch {
	width: 12px;
	height: 12px;
	border-radius: 2px;
	display: inline-block;
	border: 1px solid rgba(0, 0, 0, 0.12);
}

:deep(.legend-label) {
	font-size: 10px;
	font-family: "Space Grotesk", sans-serif;
	fill: $text-secondary;
}

.tooltip {
	position: absolute;
	left: 0;
	top: 0;
	pointer-events: none;
	opacity: 0;
	padding: 0.55rem 0.65rem;
	border-radius: 8px;
	background: rgba(26, 26, 26, 0.92);
	color: #fff;
	font-size: 0.75rem;
	line-height: 1.35;
	transform: translate(-999px, -999px);
	transition: opacity 0.08s linear;
	box-shadow: 0 8px 18px rgba(0, 0, 0, 0.24);
	max-width: 220px;
}

:deep(.tip-title) {
	font-weight: 700;
	margin-bottom: 0.2rem;
}

// ─── Species panel ───────────────────────────────────────────────────────────

.species-panel {
	background: rgba($surface, 0.92);
	border: 1px solid rgba($primary, 0.2);
	border-radius: 10px;
	padding: 0.9rem;
	display: flex;
	flex-direction: column;
	gap: 0.65rem;
	min-height: 380px;
}

.panel-content {
	display: flex;
	flex-direction: column;
	gap: 0.6rem;
	flex: 1;
}

.species-name {
	display: flex;
	flex-direction: column;
	gap: 0.1rem;
	border-bottom: 1px solid rgba($border, 0.9);
	padding-bottom: 0.5rem;

	strong {
		font-size: 1rem;
		color: $primary;
	}

	em {
		font-size: 0.78rem;
		color: $text-secondary;
	}
}

.metric-row {
	display: flex;
	justify-content: space-between;
	align-items: center;
	font-size: 0.82rem;
	padding: 0.3rem 0.4rem;
	background: rgba($background-darker, 0.7);
	border-radius: 6px;
	border: 1px solid rgba($border, 0.8);

	strong {
		color: $primary;
	}
}

.chart-section {
	display: flex;
	flex-direction: column;
	gap: 0.25rem;
}

.chart-label {
	font-size: 0.78rem;
	font-weight: 600;
	color: $text-secondary;
}

.sparkline {
	width: 100%;
	min-height: 68px;
}

.monthly-bars {
	display: flex;
	align-items: flex-end;
	gap: 2px;
	height: 68px;
	padding-bottom: 16px;
}

.month-col {
	flex: 1;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: flex-end;
	height: 100%;
}

.month-bar {
	width: 100%;
	background: rgba($primary, 0.55);
	border-radius: 2px 2px 0 0;
	min-height: 2px;
	transition: height 0.2s ease;
}

.month-tick {
	font-size: 7px;
	color: $text-secondary;
	margin-top: 2px;
	line-height: 1;
}

.dominance-note {
	font-size: 0.76rem;
	color: $text-secondary;
	line-height: 1.45;
	background: rgba($background-darker, 0.5);
	border-radius: 6px;
	padding: 0.4rem 0.5rem;

	strong {
		color: $text-primary;
	}
}

.caveat {
	margin-top: auto;
	font-size: 0.74rem;
	color: $text-secondary;
	padding-top: 0.5rem;
	border-top: 1px dashed rgba($border, 0.9);
}

@media (max-width: 1024px) {
	.layout {
		grid-template-columns: 1fr;
	}
	.map-container {
		min-height: 320px;
	}
	.species-panel {
		min-height: auto;
	}
}

@media (max-width: 680px) {
	.d3-explorer {
		padding: 0.9rem;
	}
	.control select {
		min-width: 0;
		width: 100%;
	}
}
</style>
