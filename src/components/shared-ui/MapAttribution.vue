<template>
	<div v-if="credits.length" class="attribution">
		<template v-for="(credit, i) in credits" :key="credit.href">
			<span v-if="i > 0"> · </span>
			<a :href="credit.href" target="_blank" rel="noopener">{{
				credit.text
			}}</a>
		</template>
	</div>
</template>

<script setup lang="ts">
// Credit line under a tiled basemap; every provider's terms require it.
// Renders nothing for D3-drawn basemaps (wireframe).
import { computed } from "vue";

import { BASEMAPS, type BasemapId } from "@/lib/map";

const props = defineProps<{ basemapId: BasemapId }>();

const credits = computed(
	() => BASEMAPS[props.basemapId].tiles?.attribution ?? []
);
</script>

<style scoped lang="scss">
.attribution {
	padding: 0.2rem 0.6rem;
	font-size: 0.66rem;
	line-height: 1.3;
	text-align: right;
	color: $text-secondary;
	background: rgba($surface, 0.92);

	a {
		color: inherit;
	}
}
</style>
