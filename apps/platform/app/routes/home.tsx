import { Link } from "react-router";

import { LootboxCard } from "../components/LootboxCard.js";
import { toCards } from "../lib/.server/cards.js";
import { services } from "../lib/.server/context.js";
import { publicLootboxes } from "../lib/.server/db.js";
import { originFor } from "../lib/.server/env.js";
import type { Route } from "./+types/home";

export function meta({ data }: Route.MetaArgs) {
	const origin = data?.origin ?? "";

	return [
		{ title: "lootbox.so — sealed gifts with real prizes" },
		{
			name: "description",
			content:
				"Make a Solana lootbox: fill it with SOL, tokens, or NFTs, share the link, and let people open it.",
		},
		{ property: "og:title", content: "lootbox.so" },
		{ property: "og:image", content: `${origin}/box.png` },
	];
}

export async function loader({ request, context }: Route.LoaderArgs) {
	const app = services(context);
	const origin = originFor(app.config, request);
	const records = await publicLootboxes(app.db, { query: "", limit: 6 });

	return { origin, cards: await toCards(app, origin, records) };
}

export default function Home({ loaderData }: Route.ComponentProps) {
	const { cards } = loaderData;

	return (
		<main id="main" className="page">
			<section className="hero">
				<div className="stack">
					<h1 className="display">
						Sealed gifts with <em>real prizes</em> inside.
					</h1>
					<p className="lede">
						A lootbox is a Solana token you can hold, send, and open. Every
						prize is locked on chain before anyone opens one.
					</p>
					<p className="button-row">
						<Link className="button button-primary" to="/create">
							Make a lootbox
						</Link>
						<Link className="button" to="/explore">See what's open</Link>
					</p>
				</div>
				<img
					className="hero-chest"
					src="/chest/chest-closed.webp"
					alt="A cartoon treasure chest, closed"
					width={720}
					height={720}
				/>
			</section>

			<section className="card" aria-labelledby="how-title">
				<h2 id="how-title">How it works</h2>
				<ol className="steps">
					<li>
						<strong>Fill it</strong>
						<span>Add SOL, tokens, or NFTs. They go straight into escrow.</span>
					</li>
					<li>
						<strong>Share it</strong>
						<span>Send boxes to anyone. Boxes are tokens, so they travel.</span>
					</li>
					<li>
						<strong>Open it</strong>
						<span>
							On reveal day, hold the chest. Verifiable randomness picks the
							prize.
						</span>
					</li>
				</ol>
			</section>

			<section className="stack" aria-labelledby="live-title">
				<div className="section-head">
					<h2 id="live-title">Fresh lootboxes</h2>
					<Link to="/explore">See all</Link>
				</div>
				{cards.length > 0
					? (
						<div className="box-grid">
							{cards.map((card) => <LootboxCard key={card.slug} card={card} />)}
						</div>
					)
					: (
						<div className="empty">
							<p>No lootboxes yet. Yours could be the first.</p>
							<Link className="button button-primary" to="/create">
								Make the first one
							</Link>
						</div>
					)}
			</section>
		</main>
	);
}
