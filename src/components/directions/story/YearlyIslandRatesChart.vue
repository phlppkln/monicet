<template>
	<figure class="story-chart" :class="{ morphing: isMorphing }">
		<div
			v-if="!isMorphing"
			class="chart-meta"
			:style="{ opacity: chromeOpacity }"
		>
			<span class="layer-key">
				<span class="line-swatch" aria-hidden="true"></span>
				Lines: encounters / cruise (left axis)
			</span>
			<span class="layer-key">
				<span class="bar-swatch" aria-hidden="true"></span>
				Bars: cruises per year (right axis, n =
				{{ totalCruises.toLocaleString() }})
			</span>
		</div>

		<div class="chart-shell">
			<div
				ref="chartContainer"
				class="chart-container"
				role="img"
				aria-label="Combined chart showing yearly whale-watching cruises per island group as background stacked bars and encounters per cruise as foreground lines from 2009 to 2020"
			></div>
			<div ref="tooltipRef" class="tooltip"></div>
		</div>

		<figcaption
			v-if="!isMorphing"
			class="caption"
			:style="{ opacity: chromeOpacity }"
		>
			Background bars show how cruise effort shifted across São Miguel,
			Faial/Pico (joined 2011), and Terceira (2015–2019), peaking at 1,398
			trips in 2017 before dropping to 287 in 2020. Foreground lines show
			each island's encounters per cruise normalized by its own effort;
			unmonitored years stay blank.
		</figcaption>
	</figure>
</template>

<script setup lang="ts">
// Chapter 1: yearly encounter rates per island (foreground lines, left axis)
// layered over yearly cruise effort by island (background stacked bars, right axis).
import * as d3 from "d3";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";

import { yearlyIslandRates, type YearlyIslandPoint } from "@/data/selectors";
import {
	CHART_BORDER,
	CHART_ISLAND_GROUP,
	CHART_TEXT_PRIMARY,
	CHART_TEXT_SECONDARY,
} from "@/lib/chartTokens";
import { formatRate } from "@/lib/format";
import { hideTooltip, showTooltip } from "@/lib/tooltip";
import type { IslandGroup, MonicetMapData } from "@/types/monicet";

const props = defineProps<{
	data: MonicetMapData;
	/** 0..1 when rendered as the scroll-morphing overlay; undefined for normal flow. */
	morphProgress?: number;
	/** Optional linked year from the map explorer to highlight in side-by-side layout. */
	activeYear?: number | null;
}>();

const emit = defineEmits<{
	"select:year": [year: number];
}>();

const isMorphing = computed(() => props.morphProgress !== undefined);
const chromeOpacity = computed(() =>
	props.morphProgress === undefined
		? 1
		: Math.max(0, 1 - props.morphProgress * 2.8)
);

const ISLAND_ORDER: IslandGroup[] = ["São Miguel", "Faial/Pico", "Terceira"];

const chartContainer = ref<HTMLElement | null>(null);
const tooltipRef = ref<HTMLElement | null>(null);

const totalCruises = computed(() => props.data.meta.totalCruiseEvents);

interface YearCruiseRow {
	year: number;
	"São Miguel": number;
	"Faial/Pico": number;
	Terceira: number;
	total: number;
}

const cruiseRows = computed<YearCruiseRow[]>(() => {
	const byIsland = props.data.meta.yearlyCruisesByIsland;
	return props.data.meta.years.map((year) => {
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

const series = computed(() =>
	yearlyIslandRates(
		props.data.gridCells,
		props.data.meta.yearlyCruisesByIsland,
		props.data.meta.years
	)
);

function renderChart() {
	const container = chartContainer.value;
	if (!container) return;

	d3.select(container).selectAll("*").remove();

	const years = props.data.meta.years;
	const morph = props.morphProgress ?? 0;
	const width = container.clientWidth || 760;
	const height = isMorphing.value
		? Math.max(84, container.clientHeight || 88)
		: 320;
	// Shrink margins smoothly toward the compact preview padding during scroll morph
	const margin = isMorphing.value
		? {
				top: Math.round(6 + (1 - morph) * 26),
				right: Math.round(8 + (1 - morph) * 110),
				bottom: Math.round(6 + (1 - morph) * 26),
				left: Math.round(8 + (1 - morph) * 38),
			}
		: { top: 32, right: 118, bottom: 32, left: 46 };
	const innerW = Math.max(120, width - margin.left - margin.right);
	const innerH = Math.max(40, height - margin.top - margin.bottom);

	const svg = d3
		.select(container)
		.append("svg")
		.attr("viewBox", `0 0 ${width} ${height}`)
		.style("width", "100%")
		.style("height", "auto");

	const g = svg
		.append("g")
		.attr("transform", `translate(${margin.left},${margin.top})`);

	const xBand = d3
		.scaleBand<number>()
		.domain(years)
		.range([0, innerW])
		.padding(0.28);

	const xCenter = (yr: number) => (xBand(yr) ?? 0) + xBand.bandwidth() / 2;

	// Left axis: encounters per cruise (foreground lines)
	const allRates = series.value.flatMap((s) =>
		s.points.map((p) => p.rate).filter((r): r is number => r !== null)
	);
	const maxRate = Math.ceil((d3.max(allRates) ?? 5) + 0.5);
	const yRate = d3.scaleLinear().domain([0, maxRate]).range([innerH, 0]);

	// Right axis: cruises per year (background stacked bars)
	const maxCruises = d3.max(cruiseRows.value, (d) => d.total) ?? 1400;
	const yCruises = d3
		.scaleLinear()
		.domain([0, Math.ceil(maxCruises / 200) * 200])
		.range([innerH, 0]);

	// Subtle horizontal gridlines aligned to the primary (left) rate axis
	if (chromeOpacity.value > 0.02) {
		g.append("g")
			.attr("opacity", chromeOpacity.value)
			.selectAll("line")
			.data(yRate.ticks(4))
			.join("line")
			.attr("x1", 0)
			.attr("x2", innerW)
			.attr("y1", (d) => yRate(d))
			.attr("y2", (d) => yRate(d))
			.attr("stroke", CHART_BORDER)
			.attr("stroke-dasharray", (d) => (d === 0 ? "none" : "2,3"));
	}

	// ── Background layer (ground): stacked cruise bars ───────────────────────
	const stack = d3.stack<YearCruiseRow, IslandGroup>().keys(ISLAND_ORDER);
	const stacked = stack(cruiseRows.value);
	const linkedYear = props.activeYear ?? null;

	g.append("g")
		.attr("class", "bg-bars")
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
			linkedYear !== null && d.data.year === linkedYear ? 0.42 : 0.16
		)
		.attr("stroke", "#ffffff")
		.attr("stroke-width", 0.6);

	// ── Foreground layer (figure): encounters-per-cruise lines ───────────────
	const lineGen = d3
		.line<YearlyIslandPoint>()
		.defined((d) => d.rate !== null)
		.x((d) => xCenter(d.year))
		.y((d) => yRate(d.rate ?? 0));

	for (const s of series.value) {
		const color = CHART_ISLAND_GROUP[s.island];

		g.append("path")
			.datum(s.points)
			.attr("fill", "none")
			.attr("stroke", "#ffffff")
			.attr("stroke-width", 4.5)
			.attr("stroke-linejoin", "round")
			.attr("stroke-linecap", "round")
			.attr("d", lineGen);

		g.append("path")
			.datum(s.points)
			.attr("fill", "none")
			.attr("stroke", color)
			.attr("stroke-width", 2.4)
			.attr("stroke-linejoin", "round")
			.attr("stroke-linecap", "round")
			.attr("d", lineGen);

		g.append("g")
			.selectAll("circle")
			.data(s.points.filter((p) => p.rate !== null))
			.join("circle")
			.attr("cx", (d) => xCenter(d.year))
			.attr("cy", (d) => yRate(d.rate ?? 0))
			.attr("r", 3.8)
			.attr("fill", color)
			.attr("stroke", "#ffffff")
			.attr("stroke-width", 1.2);
	}

	// Direct labels at the right edge of the plot (shifted past the right axis)
	const labelEntries = series.value
		.map((s) => {
			const last = [...s.points].reverse().find((p) => p.rate !== null);
			return last && last.rate !== null
				? {
						island: s.island,
						color: CHART_ISLAND_GROUP[s.island],
						y: yRate(last.rate),
					}
				: null;
		})
		.filter((d): d is NonNullable<typeof d> => d !== null)
		.sort((a, b) => a.y - b.y);

	// Prevent label overlap if two endpoints sit close vertically
	const minGap = 15;
	for (let i = 1; i < labelEntries.length; i++) {
		if (labelEntries[i].y - labelEntries[i - 1].y < minGap) {
			labelEntries[i].y = labelEntries[i - 1].y + minGap;
		}
	}

	if (chromeOpacity.value > 0.02) {
		const chrome = g.append("g").attr("opacity", chromeOpacity.value);

		for (const entry of labelEntries) {
			chrome
				.append("text")
				.attr("x", innerW + 44)
				.attr("y", entry.y + 4)
				.attr("fill", entry.color)
				.attr("font-size", 12)
				.attr("font-weight", 600)
				.text(entry.island);
		}

		// ── Axes ─────────────────────────────────────────────────────────────
		const xAxis = d3
			.axisBottom(xBand)
			.tickSize(0)
			.tickPadding(10)
			.tickFormat((d) => (width < 480 && d % 2 === 1 ? "" : String(d)));

		chrome
			.append("g")
			.attr("transform", `translate(0,${innerH})`)
			.call(xAxis)
			.call((axis) => axis.select(".domain").remove())
			.selectAll("text")
			.attr("fill", CHART_TEXT_SECONDARY)
			.attr("font-size", 12);

		// Left axis (primary: encounters / cruise)
		chrome
			.append("g")
			.call(d3.axisLeft(yRate).ticks(4).tickSize(0).tickPadding(8))
			.call((axis) => axis.select(".domain").remove())
			.selectAll("text")
			.attr("fill", CHART_TEXT_PRIMARY)
			.attr("font-size", 12);

		chrome
			.append("text")
			.attr("x", -margin.left + 2)
			.attr("y", -14)
			.attr("fill", CHART_TEXT_PRIMARY)
			.attr("font-size", 12)
			.attr("font-weight", 600)
			.text("Encounters / cruise");

		// Right axis (background: cruises)
		chrome
			.append("g")
			.attr("transform", `translate(${innerW},0)`)
			.call(d3.axisRight(yCruises).ticks(4).tickSize(0).tickPadding(6))
			.call((axis) => axis.select(".domain").remove())
			.selectAll("text")
			.attr("fill", CHART_TEXT_SECONDARY)
			.attr("opacity", 0.75)
			.attr("font-size", 11);

		chrome
			.append("text")
			.attr("x", innerW + 34)
			.attr("y", -14)
			.attr("text-anchor", "end")
			.attr("fill", CHART_TEXT_SECONDARY)
			.attr("opacity", 0.85)
			.attr("font-size", 11.5)
			.text("Cruises");
	}

	// ── Hover column highlight + unified tooltip ─────────────────────────────
	const hoverHighlight = g
		.append("rect")
		.attr("y", 0)
		.attr("width", xBand.bandwidth())
		.attr("height", innerH)
		.attr("fill", CHART_TEXT_PRIMARY)
		.attr("fill-opacity", 0.04)
		.attr("pointer-events", "none")
		.style("opacity", 0);

	g.append("g")
		.selectAll("rect")
		.data(years)
		.join("rect")
		.attr("x", (yr) => xBand(yr) ?? 0)
		.attr("y", 0)
		.attr("width", xBand.bandwidth())
		.attr("height", innerH)
		.attr("fill", "transparent")
		.attr("tabindex", 0)
		.attr("role", "button")
		.style("cursor", "pointer")
		.attr("aria-label", (yr) => {
			const row = cruiseRows.value.find((r) => r.year === yr);
			return `${yr}: ${row?.total ?? 0} cruises. Select to show ${yr} on the map.`;
		})
		.on("click", (_event, yr) => {
			emit("select:year", yr);
		})
		.on("keydown", (event: KeyboardEvent, yr) => {
			if (event.key === "Enter" || event.key === " ") {
				event.preventDefault();
				emit("select:year", yr);
			}
		})
		.on("mousemove", (event: MouseEvent, yr) => {
			if (!tooltipRef.value || !container) return;
			hoverHighlight.attr("x", xBand(yr) ?? 0).style("opacity", 1);
			const row = cruiseRows.value.find((r) => r.year === yr);
			const lines = series.value.map((s) => {
				const pt = s.points.find((p) => p.year === yr);
				if (!pt || pt.rate === null) {
					return `${s.island}: no cruises`;
				}
				return `${s.island}: <strong>${formatRate(pt.rate)}</strong> (${pt.cruises.toLocaleString()} cruises)`;
			});
			showTooltip(
				tooltipRef.value,
				container,
				event,
				`<strong>${yr} · ${(row?.total ?? 0).toLocaleString()} cruises</strong><br/>${lines.join("<br/>")}`
			);
		})
		.on("mouseleave blur", () => {
			hoverHighlight.style("opacity", 0);
			hideTooltip(tooltipRef.value);
		});
}

onMounted(() => {
	renderChart();
	window.addEventListener("resize", renderChart);
});

onBeforeUnmount(() => {
	window.removeEventListener("resize", renderChart);
});

watch(() => [props.data, props.morphProgress, props.activeYear], renderChart);
</script>

<style scoped lang="scss">
.story-chart {
	margin: 0;
	background: $surface;
	border: 1px solid $border;
	border-radius: $radius-md;
	padding: 1.25rem 1.35rem;

	&.morphing {
		width: 100%;
		height: 100%;
		padding: 0.45rem 0.65rem;
		background: rgba($surface, 0.94);
		box-shadow: $shadow-sm;
		display: flex;
		flex-direction: column;
		justify-content: center;

		.chart-shell,
		.chart-container {
			width: 100%;
			height: 100%;
		}
	}
}

.chart-meta {
	display: flex;
	flex-wrap: wrap;
	justify-content: flex-end;
	gap: 0.5rem 1.25rem;
	margin-bottom: 0.4rem;
	font-size: 0.8rem;
	color: $text-secondary;
}

.layer-key {
	display: inline-flex;
	align-items: center;
	gap: 0.45rem;
}

.line-swatch {
	width: 16px;
	height: 2.5px;
	border-radius: 2px;
	background: $primary;
	display: inline-block;
}

.bar-swatch {
	width: 11px;
	height: 11px;
	border-radius: 2px;
	background: rgba($primary, 0.2);
	border: 1px solid rgba($primary, 0.35);
	display: inline-block;
}

.chart-shell {
	position: relative;
}

.tooltip {
	position: absolute;
	top: 0;
	left: 0;
	pointer-events: none;
	opacity: 0;
	background: rgba($text-primary, 0.92);
	color: $text-on-primary;
	padding: 0.5rem 0.7rem;
	border-radius: $radius-sm;
	font-size: 0.78rem;
	line-height: 1.45;
	white-space: nowrap;
	transition: opacity 0.12s ease;
	z-index: 4;
}

.caption {
	margin-top: 0.75rem;
	font-size: 0.82rem;
	color: $text-secondary;
	line-height: 1.5;
}
</style>
