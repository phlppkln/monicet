<template>
	<ul v-if="items.length" class="missing-key">
		<li v-for="item in items" :key="item.kind">
			<span :class="['swatch', item.kind]"></span>
			{{ item.label }}
		</li>
	</ul>
</template>

<script setup lang="ts">
// Legend entries for cells that are drawn but sit off the colour scale:
// "none recorded" (flat grey) and "no value" (hatched). The swatches mirror
// CHART_NONE_RECORDED and addNoValuePattern() (src/lib/chartTokens.ts,
// src/lib/map.ts); keep them in sync by hand.
export interface MissingKeyItem {
	kind: "none-recorded" | "no-value";
	label: string;
}

defineProps<{ items: MissingKeyItem[] }>();
</script>

<style scoped lang="scss">
.missing-key {
	display: flex;
	flex-wrap: wrap;
	gap: 0.3rem 1rem;
	margin: 0.35rem 0 0;
	padding: 0 8px;
	list-style: none;

	li {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		margin: 0;
		padding: 0;
		font-size: 0.78rem;
		color: $text-secondary;
	}
}

.swatch {
	width: 14px;
	height: 14px;
	border-radius: 2px;
	border: 1px solid rgba(0, 0, 0, 0.12);

	&.none-recorded {
		background: #d4d7da;
	}

	&.no-value {
		background: repeating-linear-gradient(
			45deg,
			$text-secondary 0 1.4px,
			rgba(#ffffff, 0.55) 1.4px 5px
		);
	}
}
</style>
