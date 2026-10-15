// Route paths and link helper. Kept separate from router.ts so views can
// link to each other without importing the router (which imports views).

export const ROUTES = {
	landing: "/",
	threeWays: "/three-ways-of-looking",
	fillingTheGaps: "/filling-the-gaps",
} as const;

/** Href for an in-app link, e.g. `href(ROUTES.threeWays)` → "#/three-ways-of-looking". */
export function href(path: string) {
	return `#${path}`;
}
