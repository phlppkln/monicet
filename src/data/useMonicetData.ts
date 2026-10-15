import { ref } from "vue";

import type {
	BasemapFeatureCollection,
	MapLineCollection,
	MonicetMapData,
} from "@/types/monicet";

// Module-level singleton — shared by every component on the page.
// All three directions call load() in onMounted; only the first caller
// actually fetches, the others await the same promise.
const mapData = ref<MonicetMapData | null>(null);
const basemap = ref<BasemapFeatureCollection | null>(null);
const error = ref<string>("");
let loadPromise: Promise<void> | null = null;

// Coastlines, only needed by the wireframe basemap, so
// fetched on first use instead of with the page.
const mapLines = ref<MapLineCollection | null>(null);
let mapLinesPromise: Promise<void> | null = null;

const DATA_URL = `${import.meta.env.BASE_URL}data/monicet-map-data.json`;
const BASEMAP_URL = `${import.meta.env.BASE_URL}data/azores.geojson`;
const MAP_LINES_URL = `${import.meta.env.BASE_URL}data/azores-lines.geojson`;

export function useMonicetData() {
	function load(): Promise<void> {
		if (loadPromise) return loadPromise;

		loadPromise = (async () => {
			// A previous attempt may have failed; clear its message so a
			// successful retry doesn't keep showing it.
			error.value = "";
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

	function loadMapLines(): Promise<void> {
		if (mapLinesPromise) return mapLinesPromise;

		mapLinesPromise = (async () => {
			try {
				const res = await fetch(MAP_LINES_URL);
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				mapLines.value = (await res.json()) as MapLineCollection;
			} catch (err) {
				// Not fatal: the wireframe falls back to the island outlines.
				console.warn("Could not load coastlines:", err);
				mapLinesPromise = null;
			}
		})();

		return mapLinesPromise;
	}

	return { mapData, basemap, mapLines, error, load, loadMapLines };
}
