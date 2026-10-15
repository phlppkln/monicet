import { ref } from "vue";

import type { BasemapFeatureCollection, MonicetMapData } from "@/types/monicet";

// Module-level singleton — shared by every component on the page.
// All three directions call load() in onMounted; only the first caller
// actually fetches, the others await the same promise.
const mapData = ref<MonicetMapData | null>(null);
const basemap = ref<BasemapFeatureCollection | null>(null);
const error = ref<string>("");
let loadPromise: Promise<void> | null = null;

const DATA_URL = `${import.meta.env.BASE_URL}data/monicet-map-data.json`;
const BASEMAP_URL = `${import.meta.env.BASE_URL}data/azores.geojson`;

export function useMonicetData() {
	function load(): Promise<void> {
		if (loadPromise) return loadPromise;

		loadPromise = (async () => {
			try {
				const [mapRes, basemapRes] = await Promise.all([
					fetch(DATA_URL),
					fetch(BASEMAP_URL),
				]);

				if (!mapRes.ok || !basemapRes.ok) {
					throw new Error("Could not load MONICET map resources.");
				}

				mapData.value = (await mapRes.json()) as MonicetMapData;
				basemap.value =
					(await basemapRes.json()) as BasemapFeatureCollection;
			} catch (err) {
				error.value =
					err instanceof Error
						? err.message
						: "Failed to load MONICET map.";
				loadPromise = null; // allow retry on next mount
			}
		})();

		return loadPromise;
	}

	return { mapData, basemap, error, load };
}
