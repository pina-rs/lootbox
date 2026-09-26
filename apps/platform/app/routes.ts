import {
	index,
	prefix,
	route,
	type RouteConfig,
} from "@react-router/dev/routes";

export default [
	index("routes/home.tsx"),
	route("explore", "routes/explore.tsx"),
	route("create", "routes/create.tsx"),
	route("l/:slug", "routes/lootbox.tsx", [
		index("routes/lootbox.overview.tsx"),
		route("odds", "routes/lootbox.odds.tsx"),
		route("rules", "routes/lootbox.rules.tsx"),
		route("manage", "routes/lootbox.manage.tsx"),
	]),
	route("m/:file", "routes/box-metadata.ts"),
	route("media/:key", "routes/media.ts"),
	route("og/:file", "routes/og.ts"),
	...prefix("api", [
		route("auth/nonce", "routes/api.auth.nonce.ts"),
		route("auth/verify", "routes/api.auth.verify.ts"),
		route("auth/logout", "routes/api.auth.logout.ts"),
		route("drafts", "routes/api.drafts.ts"),
		route("drafts/:id/signing", "routes/api.drafts.signing.ts"),
		route("lootboxes", "routes/api.lootboxes.ts"),
		route("lootboxes/:slug/bundles", "routes/api.lootboxes.bundles.ts"),
		route("uploads", "routes/api.uploads.ts"),
		route("tokens", "routes/api.tokens.ts"),
		route("nfts", "routes/api.nfts.ts"),
		route("local/:action", "routes/api.local.ts"),
	]),
	route("*", "routes/not-found.tsx"),
] satisfies RouteConfig;
