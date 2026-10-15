<template>
	<div class="landing">
		<h1>MONICET</h1>

		<p class="intro">
			MONICET is a long-running marine megafauna monitoring programme in
			the waters around the Azores. Between 2009 and 2020, whale-watching
			companies recorded 29,400 sightings across 8,455 cruises. The
			archive is rich but patchy. Two directions explore it with two
			different goals.
		</p>

		<nav class="direction-grid" aria-label="Directions">
			<a
				v-for="direction in directions"
				:key="direction.path"
				class="direction-button"
				:href="href(direction.path)"
			>
				<span class="direction-title">{{ direction.title }}</span>
				<span class="direction-goal">{{ direction.goal }}</span>
				<span class="direction-cta">Open →</span>
			</a>
		</nav>
	</div>
</template>

<script setup lang="ts">
// Entry page: one button per direction (sub-project).
import { href, ROUTES } from "@/routes";

const directions = [
	{
		path: ROUTES.threeWays,
		title: "Three Ways of Looking",
		goal: "The same archive, three questions: how the goal behind a visualisation decides what it shows and who it is interesting for.",
	},
	{
		path: ROUTES.fillingTheGaps,
		title: "Filling the Gaps",
		goal: "The same archive, different data-filling algorithms: how each one changes the end result, and where they disagree.",
	},
];
</script>

<style scoped lang="scss">
.landing {
	width: 100%;
	max-width: 1040px;
	margin: 0 auto;
	padding: 2rem 1.5rem 4rem;
	font-family: "Space Grotesk", sans-serif;
}

h1 {
	font-size: clamp(2.2rem, 4vw, 3.2rem);
	font-weight: 700;
	color: $text-primary;
	margin-bottom: 0.75rem;
}

.intro {
	color: $text-secondary;
	line-height: 1.65;
	max-width: 760px;
	margin-bottom: 2.5rem;
}

.direction-grid {
	display: grid;
	grid-template-columns: repeat(2, 1fr);
	gap: 1rem;
}

.direction-button {
	display: flex;
	flex-direction: column;
	gap: 0.6rem;
	padding: 1.5rem 1.4rem;
	background: $surface;
	border: 1px solid rgba($primary, 0.25);
	border-radius: $radius-lg;
	box-shadow: $shadow-sm;
	color: $text-primary;
	text-decoration: none;
	font-weight: 400;
	transition:
		border-color $transition-fast,
		box-shadow $transition-fast,
		transform $transition-fast;

	&:hover,
	&:focus-visible {
		border-color: $primary;
		box-shadow: $shadow-md;
		transform: translateY(-2px);
		color: $text-primary;
	}
}

.direction-title {
	font-size: 1.35rem;
	font-weight: 700;
	color: $primary;
}

.direction-goal {
	font-size: 0.92rem;
	line-height: 1.55;
	color: $text-secondary;
}

.direction-cta {
	margin-top: auto;
	font-size: 0.85rem;
	font-weight: 600;
	color: $primary;
}

@media (max-width: 720px) {
	.direction-grid {
		grid-template-columns: 1fr;
	}
}
</style>
