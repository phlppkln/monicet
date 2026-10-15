<template>
	<div class="direction-page">
		<BackLink />
		<h1>Filling the Gaps</h1>
		<p class="subtitle">
			How different data-filling algorithms change what the MONICET
			archive appears to say — and where they disagree.
		</p>
	</div>
</template>

<script setup lang="ts">
// Direction "Filling the Gaps" — not built yet. Plan and open questions:
// docs/ideas/imputation-lab.md. Components go in
// src/components/directions/filling-the-gaps/.
import BackLink from "@/components/shared-ui/BackLink.vue";
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
}
</style>
