<template>
	<div class="monicet-explorer">
		<div class="toolbar">
			<ModeSwitch
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
					{{ mapData?.meta.caveats[0] }}
				</div>
			</aside>
		</div>
	</div>
</template>

<script setup lang="ts">
// Direction 1 — "Honest Instability". Three insight modes on one map:
// encounter-rate change (with reliability shown as opacity), a species
// distribution, and a month's encounter distribution.
import * as d3 from "d3";
import {
	computed,
	nextTick,
	onBeforeUnmount,
	onMounted,
	ref,
	watch,
} from "vue";

import ModeSwitch from "@/components/ui/ModeSwitch.vue";
import {
	averageDecline,
	findMonth,
	findSpecies,
	indexCells,
	speciesHotspots,
	speciesOptions,
	topDecliningCells,
} from "@/data/selectors";
import { useMonicetData } from "@/data/useMonicetData";
import {
	CHART_DIVERGING_NEGATIVE,
	CHART_DIVERGING_NEUTRAL,
	CHART_DIVERGING_POSITIVE,
	CHART_SEQUENTIAL_TEAL,
} from "@/lib/chartTokens";
import {
	formatCellLabel,
	formatRate,
	formatSignedPercent,
	MONTH_NAMES,
	toPercent,
} from "@/lib/format";
import { renderGradientLegend } from "@/lib/legend";
import { drawBaseMap, SAND_THEME } from "@/lib/map";
import { hideTooltip, showTooltip } from "@/lib/tooltip";
import type { MonicetGridCell, MonicetInsightMode } from "@/types/monicet";

const { mapData, basemap, error, load } = useMonicetData();
const loading = ref(true);

const mode = ref<MonicetInsightMode>("decline");
const selectedSpeciesId = ref("");
const selectedMonth = ref(6);
const reliableOnly = ref(true);

const mapContainer = ref<HTMLElement | null>(null);
const legendContainer = ref<HTMLElement | null>(null);
const tooltipRef = ref<HTMLElement | null>(null);

const modeOptions: { value: MonicetInsightMode; label: string }[] = [
	{ value: "decline", label: "Where Sightings Decline" },
	{ value: "species", label: "Species By Location" },
	{ value: "seasonality", label: "Best Time Of Year" },
];

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
		<div class="tip-line">Top species: ${topSpecies || "n/a"}</div>
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
			`legend-${mode.value}`,
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
			`legend-${mode.value}`,
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

function renderMap() {
	if (!mapContainer.value || !mapData.value || !basemap.value) return;

	hideTooltip(tooltipRef.value);
	const { mapGroup, cellPath, drawIslandLabels } = drawBaseMap(
		mapContainer.value,
		basemap.value,
		{ theme: SAND_THEME, fallbackWidth: 960, minHeight: 420, aspect: 0.62 }
	);

	// With "reliable only" on, unreliable cells are hidden entirely. With it
	// off, they are drawn faint and dashed so the uncertainty stays visible.
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

	mapGroup
		.append("g")
		.selectAll("path")
		.data(visibleCells)
		.join("path")
		.attr("d", cellPath)
		.attr("fill", (cell) => encoding.color(encoding.value(cell)))
		.attr("stroke", (cell) => (isFaint(cell) ? "#bbb" : "#ffffff"))
		.attr("stroke-width", 0.8)
		.attr("stroke-dasharray", (cell) => (isFaint(cell) ? "3,2" : null))
		.attr("opacity", (cell) => (isFaint(cell) ? 0.28 : 0.92))
		.on("mousemove", (event: MouseEvent, cell) =>
			onCellHover(event, cell, encoding.value(cell))
		)
		.on("mouseleave", () => hideTooltip(tooltipRef.value));

	drawIslandLabels();
}

// ─── Lifecycle ───────────────────────────────────────────────────────────────

onMounted(async () => {
	await load();
	loading.value = false;

	if (mapData.value) {
		selectedSpeciesId.value =
			mapData.value.speciesSummaries[0]?.speciesId ?? "";
		selectedMonth.value = mapData.value.meta.bestMonthOverall?.month ?? 6;
		await nextTick();
		renderMap();
		window.addEventListener("resize", renderMap, { passive: true });
	}
});

onBeforeUnmount(() => {
	window.removeEventListener("resize", renderMap);
});

watch([mode, selectedSpeciesId, selectedMonth, reliableOnly], () => {
	if (loading.value) return;
	renderMap();
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
