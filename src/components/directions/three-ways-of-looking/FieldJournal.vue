<template>
	<div class="d4-journal" :class="{ 'panel-open': !!selectedCell }">
		<div v-if="loading" class="status">Preparing field journal…</div>
		<div v-else-if="error" class="status error">{{ error }}</div>

		<div v-else class="layout">
			<div class="map-shell">
				<div ref="mapContainer" class="map-container"></div>

				<div class="effort-legend">
					<span class="effort-label">Survey coverage</span>
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
					<div class="log-line">Surveyed: {{ surveyRange }}</div>
					<div class="log-line">
						Active in {{ selectedCell.yearsWithEncounters }} of
						{{ totalYears }} years.
					</div>
					<div class="log-line">
						Total occurrence records:
						{{ selectedCell.encounterCount.toLocaleString() }}
					</div>
					<div class="log-line confidence-line">
						Confidence score:
						{{ (selectedCell.confidenceScore * 100).toFixed(0) }}%
						<span
							class="reliable-badge"
							:class="{ reliable: selectedCell.isReliable }"
						>
							{{
								selectedCell.isReliable
									? "reliable"
									: "low data"
							}}
						</span>
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
						class="year-row"
					>
						<span class="yr-label">{{ row.year }}</span>
						<span class="yr-count">{{
							row.count.toLocaleString()
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
					Counts are total occurrence records, not normalized by
					cruise effort.
				</div>
			</aside>

			<div v-else class="prompt-panel">
				<p>Select a cell on the map to open its field record.</p>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
// The Observer (formerly D4, "The Field Journal"). The map shows how many years each
// cell was active; clicking a cell opens its logbook record.
import * as d3 from "d3";
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";

import {
	activeYearRange,
	activeYearRows,
	cellSpeciesList,
} from "@/data/selectors";
import { useMonicetData } from "@/data/useMonicetData";
import { formatCellLabel } from "@/lib/format";
import { drawBaseMap, type MapTheme } from "@/lib/map";
import { hideTooltip, showTooltip } from "@/lib/tooltip";
import type { MonicetGridCell } from "@/types/monicet";

const THEME: MapTheme = {
	background: "#f0f4f8",
	graticule: { stroke: "#c9d6e0", width: 0.5, opacity: 0.65 },
	envelope: { fill: "#dde8ef", stroke: "#b5c9d5" },
	island: { fill: "#cbbda1", stroke: "#9a8562" },
	labelColor: "#5a4a2f",
};

const SPECIES_PREVIEW = 5;
const MAX_YEARS = 12;

const { mapData, basemap, error, load } = useMonicetData();
const loading = ref(true);

const mapContainer = ref<HTMLElement | null>(null);
const tooltipRef = ref<HTMLElement | null>(null);
const selectedCell = ref<MonicetGridCell | null>(null);
const showAllSpecies = ref(false);

// Blues scale shared between map render and legend swatches
const blueScale = d3
	.scaleSequential(d3.interpolateBlues)
	.domain([0, MAX_YEARS]);

const effortStops = [0, 3, 6, 9, 12].map((y) => ({
	years: y,
	color: blueScale(y),
	label: y === 0 ? "0 yr" : y === 12 ? "12 yr" : String(y),
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
		? activeYearRows(selectedCell.value, years.value)
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
		<div class="tip-line">Active ${cell.yearsWithEncounters} / ${MAX_YEARS} years</div>
		<div class="tip-line tip-hint">Click to open record</div>
	`
	);
}

// ─── Render ──────────────────────────────────────────────────────────────────

function renderMap() {
	if (!mapContainer.value || !mapData.value || !basemap.value) return;

	hideTooltip(tooltipRef.value);
	const { mapGroup, cellPath, drawIslandLabels, enableZoom } = drawBaseMap(
		mapContainer.value,
		basemap.value,
		{ theme: THEME, fallbackWidth: 720, minHeight: 380, aspect: 0.68 }
	);

	const isSelected = (cell: MonicetGridCell) =>
		selectedCell.value?.id === cell.id;

	mapGroup
		.append("g")
		.selectAll("path")
		.data(mapData.value.gridCells)
		.join("path")
		.attr("d", cellPath)
		.attr("fill", (cell) => blueScale(cell.yearsWithEncounters))
		.attr("stroke", (cell) => (isSelected(cell) ? "#0a6b64" : "#ffffff"))
		.attr("stroke-width", (cell) => (isSelected(cell) ? 1.8 : 0.7))
		.attr("opacity", 0.88)
		.style("cursor", "pointer")
		.on("mousemove", (event: MouseEvent, cell) => onCellHover(event, cell))
		.on("mouseleave", () => hideTooltip(tooltipRef.value))
		.on("click", (_event, cell) => {
			showAllSpecies.value = false;
			selectedCell.value = cell;
		});

	drawIslandLabels();
	enableZoom();
}

// ─── Lifecycle ───────────────────────────────────────────────────────────────

// The component can unmount while load() is still pending (e.g. a quick
// click on "← MONICET"); onBeforeUnmount has then already run, so nothing
// may be set up after an await once this is true.
let unmounted = false;

onMounted(async () => {
	await load();
	if (unmounted) return;
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
</script>

<style scoped lang="scss">
.d4-journal {
	position: relative;
	padding: 1.2rem;
	border: 1px solid rgba($journal-accent, 0.25);
	background:
		radial-gradient(
			circle at 10% 90%,
			rgba($journal-accent, 0.08),
			transparent 40%
		),
		linear-gradient(150deg, #f0f4f8, #f8f6f2);
	border-radius: 12px;
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
	grid-template-columns: minmax(0, 1fr);
	gap: 1rem;
	transition: grid-template-columns 0.25s ease;
}

.d4-journal.panel-open .layout {
	grid-template-columns: minmax(0, 3fr) minmax(280px, 2fr);
}

.map-shell {
	position: relative;
	border-radius: 10px;
	overflow: hidden;
	border: 1px solid rgba($journal-accent, 0.2);
	background: rgba($surface, 0.7);
}

.map-container {
	min-height: 380px;
	cursor: crosshair;
}

.effort-legend {
	display: flex;
	align-items: center;
	gap: 0.75rem;
	padding: 0.45rem 0.75rem 0.5rem;
	border-top: 1px solid rgba($journal-accent, 0.18);
	background: rgba($surface, 0.92);
	flex-wrap: wrap;
}

.effort-label {
	font-size: 0.76rem;
	font-weight: 700;
	color: $text-primary;
	white-space: nowrap;
}

.swatches {
	display: flex;
	align-items: center;
	gap: 0.5rem;
}

.stop-item {
	display: flex;
	align-items: center;
	gap: 0.22rem;
}

.stop-swatch {
	width: 14px;
	height: 14px;
	border-radius: 2px;
	border: 1px solid rgba(0, 0, 0, 0.1);
}

.stop-text {
	font-size: 0.72rem;
	color: $text-secondary;
}

.tooltip {
	position: absolute;
	left: 0;
	top: 0;
	pointer-events: none;
	opacity: 0;
	padding: 0.5rem 0.6rem;
	border-radius: 7px;
	background: rgba(20, 30, 40, 0.92);
	color: #fff;
	font-size: 0.74rem;
	line-height: 1.38;
	transform: translate(-999px, -999px);
	transition: opacity 0.08s linear;
	box-shadow: 0 6px 16px rgba(0, 0, 0, 0.22);
	max-width: 200px;
}

:deep(.tip-title) {
	font-weight: 700;
	margin-bottom: 0.2rem;
}
:deep(.tip-hint) {
	opacity: 0.65;
	font-style: italic;
}

// ─── Logbook panel ───────────────────────────────────────────────────────────

.logbook-panel {
	background: rgba($surface, 0.97);
	border: 1px solid rgba($journal-accent, 0.22);
	border-radius: 10px;
	padding: 1rem;
	display: flex;
	flex-direction: column;
	gap: 1rem;
	font-family: "Space Grotesk", monospace;
	overflow-y: auto;
	max-height: 520px;
}

.logbook-header {
	display: flex;
	justify-content: space-between;
	align-items: flex-start;
}

.coords {
	font-size: 1.05rem;
	font-weight: 700;
	color: $text-primary;
	letter-spacing: 0.01em;
}

.close-btn {
	background: none;
	border: 1px solid $border;
	color: $text-secondary;
	font-size: 1.1rem;
	width: 28px;
	height: 28px;
	border-radius: 6px;
	cursor: pointer;
	display: flex;
	align-items: center;
	justify-content: center;
	line-height: 1;
	padding: 0;
	transition: border-color 0.15s;

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
	padding-top: 0.75rem;
}

.log-line {
	font-size: 0.83rem;
	color: $text-primary;
	line-height: 1.4;
}

.confidence-line {
	display: flex;
	align-items: center;
	gap: 0.5rem;
}

.reliable-badge {
	font-size: 0.7rem;
	padding: 0.1rem 0.4rem;
	border-radius: 4px;
	background: rgba($secondary, 0.12);
	color: $secondary;
	font-weight: 600;

	&.reliable {
		background: rgba($primary, 0.1);
		color: $primary;
	}
}

.log-heading {
	font-size: 0.78rem;
	font-weight: 700;
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
	font-size: 0.8rem;
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
	background: rgba($journal-accent, 0.1);
	border-radius: 3px;
	overflow: hidden;
}

.yr-bar {
	height: 100%;
	background: rgba($journal-accent, 0.6);
	border-radius: 3px;
	transition: width 0.2s ease;
}

.log-caveat {
	font-size: 0.72rem;
	color: $text-secondary;
	padding-top: 0.5rem;
	border-top: 1px dashed rgba($border, 0.9);
	margin-top: auto;
}

// ─── Prompt panel (no cell selected) ─────────────────────────────────────────

.prompt-panel {
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 2rem;
	border: 1px dashed rgba($journal-accent, 0.3);
	border-radius: 10px;
	color: $text-secondary;
	font-size: 0.88rem;
	text-align: center;
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

@media (max-width: 680px) {
	.d4-journal {
		padding: 0.9rem;
	}
}
</style>
