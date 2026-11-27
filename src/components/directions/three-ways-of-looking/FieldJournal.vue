<template>
	<div class="d4-journal" :class="{ 'panel-open': !!selectedCell }">
		<div v-if="loading" class="status">Preparing field journal…</div>
		<div v-else-if="error" class="status error">{{ error }}</div>

		<div v-else class="layout">
			<div class="map-shell">
				<div ref="mapContainer" class="map-container"></div>

				<div class="effort-legend">
					<span class="effort-label">Active years</span>
					<div class="swatches">
						<span
							v-for="stop in effortStops"
							:key="stop.years"
							class="stop-item"
						>
							<span
								class="stop-swatch"
								:style="{ background: stop.color }"
							></span>
							<span class="stop-text">{{ stop.label }}</span>
						</span>
					</div>
					<span v-if="!selectedCell" class="select-hint">
						Click any cell to open its record
					</span>
				</div>

				<div ref="tooltipRef" class="tooltip"></div>
			</div>

			<aside v-if="selectedCell" class="logbook-panel">
				<div class="logbook-header">
					<div class="coords">
						{{
							formatCellLabel(selectedCell, {
								degrees: true,
								separator: ",  ",
							})
						}}
					</div>
					<button
						class="close-btn"
						@click="selectedCell = null"
						aria-label="Close"
					>
						×
					</button>
				</div>

				<div class="log-section">
					<div class="log-line">
						<span>Years with sightings</span>
						<strong
							>{{ selectedCell.yearsWithEncounters }} /
							{{ totalYears }} ({{ surveyRange }})</strong
						>
					</div>
					<div class="log-line">
						<span>Encounters</span>
						<strong>{{
							selectedCell.encounterCount.toLocaleString()
						}}</strong>
					</div>
				</div>

				<div class="log-section">
					<div class="log-heading">
						Species observed ({{ allSpecies.length }})
					</div>
					<div
						v-for="sp in visibleSpecies"
						:key="sp.id"
						class="species-row"
					>
						<span class="sp-name">{{ sp.name }}</span>
						<span class="sp-count">{{
							sp.count.toLocaleString()
						}}</span>
					</div>
					<button
						v-if="allSpecies.length > SPECIES_PREVIEW"
						class="expand-btn"
						@click="showAllSpecies = !showAllSpecies"
					>
						{{
							showAllSpecies
								? "Show fewer"
								: `+${allSpecies.length - SPECIES_PREVIEW} more`
						}}
					</button>
				</div>

				<div class="log-section">
					<div class="log-heading">Year-by-year record</div>
					<div
						v-for="row in yearRows"
						:key="row.year"
						:class="['year-row', { gap: row.count === 0 }]"
					>
						<span class="yr-label">{{ row.year }}</span>
						<span class="yr-count">{{
							row.count === 0 ? "–" : row.count.toLocaleString()
						}}</span>
						<div class="yr-bar-track">
							<div
								class="yr-bar"
								:style="{
									width: `${maxYearCount > 0 ? (row.count / maxYearCount) * 100 : 0}%`,
								}"
							></div>
						</div>
					</div>
				</div>

				<div class="log-caveat">
					Raw encounter counts, not normalized by cruise effort.
				</div>
			</aside>
		</div>
	</div>
</template>

<script setup lang="ts">
// The Observer: active years per cell on a clean wireframe coastline.
// Clicking a cell opens its field record.
import * as d3 from "d3";
import {
	computed,
	nextTick,
	onBeforeUnmount,
	onMounted,
	ref,
	watch,
} from "vue";

import { activeYearRange, cellSpeciesList, yearRecord } from "@/data/selectors";
import { useMonicetData } from "@/data/useMonicetData";
import { CHART_SEQUENTIAL_TEAL, CHART_TEXT_PRIMARY } from "@/lib/chartTokens";
import { formatCellLabel } from "@/lib/format";
import { drawBaseMap, WIREFRAME_THEME } from "@/lib/map";
import { hideTooltip, showTooltip } from "@/lib/tooltip";
import type { MonicetGridCell } from "@/types/monicet";

const SPECIES_PREVIEW = 5;
const MAX_YEARS = 12;

const { mapData, basemap, mapLines, error, load, loadMapLines } =
	useMonicetData();
const loading = ref(true);

const mapContainer = ref<HTMLElement | null>(null);
const tooltipRef = ref<HTMLElement | null>(null);
const selectedCell = ref<MonicetGridCell | null>(null);
const showAllSpecies = ref(false);

const yearScale = d3
	.scaleSequential(d3.interpolateRgb(...CHART_SEQUENTIAL_TEAL))
	.domain([1, MAX_YEARS]);

const effortStops = [1, 3, 6, 9, 12].map((y) => ({
	years: y,
	color: yearScale(y),
	label: y === 1 ? "1 yr" : y === 12 ? "12 yr" : String(y),
}));

// ─── Derived from selectedCell ───────────────────────────────────────────────

const years = computed(() => mapData.value?.meta.years ?? []);
const totalYears = computed(
	() => mapData.value?.meta.years.length ?? MAX_YEARS
);

const surveyRange = computed(() =>
	selectedCell.value && mapData.value
		? activeYearRange(selectedCell.value, years.value)
		: ""
);

const allSpecies = computed(() =>
	selectedCell.value && mapData.value
		? cellSpeciesList(selectedCell.value, mapData.value)
		: []
);

const visibleSpecies = computed(() =>
	showAllSpecies.value
		? allSpecies.value
		: allSpecies.value.slice(0, SPECIES_PREVIEW)
);

const yearRows = computed(() =>
	selectedCell.value && mapData.value
		? yearRecord(selectedCell.value, years.value)
		: []
);

const maxYearCount = computed(() =>
	Math.max(1, ...yearRows.value.map((r) => r.count))
);

// ─── Tooltip ─────────────────────────────────────────────────────────────────

function onCellHover(event: MouseEvent, cell: MonicetGridCell) {
	if (!tooltipRef.value || !mapContainer.value) return;
	showTooltip(
		tooltipRef.value,
		mapContainer.value,
		event,
		`
		<div class="tip-title">${formatCellLabel(cell, { degrees: true })}</div>
		<div class="tip-line">Active ${cell.yearsWithEncounters} / ${totalYears.value} years</div>
	`
	);
}

// ─── Render ──────────────────────────────────────────────────────────────────

let selectionOutline: d3.Selection<
	SVGGElement,
	unknown,
	null,
	undefined
> | null = null;
let currentCellPath:
	((cell: Pick<MonicetGridCell, "polygon">) => string) | null = null;

function updateSelectionOutline() {
	if (!selectionOutline || !currentCellPath) return;
	const cellPath = currentCellPath;
	selectionOutline
		.selectAll("path")
		.data(selectedCell.value ? [selectedCell.value] : [])
		.join("path")
		.attr("d", cellPath)
		.attr("fill", "none")
		.attr("stroke", CHART_TEXT_PRIMARY)
		.attr("stroke-width", 2);
}

function renderMap() {
	if (!mapContainer.value || !mapData.value || !basemap.value) return;

	hideTooltip(tooltipRef.value);
	const { cellPath, raiseLines, insertDataLayer, drawIslandLabels } =
		drawBaseMap(mapContainer.value, basemap.value, {
			theme: WIREFRAME_THEME,
			lines: mapLines.value,
			fallbackWidth: 720,
			minHeight: 380,
			aspect: 0.62,
		});

	raiseLines();
	drawIslandLabels();
	const dataLayer = insertDataLayer();

	const cellsGroup = dataLayer.append("g");
	selectionOutline = dataLayer.append("g").attr("pointer-events", "none");
	currentCellPath = cellPath;

	cellsGroup
		.selectAll("path")
		.data(mapData.value.gridCells)
		.join("path")
		.attr("d", cellPath)
		.attr("fill", (cell) => yearScale(cell.yearsWithEncounters))
		.attr("fill-opacity", 0.9)
		.attr("stroke", "rgba(26,26,26,0.2)")
		.attr("stroke-width", 0.5)
		.style("cursor", "pointer")
		.on("mousemove", (event: MouseEvent, cell) => onCellHover(event, cell))
		.on("mouseleave", () => hideTooltip(tooltipRef.value))
		.on("click", (_event, cell) => {
			showAllSpecies.value = false;
			selectedCell.value = cell;
		});

	updateSelectionOutline();
}

// ─── Lifecycle ───────────────────────────────────────────────────────────────

let unmounted = false;

onMounted(async () => {
	await load();
	if (unmounted) return;
	void loadMapLines().then(() => {
		if (!unmounted && !loading.value) renderMap();
	});
	loading.value = false;
	if (mapData.value) {
		await nextTick();
		if (unmounted) return;
		renderMap();
		window.addEventListener("resize", renderMap, { passive: true });
	}
});

onBeforeUnmount(() => {
	unmounted = true;
	window.removeEventListener("resize", renderMap);
});

watch(selectedCell, updateSelectionOutline);
</script>

<style scoped lang="scss">
.d4-journal {
	position: relative;
}

.status {
	padding: 2rem 0.5rem;
	font-size: 0.92rem;
	color: $text-secondary;
	&.error {
		color: $secondary;
	}
}

.layout {
	display: grid;
	grid-template-columns: minmax(0, 1fr);
	gap: 1.25rem;
	align-items: start;
}

.d4-journal.panel-open .layout {
	grid-template-columns: minmax(0, 3fr) minmax(280px, 2fr);
}

.map-shell {
	position: relative;
	border-radius: $radius-md;
	overflow: hidden;
	border: 1px solid $border;
	background: $surface;
}

.map-container {
	min-height: 360px;
	line-height: 0;
}

.effort-legend {
	display: flex;
	align-items: center;
	gap: 0.65rem 1rem;
	padding: 0.55rem 0.85rem;
	border-top: 1px solid $border;
	background: $surface;
	flex-wrap: wrap;
}

.effort-label {
	font-size: 0.78rem;
	font-weight: 600;
	color: $text-secondary;
	white-space: nowrap;
}

.swatches {
	display: flex;
	align-items: center;
	gap: 0.55rem;
}

.stop-item {
	display: flex;
	align-items: center;
	gap: 0.25rem;
}

.stop-swatch {
	width: 12px;
	height: 12px;
	border-radius: 2px;
	border: 1px solid rgba(0, 0, 0, 0.12);
}

.stop-text {
	font-size: 0.76rem;
	color: $text-secondary;
}

.select-hint {
	margin-left: auto;
	font-size: 0.78rem;
	color: $text-secondary;
}

.tooltip {
	position: absolute;
	left: 0;
	top: 0;
	pointer-events: none;
	opacity: 0;
	padding: 0.5rem 0.6rem;
	border-radius: $radius-sm;
	background: rgba(26, 26, 26, 0.92);
	color: #fff;
	font-size: 0.76rem;
	line-height: 1.4;
	transform: translate(-999px, -999px);
	transition: opacity 0.08s linear;
	max-width: 220px;
}

:deep(.tip-title) {
	font-weight: 700;
	margin-bottom: 0.15rem;
}

// ─── Logbook panel ───────────────────────────────────────────────────────────

.logbook-panel {
	background: $surface;
	border: 1px solid $border;
	border-radius: $radius-md;
	padding: 1.05rem 1.15rem;
	display: flex;
	flex-direction: column;
	gap: 0.9rem;
	overflow-y: auto;
	max-height: 520px;
}

.logbook-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
}

.coords {
	font-size: 1rem;
	font-weight: 700;
	color: $text-primary;
}

.close-btn {
	background: none;
	border: 1px solid $border;
	color: $text-secondary;
	font-size: 1.1rem;
	width: 28px;
	height: 28px;
	border-radius: $radius-sm;
	cursor: pointer;
	display: flex;
	align-items: center;
	justify-content: center;
	line-height: 1;
	padding: 0;
	transition: border-color $transition-fast;

	&:hover {
		border-color: $text-primary;
		color: $text-primary;
	}
}

.log-section {
	display: flex;
	flex-direction: column;
	gap: 0.35rem;
	border-top: 1px solid $border;
	padding-top: 0.7rem;
}

.log-line {
	display: flex;
	justify-content: space-between;
	gap: 0.75rem;
	font-size: 0.84rem;
	color: $text-secondary;

	strong {
		color: $text-primary;
		font-variant-numeric: tabular-nums;
	}
}

.log-heading {
	font-size: 0.76rem;
	font-weight: 600;
	color: $text-secondary;
	letter-spacing: 0.04em;
	text-transform: uppercase;
	margin-bottom: 0.15rem;
}

.species-row {
	display: flex;
	justify-content: space-between;
	align-items: baseline;
	gap: 0.5rem;
	font-size: 0.82rem;
}

.sp-name {
	color: $text-primary;
	flex: 1;
}

.sp-count {
	color: $text-secondary;
	font-variant-numeric: tabular-nums;
	white-space: nowrap;
}

.expand-btn {
	background: none;
	border: none;
	color: $primary;
	font-size: 0.78rem;
	cursor: pointer;
	padding: 0.15rem 0;
	text-align: left;
	font-family: inherit;
	text-decoration: underline;
	text-underline-offset: 2px;
}

.year-row {
	display: flex;
	align-items: center;
	gap: 0.5rem;
	font-size: 0.78rem;
}

.yr-label {
	width: 2.6rem;
	color: $text-secondary;
	font-variant-numeric: tabular-nums;
	flex-shrink: 0;
}

.yr-count {
	width: 3.2rem;
	text-align: right;
	color: $text-primary;
	font-variant-numeric: tabular-nums;
	flex-shrink: 0;
}

.yr-bar-track {
	flex: 1;
	height: 6px;
	background: $background-darker;
	border-radius: 3px;
	overflow: hidden;
}

.year-row.gap .yr-label,
.year-row.gap .yr-count {
	color: rgba($text-secondary, 0.55);
}

.yr-bar {
	height: 100%;
	background: $primary;
	border-radius: 3px;
	transition: width 0.2s ease;
}

.log-caveat {
	font-size: 0.76rem;
	color: $text-secondary;
	padding-top: 0.55rem;
	border-top: 1px solid $border;
	margin-top: auto;
}

@media (max-width: 1024px) {
	.d4-journal.panel-open .layout {
		grid-template-columns: 1fr;
	}

	.map-container {
		min-height: 300px;
	}

	.logbook-panel {
		max-height: none;
	}
}
</style>
