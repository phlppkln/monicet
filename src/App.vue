<template>
	<component :is="currentView" />
</template>

<script setup lang="ts">
import { currentView } from "@/router";
</script>
