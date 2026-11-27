<template>
	<div class="d3-explorer">
		<div class="toolbar">
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
							Encounters per cruise by month, coloured by
							behaviour, with calf share below. Pick a month to
							filter the map.
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
						&lt; {{ MIN_BEHAVIOUR_RECORDS }} behaviour records
					</li>
					<li>
						<span class="dot-swatch"></span>
						calf share
					</li>
				</ul>
			</section>

			<div class="layout">
				<div class="map-shell">
					<div class="map-heading">
						Where met in <strong>{{ monthName }}</strong>
					</div>
					<div ref="mapContainer" class="map-container"></div>
					<div class="legend-shell">
						<div class="legend-title">
							Encounters per cruise in {{ monthName }} (log scale)
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
							<div class="reason-title">{{ reason.title }}</div>
							<p class="reason-text">{{ reason.text }}</p>
							<details v-if="reason.sources.length">
								<summary>Background sources</summary>
								<ul>
									<li
										v-for="src in reason.sources"
										:key="src"
									>
										{{ src }}
									</li>
								</ul>
							</details>
						</div>

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
								<span>Active cells</span>
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
							</ul>
						</div>

						<div class="chart-section">
							<div class="chart-label">
								Year by year (encounters / cruise)
							</div>
							<div
								ref="sparklineContainer"
								class="sparkline"
							></div>
						</div>
					</div>

					<div class="caveat">
						Behaviour reflects arrival state; winter months have few
						cruises ({{ quietestMonth }}). Map rates divide by
						cruises that logged a sighting in each cell.
					</div>
				</aside>
			</div>
		</template>
	</div>
</template>

<script setup lang="ts">
// The Animal: one species across its year (encounters/cruise, behaviour,
// calves), filtered map on a clean wireframe coastline, and yearly sparkline.
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
import { addNoValuePattern, drawBaseMap, WIREFRAME_THEME } from "@/lib/map";
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
	maxCalfRadius: 13,
	segmentGap: 2,
};

interface YearColumn {
	month: number;
	x: number;
	slot: number;
	barWidth: number;
	barHeight: number;
	segments: { behaviour: Behaviour; y: number; height: number }[];
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
		: `<div class="tip-line">${activity.total} behaviour records (too few to split)</div>`;
	const calfLine =
		calf.share !== null
			? `calves in ${calf.withCalf} of ${calf.records} groups (${Math.round(calf.share * 100)}%)`
			: `${calf.records} life-stage records`;

	showTooltip(
		yearTooltipRef.value,
		yearShell.value,
		event,
		`
		<div class="tip-title">${MONTH_NAMES[month]}</div>
		<div class="tip-line">${formatRate(rate)} (${species.monthlyEncounters[month]} in ${monthlyCruises.value[month]} cruises)</div>
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
		rate === null ? `no rate (${cruises} cruises)` : formatRate(rate);

	showTooltip(
		tooltipRef.value,
		mapContainer.value,
		event,
		`
		<div class="tip-title">${formatCellLabel(cell)}</div>
		<div class="tip-line">${rateLine}</div>
		<div class="tip-line">${encounters.toLocaleString()} in ${cruises.toLocaleString()} cruises (${when})</div>
	`
	);
}

// ─── Map rates ───────────────────────────────────────────────────────────────

const cruiseCellLookup = computed(() =>
	indexCruiseCells(mapData.value?.cruiseCells ?? [])
);

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
			fallbackWidth: 720,
			minHeight: 360,
			aspect: 0.62,
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

	const cells = mapData.value.gridCells;
	const species = selectedSpecies.value;
	if (!species) return;
	const month = selectedMonth.value;
	const rates = cellRates(species, month);
	const rateOf = (cell: MonicetGridCell) => rates.get(cell.id)?.rate ?? null;

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
		renderGradientLegend(
			legendContainer.value,
			`${svgIdPrefix}-sp-legend`,
			(t) => scale.interpolator()(t),
			{
				left: minRate.toFixed(2),
				center: Math.sqrt(minRate * maxRate).toFixed(2),
				right: maxRate.toFixed(2),
			}
		);
	}

	dataLayer
		.selectAll("path")
		.data(cells)
		.join("path")
		.attr("d", base.cellPath)
		.attr("fill", fill)
		.attr("fill-opacity", 0.9)
		.attr("stroke", "rgba(26,26,26,0.2)")
		.attr("stroke-width", 0.5)
		.on("mousemove", (event: MouseEvent, cell) => onCellHover(event, cell))
		.on("mouseleave", () => hideTooltip(tooltipRef.value));
}

// ─── Render sparkline ────────────────────────────────────────────────────────

function renderSparkline() {
	const species = selectedSpecies.value;
	if (!sparklineContainer.value || !species || !mapData.value) return;
	d3.select(sparklineContainer.value).selectAll("*").remove();

	type Point = { year: number; rate: number };
	const { years, yearlyCruises } = mapData.value.meta;
	const rates = yearlyRates(species.yearlyEncounters, yearlyCruises, years);
	const data: Point[] = years.map((year, i) => ({ year, rate: rates[i] }));

	const w = sparklineContainer.value.clientWidth || 240;
	const h = 84;
	const margin = { left: 36, right: 6, top: 8, bottom: 20 };

	const firstYear = years[0] ?? 2009;
	const lastYear = years[years.length - 1] ?? 2020;
	const x = d3
		.scaleLinear()
		.domain([firstYear, lastYear])
		.range([margin.left, w - margin.right]);
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
		.attr("fill-opacity", 0.1);

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
			.attr("font-size", 12)
			.attr("fill", CHART_TEXT_SECONDARY)
			.text(text);

	label(margin.left - 4, margin.top + 5, yMax.toFixed(2), "end");
	label(margin.left - 4, h - margin.bottom, "0", "end");
	label(x(firstYear), h, String(firstYear));
	label(x(lastYear), h, String(lastYear), "end");
}

// ─── Lifecycle ───────────────────────────────────────────────────────────────

function handleResize() {
	renderMap();
	renderSparkline();
}

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
</script>

<style scoped lang="scss">
.d3-explorer {
	position: relative;
}

.toolbar {
	margin-bottom: 0.85rem;
}

.control {
	display: flex;
	align-items: center;
	gap: 0.5rem;

	label {
		font-size: 0.84rem;
		font-weight: 600;
		color: $text-secondary;
		white-space: nowrap;
	}

	select {
		padding: 0.35rem 0.55rem;
		border-radius: $radius-sm;
		border: 1px solid $border;
		font-size: 0.84rem;
		min-width: 210px;
		max-width: 320px;
		background-color: $surface;
		color: $text-primary;
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
	min-height: 360px;
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
	max-width: 240px;
}

:deep(.tip-title) {
	font-weight: 700;
	margin-bottom: 0.2rem;
}

// ─── My year ─────────────────────────────────────────────────────────────────

.year-card {
	background: $surface;
	border: 1px solid $border;
	border-radius: $radius-md;
	padding: 1rem 1.15rem 0.85rem;
	margin-bottom: 1.25rem;
}

.year-head {
	display: flex;
	justify-content: space-between;
	align-items: flex-start;
	gap: 1rem;

	h3 {
		margin: 0;
		font-size: 0.98rem;
		color: $text-primary;
	}
}

.year-sub {
	margin: 0.2rem 0 0.5rem;
	font-size: 0.82rem;
	color: $text-secondary;
}

.all-year {
	flex-shrink: 0;
	padding: 0.3rem 0.8rem;
	border-radius: 999px;
	border: 1px solid $border;
	background: $surface;
	color: $text-primary;
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
		font-size: 12px;
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
	margin-top: 0.45rem;

	li {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		margin: 0;
		padding: 0;
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
	width: 9px;
	height: 9px;
	border-radius: 50%;
	background: $text-secondary;
}

.map-heading {
	padding: 0.55rem 0.85rem;
	font-size: 0.84rem;
	color: $text-secondary;
	border-bottom: 1px solid $border;
	background: $surface;

	strong {
		color: $text-primary;
	}
}

// ─── Reason and month facts ──────────────────────────────────────────────────

.reason {
	padding-bottom: 0.75rem;
	border-bottom: 1px solid $border;

	details {
		font-size: 0.74rem;
		color: $text-secondary;

		ul {
			margin: 0.3rem 0 0;
			padding-left: 1rem;
		}
	}
}

.reason-title {
	font-size: 0.92rem;
	font-weight: 700;
	color: $primary;
	margin: 0 0 0.2rem;
}

.reason-text {
	margin: 0 0 0.35rem;
	font-size: 0.82rem;
	line-height: 1.5;
	color: $text-secondary;
}

.month-facts {
	display: flex;
	flex-direction: column;
}

.facts-title {
	font-size: 0.76rem;
	font-weight: 600;
	text-transform: uppercase;
	letter-spacing: 0.04em;
	color: $text-secondary;
	margin-bottom: 0.2rem;
}

.activity-list {
	margin-top: 0.4rem;

	li {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		padding: 0.18rem 0;
		margin: 0;

		.activity-name {
			flex: 1;
		}

		strong {
			color: $text-primary;
			font-variant-numeric: tabular-nums;
		}
	}
}

// ─── Species panel ───────────────────────────────────────────────────────────

.species-panel {
	background: $surface;
	border: 1px solid $border;
	border-radius: $radius-md;
	padding: 1.05rem 1.15rem;
	display: flex;
	flex-direction: column;
	gap: 0.75rem;
}

.panel-content {
	display: flex;
	flex-direction: column;
	gap: 0.75rem;
	flex: 1;
}

.species-name {
	display: flex;
	flex-direction: column;
	gap: 0.1rem;
	border-bottom: 1px solid $border;
	padding-bottom: 0.55rem;

	strong {
		font-size: 1rem;
		color: $text-primary;
	}

	em {
		font-size: 0.78rem;
		color: $text-secondary;
	}
}

.metric-row {
	display: flex;
	justify-content: space-between;
	align-items: baseline;
	gap: 0.75rem;
	font-size: 0.84rem;
	padding: 0.38rem 0;
	border-bottom: 1px solid rgba($border, 0.7);
	color: $text-secondary;

	strong {
		color: $text-primary;
		font-variant-numeric: tabular-nums;
	}
}

.chart-section {
	display: flex;
	flex-direction: column;
	gap: 0.25rem;
}

.chart-label {
	font-size: 0.76rem;
	font-weight: 600;
	color: $text-secondary;
}

.sparkline {
	width: 100%;
	min-height: 68px;
}

.caveat {
	margin-top: 0.2rem;
	font-size: 0.76rem;
	line-height: 1.5;
	color: $text-secondary;
	padding-top: 0.6rem;
	border-top: 1px solid $border;
}

@media (max-width: 1024px) {
	.layout {
		grid-template-columns: 1fr;
	}
	.map-container {
		min-height: 320px;
	}
}

@media (max-width: 680px) {
	.control select {
		min-width: 0;
		width: 100%;
	}
}
</style>
