<template>
	<div class="direction-page">
		<BackLink />
		<h1>Filling the Gaps</h1>
		<p class="subtitle">
			How different data-filling algorithms change what the MONICET
			archive appears to say — and where they disagree.
		</p>

		<section class="dataset">
			<h2>The dataset to fill: where sightings decline</h2>
			<p class="section-text">
				Each cell compares the encounter rate of the early years
				(2009–2014) with the late years (2015–2020). Many cells have too
				few records to be trusted; untick
				<em>Show only reliable cells</em> to see them faint. These
				unreliable and missing cells are the gaps the filling algorithms
				will work on.
			</p>
			<CellMapExplorer :modes="['decline']" />
		</section>
	</div>
</template>

<script setup lang="ts">
// Direction "Filling the Gaps". So far it shows the dataset to be filled
// (the decline map); the filling itself is planned in
// docs/ideas/imputation-lab.md. Components go in
// src/components/directions/filling-the-gaps/.
import BackLink from "@/components/shared-ui/BackLink.vue";
import CellMapExplorer from "@/components/shared-ui/CellMapExplorer.vue";
</script>

<style scoped lang="scss">
.direction-page {
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

.subtitle {
	color: $text-secondary;
	line-height: 1.65;
	max-width: 860px;
	margin-bottom: 2rem;
}

.dataset h2 {
	font-size: clamp(1.25rem, 2vw, 1.65rem);
	font-weight: 700;
	color: $text-primary;
	margin: 0 0 0.6rem;
}

.section-text {
	color: $text-secondary;
	line-height: 1.6;
	max-width: 860px;
	margin-bottom: 1.1rem;
	font-size: 0.92rem;
}
</style>
