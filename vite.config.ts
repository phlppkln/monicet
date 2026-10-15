import { fileURLToPath, URL } from "node:url";

import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

export default defineConfig({
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
