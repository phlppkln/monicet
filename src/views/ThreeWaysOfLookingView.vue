<template>
	<div class="monicet-page">
		<BackLink />
		<h1>Three Ways of Looking</h1>

		<p class="intro">
			The same twelve-year MONICET archive (2009–2020, 8,455 cruises)
			explored three ways — each framed by a different question.
		</p>

		<div class="compare-grid">
			<button
				v-for="card in compareCards"
				:key="card.title"
				type="button"
				class="compare-card"
				@click="scrollToSection(card.sectionId)"
			>
				<span class="compare-title">{{ card.title }}</span>
				<span class="compare-question">{{ card.question }}</span>
			</button>
		</div>

		<ViewSection id="the-observer" title="The Observer">
			<template #reflection>
				Where did observers log sightings across the twelve years? Click
				any cell to open its field record.
			</template>
			<FieldJournal />
		</ViewSection>

		<ViewSection id="the-external" title="The External">
			<template #reflection>
				Where are species met, when in the year, and where did boats
				stop for sightings?
			</template>
			<CellMapExplorer :modes="['species', 'seasonality', 'boats']" />
		</ViewSection>

		<ViewSection id="the-animal" title="The Animal">
			<template #reflection>
				Start from a species: when is it here, what is it doing, are
				calves present, and where is it met each month?
			</template>
			<SpeciesAsCharacter />
		</ViewSection>

		<footer class="data-footer">
			<strong>Data:</strong> MONICET Darwin Core Archive (2009–2020).
			Counts are opportunistic encounters and cruises per cell, not
			population estimates.
		</footer>
	</div>
</template>

<script setup lang="ts">
// Direction "Three Ways of Looking": one archive, three questions, three views.
import FieldJournal from "@/components/directions/three-ways-of-looking/FieldJournal.vue";
import SpeciesAsCharacter from "@/components/directions/three-ways-of-looking/SpeciesAsCharacter.vue";
import ViewSection from "@/components/directions/three-ways-of-looking/ViewSection.vue";
import BackLink from "@/components/shared-ui/BackLink.vue";
import CellMapExplorer from "@/components/shared-ui/CellMapExplorer.vue";

const compareCards: {
	title: string;
	sectionId: string;
	question: string;
}[] = [
	{
		title: "The Observer",
		sectionId: "the-observer",
		question: "What was seen at each location?",
	},
	{
		title: "The External",
		sectionId: "the-external",
		question: "Where, when, and where did boats go?",
	},
	{
		title: "The Animal",
		sectionId: "the-animal",
		question: "If I were this species, when and where would I go?",
	},
];

function scrollToSection(sectionId: string) {
	const prefersReducedMotion = window.matchMedia(
		"(prefers-reduced-motion: reduce)"
	).matches;
	document.getElementById(sectionId)?.scrollIntoView({
		behavior: prefersReducedMotion ? "auto" : "smooth",
		block: "start",
	});
}
</script>

<style scoped lang="scss">
.monicet-page {
	width: 100%;
	max-width: 1120px;
	margin: 0 auto;
	padding: 2rem 1.5rem 4rem;
	font-family: "Space Grotesk", sans-serif;
}

h1 {
	font-size: clamp(1.9rem, 3vw, 2.5rem);
	font-weight: 700;
	color: $text-primary;
	padding-top: 0;
	margin-bottom: 0.65rem;
}

.intro {
	color: $text-secondary;
	line-height: 1.65;
	max-width: 660px;
	margin-bottom: 1.75rem;
}

.compare-grid {
	display: grid;
	grid-template-columns: repeat(3, 1fr);
	gap: 0.85rem;
	margin-bottom: 3rem;
}

.compare-card {
	background: $surface;
	border: 1px solid $border;
	border-radius: $radius-md;
	padding: 0.9rem 1rem;
	display: flex;
	flex-direction: column;
	gap: 0.25rem;
	font: inherit;
	text-align: left;
	cursor: pointer;
	transition: border-color $transition-fast;

	&:hover {
		border-color: $primary;
	}

	&:focus-visible {
		outline: 2px solid $primary;
		outline-offset: 2px;
	}
}

.compare-title {
	font-size: 0.95rem;
	font-weight: 700;
	color: $text-primary;
}

.compare-question {
	font-size: 0.84rem;
	color: $text-secondary;
}

.data-footer {
	font-size: 0.8rem;
	color: $text-secondary;
	line-height: 1.5;
	border-top: 1px solid $border;
	padding-top: 1.2rem;
	max-width: 760px;
}

@media (max-width: 860px) {
	.compare-grid {
		grid-template-columns: 1fr;
	}
}
</style>
