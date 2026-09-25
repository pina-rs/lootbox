/**
 * Resolve a file in `public/` against Vite's base path.
 *
 * The site is served from `/` locally and from `/lootbox/` on GitHub Pages,
 * so every static URL must go through this instead of a leading slash.
 */
export function assetUrl(
	path: string,
	base = import.meta.env.BASE_URL,
): string {
	const root = base.endsWith("/") ? base : `${base}/`;

	return `${root}${path.replace(/^\/+/, "")}`;
}

/** The app's route within the base path, e.g. `/playground` or `/`. */
export function routeOf(
	pathname: string,
	base = import.meta.env.BASE_URL,
): string {
	const root = base.replace(/\/+$/, "");
	const local = root && pathname.startsWith(root)
		? pathname.slice(root.length)
		: pathname;

	return `/${local.replace(/^\/+|\/+$/g, "")}`;
}
