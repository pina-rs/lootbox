/**
 * `/l/:slug` layout: hero, reveal status, and the tab bar shared by
 * Overview, Odds, Rules, and Manage.
 */
import { type CSSProperties, useEffect, useState } from "react";
import {
	NavLink,
	Outlet,
	useOutletContext,
	useRevalidator,
} from "react-router";

import { mediaUrl, services } from "../lib/.server/context.js";
import { originFor } from "../lib/.server/env.js";
import { readChain, requireLootbox } from "../lib/.server/lootbox.js";
import { shortAddress } from "../lib/bytes.js";
import type { LootboxChainView } from "../lib/chain.js";
import { explorerUrl } from "../lib/clusters.js";
import { plainText } from "../lib/metadata.js";
import { useClusterInfo } from "../lib/public-config.js";
import { accentStyle, formatDuration, lootboxStatus } from "../lib/status.js";
import { useSession } from "../wallet/session.js";
import type { Route } from "./+types/lootbox";

export async function loader({ request, params, context }: Route.LoaderArgs) {
	const app = services(context);
	const record = await requireLootbox(app, params.slug);
	const origin = originFor(app.config, request);
	const chain = await readChain(app, record);

	return {
		origin,
		lootbox: {
			slug: record.slug,
			cluster: record.cluster,
			template: record.template,
			boxMint: record.boxMint,
			creator: record.creator,
			title: record.title,
			symbol: record.symbol,
			tagline: record.tagline,
			descriptionMd: record.descriptionMd,
			coverKey: record.coverKey,
			coverUrl: mediaUrl(origin, record.coverKey),
			accent: record.accent,
			links: record.links,
			visibility: record.visibility,
			bundles: record.bundles,
		},
		chain: chain.status === "ok" ? chain.view : null,
		chainProblem: chain.status === "ok"
			? null
			: chain.status === "missing"
			? "This treasury is not on chain."
			: chain.message,
	};
}

export type LootboxData = Awaited<ReturnType<typeof loader>>;

export type LootboxOutlet =
	& LootboxData
	& Readonly<{
		isCreator: boolean;
		/** Chain clock now, advanced locally between refreshes. */
		now: number;
	}>;

export function useLootbox(): LootboxOutlet {
	return useOutletContext<LootboxOutlet>();
}

export function meta({ data }: Route.MetaArgs) {
	if (!data) return [{ title: "Lootbox not found — lootbox.so" }];

	const { lootbox, origin } = data;
	const description = lootbox.tagline ||
		plainText(lootbox.descriptionMd).slice(0, 180) ||
		"A sealed Solana lootbox. Hold the chest to open it.";
	const image = `${origin}/og/${lootbox.slug}.png`;
	const url = `${origin}/l/${lootbox.slug}`;

	return [
		{ title: `${lootbox.title} — lootbox.so` },
		{ name: "description", content: description },
		{ tagName: "link", rel: "canonical", href: url },
		{ property: "og:type", content: "website" },
		{ property: "og:url", content: url },
		{ property: "og:title", content: lootbox.title },
		{ property: "og:description", content: description },
		{ property: "og:image", content: image },
		{ property: "og:image:width", content: "1200" },
		{ property: "og:image:height", content: "630" },
		{ name: "twitter:card", content: "summary_large_image" },
		{ name: "twitter:title", content: lootbox.title },
		{ name: "twitter:description", content: description },
		{ name: "twitter:image", content: image },
		...(lootbox.visibility === "unlisted"
			? [{ name: "robots", content: "noindex" }]
			: []),
	];
}

/** Advance the chain clock between loader refreshes for the countdown. */
function useChainClock(chain: LootboxChainView | null): number {
	const [offset, setOffset] = useState(0);

	useEffect(() => {
		if (!chain) return;

		const startedAt = Date.now();

		setOffset(0);

		const timer = setInterval(
			() => setOffset(Math.floor((Date.now() - startedAt) / 1000)),
			1000,
		);

		return () => clearInterval(timer);
	}, [chain]);

	return (chain?.chainTime ?? 0) + offset;
}

/** Re-read chain state every 20 s while the tab is visible, and on focus. */
function useChainRefresh() {
	const revalidator = useRevalidator();

	useEffect(() => {
		const refresh = () => {
			if (
				document.visibilityState === "visible" && revalidator.state === "idle"
			) {
				void revalidator.revalidate();
			}
		};
		const timer = setInterval(refresh, 20_000);

		window.addEventListener("focus", refresh);

		return () => {
			clearInterval(timer);
			window.removeEventListener("focus", refresh);
		};
	}, [revalidator]);
}

export default function LootboxLayout({ loaderData }: Route.ComponentProps) {
	const { lootbox, chain, chainProblem } = loaderData;
	const { address, session } = useSession();
	const cluster = useClusterInfo(lootbox.cluster);
	const now = useChainClock(chain);
	const isCreator = address === lootbox.creator || session === lootbox.creator;
	const status = chain
		? lootboxStatus({
			...chain,
			chainTime: now,
			remaining: chain.remainingBundles,
		})
		: null;
	const base = `/l/${lootbox.slug}`;

	useChainRefresh();

	return (
		<main
			id="main"
			className="page"
			style={accentStyle(lootbox.accent) as CSSProperties}
		>
			<section className="lootbox-hero">
				<div className="lootbox-cover">
					<img
						src={lootbox.coverUrl ?? "/chest/chest-closed.webp"}
						alt={lootbox.coverUrl ? `${lootbox.title} cover art` : ""}
						width={640}
						height={640}
					/>
				</div>
				<div className="lootbox-title">
					<p className="button-row">
						{status && (
							<span
								className="chip"
								data-tone={status.tone}
								data-testid="status"
							>
								{status.label}
							</span>
						)}
						{lootbox.cluster !== "mainnet" && (
							<span className="chip">{cluster?.label ?? lootbox.cluster}</span>
						)}
					</p>
					<h1 className="display">{lootbox.title}</h1>
					{lootbox.tagline && <p className="lede">{lootbox.tagline}</p>}
					<p className="byline">
						By {cluster
							? (
								<a href={explorerUrl(cluster, "address", lootbox.creator)}>
									{shortAddress(lootbox.creator)}
								</a>
							)
							: shortAddress(lootbox.creator)}
					</p>
					{chain && chain.lockedAt > 0 && now < chain.opensAt && (
						<p className="countdown" aria-live="off">
							Opens in {formatDuration(chain.opensAt - now)}
						</p>
					)}
					{chainProblem && (
						<p className="notice" role="status">{chainProblem}</p>
					)}
				</div>
			</section>

			<nav className="tabs" aria-label="Lootbox sections">
				<NavLink to={base} end>Overview</NavLink>
				<NavLink to={`${base}/odds`}>Odds</NavLink>
				<NavLink to={`${base}/rules`}>Rules</NavLink>
				{isCreator && <NavLink to={`${base}/manage`}>Manage</NavLink>}
			</nav>

			<div className="tab-panel">
				<Outlet
					context={{ ...loaderData, isCreator, now } satisfies LootboxOutlet}
				/>
			</div>
		</main>
	);
}
