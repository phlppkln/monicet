<template>
	<div class="d3-explorer">
		<div class="toolbar">
			<div class="controls-row">
				<div class="control">
					<label for="d3-species-select">If I were a…</label>
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
			</div>

			<BasemapControls
				v-model:basemap-id="basemapId"
				v-model:show-data-layer="showDataLayer"
				v-model:data-layer-opacity="dataLayerOpacity"
				v-model:show-observation-grid="showObservationGrid"
			/>
		</div>

		<div v-if="loading" class="status">Preparing species map…</div>
		<div v-else-if="error" class="status error">{{ error }}</div>

		<template v-else-if="selectedSpecies">
			<!-- ─── My year ─────────────────────────────────────────────── -->
			<section class="year-card" aria-labelledby="animal-year-title">
				<div class="year-head">
					<div>
						<h3 id="animal-year-title">My year in the Azores</h3>
						<p class="year-sub">
							Bar height: encounters per cruise. Colour: what I
							was doing when the boat arrived. Dots: share of my
							groups with a calf. Pick a month to see where I am.
						</p>
					</div>
					<button
						type="button"
						class="all-year"
						:class="{ active: selectedMonth === null }"
						:aria-pressed="selectedMonth === null"
						@click="selectedMonth = null"
					>
						All year
					</button>
				</div>

				<div ref="yearShell" class="year-shell">
					<svg
						class="year-chart"
						:viewBox="`0 0 ${YEAR.width} ${YEAR.height}`"
						role="group"
						aria-label="Encounters per cruise, behaviour and calf share by month"
					>
						<text
							class="axis-label"
							:x="YEAR.left - 6"
							:y="YEAR.top + 4"
							text-anchor="end"
						>
							<!-- Number only: "1.32 encounters/cruise" ran ~100px
							past the chart's left edge. The unit is in the
							subtitle ("Bar height: encounters per cruise"). -->
							{{ maxMonthlyRate.toFixed(2) }}
						</text>
						<text
							class="axis-label"
							:x="YEAR.left - 6"
							:y="YEAR.baseline"
							text-anchor="end"
						>
							0
						</text>
						<line
							class="baseline"
							:x1="YEAR.left"
							:x2="YEAR.width"
							:y1="YEAR.baseline"
							:y2="YEAR.baseline"
						/>
						<text
							class="axis-label row-label"
							:x="YEAR.left - 6"
							:y="YEAR.calfRow + 4"
							text-anchor="end"
						>
							calves
						</text>

						<g
							v-for="col in yearColumns"
							:key="col.month"
							class="month-col"
							:class="{ selected: selectedMonth === col.month }"
							role="button"
							tabindex="0"
							:aria-pressed="selectedMonth === col.month"
							:aria-label="col.ariaLabel"
							@click="toggleMonth(col.month)"
							@keydown.enter.prevent="toggleMonth(col.month)"
							@keydown.space.prevent="toggleMonth(col.month)"
							@mousemove="onMonthHover($event, col.month)"
							@mouseleave="hideTooltip(yearTooltipRef)"
						>
							<rect
								class="hit"
								:x="col.x - col.slot / 2"
								:y="0"
								:width="col.slot"
								:height="YEAR.height"
							/>
							<rect
								v-for="seg in col.segments"
								:key="seg.behaviour"
								:x="col.x - col.barWidth / 2"
								:y="seg.y"
								:width="col.barWidth"
								:height="seg.height"
								:fill="CHART_BEHAVIOUR[seg.behaviour]"
							/>
							<rect
								v-if="col.unsplit"
								class="unsplit"
								:x="col.x - col.barWidth / 2"
								:y="YEAR.baseline - col.barHeight"
								:width="col.barWidth"
								:height="col.barHeight"
							/>
							<text
								class="month-tick"
								:x="col.x"
								:y="YEAR.baseline + 16"
								text-anchor="middle"
							>
								{{ MONTH_LABELS[col.month] }}
							</text>
							<circle
								v-if="col.calf"
								:class="col.calf.reliable ? 'calf' : 'calf few'"
								:cx="col.x"
								:cy="YEAR.calfRow"
								:r="col.calf.radius"
							/>
						</g>
					</svg>
					<div ref="yearTooltipRef" class="tooltip"></div>
				</div>

				<ul class="behaviour-legend">
					<li v-for="b in BEHAVIOUR_ORDER" :key="b">
						<span
							class="swatch"
							:style="{ background: CHART_BEHAVIOUR[b] }"
						></span>
						{{ b }}
					</li>
					<li>
						<span class="swatch unsplit-swatch"></span>
						fewer than {{ MIN_BEHAVIOUR_RECORDS }} behaviour records
					</li>
					<li>
						<span class="dot-swatch"></span>
						calves (area = share)
					</li>
					<li>
						<span class="dot-swatch few"></span>
						fewer than {{ MIN_LIFE_STAGE_RECORDS }} life-stage
						records
					</li>
				</ul>
			</section>

			<div class="layout">
				<div class="map-shell">
					<div class="map-heading">
						Where I am in <strong>{{ monthName }}</strong>
					</div>
					<div ref="mapContainer" class="map-container"></div>
					<MapAttribution :basemap-id="basemapId" />
					<div v-show="showDataLayer" class="legend-shell">
						<div class="legend-title">
							Encounters per cruise in {{ monthName }}, all years
							(log scale)
						</div>
						<div
							ref="legendContainer"
							class="legend-container"
						></div>
						<MapMissingKey :items="MISSING_KEY" />
					</div>
					<div ref="tooltipRef" class="tooltip"></div>
				</div>

				<aside class="species-panel">
					<div class="panel-content">
						<div class="species-name">
							<strong>{{ selectedSpecies.commonName }}</strong>
							<em>{{ selectedSpecies.scientificName }}</em>
						</div>

						<div v-if="reason" class="reason">
							<div class="reason-kicker">
								Why I come (background, not from this archive)
							</div>
							<div class="reason-title">{{ reason.title }}</div>
							<p class="reason-text">{{ reason.text }}</p>
							<details v-if="reason.sources.length">
								<summary>Sources</summary>
								<ul>
									<li
										v-for="src in reason.sources"
										:key="src"
									>
										{{ src }}
									</li>
								</ul>
							</details>
							<p v-else class="reason-missing">
								Source still to be added.
							</p>
						</div>
						<p v-else class="reason-missing">
							No background note for this species yet. The charts
							show only what the archive records.
						</p>

						<div class="month-facts">
							<div class="facts-title">{{ monthName }}</div>
							<div class="metric-row">
								<span>Encounters per cruise</span>
								<strong>{{ formatRate(facts.rate) }}</strong>
							</div>
							<div class="metric-row">
								<span>Encounters</span>
								<strong>{{
									facts.encounters.toLocaleString()
								}}</strong>
							</div>
							<div class="metric-row">
								<span>Groups with a calf</span>
								<strong>{{ facts.calfLabel }}</strong>
							</div>
							<div class="metric-row">
								<span>Grid cells with sightings</span>
								<strong>{{ facts.cells }}</strong>
							</div>
							<ul
								v-if="facts.activity.shares"
								class="activity-list"
							>
								<li v-for="b in BEHAVIOUR_ORDER" :key="b">
									<span
										class="swatch"
										:style="{
											background: CHART_BEHAVIOUR[b],
										}"
									></span>
									<span class="activity-name">{{ b }}</span>
									<strong
										>{{
											Math.round(
												facts.activity.shares[b] * 100
											)
										}}%</strong
									>
								</li>
								<li class="activity-n">
									of {{ facts.activity.total }} groups with a
									behaviour record
								</li>
							</ul>
							<p v-else class="activity-n">
								Only {{ facts.activity.total }} groups with a
								behaviour record: too few to split.
							</p>
						</div>

						<div class="chart-section">
							<div class="chart-label">
								Year by year (encounters per cruise)
							</div>
							<div
								ref="sparklineContainer"
								class="sparkline"
							></div>
						</div>
					</div>

					<div class="caveat">
						Behaviour is the state when the boat arrived, and the
						boat may have changed it; deep divers forage out of
						sight. Calf share counts groups, not animals. Winter
						months have few cruises ({{ quietestMonth }}), so their
						shares are noisy. The map divides by the cruises that
						logged a sighting in each cell, so it is per cruise that
						stopped there, not per cruise that searched it.
					</div>
				</aside>
			</div>
		</template>
	</div>
</template>

<script setup lang="ts">
// The Animal (formerly D3, "The Species as Character"). The question is the
// animal's own: "if I were this species, where would I go, and when, and
// why?" One species reorganises the view into
//   - "My year": encounters per cruise by month (when am I here?), stacked
//     by behaviour on arrival (what am I doing?) with a calf-share dot row
//     (am I raising young?);
//   - a map filtered to the selected month (where am I then?);
//   - a side panel with that month in words, a background note on why the
//     species comes (from the literature, not from this archive) and the
//     year-by-year sparkline.
// Why this design and its alternatives: docs/ideas/the-animal.md.
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

import BasemapControls from "@/components/shared-ui/BasemapControls.vue";
import MapAttribution from "@/components/shared-ui/MapAttribution.vue";
import MapMissingKey, {
	type MissingKeyItem,
} from "@/components/shared-ui/MapMissingKey.vue";
import {
	BEHAVIOUR_ORDER,
	MIN_BEHAVIOUR_RECORDS,
	MIN_LIFE_STAGE_RECORDS,
	bestMonthIndex,
	cellRate,
	findSpecies,
	indexCruiseCells,
	MIN_CRUISES_FOR_RATE,
	monthActivity,
	monthCalfShare,
	monthlyRates,
	speciesCellCountsFor,
	speciesOptions,
	yearlyRates,
} from "@/data/selectors";
import { useMonicetData } from "@/data/useMonicetData";
import {
	CHART_BEHAVIOUR,
	CHART_NO_VALUE_HATCH,
	CHART_NONE_RECORDED,
	CHART_PRIMARY,
	CHART_SEQUENTIAL_TEAL,
	CHART_TEXT_SECONDARY,
} from "@/lib/chartTokens";
import { formatCellLabel, formatRate, MONTH_LABELS } from "@/lib/format";
import { renderGradientLegend } from "@/lib/legend";
import {
	addNoValuePattern,
	addSoftEdgeFilter,
	BASEMAPS,
	drawBaseMap,
	type BasemapId,
} from "@/lib/map";
import { hideTooltip, showTooltip } from "@/lib/tooltip";
import type { Behaviour, MonicetGridCell } from "@/types/monicet";

import { ANIMAL_REASONS } from "./animalReasons";

const MONTH_NAMES = [
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

// Cells drawn off the colour scale: the species was not logged there in
// the selected period (other species were), or too few cruises reached
// the cell then to give a rate.
const MISSING_KEY: MissingKeyItem[] = [
	{ kind: "none-recorded", label: "none recorded" },
	{
		kind: "no-value",
		label: `no rate: fewer than ${MIN_CRUISES_FOR_RATE} cruises`,
	},
];

const { mapData, basemap, mapLines, error, load, loadMapLines } =
	useMonicetData();
const loading = ref(true);

const selectedSpeciesId = ref("");
/** 0–11, or null for "all year". */
const selectedMonth = ref<number | null>(null);

// Same basemaps as The External (docs/basemaps.md), with the cells as a
// toggleable layer whose opacity lets the basemap show through.
const basemapId = ref<BasemapId>("basic");
const showDataLayer = ref(true);
// 0.85, not lower: at 0.65 the ramp's light end blended into the basemap.
const dataLayerOpacity = ref(0.85);
// The grid the build sorts observations into (drawObservationGrid in
// src/lib/map.ts). Off by default: it is an explanation, not data.
const showObservationGrid = ref(false);

// SVG ids (blur filter) are document-wide; prefix them per instance.
const svgIdPrefix = `sac${useId()}`;

const mapContainer = ref<HTMLElement | null>(null);
const legendContainer = ref<HTMLElement | null>(null);
const sparklineContainer = ref<HTMLElement | null>(null);
const tooltipRef = ref<HTMLElement | null>(null);
const yearShell = ref<HTMLElement | null>(null);
const yearTooltipRef = ref<HTMLElement | null>(null);

// ─── Derived data ────────────────────────────────────────────────────────────

const speciesList = computed(() =>
	mapData.value ? speciesOptions(mapData.value) : []
);

const selectedSpecies = computed(() => {
	if (!mapData.value || !selectedSpeciesId.value) return null;
	return findSpecies(mapData.value, selectedSpeciesId.value);
});

const reason = computed(() =>
	selectedSpecies.value
		? (ANIMAL_REASONS[selectedSpecies.value.scientificName] ?? null)
		: null
);

const monthlyCruises = computed(
	() => mapData.value?.monthlySummaries.map((m) => m.cruises) ?? []
);

const quietestMonth = computed(() => {
	const cruises = monthlyCruises.value;
	if (!cruises.length) return "";
	const i = cruises.indexOf(Math.min(...cruises));
	return `${cruises[i]} in ${MONTH_NAMES[i]}`;
});

// Encounters per cruise, not raw counts: raw monthly counts mostly follow
// how many trips ran (July has ~15× the cruises of January), so dividing by
// cruises asks "if I go out this month, how likely am I to meet it?".
const monthlyRatesForSpecies = computed(() => {
	const monthly = selectedSpecies.value?.monthlyEncounters;
	if (!monthly) return [];
	return monthlyRates(monthly, monthlyCruises.value);
});

const maxMonthlyRate = computed(() =>
	Math.max(0, ...monthlyRatesForSpecies.value)
);

const monthName = computed(() =>
	selectedMonth.value === null ? "all year" : MONTH_NAMES[selectedMonth.value]
);

function toggleMonth(month: number) {
	selectedMonth.value = selectedMonth.value === month ? null : month;
}

// ─── My year: chart geometry ─────────────────────────────────────────────────
// Drawn by the template (Vue SVG), not by D3: the chart is twelve columns
// with fixed positions, and each column is a keyboard-focusable button.

const YEAR = {
	width: 720,
	height: 196,
	left: 40,
	top: 8,
	barArea: 120,
	get baseline() {
		return this.top + this.barArea;
	},
	get calfRow() {
		return this.baseline + 42;
	},
	// Largest calf dot (share = 100%). Area, not radius, follows the share,
	// so a 40% month looks twice as heavy as a 20% month.
	maxCalfRadius: 13,
	// Surface gap between stacked segments (dataviz mark spec).
	segmentGap: 2,
};

interface YearColumn {
	month: number;
	x: number;
	slot: number;
	barWidth: number;
	barHeight: number;
	segments: { behaviour: Behaviour; y: number; height: number }[];
	/** Bar drawn as an outline: present, but too few behaviour records to split. */
	unsplit: boolean;
	calf: { radius: number; reliable: boolean } | null;
	ariaLabel: string;
}

const yearColumns = computed<YearColumn[]>(() => {
	const species = selectedSpecies.value;
	if (!species) return [];
	const rates = monthlyRatesForSpecies.value;
	const maxRate = maxMonthlyRate.value || 1;
	const slot = (YEAR.width - YEAR.left) / 12;
	const barWidth = slot * 0.62;

	return rates.map((rate, month) => {
		const x = YEAR.left + slot * (month + 0.5);
		const barHeight = (rate / maxRate) * YEAR.barArea;
		const activity = monthActivity(species, month);
		const calf = monthCalfShare(species, month);

		// Stack bottom-up in BEHAVIOUR_ORDER; each segment is its share of
		// the bar. The gap is taken out of the segment, so the bar's total
		// height still reads as the rate.
		const segments: YearColumn["segments"] = [];
		if (activity.shares && barHeight > 0) {
			let y = YEAR.baseline;
			for (const behaviour of BEHAVIOUR_ORDER) {
				const full = barHeight * activity.shares[behaviour];
				if (full <= 0) continue;
				const height = Math.max(0.5, full - YEAR.segmentGap);
				y -= full;
				segments.push({ behaviour, y: y + YEAR.segmentGap, height });
			}
		}

		let calfDot: YearColumn["calf"] = null;
		if (calf.share !== null) {
			calfDot = {
				radius: Math.max(
					1.5,
					Math.sqrt(calf.share) * YEAR.maxCalfRadius
				),
				reliable: true,
			};
		} else if (calf.records > 0) {
			calfDot = { radius: 3, reliable: false };
		}

		const parts = [
			`${MONTH_NAMES[month]}: ${formatRate(rate)} encounters per cruise`,
		];
		if (activity.shares && activity.dominant) {
			parts.push(
				`mostly ${activity.dominant} (${Math.round(activity.shares[activity.dominant] * 100)}%)`
			);
		}
		if (calf.share !== null) {
			parts.push(`calves in ${Math.round(calf.share * 100)}% of groups`);
		}

		return {
			month,
			x,
			slot,
			barWidth,
			barHeight,
			segments,
			unsplit: barHeight > 0 && !activity.shares,
			calf: calfDot,
			ariaLabel: parts.join(", "),
		};
	});
});

function onMonthHover(event: MouseEvent, month: number) {
	const species = selectedSpecies.value;
	if (!species || !yearTooltipRef.value || !yearShell.value) return;
	const activity = monthActivity(species, month);
	const calf = monthCalfShare(species, month);
	const rate = monthlyRatesForSpecies.value[month] ?? 0;

	const behaviourLines = activity.shares
		? BEHAVIOUR_ORDER.map(
				(b) =>
					`<div class="tip-line">${b}: ${Math.round((activity.shares?.[b] ?? 0) * 100)}%</div>`
			).join("")
		: `<div class="tip-line">${activity.total} behaviour records: too few to split</div>`;
	const calfLine =
		calf.share !== null
			? `calves in ${calf.withCalf} of ${calf.records} groups (${Math.round(calf.share * 100)}%)`
			: `${calf.records} life-stage records: too few`;

	showTooltip(
		yearTooltipRef.value,
		yearShell.value,
		event,
		`
		<div class="tip-title">${MONTH_NAMES[month]}</div>
		<div class="tip-line">${formatRate(rate)} encounters per cruise (${species.monthlyEncounters[month]} in ${monthlyCruises.value[month]} cruises)</div>
		${behaviourLines}
		<div class="tip-line">${calfLine}</div>
	`
	);
}

// ─── Month (or all-year) facts for the side panel ────────────────────────────

const facts = computed(() => {
	const species = selectedSpecies.value;
	const month = selectedMonth.value;
	const empty = {
		rate: 0,
		encounters: 0,
		calfLabel: "–",
		cells: 0,
		activity: { total: 0, shares: null } as {
			total: number;
			shares: Record<Behaviour, number> | null;
		},
	};
	if (!species) return empty;

	const cells = Object.keys(speciesCellCountsFor(species, month)).length;

	if (month !== null) {
		const calf = monthCalfShare(species, month);
		return {
			rate: monthlyRatesForSpecies.value[month] ?? 0,
			encounters: species.monthlyEncounters[month],
			calfLabel:
				calf.share !== null
					? `${Math.round(calf.share * 100)}%`
					: `too few (${calf.records})`,
			cells,
			activity: monthActivity(species, month),
		};
	}

	// All year: pool the twelve months. Same thresholds as for one month.
	const totalCruises = monthlyCruises.value.reduce((a, b) => a + b, 0);
	const counts = Object.fromEntries(
		BEHAVIOUR_ORDER.map((b) => [
			b,
			species.monthlyBehaviour[b].reduce((x, y) => x + y, 0),
		])
	) as Record<Behaviour, number>;
	const total = BEHAVIOUR_ORDER.reduce((sum, b) => sum + counts[b], 0);
	const records = species.monthlyWithLifeStage.reduce((a, b) => a + b, 0);
	const withCalf = species.monthlyWithCalf.reduce((a, b) => a + b, 0);
	return {
		rate: totalCruises ? species.totalEncounters / totalCruises : 0,
		encounters: species.totalEncounters,
		calfLabel:
			records >= MIN_LIFE_STAGE_RECORDS
				? `${Math.round((withCalf / records) * 100)}%`
				: `too few (${records})`,
		cells,
		activity: {
			total,
			shares:
				total >= MIN_BEHAVIOUR_RECORDS
					? (Object.fromEntries(
							BEHAVIOUR_ORDER.map((b) => [b, counts[b] / total])
						) as Record<Behaviour, number>)
					: null,
		},
	};
});

// ─── Tooltip ─────────────────────────────────────────────────────────────────

function onCellHover(event: MouseEvent, cell: MonicetGridCell) {
	if (!tooltipRef.value || !mapContainer.value || !selectedSpecies.value) {
		return;
	}
	const { encounters, cruises, rate } = cellRates(
		selectedSpecies.value,
		selectedMonth.value
	).get(cell.id) ?? { encounters: 0, cruises: 0, rate: null };
	const when =
		selectedMonth.value === null
			? "2009–2020"
			: `${MONTH_NAMES[selectedMonth.value]}, all years`;
	const rateLine =
		rate === null
			? `no rate: only ${cruises} cruises reached the cell`
			: formatRate(rate);

	showTooltip(
		tooltipRef.value,
		mapContainer.value,
		event,
		`
		<div class="tip-title">${formatCellLabel(cell)}</div>
		<div class="tip-line">${rateLine}</div>
		<div class="tip-line">${encounters.toLocaleString()} encounters in ${cruises.toLocaleString()} cruises (${when})</div>
	`
	);
}

// ─── Map rates ───────────────────────────────────────────────────────────────
// The map shows encounters per cruise that reached the cell, like the bars
// above it: raw counts mostly map where boats go (see cellRate in
// src/data/selectors.ts, and its bias: cruises count only where they
// logged a sighting).

const cruiseCellLookup = computed(() =>
	indexCruiseCells(mapData.value?.cruiseCells ?? [])
);

/** Encounters, cruises and rate per grid cell, for one month or all year. */
function cellRates(
	species: NonNullable<typeof selectedSpecies.value>,
	month: number | null
) {
	const counts = speciesCellCountsFor(species, month);
	const rates = new Map<
		string,
		{ encounters: number; cruises: number; rate: number | null }
	>();
	for (const cell of mapData.value?.gridCells ?? []) {
		const cruiseCell = cruiseCellLookup.value.get(cell.id);
		const cruises =
			(month === null
				? cruiseCell?.cruises
				: cruiseCell?.monthlyCruises[month]) ?? 0;
		const encounters = counts[cell.id] ?? 0;
		rates.set(cell.id, {
			encounters,
			cruises,
			rate: cellRate(encounters, cruises),
		});
	}
	return rates;
}

/** All positive rates of a set of months, for the colour domain. */
function positiveRates(
	species: NonNullable<typeof selectedSpecies.value>,
	months: (number | null)[]
) {
	return months.flatMap((m) =>
		[...cellRates(species, m).values()]
			.map((r) => r.rate)
			.filter((r): r is number => r !== null && r > 0)
	);
}

// ─── Render map ──────────────────────────────────────────────────────────────

let dataLayer: d3.Selection<SVGGElement, unknown, null, undefined> | null =
	null;

let observationGrid: d3.Selection<
	SVGGElement,
	unknown,
	null,
	undefined
> | null = null;

function applyObservationGridVisibility() {
	observationGrid?.attr("display", showObservationGrid.value ? null : "none");
}

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
	softFilterUrl: string;
	noValueFill: string;
} | null = null;

function renderMap() {
	if (!mapContainer.value || !mapData.value || !basemap.value) return;

	const { theme, tiles } = BASEMAPS[basemapId.value];
	const {
		svg,
		cellPath,
		cellWidthPx,
		raiseLines,
		insertDataLayer,
		drawIslandLabels,
		drawObservationGrid,
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
	observationGrid = drawObservationGrid(mapData.value);
	applyObservationGridVisibility();
	enableZoom();

	base = {
		cellPath,
		insertDataLayer,
		softFilterUrl: addSoftEdgeFilter(
			svg,
			cellWidthPx,
			`${svgIdPrefix}-soft-cells`
		),
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
	applyDataLayerVisibility();
	// Soft edges as in The External: cells with a rate are blurred and
	// have no borders. Cells with no rate are hatched, on top and unblurred
	// so the hatching stays readable.
	const softCells = dataLayer.append("g").attr("filter", base.softFilterUrl);
	const noValueCells = dataLayer.append("g");

	const cells = mapData.value.gridCells;
	const species = selectedSpecies.value;
	if (!species) return;
	const month = selectedMonth.value;
	const rates = cellRates(species, month);
	const rateOf = (cell: MonicetGridCell) => rates.get(cell.id)?.rate ?? null;

	// Log scale, because the rates are still right-skewed: across the
	// months of the most common species they span about 0.02 to 3.4
	// encounters per cruise, median 0.44. On a log scale equal colour steps
	// mean equal *ratios* (0.05→0.5 looks like 0.5→5), which spreads the
	// many small rates out. The cost: absolute differences among the top
	// cells are compressed. The domain starts at the smallest positive
	// rate (log 0 is undefined); zero cells keep their own "none recorded"
	// grey below, so they never reach the scale.
	//
	// One domain for all twelve months. With a per-month domain every
	// month would have a dark cell, and a month with three sightings would
	// look as busy as July. The all-year view pools the months, so it gets
	// its own domain (the legend says which one is shown).
	const domainRates = positiveRates(
		species,
		month === null ? [null] : d3.range(12)
	);
	const minRate = d3.min(domainRates) ?? 0.01;
	const maxRate = Math.max(minRate * 2, d3.max(domainRates) ?? 0.02);
	const scale = d3
		.scaleSequentialLog(d3.interpolateRgb(...CHART_SEQUENTIAL_TEAL))
		.domain([minRate, maxRate]);
	const fill = (cell: MonicetGridCell) => {
		const rate = rateOf(cell);
		if (rate === null) return base?.noValueFill ?? "none";
		return rate > 0 ? scale(rate) : CHART_NONE_RECORDED;
	};
	if (legendContainer.value) {
		// The legend bar is evenly spaced in log space, so its midpoint
		// is the geometric mean sqrt(min · max), not the arithmetic one.
		renderGradientLegend(
			legendContainer.value,
			"d3-sp-legend",
			(t) => scale.interpolator()(t),
			{
				left: minRate.toFixed(2),
				center: Math.sqrt(minRate * maxRate).toFixed(2),
				right: maxRate.toFixed(2),
			}
		);
	}

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
			.attr("fill", fill)
			.on("mousemove", (event: MouseEvent, cell) =>
				onCellHover(event, cell)
			)
			.on("mouseleave", () => hideTooltip(tooltipRef.value));

	drawCells(
		softCells,
		cells.filter((cell) => rateOf(cell) !== null)
	);
	drawCells(
		noValueCells,
		cells.filter((cell) => rateOf(cell) === null)
	);
}

// ─── Render sparkline ────────────────────────────────────────────────────────

function renderSparkline() {
	const species = selectedSpecies.value;
	if (!sparklineContainer.value || !species || !mapData.value) return;
	d3.select(sparklineContainer.value).selectAll("*").remove();

	// Encounters per cruise per year, for the same reason as the monthly
	// bars: the number of trips changed a lot between years.
	type Point = { year: number; rate: number };
	const { years, yearlyCruises } = mapData.value.meta;
	const rates = yearlyRates(species.yearlyEncounters, yearlyCruises, years);
	const data: Point[] = years.map((year, i) => ({ year, rate: rates[i] }));

	const w = sparklineContainer.value.clientWidth || 240;
	const h = 68;
	const margin = { left: 28, right: 6, top: 6, bottom: 16 };

	const firstYear = years[0] ?? 2009;
	const lastYear = years[years.length - 1] ?? 2020;
	const x = d3
		.scaleLinear()
		.domain([firstYear, lastYear])
		.range([margin.left, w - margin.right]);
	// Floor the axis so a species with almost no sightings still gets a
	// non-zero domain.
	const yMax = Math.max(0.01, d3.max(data, (d) => d.rate) ?? 0);
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
		.y1((d) => y(d.rate))
		.curve(d3.curveMonotoneX);

	const line = d3
		.line<Point>()
		.x((d) => x(d.year))
		.y((d) => y(d.rate))
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
		.attr("cy", (d) => y(d.rate))
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
	label(margin.left - 3, margin.top + 4, yMax.toFixed(2), "end");
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
		selectedMonth.value = peakMonth();
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

// Open each species on its own peak month, so the map starts where the
// animal is most often met.
function peakMonth(): number | null {
	const rates = monthlyRatesForSpecies.value;
	return rates.length && Math.max(...rates) > 0
		? bestMonthIndex(rates)
		: null;
}

watch(selectedSpeciesId, async () => {
	if (loading.value) return;
	selectedMonth.value = peakMonth();
	renderDataLayer();
	await nextTick();
	renderSparkline();
});

watch(selectedMonth, () => {
	if (!loading.value) renderDataLayer();
});

watch(basemapId, () => {
	if (!loading.value) renderMap();
});

watch(dataLayerOpacity, applyDataLayerVisibility);

// Toggling the data layer only hides it: no redraw, so tiles don't reload.
watch(showObservationGrid, applyObservationGridVisibility);

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

// ─── My year ─────────────────────────────────────────────────────────────────

.year-card {
	background: rgba($surface, 0.92);
	border: 1px solid rgba($primary, 0.2);
	border-radius: 10px;
	padding: 0.9rem 1rem 0.75rem;
	margin-bottom: 1rem;
}

.year-head {
	display: flex;
	justify-content: space-between;
	align-items: flex-start;
	gap: 1rem;

	h3 {
		margin: 0;
		font-size: 1rem;
		color: $primary;
	}
}

.year-sub {
	margin: 0.2rem 0 0.4rem;
	font-size: 0.8rem;
	color: $text-secondary;
	max-width: 60ch;
}

.all-year {
	flex-shrink: 0;
	padding: 0.3rem 0.8rem;
	border-radius: 999px;
	border: 1px solid $border;
	background: $surface;
	font-size: 0.8rem;
	cursor: pointer;

	&.active {
		background: $primary;
		border-color: $primary;
		color: $surface;
	}
}

.year-shell {
	position: relative;
}

.year-chart {
	display: block;
	width: 100%;
	height: auto;
	overflow: visible;

	.axis-label,
	.month-tick {
		font-size: 11px;
		fill: $text-secondary;
	}

	.row-label {
		font-style: italic;
	}

	.baseline {
		stroke: $border;
	}

	.hit {
		fill: transparent;
	}

	.month-col {
		cursor: pointer;
		outline: none;

		&:hover .hit {
			fill: rgba($primary, 0.05);
		}

		&.selected .hit {
			fill: rgba($primary, 0.12);
		}

		&.selected .month-tick {
			fill: $text-primary;
			font-weight: 700;
		}

		&:focus-visible .hit {
			stroke: $primary;
			stroke-width: 2;
		}
	}

	.unsplit {
		fill: none;
		stroke: $text-secondary;
		stroke-dasharray: 3 2;
	}

	.calf {
		fill: $text-secondary;

		&.few {
			fill: none;
			stroke: $text-secondary;
		}
	}
}

.behaviour-legend,
.activity-list {
	list-style: none;
	margin: 0;
	padding: 0;
	font-size: 0.78rem;
	color: $text-secondary;
}

.behaviour-legend {
	display: flex;
	flex-wrap: wrap;
	gap: 0.3rem 1rem;
	margin-top: 0.4rem;

	li {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
	}
}

.swatch {
	display: inline-block;
	width: 10px;
	height: 10px;
	border-radius: 2px;
	flex-shrink: 0;
}

.unsplit-swatch {
	border: 1px dashed $text-secondary;
}

.dot-swatch {
	display: inline-block;
	width: 10px;
	height: 10px;
	border-radius: 50%;
	background: $text-secondary;

	&.few {
		width: 6px;
		height: 6px;
		background: none;
		border: 1px solid $text-secondary;
	}
}

.map-heading {
	padding: 0.5rem 0.75rem;
	font-size: 0.85rem;
	color: $text-primary;
	border-bottom: 1px solid rgba($primary, 0.16);
	background: rgba($surface, 0.92);
}

// ─── Reason and month facts ──────────────────────────────────────────────────

.reason {
	padding: 0.6rem 0.7rem;
	border-radius: 8px;
	background: rgba($primary, 0.06);
	border: 1px solid rgba($primary, 0.16);

	details {
		font-size: 0.72rem;
		color: $text-secondary;

		ul {
			margin: 0.3rem 0 0;
			padding-left: 1rem;
		}
	}
}

.reason-kicker {
	font-size: 0.7rem;
	color: $text-secondary;
}

.reason-title {
	font-size: 0.98rem;
	font-weight: 700;
	color: $primary;
	margin: 0.1rem 0 0.2rem;
}

.reason-text {
	margin: 0 0 0.3rem;
	font-size: 0.82rem;
	line-height: 1.45;
}

.reason-missing {
	margin: 0;
	font-size: 0.74rem;
	font-style: italic;
	color: $text-secondary;
}

.month-facts {
	display: flex;
	flex-direction: column;
	gap: 0.35rem;
}

.facts-title {
	font-size: 0.8rem;
	font-weight: 700;
	text-transform: capitalize;
	color: $text-primary;
}

.activity-list li {
	display: flex;
	align-items: center;
	gap: 0.4rem;
	padding: 0.1rem 0.4rem;

	.activity-name {
		flex: 1;
	}

	strong {
		color: $text-primary;
	}
}

.activity-n {
	margin: 0;
	font-size: 0.72rem;
	color: $text-secondary;
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
