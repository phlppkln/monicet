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
				:key="card.tag"
				class="compare-card"
			>
				<div class="compare-tag">{{ card.tag }}</div>
				<div class="compare-title">{{ card.title }}</div>
				<div class="compare-question">{{ card.question }}</div>
				<div class="compare-entry">Entry: {{ card.entry }}</div>
				<div class="compare-var">
					Visual variable: {{ card.variable }}
				</div>
			</div>
		</div>

		<DirectionSection tag="Direction 1" title="Honest Instability">
			<template #reflection>
				The map as a reliability audit. Encounter-rate trends are
				colored by magnitude — but when you uncheck
				<em>Emphasise reliable cells</em>, cells with too few surveys to
				be trusted appear at low opacity with a dashed border. The
				uncertainty is in the picture, not buried in a caveat.
			</template>
			<HonestInstability />
		</DirectionSection>

		<DirectionSection tag="Direction 3" title="The Species as Character">
			<template #reflection>
				The animal as the entry point — not the map. Selecting a species
				reorganises the map around that one creature: where it
				concentrates, which cells it dominates versus merely visits, and
				how its encounter count has moved year by year since 2009.
				Switch to <em>Dominance</em> to see habitat role rather than raw
				count.
			</template>
			<SpeciesAsCharacter />
		</DirectionSection>

		<DirectionSection tag="Direction 4" title="The Field Journal">
			<template #reflection>
				The observer as the subject. The default map shows not what was
				found, but where people went — cells shaded by how many of the
				twelve years had any recorded survey activity. Click a cell to
				open its field record: coordinates, active years, species list,
				and a year-by-year count.
			</template>
			<FieldJournal />
		</DirectionSection>

		<footer class="data-footer">
			<strong>Data:</strong> MONICET Darwin Core Archive (2009–2020).
			Decline rates are encounter-rate trends, not direct population
			estimates. Rates in D1 are normalized by cruise counts per year.
		</footer>
	</div>
</template>

<script setup lang="ts">
// Direction "Three Ways of Looking": one archive, three questions, three
// visualisations (labelled "Direction 1/3/4" in the page copy).
import DirectionSection from "@/components/directions/three-ways-of-looking/DirectionSection.vue";
import FieldJournal from "@/components/directions/three-ways-of-looking/FieldJournal.vue";
import HonestInstability from "@/components/directions/three-ways-of-looking/HonestInstability.vue";
import SpeciesAsCharacter from "@/components/directions/three-ways-of-looking/SpeciesAsCharacter.vue";
import BackLink from "@/components/shared-ui/BackLink.vue";

const compareCards = [
	{
		tag: "D1",
		title: "Honest Instability",
		question: "Where is the data trustworthy?",
		entry: "the map",
		variable: "confidence opacity",
	},
	{
		tag: "D3",
		title: "The Species as Character",
		question: "Who are the animals?",
		entry: "a species",
		variable: "territory + time",
	},
	{
		tag: "D4",
		title: "The Field Journal",
		question: "Where did people look?",
		entry: "a location",
		variable: "survey effort",
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

.compare-tag {
	font-size: 0.7rem;
	font-weight: 700;
	letter-spacing: 0.06em;
	text-transform: uppercase;
	color: $primary;
	margin-bottom: 0.1rem;
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
