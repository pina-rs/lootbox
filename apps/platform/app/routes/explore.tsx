import { Form, Link, useNavigation } from "react-router";

import { LootboxCard } from "../components/LootboxCard.js";
import { toCards } from "../lib/.server/cards.js";
import { services } from "../lib/.server/context.js";
import { publicLootboxes } from "../lib/.server/db.js";
import { originFor } from "../lib/.server/env.js";
import { lootboxStatus } from "../lib/status.js";
import type { Route } from "./+types/explore";

const FILTERS = [
	{ value: "", label: "All" },
	{ value: "open", label: "Open now" },
	{ value: "sealed", label: "Coming up" },
] as const;

export function meta() {
	return [
		{ title: "Explore lootboxes — lootbox.so" },
		{ name: "description", content: "Every public lootbox on lootbox.so." },
	];
}

export async function loader({ request, context }: Route.LoaderArgs) {
	const app = services(context);
	const url = new URL(request.url);
	const query = (url.searchParams.get("q") ?? "").trim().slice(0, 60);
	const filter =
		FILTERS.find((item) => item.value === url.searchParams.get("show"))
			?.value ?? "";
	const origin = originFor(app.config, request);
	const records = await publicLootboxes(app.db, { query, limit: 60 });
	const cards = await toCards(app, origin, records);

	return {
		query,
		filter,
		cards: filter
			? cards.filter((card) =>
				card.summary && lootboxStatus(card.summary).tone === filter
			)
			: cards,
	};
}

export default function Explore({ loaderData }: Route.ComponentProps) {
	const { cards, query, filter } = loaderData;
	const navigation = useNavigation();

	return (
		<main id="main" className="page">
			<div className="stack">
				<h1 className="display">Explore</h1>
				<Form className="search" role="search" method="get">
					<label className="visually-hidden" htmlFor="q">
						Search lootboxes
					</label>
					<input
						id="q"
						name="q"
						type="search"
						defaultValue={query}
						placeholder="Search by name"
					/>
					<fieldset className="segmented">
						<legend className="visually-hidden">Show</legend>
						{FILTERS.map((item) => (
							<label key={item.value}>
								<input
									type="radio"
									name="show"
									value={item.value}
									defaultChecked={filter === item.value}
									onChange={(event) =>
										event.currentTarget.form?.requestSubmit()}
								/>
								{item.label}
							</label>
						))}
					</fieldset>
					<button className="button button-small" type="submit">Search</button>
				</Form>
			</div>
			<p className="visually-hidden" aria-live="polite">
				{navigation.state === "idle"
					? `${cards.length} lootboxes`
					: "Searching"}
			</p>
			{cards.length > 0
				? (
					<div className="box-grid">
						{cards.map((card) => <LootboxCard key={card.slug} card={card} />)}
					</div>
				)
				: (
					<div className="empty">
						<p>{query ? `Nothing matches “${query}”.` : "Nothing here yet."}</p>
						<Link className="button button-primary" to="/create">
							Make a lootbox
						</Link>
					</div>
				)}
		</main>
	);
}
