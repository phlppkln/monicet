<template>
	<div class="monicet-explorer">
		<div v-if="hasControls" class="toolbar">
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
		</div>

		<div v-if="loading" class="status">Preparing MONICET map...</div>
		<div v-else-if="error" class="status error">{{ error }}</div>

		<div v-else class="layout">
			<div class="map-shell">
				<div ref="mapContainer" class="map-container"></div>
				<div class="legend-shell">
					<div class="legend-title">{{ copy.legendTitle }}</div>
					<div ref="legendContainer" class="legend-container"></div>
					<MapMissingKey :items="missingKeyItems" />
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
							<span>{{ cell.label }}</span>
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

					<h4>Most encounters (raw count)</h4>
					<ul class="insight-list">
						<li v-for="hotspot in hotspots" :key="hotspot.id">
							<span>{{ hotspot.label }}</span>
							<strong>{{ hotspot.count }}</strong>
						</li>
					</ul>
				</div>

				<div v-else-if="mode === 'boats'" class="insight-block">
					<div class="metric-row">
						<span>Cruises in archive</span>
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
						<span>Cruises without sea position</span>
						<strong>{{
							mapData?.meta.cruisesWithoutPositionsAtSea ?? "n/a"
						}}</strong>
					</div>

					<h4>Most visited</h4>
					<ul class="insight-list">
						<li v-for="cell in busiestCruiseCells" :key="cell.id">
							<span>{{ cell.label }}</span>
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
						<span>Selected month</span>
						<strong>{{
							formatRate(selectedMonthSummary?.rate ?? null)
						}}</strong>
					</div>

					<h4>Top species in {{ selectedMonthSummary?.label }}</h4>
					<ul class="insight-list">
						<li
							v-for="entry in selectedMonthSummary?.topSpecies ??
							[]"
							:key="entry.speciesId"
						>
							<span>{{ entry.commonName }}</span>
							<strong>{{ toPercent(entry.share) }}</strong>
						</li>
					</ul>
				</div>

				<div v-if="caveat" class="caveat">{{ caveat }}</div>
			</aside>
		</div>
	</div>
</template>

<script setup lang="ts">
// Grid-cell map with switchable insight modes on a clean wireframe coastline.
// - The External: species, seasonality, boats
// - Story & Filling the Gaps: decline (the original naive change map)
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
import ModeSwitch from "@/components/shared-ui/ModeSwitch.vue";
import {
	averageDecline,
	cellRate,
	findMonth,
	findSpecies,
	indexCells,
	indexCruiseCells,
	MIN_CRUISES_FOR_RATE,
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
	CHART_NO_VALUE_HATCH,
	CHART_NONE_RECORDED,
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
import { addNoValuePattern, drawBaseMap, WIREFRAME_THEME } from "@/lib/map";
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

// SVG ids (hatch pattern, legend gradient) are document-wide; prefix per instance.
const svgIdPrefix = `cme${useId()}`;
const selectedSpeciesId = ref("");
const selectedMonth = ref(6);
const reliableOnly = ref(true);

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

const hasControls = computed(
	() =>
		modeOptions.length > 1 ||
		mode.value === "species" ||
		mode.value === "seasonality" ||
		mode.value === "decline"
);

const monthOptions = MONTH_NAMES.map((label, i) => ({ value: i + 1, label }));

const MODE_COPY: Record<
	MonicetInsightMode,
	{ panelTitle: string; panelIntro: string; legendTitle: string }
> = {
	decline: {
		panelTitle: "Early vs. late change",
		panelIntro:
			"Encounter-rate change between 2009–2014 and 2015–2020, divided by all cruises in the archive.",
		legendTitle: "Encounter-rate change (%)",
	},
	species: {
		panelTitle: "Species by location",
		panelIntro:
			"Encounters per cruise that reached each cell, so busy harbours do not dominate by traffic alone.",
		legendTitle: "Encounters per cruise, selected species",
	},
	seasonality: {
		panelTitle: "Best time of year",
		panelIntro:
			"Encounters per cruise in the selected month, plus which species make up most sightings then.",
		legendTitle: "Encounters per cruise in selected month",
	},
	boats: {
		panelTitle: "Where boats stopped",
		panelIntro:
			"Cruises that logged at least one sighting in each cell (log scale).",
		legendTitle: "Cruises that reached the cell (log scale)",
	},
};

const copy = computed(() => MODE_COPY[mode.value]);

const MISSING_KEY: Record<MonicetInsightMode, MissingKeyItem[]> = {
	decline: [
		{ kind: "no-value", label: "no value: too few years to compare" },
	],
	species: [
		{ kind: "none-recorded", label: "none recorded" },
		{
			kind: "no-value",
			label: `no rate: fewer than ${MIN_CRUISES_FOR_RATE} cruises`,
		},
	],
	seasonality: [
		{ kind: "none-recorded", label: "none recorded" },
		{
			kind: "no-value",
			label: `no rate: fewer than ${MIN_CRUISES_FOR_RATE} cruises that month`,
		},
	],
	boats: [],
};
const missingKeyItems = computed(() => MISSING_KEY[mode.value]);

const caveat = computed(() => {
	if (mode.value === "decline") return mapData.value?.meta.caveats[0];
	if (mode.value === "species" || mode.value === "seasonality") {
		return "Rates divide by cruises that logged a sighting in the cell, not cruises that searched it.";
	}
	if (mode.value === "boats") {
		return "Positions are only logged at sightings — empty cells may have been searched without finding animals.";
	}
	return null;
});

// ─── Derived data ────────────────────────────────────────────────────────────

const cells = computed(() => mapData.value?.gridCells ?? []);
const cellLookup = computed(() => indexCells(cells.value));
const cruiseCellLookup = computed(() =>
	indexCruiseCells(mapData.value?.cruiseCells ?? [])
);

function rateInputs(cell: MonicetGridCell) {
	const cruiseCell = cruiseCellLookup.value.get(cell.id);
	if (mode.value === "species") {
		return {
			encounters: cell.speciesCounts[selectedSpeciesId.value] ?? 0,
			cruises: cruiseCell?.cruises ?? 0,
		};
	}
	const month = selectedMonth.value - 1;
	return {
		encounters: cell.monthlyEncounters[month] ?? 0,
		cruises: cruiseCell?.monthlyCruises[month] ?? 0,
	};
}

function cellRateFor(cell: MonicetGridCell) {
	const { encounters, cruises } = rateInputs(cell);
	return cellRate(encounters, cruises);
}

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
		valueLabel = `Change: ${value === null ? "no value" : formatSignedPercent(value)}`;
	} else {
		const { encounters, cruises } = rateInputs(cell);
		const prefix =
			mode.value === "seasonality"
				? `${selectedMonthSummary.value?.label ?? "Month"}: `
				: "";
		valueLabel =
			value === null
				? `${prefix}no rate (${cruises} cruises, ${encounters} encounters)`
				: `${prefix}${formatRate(value)} (${encounters.toLocaleString()} in ${cruises.toLocaleString()} cruises)`;
	}

	const topSpeciesLabel =
		mode.value === "seasonality" ? "Top species (all year)" : "Top species";
	const topSpecies = cell.topSpecies
		.map((entry) => `${entry.commonName} (${entry.count})`)
		.slice(0, 2)
		.join(" · ");

	showTooltip(
		tooltipRef.value,
		mapContainer.value,
		event,
		`
		<div class="tip-title">${formatCellLabel(cell)}</div>
		<div class="tip-line">${valueLabel}</div>
		<div class="tip-line">${topSpeciesLabel}: ${topSpecies || "n/a"}</div>
	`
	);
}

function onCruiseCellHover(event: MouseEvent, cell: MonicetCruiseCell) {
	if (!tooltipRef.value || !mapContainer.value) return;
	const islands = Object.entries(cell.cruisesByIsland)
		.filter(([, n]) => n > 0)
		.map(([island, n]) => `${island}: ${n.toLocaleString()}`)
		.join(" · ");
	showTooltip(
		tooltipRef.value,
		mapContainer.value,
		event,
		`
		<div class="tip-title">${formatCellLabel(cell)}</div>
		<div class="tip-line">${cell.cruises.toLocaleString()} cruises (${toPercent(cell.share)})</div>
		<div class="tip-line">${islands}</div>
	`
	);
}

// ─── Color encodings per mode ────────────────────────────────────────────────

interface Encoding {
	value: (cell: MonicetGridCell) => number | null;
	color: (value: number | null) => string;
}

function rateEncoding(
	visibleCells: MonicetGridCell[],
	value: (cell: MonicetGridCell) => number | null
): Encoding {
	const rates = visibleCells
		.map(value)
		.filter((v): v is number => v !== null);
	const maxValue = Math.max(0.01, d3.max(rates) ?? 0.01);
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
				center: (maxValue / 2).toFixed(2),
				right: maxValue.toFixed(2),
			}
		);
	}

	return {
		value,
		color: (v) => {
			if (v === null) return base?.noValueFill ?? "none";
			return v <= 0 ? CHART_NONE_RECORDED : scale(v);
		},
	};
}

function declineEncoding(visibleCells: MonicetGridCell[]): Encoding {
	const values = visibleCells
		.map((cell) => cell.declinePct)
		.filter((v): v is number => v !== null && Number.isFinite(v));
	const maxAbs = Math.max(5, d3.max(values.map(Math.abs)) ?? 5);

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
		color: (v) => (v === null ? (base?.noValueFill ?? "none") : scale(v)),
	};
}

// ─── Render ──────────────────────────────────────────────────────────────────

let dataLayer: d3.Selection<SVGGElement, unknown, null, undefined> | null =
	null;

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
		.attr("fill-opacity", 0.9)
		.attr("stroke", "rgba(26,26,26,0.2)")
		.attr("stroke-width", 0.5)
		.on("mousemove", (event: MouseEvent, cell) =>
			onCruiseCellHover(event, cell)
		)
		.on("mouseleave", () => hideTooltip(tooltipRef.value));
}

let base: {
	cellPath: ReturnType<typeof drawBaseMap>["cellPath"];
	insertDataLayer: ReturnType<typeof drawBaseMap>["insertDataLayer"];
	noValueFill: string;
} | null = null;

function renderMap() {
	if (!mapContainer.value || !mapData.value || !basemap.value) return;

	const { svg, cellPath, raiseLines, insertDataLayer, drawIslandLabels } =
		drawBaseMap(mapContainer.value, basemap.value, {
			theme: WIREFRAME_THEME,
			lines: mapLines.value,
			fallbackWidth: 960,
			minHeight: 380,
			aspect: 0.6,
		});

	raiseLines();
	drawIslandLabels();

	base = {
		cellPath,
		insertDataLayer,
		noValueFill: addNoValuePattern(
			svg,
			CHART_NO_VALUE_HATCH,
			`${svgIdPrefix}-no-value`
		),
	};
	renderDataLayer();
}

function renderDataLayer() {
	if (!base || !mapData.value) return;
	hideTooltip(tooltipRef.value);

	dataLayer?.remove();
	dataLayer = base.insertDataLayer();
	const solidCells = dataLayer.append("g");
	const faintCells = dataLayer.append("g");

	if (mode.value === "boats") {
		drawCruiseCells(solidCells, base.cellPath);
		return;
	}

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
			: rateEncoding(visibleCells, cellRateFor);

	const cellPath = base.cellPath;
	const drawCells = (
		group: d3.Selection<SVGGElement, unknown, null, undefined>,
		subset: MonicetGridCell[]
	) =>
		group
			.selectAll("path")
			.data(subset)
			.join("path")
			.attr("d", cellPath)
			.attr("fill", (cell) => encoding.color(encoding.value(cell)))
			.attr("fill-opacity", 0.9)
			.attr("stroke", "rgba(26,26,26,0.2)")
			.attr("stroke-width", 0.5)
			.on("mousemove", (event: MouseEvent, cell) =>
				onCellHover(event, cell, encoding.value(cell))
			)
			.on("mouseleave", () => hideTooltip(tooltipRef.value));

	drawCells(
		solidCells,
		visibleCells.filter((cell) => !isFaint(cell))
	);
	drawCells(faintCells, visibleCells.filter(isFaint))
		.attr("fill-opacity", 0.3)
		.attr("stroke", CHART_TEXT_SECONDARY)
		.attr("stroke-width", 0.8)
		.attr("stroke-dasharray", "3,2");
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

watch([mode, selectedSpeciesId, selectedMonth, reliableOnly], () => {
	if (!loading.value) renderDataLayer();
});
</script>

<style scoped lang="scss">
.monicet-explorer {
	position: relative;
}

.toolbar {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	justify-content: space-between;
	gap: 0.75rem 1rem;
	margin-bottom: 0.85rem;
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
		color: $text-secondary;
	}

	select {
		padding: 0.35rem 0.55rem;
		border-radius: $radius-sm;
		border: 1px solid $border;
		font-size: 0.84rem;
		min-width: 210px;
		background-color: $surface;
		color: $text-primary;
	}
}

.checkbox {
	display: flex;
	align-items: center;
	gap: 0.45rem;
	font-size: 0.84rem;
	color: $text-secondary;
	cursor: pointer;

	input {
		accent-color: $primary;
	}
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
	grid-template-columns: minmax(0, 2fr) minmax(260px, 1fr);
	gap: 1.25rem;
	align-items: start;
}

.map-shell {
	position: relative;
	border-radius: $radius-md;
	overflow: hidden;
	border: 1px solid $border;
	background: $surface;
}

.map-container {
	min-height: 380px;
	line-height: 0;
}

.legend-shell {
	padding: 0.6rem 0.85rem;
	border-top: 1px solid $border;
	background: $surface;
}

.legend-title {
	font-size: 0.78rem;
	font-weight: 600;
	color: $text-secondary;
	margin-bottom: 0.2rem;
}

:deep(.legend-label) {
	font-size: 12px;
	font-family: "Space Grotesk", sans-serif;
	fill: $text-secondary;
}

.tooltip {
	position: absolute;
	left: 0;
	top: 0;
	pointer-events: none;
	opacity: 0;
	padding: 0.5rem 0.65rem;
	border-radius: $radius-sm;
	background: rgba(26, 26, 26, 0.92);
	color: #fff;
	font-size: 0.76rem;
	line-height: 1.4;
	transform: translate(-999px, -999px);
	transition: opacity 0.08s linear;
	max-width: 280px;
}

:deep(.tip-title) {
	font-weight: 700;
	margin-bottom: 0.2rem;
}

.insight-panel {
	background: $surface;
	border: 1px solid $border;
	border-radius: $radius-md;
	padding: 1.05rem 1.15rem;
	display: flex;
	flex-direction: column;
	gap: 0.75rem;

	h3 {
		font-size: 0.98rem;
		margin: 0;
		color: $text-primary;
	}

	p {
		margin: 0;
		font-size: 0.84rem;
		line-height: 1.5;
		color: $text-secondary;
	}

	h4 {
		font-size: 0.78rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		margin: 0.45rem 0 0.15rem;
		color: $text-secondary;
	}
}

.insight-block {
	display: flex;
	flex-direction: column;
}

.metric-row {
	display: flex;
	justify-content: space-between;
	align-items: baseline;
	gap: 0.75rem;
	font-size: 0.84rem;
	padding: 0.42rem 0;
	border-bottom: 1px solid $border;
	color: $text-secondary;

	strong {
		color: $text-primary;
		font-variant-numeric: tabular-nums;
	}
}

.insight-list {
	list-style: none;
	padding: 0;
	margin: 0;
	display: flex;
	flex-direction: column;

	li {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 0.5rem;
		padding: 0.36rem 0;
		margin: 0;
		border-bottom: 1px solid rgba($border, 0.7);
		font-size: 0.82rem;
		color: $text-primary;

		&:last-child {
			border-bottom: none;
		}

		strong {
			color: $text-secondary;
			font-weight: 600;
			font-variant-numeric: tabular-nums;
			white-space: nowrap;
		}
	}
}

.caveat {
	margin-top: 0.25rem;
	font-size: 0.76rem;
	line-height: 1.5;
	color: $text-secondary;
	padding-top: 0.65rem;
	border-top: 1px solid $border;
}

@media (max-width: 1024px) {
	.layout {
		grid-template-columns: 1fr;
	}

	.map-container {
		min-height: 340px;
	}
}

@media (max-width: 680px) {
	.control {
		width: 100%;

		select {
			min-width: 0;
			width: 100%;
		}
	}

	.map-container {
		min-height: 290px;
	}
}
</style>
