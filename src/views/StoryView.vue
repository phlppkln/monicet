<template>
	<article class="story-page">
		<header class="masthead">
			<span class="brand">MONICET · Azores 2009–2020</span>
			<nav class="top-nav" aria-label="Explorations">
				<a :href="href(ROUTES.threeWays)">Three Ways of Looking</a>
				<a :href="href(ROUTES.fillingTheGaps)">Filling the Gaps</a>
			</nav>
		</header>

		<section class="hero">
			<h1>Twelve years at sea</h1>
			<p class="lead">
				29,400 whale-watching sightings across 8,455 cruises in the
				Azores (2009–2020). Before asking how marine life changed, we
				need to see who was out on the water each year — and where the
				archive goes silent.
			</p>
		</section>

		<div v-if="error" class="status error">{{ error }}</div>

		<div v-if="mapData" class="viz-grid">
			<!-- Card 1: Effort & yearly rates combined -->
			<section class="chapter viz-card" id="yearly-rates">
				<div class="chapter-head">
					<span class="chapter-num"
						>01 · Effort &amp; yearly rates</span
					>
					<h2>
						Encounters per cruise against the cruises behind them
					</h2>
					<p>
						The archive did not monitor the same islands across all
						twelve years. Placing yearly cruises behind each
						island's encounter rate shows both the shifting effort
						and how sightings moved once normalized by each island's
						own trips.
					</p>
				</div>
				<div
					ref="originRef"
					class="chart-origin"
					:class="{ 'is-morphing': morphActive && morphT > 0 }"
				>
					<YearlyIslandRatesChart
						:data="mapData"
						:active-year="isSideBySide ? activeMapYear : null"
						@select:year="onSelectYear"
					/>
				</div>
			</section>

			<!-- Card 2: Year-by-year map -->
			<section v-if="basemap" class="chapter viz-card" id="yearly-map">
				<div class="chapter-head">
					<span class="chapter-num">02 · Space and time</span>
					<h2>Watch coverage and rates shift year by year</h2>
					<p>
						Step through 2009–2020 on a fixed colour scale. Hover or
						focus any cell for its cruise and encounter details;
						cells without recorded cruises stay hatched.
					</p>
				</div>
				<YearlyMapExplorer
					ref="mapExplorerRef"
					:data="mapData"
					:basemap="basemap"
					:lines="mapLines"
					:show-preview="!isSideBySide"
					:preview-visible="!morphActive || morphT >= 1"
					@update:year="activeMapYear = $event"
				/>
			</section>
		</div>

		<!-- Scroll-driven shrinking overlay bridging Chapter 1 → Chapter 2 (stacked layout) -->
		<div
			v-if="mapData && morphActive && morphT > 0 && morphT < 1"
			class="morph-overlay"
			:style="morphStyle"
			aria-hidden="true"
		>
			<YearlyIslandRatesChart :data="mapData" :morph-progress="morphT" />
		</div>

		<!-- Chapter 3: Continue exploring -->
		<section class="chapter next-chapter" id="continue">
			<div class="chapter-head">
				<span class="chapter-num">03 · Continue exploring</span>
				<h2>Gaps and other lenses on the same archive</h2>
				<p>
					Opportunistic sightings leave unmonitored island-years and
					sparse cells. Explore how gap-filling methods handle missing
					data, or view the archive from the observer's, outsider's,
					and animal's perspectives.
				</p>
			</div>
			<div class="next-actions">
				<a class="cta-primary" :href="href(ROUTES.threeWays)">
					Three Ways of Looking →
				</a>
				<a class="cta-secondary" :href="href(ROUTES.fillingTheGaps)">
					Filling the Gaps →
				</a>
			</div>
		</section>

		<footer class="story-footer">
			<strong>Data:</strong> MONICET Darwin Core Archive (2009–2020),
			González García et al. 2023 (<a
				href="https://doi.org/10.3897/BDJ.11.e106991"
				target="_blank"
				rel="noopener noreferrer"
				>DOI 10.3897/BDJ.11.e106991</a
			>
			·
			<a
				href="https://doi.org/10.14284/599"
				target="_blank"
				rel="noopener noreferrer"
				>Dataset DOI 10.14284/599</a
			>). Counts are opportunistic encounters per cruise, not population
			estimates.
		</footer>
	</article>
</template>

<script setup lang="ts">
// Main entry page: yearly exploration of the MONICET archive (2009–2020).
// On wide displays (≥ 1100px) both visualizations sit side-by-side as linked
// cards; on stacked displays scrolling shrinks Visualization 1 into the map's
// inset preview card.
import { computed, onBeforeUnmount, onMounted, ref } from "vue";

import YearlyIslandRatesChart from "@/components/directions/story/YearlyIslandRatesChart.vue";
import YearlyMapExplorer from "@/components/directions/story/YearlyMapExplorer.vue";
import { useMonicetData } from "@/data/useMonicetData";
import { href, ROUTES } from "@/routes";

const SIDE_BY_SIDE_MIN_WIDTH = 1100;

const { mapData, basemap, mapLines, error, load, loadMapLines } =
	useMonicetData();

const originRef = ref<HTMLElement | null>(null);
const mapExplorerRef = ref<InstanceType<typeof YearlyMapExplorer> | null>(null);

const isSideBySide = ref(
	typeof window !== "undefined" && window.innerWidth >= SIDE_BY_SIDE_MIN_WIDTH
);
const activeMapYear = ref<number>(2020);

function onSelectYear(year: number) {
	activeMapYear.value = year;
	mapExplorerRef.value?.jumpToYear(year);
}

const morphActive = ref(false);
const morphT = ref(0);
const morphRect = ref({ left: 0, top: 0, width: 0, height: 0 });

const morphStyle = computed(() => ({
	transform: `translate3d(${morphRect.value.left}px, ${morphRect.value.top}px, 0)`,
	width: `${morphRect.value.width}px`,
	height: `${morphRect.value.height}px`,
}));

function easeInOutCubic(t: number): number {
	return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function lerp(a: number, b: number, t: number): number {
	return a + (b - a) * t;
}

let rafId: number | null = null;

function updateScrollMorph() {
	rafId = null;

	isSideBySide.value = window.innerWidth >= SIDE_BY_SIDE_MIN_WIDTH;

	const reducedMotion = window.matchMedia(
		"(prefers-reduced-motion: reduce)"
	).matches;
	const narrow = window.innerWidth <= 680;
	const originEl = originRef.value;
	const targetEl = mapExplorerRef.value?.previewCardRef ?? null;

	if (
		isSideBySide.value ||
		reducedMotion ||
		narrow ||
		!originEl ||
		!targetEl
	) {
		morphActive.value = false;
		morphT.value = 0;
		return;
	}

	const startRect = originEl.getBoundingClientRect();
	const targetRect = targetEl.getBoundingClientRect();
	const startTrigger = Math.min(280, window.innerHeight * 0.34);
	const endTrigger = 170;
	const fullTravel =
		targetRect.top - startRect.top - (endTrigger - startTrigger);

	if (fullTravel <= 80) {
		morphActive.value = false;
		morphT.value = 0;
		return;
	}

	const travel = Math.max(120, fullTravel * 0.5);
	morphActive.value = true;
	const raw = (startTrigger - startRect.top) / travel;
	const clamped = Math.max(0, Math.min(1, raw));
	morphT.value = clamped;

	if (clamped > 0 && clamped < 1) {
		const e = easeInOutCubic(clamped);
		morphRect.value = {
			left: lerp(startRect.left, targetRect.left, e),
			top: lerp(startRect.top, targetRect.top, e),
			width: lerp(startRect.width, targetRect.width, e),
			height: lerp(startRect.height, targetRect.height, e),
		};
	}
}

function scheduleMorphUpdate() {
	if (rafId !== null) return;
	rafId = window.requestAnimationFrame(updateScrollMorph);
}

onMounted(() => {
	void load();
	void loadMapLines();
	window.addEventListener("scroll", scheduleMorphUpdate, { passive: true });
	window.addEventListener("resize", scheduleMorphUpdate, { passive: true });
	scheduleMorphUpdate();
});

onBeforeUnmount(() => {
	window.removeEventListener("scroll", scheduleMorphUpdate);
	window.removeEventListener("resize", scheduleMorphUpdate);
	if (rafId !== null) window.cancelAnimationFrame(rafId);
});
</script>

<style scoped lang="scss">
.story-page {
	width: 100%;
	max-width: 1380px;
	margin: 0 auto;
	padding: 1.5rem 1.5rem 4.5rem;
	font-family: "Space Grotesk", sans-serif;
}

.masthead {
	display: flex;
	flex-wrap: wrap;
	justify-content: space-between;
	align-items: center;
	gap: 0.75rem 1.5rem;
	padding-bottom: 1rem;
	margin-bottom: 2.75rem;
	border-bottom: 1px solid $border;
}

.brand {
	font-size: 0.8rem;
	font-weight: 700;
	letter-spacing: 0.06em;
	text-transform: uppercase;
	color: $primary;
}

.top-nav {
	display: flex;
	flex-wrap: wrap;
	gap: 1.25rem;
	font-size: 0.86rem;

	a {
		color: $text-secondary;
		text-decoration: none;
		font-weight: 500;
		transition: color $transition-fast;

		&:hover,
		&:focus-visible {
			color: $primary;
		}
	}
}

.hero {
	margin-bottom: 3rem;

	h1 {
		font-size: clamp(2.1rem, 4vw, 3.1rem);
		font-weight: 700;
		letter-spacing: -0.02em;
		color: $text-primary;
		margin: 0 0 0.85rem;
		padding-top: 0;
		line-height: 1.12;
	}

	.lead {
		font-size: 1.08rem;
		line-height: 1.65;
		color: $text-secondary;
		max-width: 680px;
		margin: 0;
	}
}

.viz-grid {
	display: grid;
	grid-template-columns: 1fr;
	gap: 3.5rem;
	margin-bottom: 4rem;
}

.viz-card {
	margin-bottom: 0;
	display: flex;
	flex-direction: column;
}

@media (min-width: 1100px) {
	.viz-grid {
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: 1.5rem;
		align-items: stretch;
	}

	.viz-card {
		background: $surface;
		border: 1px solid $border;
		border-radius: $radius-md;
		padding: 1.4rem 1.5rem;
	}

	.viz-card :deep(.story-chart),
	.viz-card :deep(.map-frame) {
		border: none;
		padding-left: 0;
		padding-right: 0;
	}

	.viz-card :deep(.story-chart) {
		padding-bottom: 0;
	}
}

.chapter {
	margin-bottom: 4rem;
}

.viz-grid .chapter {
	margin-bottom: 0;
}

.chapter-head {
	max-width: 680px;
	margin-bottom: 1.25rem;

	h2 {
		font-size: clamp(1.25rem, 2vw, 1.55rem);
		font-weight: 700;
		color: $text-primary;
		margin: 0.25rem 0 0.5rem;
		padding-top: 0;
		line-height: 1.25;
	}

	p {
		margin: 0;
		font-size: 0.9rem;
		line-height: 1.6;
		color: $text-secondary;
	}
}

.chapter-num {
	display: inline-block;
	font-size: 0.76rem;
	font-weight: 700;
	text-transform: uppercase;
	letter-spacing: 0.06em;
	color: $primary;
}

.chart-origin.is-morphing {
	visibility: hidden;
}

.morph-overlay {
	position: fixed;
	top: 0;
	left: 0;
	z-index: 20;
	pointer-events: none;
	will-change: transform, width, height;
}

.next-chapter {
	padding-top: 2rem;
	border-top: 1px solid $border;
}

.next-actions {
	display: flex;
	flex-wrap: wrap;
	gap: 0.85rem;
	margin-top: 1.25rem;
}

.cta-primary,
.cta-secondary {
	display: inline-flex;
	align-items: center;
	padding: 0.6rem 1.1rem;
	border-radius: $radius-sm;
	font-size: 0.88rem;
	font-weight: 600;
	text-decoration: none;
	transition:
		background-color $transition-fast,
		border-color $transition-fast,
		color $transition-fast;
}

.cta-primary {
	background: $primary;
	color: $text-on-primary;
	border: 1px solid $primary;

	&:hover,
	&:focus-visible {
		background: #08554f;
		color: $text-on-primary;
	}
}

.cta-secondary {
	background: $surface;
	color: $text-primary;
	border: 1px solid $border;

	&:hover,
	&:focus-visible {
		border-color: $primary;
		color: $primary;
	}
}

.status.error {
	padding: 0.85rem 1rem;
	border: 1px solid $secondary;
	border-radius: $radius-sm;
	color: $secondary;
	margin-bottom: 1.5rem;
}

.story-footer {
	font-size: 0.8rem;
	color: $text-secondary;
	line-height: 1.55;
	border-top: 1px solid $border;
	padding-top: 1.25rem;
	max-width: 780px;

	a {
		color: $primary;
	}
}
</style>
