<template>
	<div class="basemap-controls">
		<ModeSwitch
			v-model="basemapId"
			:options="basemapOptions"
			label="Basemap"
			variant="compact"
		/>
		<label class="checkbox">
			<input type="checkbox" v-model="showDataLayer" />
			<span>Show data layer</span>
		</label>
		<label class="checkbox" v-if="showDataLayer">
			<span>Layer opacity</span>
			<input
				type="range"
				min="0.2"
				max="1"
				step="0.05"
				v-model.number="dataLayerOpacity"
			/>
		</label>
	</div>
</template>

<script setup lang="ts">
// Basemap switch + data-layer toggle + layer opacity, shared by every map
// with tiled basemaps (docs/basemaps.md). The map component owns the state
// (v-model) and decides how each change is redrawn.
import ModeSwitch from "@/components/shared-ui/ModeSwitch.vue";
import { BASEMAPS, type BasemapId } from "@/lib/map";

const basemapId = defineModel<BasemapId>("basemapId", { required: true });
const showDataLayer = defineModel<boolean>("showDataLayer", {
	required: true,
});
const dataLayerOpacity = defineModel<number>("dataLayerOpacity", {
	required: true,
});

const basemapOptions = (Object.keys(BASEMAPS) as BasemapId[]).map((id) => ({
	value: id,
	label: BASEMAPS[id].label,
}));
</script>

<style scoped lang="scss">
.basemap-controls {
	display: flex;
	flex-wrap: wrap;
	gap: 1rem;
	align-items: center;
}

.checkbox {
	display: flex;
	align-items: center;
	gap: 0.4rem;
	font-size: 0.84rem;
	color: $text-primary;

	input {
		accent-color: $primary;
	}
}
</style>
