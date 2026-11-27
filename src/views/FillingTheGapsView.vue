<template>
	<div class="direction-page">
		<BackLink />
		<h1>Filling the Gaps</h1>
		<p class="subtitle">
			How different gap-filling methods change what the MONICET archive
			appears to say — and where they disagree.
		</p>

		<section class="dataset">
			<h2>The dataset to fill</h2>
			<p class="section-text">
				Each cell compares early (2009–2014) and late (2015–2020)
				encounter rates. Uncheck <em>Show only reliable cells</em> to
				reveal the sparse and missing cells that imputation methods will
				work on.
			</p>
			<CellMapExplorer :modes="['decline']" />
		</section>
	</div>
</template>

<script setup lang="ts">
// Direction "Filling the Gaps": shows the baseline decline dataset to be filled.
import BackLink from "@/components/shared-ui/BackLink.vue";
import CellMapExplorer from "@/components/shared-ui/CellMapExplorer.vue";
</script>

<style scoped lang="scss">
.direction-page {
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

.subtitle {
	color: $text-secondary;
	line-height: 1.65;
	max-width: 660px;
	margin-bottom: 2.25rem;
}

.dataset h2 {
	font-size: clamp(1.25rem, 2vw, 1.55rem);
	font-weight: 700;
	color: $text-primary;
	padding-top: 0;
	margin: 0 0 0.5rem;
}

.section-text {
	color: $text-secondary;
	line-height: 1.6;
	max-width: 680px;
	margin-bottom: 1.25rem;
	font-size: 0.92rem;
}
</style>
