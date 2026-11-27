// Minimal hash router: three pages don't justify vue-router.
// URLs look like /#/three-ways-of-looking, so they work on any static host
// (no server rewrites) and the browser back button works.

import { computed, ref, type Component } from "vue";

import { ROUTES } from "@/routes";
import FillingTheGapsView from "@/views/FillingTheGapsView.vue";
import StoryView from "@/views/StoryView.vue";
import ThreeWaysOfLookingView from "@/views/ThreeWaysOfLookingView.vue";

const VIEWS: Record<string, Component> = {
	[ROUTES.landing]: StoryView,
	[ROUTES.threeWays]: ThreeWaysOfLookingView,
	[ROUTES.fillingTheGaps]: FillingTheGapsView,
};

function currentPath() {
	return window.location.hash.slice(1) || ROUTES.landing;
}

const path = ref(currentPath());

window.addEventListener("hashchange", () => {
	path.value = currentPath();
	window.scrollTo(0, 0);
});

/** The view for the current URL; unknown paths fall back to the main story. */
export const currentView = computed(() => VIEWS[path.value] ?? StoryView);
