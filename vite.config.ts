import { fileURLToPath, URL } from "node:url";

import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

export default defineConfig({
	// Relative asset URLs, so the build works under any path — e.g. the
	// GitHub Pages project URL /monicet/. Routing is hash-based, so the
	// page itself never leaves index.html.
	base: "./",
	plugins: [vue()],
	resolve: {
		alias: {
			"@": fileURLToPath(new URL("./src", import.meta.url)),
		},
	},
	css: {
		preprocessorOptions: {
			scss: {
				// Design tokens are available in every <style lang="scss">
				// block without a local @use.
				additionalData: `@use "@/styles/tokens" as *;`,
			},
		},
	},
});
