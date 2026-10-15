<template>
	<div class="monicet-explorer">
		<div class="toolbar">
			<ModeSwitch
				v-if="modeOptions.length > 1"
				v-model="mode"
				:options="modeOptions"
				label="Insight modes"
			/>

			<div class="controls-row">
				<div class="control" v-if="mode === 'species'">
					<label for="species-select">Species</label>
					<select id="species-select" v-model="selectedSpeciesId">
						<option
							v-for="species in speciesList"
							:key="species.id"
							:value="species.id"
						>
							{{ species.label }}
						</option>
					</select>
				</div>

				<div class="control" v-if="mode === 'seasonality'">
					<label for="month-select">Month</label>
					<select id="month-select" v-model.number="selectedMonth">
						<option
							v-for="month in monthOptions"
							:key="month.value"
							:value="month.value"
						>
							{{ month.label }}
						</option>
					</select>
				</div>

				<label class="checkbox" v-if="mode === 'decline'">
					<input type="checkbox" v-model="reliableOnly" />
					<span>Show only reliable cells</span>
				</label>
			</div>

			<div class="controls-row">
				<ModeSwitch
					v-model="basemapId"
					:options="basemapOptions"
					label="Basemap"
					variant="compact"
				/>
				<label class="checkbox">
					<input type="checkbox" v-model="showDataLayer" />
					<span>Show data layer</span>
				</label>
				<label class="checkbox" v-if="showDataLayer">
					<span>Layer opacity</span>
					<input
						type="range"
						min="0.2"
						max="1"
						step="0.05"
						v-model.number="dataLayerOpacity"
					/>
				</label>
			</div>
		</div>

		<div v-if="loading" class="status">Preparing MONICET map...</div>
		<div v-else-if="error" class="status error">{{ error }}</div>

		<div v-else class="layout">
			<div class="map-shell">
				<div ref="mapContainer" class="map-container"></div>
				<div v-if="attribution.length" class="attribution">
					<template
						v-for="(credit, i) in attribution"
						:key="credit.href"
					>
						<span v-if="i > 0"> · </span>
						<a :href="credit.href" target="_blank" rel="noopener">{{
							credit.text
						}}</a>
					</template>
				</div>
				<div v-show="showDataLayer" class="legend-shell">
					<div class="legend-title">{{ copy.legendTitle }}</div>
					<div ref="legendContainer" class="legend-container"></div>
				</div>
				<div ref="tooltipRef" class="tooltip"></div>
			</div>

			<aside class="insight-panel">
				<h3>{{ copy.panelTitle }}</h3>
				<p>{{ copy.panelIntro }}</p>

				<div v-if="mode === 'decline'" class="insight-block">
					<div class="metric-row">
						<span>Reliable cells</span>
						<strong>{{ reliableCellCount }}</strong>
					</div>
					<div class="metric-row">
						<span>Average change</span>
						<strong>{{ averageDeclineLabel }}</strong>
					</div>

					<h4>Strongest declines</h4>
					<ul class="insight-list">
						<li v-for="cell in topDeclines" :key="cell.id">
							<div>{{ cell.label }}</div>
							<strong>{{ cell.change }}</strong>
						</li>
					</ul>
				</div>

				<div v-else-if="mode === 'species'" class="insight-block">
					<div class="metric-row">
						<span>Selected species</span>
						<strong>{{
							selectedSpecies?.commonName ?? "n/a"
						}}</strong>
					</div>
					<div class="metric-row">
						<span>Total encounters</span>
						<strong>{{
							selectedSpecies?.totalEncounters.toLocaleString() ??
							"0"
						}}</strong>
					</div>

					<h4>Hotspots</h4>
					<ul class="insight-list">
						<li v-for="hotspot in hotspots" :key="hotspot.id">
							<div>{{ hotspot.label }}</div>
							<strong>{{ hotspot.count }} encounters</strong>
						</li>
					</ul>
				</div>

				<div v-else-if="mode === 'boats'" class="insight-block">
					<div class="metric-row">
						<span>Cruises in the archive</span>
						<strong>{{
							mapData?.meta.totalCruiseEvents.toLocaleString()
						}}</strong>
					</div>
					<div class="metric-row">
						<span>Cells reached</span>
						<strong>{{
							mapData?.cruiseCells?.length ?? "n/a"
						}}</strong>
					</div>
					<div class="metric-row">
						<span>Cruises with no position at sea</span>
						<strong>{{
							mapData?.meta.cruisesWithoutPositionsAtSea ?? "n/a"
						}}</strong>
					</div>

					<h4>Most visited</h4>
					<ul class="insight-list">
						<li v-for="cell in busiestCruiseCells" :key="cell.id">
							<div>{{ cell.label }}</div>
							<strong>{{ cell.cruises }}</strong>
						</li>
					</ul>
				</div>

				<div v-else class="insight-block">
					<div class="metric-row">
						<span>Best month overall</span>
						<strong>{{ bestMonthLabel }}</strong>
					</div>
					<div class="metric-row">
						<span>Rate in selected month</span>
						<strong>{{
							formatRate(selectedMonthSummary?.rate ?? null)
						}}</strong>
					</div>

					<h4>What to expect in {{ selectedMonthSummary?.label }}</h4>
					<ul class="insight-list">
						<li
							v-for="entry in selectedMonthSummary?.topSpecies ??
							[]"
							:key="entry.speciesId"
						>
							<div>{{ entry.commonName }}</div>
							<strong>{{ toPercent(entry.share) }}</strong>
						</li>
					</ul>
				</div>

				<div class="caveat">
					{{
						mode === "boats"
							? "Positions are only logged at sightings. A boat that searched an area and found nothing leaves no trace there, so this is where boats stopped for animals, not every place they looked."
							: mapData?.meta.caveats[0]
					}}
				</div>
			</aside>
		</div>
	</div>
</template>

<script setup lang="ts">
// Grid-cell map with switchable insight modes, basemaps and a toggleable
// data layer. Formerly D1, "Honest Instability". Each page picks its modes:
// - The External: species, seasonality, boats ("where do boats go?")
// - Filling the Gaps: decline (encounter-rate change, reliability as
//   opacity), the dataset to interpolate
// Fork it into the direction's folder once a page needs more than modes.
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

import ModeSwitch from "@/components/shared-ui/ModeSwitch.vue";
import {
	averageDecline,
	findMonth,
	findSpecies,
	indexCells,
	speciesHotspots,
	speciesOptions,
	topCruiseCells,
	topDecliningCells,
} from "@/data/selectors";
import { useMonicetData } from "@/data/useMonicetData";
import {
	CHART_DIVERGING_NEGATIVE,
	CHART_DIVERGING_NEUTRAL,
	CHART_DIVERGING_POSITIVE,
	CHART_SEQUENTIAL_TEAL,
	CHART_TEXT_SECONDARY,
} from "@/lib/chartTokens";
import {
	formatCellLabel,
	formatRate,
	formatSignedPercent,
	MONTH_NAMES,
	toPercent,
} from "@/lib/format";
import { renderGradientLegend } from "@/lib/legend";
import { BASEMAPS, drawBaseMap, type BasemapId } from "@/lib/map";
import { hideTooltip, showTooltip } from "@/lib/tooltip";
import type {
	MonicetCruiseCell,
	MonicetGridCell,
	MonicetInsightMode,
} from "@/types/monicet";

const { mapData, basemap, mapLines, error, load, loadMapLines } =
	useMonicetData();
const loading = ref(true);

const props = defineProps<{
	/** Modes this instance offers, in order; the first is the default. */
	modes: MonicetInsightMode[];
}>();

const mode = ref<MonicetInsightMode>(props.modes[0]);

// SVG ids (blur filter, legend gradient) are document-wide; prefix them per
// instance so two explorers on one page don't use each other's defs.
const svgIdPrefix = `cme${useId()}`;
const selectedSpeciesId = ref("");
const selectedMonth = ref(6);
const reliableOnly = ref(true);

// Basemap pilot: tiles under the D3 cells, switchable, with the cells as a
// toggleable layer. No zoom yet (docs/basemaps.md).
const basemapId = ref<BasemapId>("basic");
const showDataLayer = ref(true);
// Whole-layer opacity, so the basemap shows through. Per-cell opacity still
// encodes reliability on top of this.
const dataLayerOpacity = ref(0.65);
const basemapOptions = (Object.keys(BASEMAPS) as BasemapId[]).map((id) => ({
	value: id,
	label: BASEMAPS[id].label,
}));
const attribution = computed(
	() => BASEMAPS[basemapId.value].tiles?.attribution ?? []
);

const mapContainer = ref<HTMLElement | null>(null);
const legendContainer = ref<HTMLElement | null>(null);
const tooltipRef = ref<HTMLElement | null>(null);

const MODE_LABELS: Record<MonicetInsightMode, string> = {
	decline: "Where Sightings Decline",
	species: "Species By Location",
	seasonality: "Best Time Of Year",
	boats: "Where Do Boats Go?",
};
const modeOptions = props.modes.map((value) => ({
	value,
	label: MODE_LABELS[value],
}));

const monthOptions = MONTH_NAMES.map((label, i) => ({ value: i + 1, label }));

const MODE_COPY: Record<
	MonicetInsightMode,
	{ panelTitle: string; panelIntro: string; legendTitle: string }
> = {
	decline: {
		panelTitle: "Decline Insight",
		panelIntro:
			"Cells are colored by change in encounter rate between early and late years. Negative values suggest fewer sightings per cruise in recent years.",
		legendTitle: "Encounter-rate change (%)",
	},
	species: {
		panelTitle: "Species Distribution Insight",
		panelIntro:
			"Select a species to reveal where encounters concentrate. Darker cells indicate areas where this species appears more frequently.",
		legendTitle: "Encounters in selected species",
	},
	seasonality: {
		panelTitle: "Seasonality Insight",
		panelIntro:
			"Select a month to explore where encounters concentrate and which species dominate sightings during that period.",
		legendTitle: "Encounters in selected month",
	},
	boats: {
		panelTitle: "Where Do Boats Go?",
		panelIntro:
			"Cells are colored by how many cruises logged a position there. A cruise counts once per cell, however many sightings it had in it. The scale is logarithmic: the busiest cell has thousands of cruises, most have a few dozen.",
		legendTitle: "Cruises that reached the cell (log scale)",
	},
};

const copy = computed(() => MODE_COPY[mode.value]);

// ─── Derived data ────────────────────────────────────────────────────────────

const cells = computed(() => mapData.value?.gridCells ?? []);
const cellLookup = computed(() => indexCells(cells.value));

const speciesList = computed(() =>
	mapData.value ? speciesOptions(mapData.value) : []
);

const selectedSpecies = computed(() =>
	mapData.value ? findSpecies(mapData.value, selectedSpeciesId.value) : null
);

const selectedMonthSummary = computed(() =>
	mapData.value ? findMonth(mapData.value, selectedMonth.value) : null
);

const reliableCellCount = computed(
	() => cells.value.filter((cell) => cell.isReliable).length
);

const averageDeclineLabel = computed(() =>
	formatSignedPercent(averageDecline(cells.value))
);

const topDeclines = computed(() =>
	topDecliningCells(cells.value).map((cell) => ({
		id: cell.id,
		label: formatCellLabel(cell),
		change: formatSignedPercent(cell.declinePct),
	}))
);

const hotspots = computed(() => {
	if (!selectedSpecies.value) return [];
	return speciesHotspots(selectedSpecies.value).map(([cellId, count]) => {
		const cell = cellLookup.value.get(cellId);
		return {
			id: cellId,
			label: cell ? formatCellLabel(cell) : cellId,
			count,
		};
	});
});

const busiestCruiseCells = computed(() =>
	topCruiseCells(mapData.value?.cruiseCells ?? []).map((cell) => ({
		id: cell.id,
		label: formatCellLabel(cell),
		cruises: `${cell.cruises.toLocaleString()} (${toPercent(cell.share)})`,
	}))
);

const bestMonthLabel = computed(() => {
	const best = mapData.value?.meta.bestMonthOverall;
	if (!best) return "n/a";
	return `${best.label} (${formatRate(best.rate)})`;
});

// ─── Tooltip ─────────────────────────────────────────────────────────────────

function onCellHover(
	event: MouseEvent,
	cell: MonicetGridCell,
	value: number | null
) {
	if (!tooltipRef.value || !mapContainer.value || !mapData.value) return;

	let valueLabel = "";
	if (mode.value === "decline") {
		valueLabel = `Change: ${formatSignedPercent(value)}`;
	} else if (mode.value === "species") {
		valueLabel = `Encounters: ${(value ?? 0).toLocaleString()}`;
	} else {
		valueLabel = `${selectedMonthSummary.value?.label ?? "Month"}: ${(value ?? 0).toLocaleString()} encounters`;
	}

	// topSpecies counts all months; in seasonality mode it sits right under
	// the selected month's count, so say so.
	const topSpeciesLabel =
		mode.value === "seasonality" ? "Top species (all year)" : "Top species";
	const topSpecies = cell.topSpecies
		.map((entry) => `${entry.commonName} (${entry.count})`)
		.slice(0, 2)
		.join(" | ");

	showTooltip(
		tooltipRef.value,
		mapContainer.value,
		event,
		`
		<div class="tip-title">${formatCellLabel(cell)}</div>
		<div class="tip-line">${valueLabel}</div>
		<div class="tip-line">Total encounters: ${cell.encounterCount.toLocaleString()}</div>
		<div class="tip-line">${topSpeciesLabel}: ${topSpecies || "n/a"}</div>
	`
	);
}

function onCruiseCellHover(event: MouseEvent, cell: MonicetCruiseCell) {
	if (!tooltipRef.value || !mapContainer.value) return;
	const islands = Object.entries(cell.cruisesByIsland)
		.filter(([, n]) => n > 0)
		.map(([island, n]) => `${island}: ${n.toLocaleString()}`)
		.join(" | ");
	showTooltip(
		tooltipRef.value,
		mapContainer.value,
		event,
		`
		<div class="tip-title">${formatCellLabel(cell)}</div>
		<div class="tip-line">${cell.cruises.toLocaleString()} cruises (${toPercent(cell.share)} of all)</div>
		<div class="tip-line">From: ${islands}</div>
	`
	);
}

// ─── Color encodings per mode ────────────────────────────────────────────────

interface Encoding {
	value: (cell: MonicetGridCell) => number | null;
	color: (value: number | null) => string;
}

/** Sequential teal encoding for count-like values (species / month). */
function countEncoding(
	visibleCells: MonicetGridCell[],
	value: (cell: MonicetGridCell) => number
): Encoding {
	const maxValue = Math.max(1, d3.max(visibleCells.map(value)) ?? 1);
	const scale = d3
		.scaleSequential(d3.interpolateRgb(...CHART_SEQUENTIAL_TEAL))
		.domain([0, maxValue]);

	if (legendContainer.value) {
		renderGradientLegend(
			legendContainer.value,
			`${svgIdPrefix}-legend-${mode.value}`,
			(t) => scale(t * maxValue),
			{
				left: "0",
				center: `${Math.round(maxValue / 2)}`,
				right: `${maxValue}`,
			}
		);
	}

	return {
		value,
		color: (v) => (v === null || v <= 0 ? "#ecf0f2" : scale(v)),
	};
}

/** Diverging red–gray–teal encoding for declinePct. */
function declineEncoding(visibleCells: MonicetGridCell[]): Encoding {
	const values = visibleCells
		.map((cell) => cell.declinePct)
		.filter((v): v is number => v !== null && Number.isFinite(v));
	const maxAbs = Math.max(5, d3.max(values.map(Math.abs)) ?? 5);

	// RdYlGn fails CVD separation and puts a hue (yellow) at the midpoint;
	// this is brand red vs. a re-stepped brand teal through neutral gray.
	// See src/lib/chartTokens.ts for the validated ΔE numbers.
	const scale = d3
		.scaleDiverging(
			d3.piecewise(d3.interpolateRgb, [
				CHART_DIVERGING_NEGATIVE,
				CHART_DIVERGING_NEUTRAL,
				CHART_DIVERGING_POSITIVE,
			])
		)
		.domain([-maxAbs, 0, maxAbs]);

	if (legendContainer.value) {
		renderGradientLegend(
			legendContainer.value,
			`${svgIdPrefix}-legend-${mode.value}`,
			(t) => scale(-maxAbs + t * maxAbs * 2),
			{
				left: `-${maxAbs.toFixed(0)}%`,
				center: "0%",
				right: `+${maxAbs.toFixed(0)}%`,
			}
		);
	}

	return {
		value: (cell) => cell.declinePct,
		color: (v) => (v === null ? CHART_DIVERGING_NEUTRAL : scale(v)),
	};
}

// ─── Render ──────────────────────────────────────────────────────────────────

let dataLayer: d3.Selection<SVGGElement, unknown, null, undefined> | null =
	null;

function applyDataLayerVisibility() {
	dataLayer
		?.attr("display", showDataLayer.value ? null : "none")
		.attr("opacity", dataLayerOpacity.value);
}

// Soft edges for the 0.2° cells: a Gaussian blur over the rendered layer.
// This is purely visual: values are not interpolated. Colour does bleed
// about half a cell into neighbours, which is why unreliable cells are
// drawn outside the blur (see renderMap).
// (Real spatial smoothing — kernel density, kriging — would estimate values
// between cells; that is a gap-filling question for Filling the Gaps.)
// The blur radius is a quarter of a cell's on-screen width, so the look
// stays the same at any map size.
function addSoftEdgeFilter(
	svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
	cellWidthPx: number
) {
	svg.append("defs")
		.append("filter")
		.attr("id", `${svgIdPrefix}-soft-cells`)
		.attr("x", "-10%")
		.attr("y", "-10%")
		.attr("width", "120%")
		.attr("height", "120%")
		.append("feGaussianBlur")
		.attr("stdDeviation", Math.max(1, cellWidthPx / 4));
	return `url(#${svgIdPrefix}-soft-cells)`;
}

/**
 * "Where do boats go?": cruises per cell on a log scale. Linear would show
 * the three harbour-side cells off São Miguel (2,000–2,900 cruises each)
 * and leave every other cell near-white; log keeps the 1–50 range readable.
 */
function drawCruiseCells(
	layer: d3.Selection<SVGGElement, unknown, null, undefined>,
	cellPath: (cell: Pick<MonicetCruiseCell, "polygon">) => string
) {
	const cruiseCells = mapData.value?.cruiseCells ?? [];
	const max = Math.max(2, d3.max(cruiseCells, (c) => c.cruises) ?? 2);
	const scale = d3
		.scaleSequentialLog(d3.interpolateRgb(...CHART_SEQUENTIAL_TEAL))
		.domain([1, max]);

	if (legendContainer.value) {
		renderGradientLegend(
			legendContainer.value,
			`${svgIdPrefix}-legend-boats`,
			(t) => scale(Math.pow(max, t)),
			{
				left: "1",
				center: `${Math.round(Math.sqrt(max))}`,
				right: max.toLocaleString(),
			}
		);
	}

	layer
		.selectAll("path")
		.data(cruiseCells)
		.join("path")
		.attr("d", cellPath)
		.attr("fill", (cell) => scale(cell.cruises))
		.on("mousemove", (event: MouseEvent, cell) =>
			onCruiseCellHover(event, cell)
		)
		.on("mouseleave", () => hideTooltip(tooltipRef.value));
}

function renderMap() {
	if (!mapContainer.value || !mapData.value || !basemap.value) return;

	hideTooltip(tooltipRef.value);
	const { theme, tiles } = BASEMAPS[basemapId.value];
	const {
		svg,
		mapGroup,
		cellPath,
		cellWidthPx,
		raiseLines,
		drawIslandLabels,
	} = drawBaseMap(mapContainer.value, basemap.value, {
		theme,
		tiles,
		lines: mapLines.value,
		fallbackWidth: 960,
		minHeight: 420,
		aspect: 0.62,
	});

	// With "reliable only" on, unreliable cells are hidden entirely. With it
	// off, they are drawn faint so the uncertainty stays visible.
	const showUncertainty = mode.value === "decline" && !reliableOnly.value;
	const visibleCells = mapData.value.gridCells.filter(
		(cell) =>
			mode.value !== "decline" || !reliableOnly.value || cell.isReliable
	);
	const isFaint = (cell: MonicetGridCell) =>
		showUncertainty && !cell.isReliable;

	const encoding =
		mode.value === "decline"
			? declineEncoding(visibleCells)
			: mode.value === "species"
				? countEncoding(
						visibleCells,
						(cell) =>
							cell.speciesCounts[selectedSpeciesId.value] ?? 0
					)
				: countEncoding(
						visibleCells,
						(cell) =>
							cell.monthlyEncounters[selectedMonth.value - 1] ?? 0
					);

	// dataLayer carries visibility and layer opacity. Inside it, reliable
	// cells are blurred; unreliable ones sit on top unblurred with a dashed
	// outline, so their uncertainty isn't washed out by neighbours' colour.
	dataLayer = mapGroup.append("g");
	applyDataLayerVisibility();
	const softCells = dataLayer
		.append("g")
		.attr("filter", addSoftEdgeFilter(svg, cellWidthPx));
	const faintCells = dataLayer.append("g");

	if (mode.value === "boats") {
		drawCruiseCells(softCells, cellPath);
		raiseLines();
		drawIslandLabels();
		return;
	}

	const drawCells = (
		group: d3.Selection<SVGGElement, unknown, null, undefined>,
		cells: MonicetGridCell[]
	) =>
		group
			.selectAll("path")
			.data(cells)
			.join("path")
			.attr("d", cellPath)
			.attr("fill", (cell) => encoding.color(encoding.value(cell)))
			.on("mousemove", (event: MouseEvent, cell) =>
				onCellHover(event, cell, encoding.value(cell))
			)
			.on("mouseleave", () => hideTooltip(tooltipRef.value));

	drawCells(
		softCells,
		visibleCells.filter((cell) => !isFaint(cell))
	);
	drawCells(faintCells, visibleCells.filter(isFaint))
		.attr("fill-opacity", 0.3)
		.attr("stroke", CHART_TEXT_SECONDARY)
		.attr("stroke-width", 0.8)
		.attr("stroke-dasharray", "3,2");

	// Wireframe: coastlines on top of the cells, so the map
	// stays readable through the data.
	raiseLines();
	drawIslandLabels();
}

// ─── Lifecycle ───────────────────────────────────────────────────────────────

// The component can unmount while load() is still pending (e.g. a quick
// click on "← MONICET"); onBeforeUnmount has then already run, so nothing
// may be set up after an await once this is true.
let unmounted = false;

onMounted(async () => {
	await load();
	if (unmounted) return;
	// Coastlines (4 KB): drawn by the wireframe and, on tiled basemaps, as
	// the fallback under the tiles. Not awaited; redraw once they arrive.
	void loadMapLines().then(() => {
		if (!unmounted && !loading.value) renderMap();
	});
	loading.value = false;

	if (mapData.value) {
		selectedSpeciesId.value =
			mapData.value.speciesSummaries[0]?.speciesId ?? "";
		selectedMonth.value = mapData.value.meta.bestMonthOverall?.month ?? 6;
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

watch([mode, selectedSpeciesId, selectedMonth, reliableOnly, basemapId], () => {
	if (loading.value) return;
	renderMap();
});

watch(dataLayerOpacity, applyDataLayerVisibility);

// Toggling the data layer only hides it: no redraw, so tiles don't reload.
watch(showDataLayer, () => {
	hideTooltip(tooltipRef.value);
	applyDataLayerVisibility();
});
</script>

<style scoped lang="scss">
.monicet-explorer {
	position: relative;
	padding: 1.2rem;
	border: 1px solid rgba($primary, 0.22);
	background:
		radial-gradient(
			circle at 15% 10%,
			rgba($secondary, 0.12),
			transparent 36%
		),
		radial-gradient(
			circle at 90% 0%,
			rgba($primary, 0.18),
			transparent 32%
		),
		linear-gradient(150deg, #f9f5ee, #f2f7f4 55%, #f8f3e8);
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
	gap: 1rem;
	align-items: center;
}

.control {
	display: flex;
	align-items: center;
	gap: 0.5rem;

	label {
		font-size: 0.84rem;
		font-weight: 600;
		color: $text-primary;
	}

	select {
		padding: 0.35rem 0.5rem;
		border-radius: 6px;
		border: 1px solid $border;
		font-size: 0.84rem;
		min-width: 220px;
		background-color: $surface;
	}
}

.checkbox {
	display: flex;
	align-items: center;
	gap: 0.4rem;
	font-size: 0.84rem;
	color: $text-primary;

	input {
		accent-color: $primary;
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
	grid-template-columns: minmax(0, 2fr) minmax(280px, 1fr);
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
	min-height: 420px;
}

.attribution {
	padding: 0.2rem 0.6rem;
	font-size: 0.66rem;
	line-height: 1.3;
	text-align: right;
	color: $text-secondary;
	background: rgba($surface, 0.92);

	a {
		color: inherit;
	}
}

.legend-shell {
	padding: 0.5rem 0.75rem 0.65rem;
	border-top: 1px solid rgba($primary, 0.16);
	background: rgba($surface, 0.92);
}

.legend-title {
	font-size: 0.78rem;
	font-weight: 700;
	letter-spacing: 0.02em;
	color: $text-primary;
	margin-bottom: 0.2rem;
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
	max-width: 280px;
}

:deep(.tip-title) {
	font-weight: 700;
	margin-bottom: 0.25rem;
}

.insight-panel {
	background: rgba($surface, 0.92);
	border: 1px solid rgba($primary, 0.2);
	border-radius: 10px;
	padding: 0.9rem;
	display: flex;
	flex-direction: column;
	gap: 0.7rem;

	h3 {
		font-size: 1.03rem;
		margin: 0;
		color: $primary;
	}

	p {
		margin: 0;
		font-size: 0.86rem;
		line-height: 1.45;
		color: $text-primary;
	}

	h4 {
		font-size: 0.85rem;
		margin: 0.25rem 0 0;
		color: $text-primary;
	}
}

.insight-block {
	display: flex;
	flex-direction: column;
	gap: 0.45rem;
}

.metric-row {
	display: flex;
	justify-content: space-between;
	align-items: center;
	font-size: 0.82rem;
	padding: 0.36rem 0.45rem;
	background: rgba($background-darker, 0.82);
	border-radius: 6px;
	border: 1px solid rgba($border, 0.85);

	strong {
		color: $primary;
	}
}

.insight-list {
	list-style: none;
	padding: 0;
	margin: 0;
	display: flex;
	flex-direction: column;
	gap: 0.4rem;

	li {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 0.5rem;
		padding: 0.4rem 0.5rem;
		border-radius: 6px;
		background: rgba($background-darker, 0.58);
		font-size: 0.8rem;

		strong {
			color: $secondary;
			font-size: 0.8rem;
			white-space: nowrap;
		}
	}
}

.caveat {
	margin-top: auto;
	font-size: 0.74rem;
	color: $text-secondary;
	padding-top: 0.55rem;
	border-top: 1px dashed rgba($border, 0.9);
}

@media (max-width: 1024px) {
	.layout {
		grid-template-columns: 1fr;
	}

	.map-container {
		min-height: 360px;
	}
}

@media (max-width: 680px) {
	.monicet-explorer {
		padding: 0.9rem;
	}

	.control {
		width: 100%;

		select {
			min-width: 0;
			width: 100%;
		}
	}

	.map-container {
		min-height: 300px;
	}
}
</style>
