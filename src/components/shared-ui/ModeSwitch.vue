<template>
	<div :class="['mode-switch', variant]" role="tablist" :aria-label="label">
		<button
			v-for="option in options"
			:key="String(option.value)"
			:class="['mode-btn', { active: modelValue === option.value }]"
			@click="emit('update:modelValue', option.value)"
		>
			{{ option.label }}
		</button>
	</div>
</template>

<script setup lang="ts" generic="T extends string | boolean">
// Pill-button group that selects one of several options (v-model).
// "default" wraps and lifts on hover; "compact" is the tighter variant used
// next to a select.
defineProps<{
	options: { value: T; label: string }[];
	modelValue: T;
	label: string;
	variant?: "default" | "compact";
}>();

const emit = defineEmits<{ "update:modelValue": [value: T] }>();
</script>

<style scoped lang="scss">
.mode-switch {
	display: flex;

	&.default {
		flex-wrap: wrap;
		gap: 0.55rem;
	}

	&.compact {
		gap: 0.4rem;
	}
}

.mode-btn {
	border: 1px solid rgba($primary, 0.35);
	background: rgba($surface, 0.92);
	color: $text-primary;
	font-family: "Space Grotesk", sans-serif;
	font-size: 0.85rem;
	padding: 0.4rem 0.75rem;
	border-radius: 999px;
	cursor: pointer;

	&:hover {
		border-color: $primary;
	}

	&.active {
		background: $primary;
		border-color: $primary;
		color: $text-on-primary;
	}
}

.default .mode-btn {
	transition: all 0.2s ease;

	&:hover {
		transform: translateY(-1px);
	}
}

.compact .mode-btn {
	transition: all 0.18s ease;
}

@media (max-width: 680px) {
	.default .mode-btn {
		font-size: 0.78rem;
	}
}
</style>
