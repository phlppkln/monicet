<template>
	<a class="back-link" :href="href(ROUTES.landing)">← MONICET</a>
</template>

<script setup lang="ts">
// Link from a direction back to the landing page.
import { href, ROUTES } from "@/routes";
</script>

<style scoped lang="scss">
.back-link {
	display: inline-block;
	font-family: "Space Grotesk", sans-serif;
	font-size: 0.85rem;
	text-decoration: none;
}
</style>
