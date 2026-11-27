<template>
	<div class="yearly-map" @keydown.escape="clearHover">
		<div class="controls-bar">
			<div class="year-slider-wrap">
				<button
					type="button"
					class="play-btn"
					:aria-pressed="isPlaying"
					:aria-label="
						isPlaying
							? 'Pause year animation'
							: 'Play year animation'
					"
					@click="togglePlay"
				>
					<svg
						v-if="isPlaying"
						class="play-icon"
						viewBox="0 0 16 16"
						width="14"
						height="14"
						aria-hidden="true"
					>
						<rect
							x="3.5"
							y="2.5"
							width="3.2"
							height="11"
							rx="1.2"
							fill="currentColor"
						/>
						<rect
							x="9.3"
							y="2.5"
							width="3.2"
							height="11"
							rx="1.2"
							fill="currentColor"
						/>
					</svg>
					<svg
						v-else
						class="play-icon"
						viewBox="0 0 16 16"
						width="14"
						height="14"
						aria-hidden="true"
					>
						<path
							d="M4.6 2.8c0-.7.76-1.14 1.37-.78l7.4 4.38c.6.35.6 1.21 0 1.56l-7.4 4.38c-.61.36-1.37-.08-1.37-.78V2.8Z"
							fill="currentColor"
						/>
					</svg>
				</button>
				<label :for="`year-slider-${uid}`" class="year-label">
					Year
					<strong class="year-value">{{ selectedYear }}</strong>
				</label>
				<div class="slider-track-wrap">
					<span class="year-bound">{{ minYear }}</span>
					<input
						:id="`year-slider-${uid}`"
						v-model.number="selectedYear"
						type="range"
						class="year-slider"
						:min="minYear"
						:max="maxYear"
						step="1"
						:aria-valuetext="`${selectedYear}, ${yearSummary}`"
						@input="stopPlay"
					/>
					<span class="year-bound">{{ maxYear }}</span>
				</div>
			</div>
			<span class="year-summary">{{ yearSummary }}</span>
		</div>

		<div class="map-frame">
			<div ref="mapShellRef" class="map-shell">
				<div
					v-if="showPreview"
					ref="previewCardRef"
					class="preview-card"
					:class="{ 'is-hidden': !previewVisible }"
					aria-hidden="true"
				>
					<div ref="previewRef" class="effort-preview"></div>
				</div>
				<div ref="mapRef" class="map-canvas"></div>
				<div
					ref="tooltipRef"
					class="tooltip"
					role="tooltip"
					aria-live="polite"
				></div>
			</div>
			<div class="legend-row">
				<div class="legend-block">
					<span class="legend-title"
						>Encounters per island cruise ({{ selectedYear }})</span
					>
					<div ref="legendRef" class="legend-svg"></div>
				</div>
				<MapMissingKey :items="missingItems" />
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
// Chapter 2: year-by-year wireframe map (2009–2020) with a fixed color scale
// across all 12 years and a hover/focus details tooltip per cell.
import * as d3 from "d3";
import {
	computed,
	nextTick,
	onBeforeUnmount,
	onMounted,
	ref,
	useId,
	watch,
} from "vue";

import MapMissingKey, {
	type MissingKeyItem,
} from "@/components/shared-ui/MapMissingKey.vue";
import {
	indexCruiseCells,
	yearlyCellRate,
	yearlyIslandRates,
	type YearlyIslandPoint,
} from "@/data/selectors";
import {
	CHART_ISLAND_GROUP,
	CHART_NO_VALUE_HATCH,
	CHART_SEQUENTIAL_TEAL,
	CHART_TEXT_PRIMARY,
} from "@/lib/chartTokens";
import { formatCellLabel, formatRate } from "@/lib/format";
import { renderGradientLegend } from "@/lib/legend";
import { addNoValuePattern, drawBaseMap, WIREFRAME_THEME } from "@/lib/map";
import { hideTooltip, showTooltip } from "@/lib/tooltip";
import type {
	BasemapFeatureCollection,
	IslandGroup,
	MapLineCollection,
	MonicetGridCell,
	MonicetMapData,
} from "@/types/monicet";

const props = withDefaults(
	defineProps<{
		data: MonicetMapData;
		basemap: BasemapFeatureCollection;
		lines: MapLineCollection | null;
		/** Controlled by StoryView during the scroll-dock transition. */
		previewVisible?: boolean;
		/** Hidden when Visualization 1 sits side-by-side with the map. */
		showPreview?: boolean;
	}>(),
	{ previewVisible: true, showPreview: true }
);

const emit = defineEmits<{
	"update:year": [year: number];
}>();

const years = computed(() => props.data.meta.years);
const minYear = computed(() => years.value[0] ?? 2009);
const maxYear = computed(() => years.value[years.value.length - 1] ?? 2020);
const selectedYear = ref<number>(
	props.data.meta.years[props.data.meta.years.length - 1] ?? 2020
);
const isPlaying = ref(false);
let playTimer: ReturnType<typeof setInterval> | null = null;

const PLAY_INTERVAL_MS = 450;

function stopPlay() {
	if (playTimer !== null) {
		clearInterval(playTimer);
		playTimer = null;
	}
	isPlaying.value = false;
}

function jumpToYear(year: number) {
	stopPlay();
	selectedYear.value = Math.max(minYear.value, Math.min(maxYear.value, year));
}

function togglePlay() {
	if (isPlaying.value) {
		stopPlay();
		return;
	}
	if (selectedYear.value >= maxYear.value) {
		selectedYear.value = minYear.value;
	}
	isPlaying.value = true;
	playTimer = setInterval(() => {
		if (selectedYear.value >= maxYear.value) {
			selectedYear.value = minYear.value;
		} else {
			selectedYear.value += 1;
		}
	}, PLAY_INTERVAL_MS);
}

const mapShellRef = ref<HTMLElement | null>(null);
const mapRef = ref<HTMLElement | null>(null);
const previewCardRef = ref<HTMLElement | null>(null);
const previewRef = ref<HTMLElement | null>(null);
const legendRef = ref<HTMLElement | null>(null);
const tooltipRef = ref<HTMLElement | null>(null);
const hoveredCellId = ref<string | null>(null);
const uid = useId();

defineExpose({ previewCardRef, jumpToYear });

const ISLAND_ORDER: IslandGroup[] = ["São Miguel", "Faial/Pico", "Terceira"];

interface YearCruiseRow {
	year: number;
	"São Miguel": number;
	"Faial/Pico": number;
	Terceira: number;
	total: number;
}

const previewCruiseRows = computed<YearCruiseRow[]>(() => {
	const byIsland = props.data.meta.yearlyCruisesByIsland;
	return years.value.map((year) => {
		const y = String(year);
		const sm = byIsland["São Miguel"]?.[y] ?? 0;
		const fp = byIsland["Faial/Pico"]?.[y] ?? 0;
		const te = byIsland["Terceira"]?.[y] ?? 0;
		return {
			year,
			"São Miguel": sm,
			"Faial/Pico": fp,
			Terceira: te,
			total: sm + fp + te,
		};
	});
});

const previewRateSeries = computed(() =>
	yearlyIslandRates(
		props.data.gridCells,
		props.data.meta.yearlyCruisesByIsland,
		years.value
	)
);

const missingItems: MissingKeyItem[] = [
	{ kind: "no-value", label: "no cruises recorded" },
];

const cruiseCellLookup = computed(() =>
	indexCruiseCells(props.data.cruiseCells ?? [])
);

function cellCruisesForYear(cellId: string, year: number): number {
	return (
		cruiseCellLookup.value.get(cellId)?.yearlyCruises?.[String(year)] ?? 0
	);
}

// One fixed domain across all 12 years (95th percentile of positive cell-year
// rates) so stepping through 2009 → 2020 never rescales the colours.
const colorDomainMax = computed(() => {
	const rates: number[] = [];
	for (const cell of props.data.gridCells) {
		for (const yr of years.value) {
			const { rate } = yearlyCellRate(
				cell,
				props.data.meta.yearlyCruisesByIsland,
				yr
			);
			if (rate !== null && rate > 0) rates.push(rate);
		}
	}
	rates.sort((a, b) => a - b);
	return Math.max(0.2, d3.quantile(rates, 0.95) ?? 1);
});

const colorScale = computed(() =>
	d3
		.scaleSequential(d3.interpolateRgb(...CHART_SEQUENTIAL_TEAL))
		.domain([0, colorDomainMax.value])
		.clamp(true)
);

const yearSummary = computed(() => {
	const yr = String(selectedYear.value);
	const cruises = props.data.meta.yearlyCruises[yr] ?? 0;
	const activeCells = props.data.gridCells.filter(
		(c) => cellCruisesForYear(c.id, selectedYear.value) > 0
	).length;
	return `${cruises.toLocaleString()} cruises · ${activeCells} active cells`;
});

let base: {
	cellPath: ReturnType<typeof drawBaseMap>["cellPath"];
	insertDataLayer: ReturnType<typeof drawBaseMap>["insertDataLayer"];
	hatchUrl: string;
} | null = null;
let dataLayer: d3.Selection<SVGGElement, unknown, null, undefined> | null =
	null;

function tooltipHtml(cell: MonicetGridCell, yr: number): string {
	const island = cell.reachableIslands.join(" + ") || "No island";
	const coords = formatCellLabel(cell, { degrees: true });
	const cellCruises = cellCruisesForYear(cell.id, yr);
	const { encounters, rate } = yearlyCellRate(
		cell,
		props.data.meta.yearlyCruisesByIsland,
		yr
	);

	const metricBlock =
		cellCruises === 0
			? `
				<div class="tip-primary">No cruises recorded</div>
				<div class="tip-sub">0 cruises · 0 encounters in ${yr}</div>
			`
			: `
				<div class="tip-primary">${formatRate(rate)}</div>
				<div class="tip-sub">${cellCruises.toLocaleString()} ${cellCruises === 1 ? "cruise" : "cruises"} to cell · ${encounters.toLocaleString()} encounters</div>
			`;

	return `
		<div class="tip-group">${metricBlock}</div>
		<div class="tip-group tip-place">
			<div class="tip-island">${island}</div>
			<div class="tip-sub">${coords}</div>
		</div>
	`;
}

function clearHover() {
	hoveredCellId.value = null;
	hideTooltip(tooltipRef.value);
}

function showFocusTooltip(
	el: SVGPathElement,
	cell: MonicetGridCell,
	yr: number
) {
	if (!tooltipRef.value || !mapShellRef.value) return;
	const cellRect = el.getBoundingClientRect();
	const syntheticEvent = {
		clientX: cellRect.left + cellRect.width / 2,
		clientY: cellRect.top + cellRect.height / 2,
	} as MouseEvent;
	showTooltip(
		tooltipRef.value,
		mapShellRef.value,
		syntheticEvent,
		tooltipHtml(cell, yr)
	);
}

function updateHighlight() {
	if (!dataLayer) return;
	const id = hoveredCellId.value;
	dataLayer
		.selectAll<SVGPathElement, MonicetGridCell>("path.yr-cell")
		.attr("stroke", (d) =>
			d.id === id ? CHART_TEXT_PRIMARY : "rgba(26,26,26,0.2)"
		)
		.attr("stroke-width", (d) => (d.id === id ? 2 : 0.5))
		.filter((d) => d.id === id)
		.raise();
}

function renderDataLayer() {
	if (!base) return;
	clearHover();
	dataLayer?.remove();
	dataLayer = base.insertDataLayer();

	const scale = colorScale.value;
	const yr = selectedYear.value;

	const fillForCell = (d: MonicetGridCell) => {
		const hatch = base?.hatchUrl ?? "none";
		if (cellCruisesForYear(d.id, yr) === 0) return hatch;
		const { rate } = yearlyCellRate(
			d,
			props.data.meta.yearlyCruisesByIsland,
			yr
		);
		return rate !== null && rate > 0 ? scale(rate) : hatch;
	};

	dataLayer
		.selectAll<SVGPathElement, MonicetGridCell>("path.yr-cell")
		.data(props.data.gridCells)
		.join("path")
		.attr("class", "yr-cell")
		.attr("d", base.cellPath)
		.attr("fill", fillForCell)
		.attr("fill-opacity", 0.9)
		.attr("stroke", "rgba(26,26,26,0.2)")
		.attr("stroke-width", 0.5)
		.attr("tabindex", 0)
		.attr("aria-label", (d) => {
			const cellCruises = cellCruisesForYear(d.id, yr);
			if (cellCruises === 0) {
				return `${formatCellLabel(d)}: no cruises recorded in ${yr}`;
			}
			const { encounters, rate } = yearlyCellRate(
				d,
				props.data.meta.yearlyCruisesByIsland,
				yr
			);
			return `${formatCellLabel(d)}: ${cellCruises} cruises in cell, ${encounters} encounters (${formatRate(rate)})`;
		})
		.style("cursor", "pointer")
		.on("mousemove", (event: MouseEvent, d) => {
			hoveredCellId.value = d.id;
			if (!tooltipRef.value || !mapShellRef.value) return;
			showTooltip(
				tooltipRef.value,
				mapShellRef.value,
				event,
				tooltipHtml(d, yr)
			);
		})
		.on("focus", function (_event, d) {
			hoveredCellId.value = d.id;
			showFocusTooltip(this, d, yr);
		})
		.on("mouseleave blur", clearHover);

	updateHighlight();
}

function renderLegend() {
	if (!legendRef.value) return;
	const max = colorDomainMax.value;
	const scale = colorScale.value;
	renderGradientLegend(
		legendRef.value,
		`yearly-legend-${uid}`,
		(t) => scale(t * max),
		{
			left: "0",
			center: (max / 2).toFixed(2),
			right: `${max.toFixed(2)}+`,
		}
	);
}

function renderMap() {
	if (!mapRef.value) return;
	const { svg, cellPath, raiseLines, insertDataLayer, drawIslandLabels } =
		drawBaseMap(mapRef.value, props.basemap, {
			theme: WIREFRAME_THEME,
			fallbackWidth: 880,
			minHeight: 360,
			aspect: 0.52,
			lines: props.lines,
		});

	raiseLines();
	drawIslandLabels();

	base = {
		cellPath,
		insertDataLayer,
		hatchUrl: addNoValuePattern(
			svg,
			CHART_NO_VALUE_HATCH,
			`yearly-hatch-${uid}`
		),
	};
	renderDataLayer();
	renderLegend();
}

function renderPreview() {
	const container = previewRef.value;
	if (!container) return;

	d3.select(container).selectAll("*").remove();

	const yrs = years.value;
	const width = container.clientWidth || 340;
	const height = 88;
	const padY = 6;
	const innerH = height - padY * 2;

	const svg = d3
		.select(container)
		.append("svg")
		.attr("viewBox", `0 0 ${width} ${height}`)
		.style("width", "100%")
		.style("height", `${height}px`)
		.style("display", "block");

	const xBand = d3
		.scaleBand<number>()
		.domain(yrs)
		.range([0, width])
		.padding(0.24);
	const xCenter = (yr: number) => (xBand(yr) ?? 0) + xBand.bandwidth() / 2;

	const maxCruises = d3.max(previewCruiseRows.value, (d) => d.total) ?? 1400;
	const yCruises = d3
		.scaleLinear()
		.domain([0, maxCruises])
		.range([height - padY, padY]);

	const allRates = previewRateSeries.value.flatMap((s) =>
		s.points.map((p) => p.rate).filter((r): r is number => r !== null)
	);
	const maxRate = Math.max(1, d3.max(allRates) ?? 5);
	const yRate = d3
		.scaleLinear()
		.domain([0, maxRate])
		.range([height - padY, padY]);

	const activeYear = selectedYear.value;

	// Background stacked cruise bars: low alpha by default, saturated on active year
	const stack = d3.stack<YearCruiseRow, IslandGroup>().keys(ISLAND_ORDER);
	const stacked = stack(previewCruiseRows.value);

	svg.append("g")
		.selectAll("g")
		.data(stacked)
		.join("g")
		.attr("fill", (d) => CHART_ISLAND_GROUP[d.key])
		.selectAll("rect")
		.data((d) => d)
		.join("rect")
		.attr("x", (d) => xBand(d.data.year) ?? 0)
		.attr("y", (d) => yCruises(d[1]))
		.attr("width", xBand.bandwidth())
		.attr("height", (d) => Math.max(0, yCruises(d[0]) - yCruises(d[1])))
		.attr("fill-opacity", (d) =>
			d.data.year === activeYear ? 0.55 : 0.12
		);

	// Lines: muted alpha across all years, plus full saturation clipped to active year
	const lineGen = d3
		.line<YearlyIslandPoint>()
		.defined((d) => d.rate !== null)
		.x((d) => xCenter(d.year))
		.y((d) => yRate(d.rate ?? 0));

	const clipId = `preview-active-clip-${uid}`;
	const activeX = xBand(activeYear);
	if (activeX !== undefined) {
		svg.append("defs")
			.append("clipPath")
			.attr("id", clipId)
			.append("rect")
			.attr("x", Math.max(0, activeX - xBand.step() * 0.35))
			.attr("y", 0)
			.attr("width", xBand.bandwidth() + xBand.step() * 0.7)
			.attr("height", height);
	}

	const mutedLines = svg.append("g").attr("opacity", 0.25);
	const activeLines = svg
		.append("g")
		.attr("clip-path", activeX !== undefined ? `url(#${clipId})` : null);

	for (const s of previewRateSeries.value) {
		const color = CHART_ISLAND_GROUP[s.island];

		mutedLines
			.append("path")
			.datum(s.points)
			.attr("fill", "none")
			.attr("stroke", color)
			.attr("stroke-width", 1.5)
			.attr("stroke-linejoin", "round")
			.attr("stroke-linecap", "round")
			.attr("d", lineGen);

		activeLines
			.append("path")
			.datum(s.points)
			.attr("fill", "none")
			.attr("stroke", color)
			.attr("stroke-width", 2.2)
			.attr("stroke-linejoin", "round")
			.attr("stroke-linecap", "round")
			.attr("d", lineGen);

		const activePt = s.points.find(
			(p) => p.year === activeYear && p.rate !== null
		);
		if (activePt && activePt.rate !== null) {
			svg.append("circle")
				.attr("cx", xCenter(activePt.year))
				.attr("cy", yRate(activePt.rate))
				.attr("r", 3)
				.attr("fill", color)
				.attr("stroke", "#ffffff")
				.attr("stroke-width", 1);
		}
	}

	// Click any year column in the preview to jump directly to that year
	svg.append("g")
		.selectAll("rect")
		.data(yrs)
		.join("rect")
		.attr("x", (yr) => xBand(yr) ?? 0)
		.attr("y", 0)
		.attr("width", xBand.bandwidth())
		.attr("height", innerH + padY * 2)
		.attr("fill", "transparent")
		.style("cursor", "pointer")
		.on("click", (_event, yr) => {
			stopPlay();
			selectedYear.value = yr;
		});
}

function handleResize() {
	renderMap();
	renderPreview();
}

onMounted(async () => {
	await nextTick();
	renderMap();
	renderPreview();
	window.addEventListener("resize", handleResize);
});

onBeforeUnmount(() => {
	stopPlay();
	window.removeEventListener("resize", handleResize);
});

watch(selectedYear, (yr) => {
	emit("update:year", yr);
	renderDataLayer();
	renderPreview();
});
watch(
	() => props.showPreview,
	async (show) => {
		if (show) {
			await nextTick();
			renderPreview();
		}
	}
);
watch(hoveredCellId, updateHighlight);
watch(
	() => [props.data, props.basemap, props.lines],
	() => {
		renderMap();
		renderPreview();
	}
);
</script>

<style scoped lang="scss">
.yearly-map {
	display: flex;
	flex-direction: column;
	gap: 0.75rem;
}

.controls-bar {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	justify-content: space-between;
	gap: 0.5rem 1rem;
}

.year-slider-wrap {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 0.5rem 0.9rem;
	flex: 1;
	min-width: 240px;
}

.play-btn {
	width: 34px;
	height: 34px;
	padding: 0;
	border-radius: 999px;
	border: 1px solid $border;
	background: $surface;
	color: $text-primary;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
	cursor: pointer;
	transition:
		border-color $transition-fast,
		background-color $transition-fast,
		color $transition-fast;

	&:hover {
		border-color: $primary;
		color: $primary;
	}

	&:focus-visible {
		outline: 2px solid $primary;
		outline-offset: 2px;
	}

	&[aria-pressed="true"] {
		background: $primary;
		border-color: $primary;
		color: $text-on-primary;
	}
}

.play-icon {
	display: block;
}

.year-label {
	display: inline-flex;
	align-items: baseline;
	gap: 0.45rem;
	font-size: 0.84rem;
	color: $text-secondary;
}

.year-value {
	font-size: 1.05rem;
	font-weight: 700;
	color: $text-primary;
	font-variant-numeric: tabular-nums;
}

.slider-track-wrap {
	display: flex;
	align-items: center;
	gap: 0.55rem;
	flex: 1;
	max-width: 340px;
}

.year-bound {
	font-size: 0.78rem;
	color: $text-secondary;
	font-variant-numeric: tabular-nums;
}

.year-slider {
	flex: 1;
	min-height: 28px;
	accent-color: $primary;
	cursor: pointer;

	&:focus-visible {
		outline: 2px solid $primary;
		outline-offset: 2px;
	}
}

.year-summary {
	font-size: 0.82rem;
	color: $text-secondary;
	font-variant-numeric: tabular-nums;
}

.map-frame {
	background: $surface;
	border: 1px solid $border;
	border-radius: $radius-md;
	overflow: hidden;
}

.map-shell {
	position: relative;
}

.preview-card {
	position: absolute;
	top: 0.75rem;
	left: 50%;
	transform: translateX(-50%);
	z-index: 3;
	width: min(360px, calc(100% - 1.5rem));
	padding: 0.45rem 0.65rem;
	background: rgba($surface, 0.94);
	border: 1px solid $border;
	border-radius: $radius-md;
	box-shadow: $shadow-sm;

	&.is-hidden {
		opacity: 0;
		pointer-events: none;
	}
}

.effort-preview {
	width: 100%;
}

@media (max-width: 680px) {
	.preview-card {
		position: static;
		transform: none;
		margin: 0.75rem auto 0;
	}
}

.map-canvas {
	line-height: 0;
}

.tooltip {
	position: absolute;
	top: 0;
	left: 0;
	pointer-events: none;
	opacity: 0;
	background: rgba($text-primary, 0.94);
	color: $text-on-primary;
	padding: 0.5rem 0.7rem;
	border-radius: $radius-sm;
	font-size: 0.78rem;
	line-height: 1.45;
	white-space: nowrap;
	transition: opacity 0.1s ease;
	z-index: 4;
}

:deep(.tip-primary) {
	font-size: 0.88rem;
	font-weight: 700;
	line-height: 1.3;
}

:deep(.tip-island) {
	font-size: 0.8rem;
	font-weight: 600;
	line-height: 1.3;
}

:deep(.tip-sub) {
	font-size: 0.72rem;
	color: rgba(255, 255, 255, 0.78);
	line-height: 1.35;
}

:deep(.tip-place) {
	margin-top: 0.4rem;
	padding-top: 0.35rem;
	border-top: 1px solid rgba(255, 255, 255, 0.16);
}

.legend-row {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	justify-content: space-between;
	gap: 0.5rem 1.25rem;
	padding: 0.6rem 0.9rem;
	border-top: 1px solid $border;
}

.legend-block {
	display: flex;
	flex-direction: column;
	gap: 0.15rem;
}

.legend-title {
	font-size: 0.78rem;
	font-weight: 600;
	color: $text-secondary;
}

.legend-svg :deep(.legend-label) {
	fill: $text-secondary;
	font-size: 12px;
	font-family: "Space Grotesk", sans-serif;
}
</style>
