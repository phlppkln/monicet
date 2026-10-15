<template>
	<div class="monicet-page">
		<BackLink />
		<h1>MONICET: Three Ways of Looking</h1>

		<p class="intro">
			MONICET is a long-running marine megafauna monitoring programme in
			the waters around the Azores. Between 2009 and 2020, trained
			observers recorded whale and dolphin encounters across 8,455
			cruises. The same archive is explored here three times — each framed
			by a different question. What you see depends entirely on what you
			ask.
		</p>

		<div class="compare-grid">
			<div
				v-for="card in compareCards"
				:key="card.title"
				class="compare-card"
			>
				<div class="compare-title">{{ card.title }}</div>
				<div v-if="card.question" class="compare-question">
					{{ card.question }}
				</div>
				<div v-else class="compare-question open">
					Question still open
				</div>
				<div class="compare-entry">Entry: {{ card.entry }}</div>
				<div class="compare-var">
					Visual variable: {{ card.variable }}
				</div>
			</div>
		</div>

		<ViewSection title="The Observer">
			<template #reflection>
				The observer as the subject. The default map shows not what was
				found, but where people went — cells shaded by how many of the
				twelve years had any recorded survey activity. Click a cell to
				open its field record: coordinates, active years, species list,
				and a year-by-year count.
			</template>
			<FieldJournal />
		</ViewSection>

		<ViewSection title="The External">
			<template #reflection>
				The map from outside. Where are the animals encountered, when in
				the year, and where do the boats actually go? Switch to
				<em>Where Do Boats Go?</em> to see the effort behind every other
				map: the cells that cruises reached, which is also where
				sightings can happen at all.
			</template>
			<CellMapExplorer :modes="['species', 'seasonality', 'boats']" />
		</ViewSection>

		<ViewSection title="The Animal">
			<template #reflection>
				The animal as the entry point — not the map. Selecting a species
				reorganises the map around that one creature: where it
				concentrates, which cells it dominates versus merely visits, and
				how its encounter count has moved year by year since 2009.
				Switch to <em>Dominance</em> to see habitat role rather than raw
				count.
			</template>
			<SpeciesAsCharacter />
		</ViewSection>

		<footer class="data-footer">
			<strong>Data:</strong> MONICET Darwin Core Archive (2009–2020).
			Counts are encounters and cruises per grid cell, not population
			estimates.
		</footer>
	</div>
</template>

<script setup lang="ts">
// Direction "Three Ways of Looking": one archive, three questions, three
// visualisations — the observer, the external, the animal.
import FieldJournal from "@/components/directions/three-ways-of-looking/FieldJournal.vue";
import SpeciesAsCharacter from "@/components/directions/three-ways-of-looking/SpeciesAsCharacter.vue";
import ViewSection from "@/components/directions/three-ways-of-looking/ViewSection.vue";
import BackLink from "@/components/shared-ui/BackLink.vue";
import CellMapExplorer from "@/components/shared-ui/CellMapExplorer.vue";

// question: null renders as "Question still open".
const compareCards: {
	title: string;
	question: string | null;
	entry: string;
	variable: string;
}[] = [
	{
		title: "The Observer",
		question: "What did I see?",
		entry: "a location",
		variable: "survey effort",
	},
	{
		title: "The External",
		question: null,
		entry: "the map",
		variable: "encounters and cruises per cell",
	},
	{
		title: "The Animal",
		question: "Where will I meet my kind?",
		entry: "a species",
		variable: "territory + time",
	},
];
</script>

<style scoped lang="scss">
.monicet-page {
	width: 100%;
	max-width: 1340px;
	margin: 0 auto;
	padding: 2rem 1.5rem 4rem;
	font-family: "Space Grotesk", sans-serif;
}

h1 {
	font-size: clamp(1.9rem, 3vw, 2.6rem);
	font-weight: 700;
	color: $text-primary;
	margin-bottom: 0.75rem;
}

.intro {
	color: $text-secondary;
	line-height: 1.65;
	max-width: 860px;
	margin-bottom: 2rem;
}

// ── Comparison grid ─────────────────────────────────────────────────────────

.compare-grid {
	display: grid;
	grid-template-columns: repeat(3, 1fr);
	gap: 0.85rem;
	margin-bottom: 3rem;
}

.compare-card {
	background: rgba($surface, 0.9);
	border: 1px solid $border;
	border-radius: 10px;
	padding: 0.9rem 1rem;
	display: flex;
	flex-direction: column;
	gap: 0.3rem;
}

.compare-title {
	font-size: 0.95rem;
	font-weight: 700;
	color: $text-primary;
}

.compare-question {
	font-size: 0.85rem;
	color: $text-secondary;
	font-style: italic;

	&.open {
		opacity: 0.6;
	}
}

.compare-entry,
.compare-var {
	font-size: 0.78rem;
	color: $text-secondary;
}

// ── Footer ──────────────────────────────────────────────────────────────────

.data-footer {
	font-size: 0.78rem;
	color: $text-secondary;
	line-height: 1.5;
	border-top: 1px dashed $border;
	padding-top: 1.2rem;
	max-width: 860px;
}

@media (max-width: 860px) {
	.compare-grid {
		grid-template-columns: 1fr;
	}
}
</style>
