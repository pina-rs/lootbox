import type { CSSProperties } from "react";
import { Link } from "react-router";

import type { LootboxCard as Card } from "../lib/.server/cards.js";
import { CLUSTER_LABELS } from "../lib/clusters.js";
import { accentStyle, lootboxStatus } from "../lib/status.js";

export function LootboxCard({ card }: Readonly<{ card: Card }>) {
	const status = card.summary ? lootboxStatus(card.summary) : null;

	return (
		<Link
			to={`/l/${card.slug}`}
			className="box-card"
			style={accentStyle(card.accent) as CSSProperties}
		>
			<div className="box-card-art">
				<img
					src={card.coverUrl ?? "/chest/chest-closed.webp"}
					alt=""
					loading="lazy"
					width={400}
					height={400}
				/>
			</div>
			<div className="box-card-body">
				<span className="box-card-title">{card.title}</span>
				{card.tagline && <span className="muted">{card.tagline}</span>}
				<span className="box-card-meta">
					{status && (
						<span className="chip" data-tone={status.tone}>{status.label}</span>
					)}
					{card.summary && card.summary.lockedAt > 0 && (
						<span>
							{BigInt(card.summary.remaining).toLocaleString("en-US")} left
						</span>
					)}
					{card.cluster !== "mainnet" && (
						<span>{CLUSTER_LABELS[card.cluster]}</span>
					)}
				</span>
			</div>
		</Link>
	);
}
