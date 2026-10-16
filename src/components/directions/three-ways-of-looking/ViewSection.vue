<template>
	<section class="view-section">
		<h2>{{ title }}</h2>
		<p class="section-reflection">
			<slot name="reflection" />
		</p>
		<slot />
	</section>
</template>

<script setup lang="ts">
// One way of looking on the page: heading + framing paragraph, followed by
// the interactive visualisation in the default slot.
defineProps<{ title: string }>();
</script>

<style scoped lang="scss">
.view-section {
	margin-bottom: 4rem;
	// Breathing room above the heading when a comparison card scrolls here.
	scroll-margin-top: 1.5rem;

	&:last-of-type {
		margin-bottom: 2rem;
	}
}

h2 {
	font-size: clamp(1.25rem, 2vw, 1.65rem);
	font-weight: 700;
	color: $text-primary;
	margin: 0 0 0.6rem;
}

.section-reflection {
	color: $text-secondary;
	line-height: 1.6;
	max-width: 860px;
	margin-bottom: 1.1rem;
	font-size: 0.92rem;
}
</style>
