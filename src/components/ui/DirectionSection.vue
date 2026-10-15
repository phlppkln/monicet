<template>
	<section class="direction-section">
		<div class="section-header">
			<span class="dir-tag">{{ tag }}</span>
			<h2>{{ title }}</h2>
		</div>
		<p class="section-reflection">
			<slot name="reflection" />
		</p>
		<slot />
	</section>
</template>

<script setup lang="ts">
// One "direction" block on the page: tag + heading + framing paragraph,
// followed by the interactive visualisation in the default slot.
defineProps<{ tag: string; title: string }>();
</script>

<style scoped lang="scss">
.direction-section {
	margin-bottom: 4rem;

	&:last-of-type {
		margin-bottom: 2rem;
	}
}

.section-header {
	display: flex;
	align-items: baseline;
	gap: 0.75rem;
	margin-bottom: 0.6rem;
}

.dir-tag {
	font-size: 0.72rem;
	font-weight: 700;
	letter-spacing: 0.06em;
	text-transform: uppercase;
	color: $primary;
	background: rgba($primary, 0.08);
	padding: 0.15rem 0.5rem;
	border-radius: 4px;
}

h2 {
	font-size: clamp(1.25rem, 2vw, 1.65rem);
	font-weight: 700;
	color: $text-primary;
	margin: 0;
}

.section-reflection {
	color: $text-secondary;
	line-height: 1.6;
	max-width: 860px;
	margin-bottom: 1.1rem;
	font-size: 0.92rem;
}
</style>
