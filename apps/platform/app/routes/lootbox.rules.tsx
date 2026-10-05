/**
 * Official rules, generated from this lootbox's on-chain terms plus the
 * creator's display details, so they can never drift from the program.
 */
import type { ReactNode } from "react";
import { Link } from "react-router";

import { OddsTable } from "../components/OddsTable.js";
import { explorerUrl } from "../lib/clusters.js";
import {
	ELIGIBILITY_STATEMENT,
	prizeViews,
	stockDisclaimer,
} from "../lib/prizes.js";
import { useClusterInfo } from "../lib/public-config.js";
import { useLootbox } from "./lootbox.js";

function formatDate(seconds: number): string {
	return new Date(seconds * 1000).toLocaleString("en-GB", {
		day: "numeric",
		month: "long",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
		timeZone: "UTC",
		timeZoneName: "short",
	});
}

function Section(
	{ id, title, children }: Readonly<{
		id: string;
		title: string;
		children: ReactNode;
	}>,
) {
	return (
		<section className="rules-section" aria-labelledby={id}>
			<h2 id={id}>{title}</h2>
			{children}
		</section>
	);
}

export default function RulesTab() {
	const { lootbox, chain } = useLootbox();
	const cluster = useClusterInfo(lootbox.cluster);
	const prizes = chain ? prizeViews(chain.bundles, lootbox.bundles) : [];
	const stocks = prizes.flatMap((prize) => prize.tracks);
	const hasStocks = prizes.some((prize) => prize.issuerStock);
	const link = (kind: "address" | "tx", value: string, label: string) =>
		cluster ? <a href={explorerUrl(cluster, kind, value)}>{label}</a> : label;

	return (
		<article className="card prose" aria-labelledby="rules-title">
			<h2 id="rules-title" className="visually-hidden">Official rules</h2>
			<p className="lede">
				Official rules for{" "}
				<strong>{lootbox.title}</strong>. They are generated from the lootbox's
				on-chain terms and apply to every box.
			</p>

			<Section id="rules-organizer" title="1. Organizer">
				<p>
					This lootbox is created and run by the wallet{" "}
					{link("address", lootbox.creator, lootbox.creator)}. lootbox.so is the
					software it runs on; it does not hold prizes, pick winners, or endorse
					any creator.
				</p>
			</Section>

			<Section id="rules-entry" title="2. Getting a box">
				<p>
					A box is a Solana token ({lootbox.symbol}). The organizer decides how
					boxes are handed out. Anyone holding a box may keep it, send it to
					someone else, or open it after the reveal date. Opening costs only
					ordinary network fees.
				</p>
			</Section>

			<Section id="rules-dates" title="3. Dates">
				<ul>
					<li>
						Supply fixed: {chain && chain.lockedAt > 0
							? formatDate(chain.lockedAt)
							: "not yet; prizes can still be added"}
						.
					</li>
					<li>
						Reveal date:{" "}
						<strong data-testid="rules-reveal">
							{chain ? formatDate(chain.opensAt) : "to be announced"}
						</strong>
						. Before then a box can only be held or sent.
					</li>
					<li>
						There is no closing date. Boxes can be opened while prizes remain.
					</li>
				</ul>
			</Section>

			<Section id="rules-prizes" title="4. Prizes and odds">
				<p>
					Every prize is held in escrow by the lootbox program before any box
					can be opened. Each box is one equal ticket: a prize's chance is its
					copies left divided by all copies left. Odds change after each
					opening. There are no hidden weights.
				</p>
				{prizes.length > 0
					? <OddsTable prizes={prizes} />
					: (
						<p className="muted">
							The inventory appears once the chain answers.
						</p>
					)}
				{hasStocks && <p>{stockDisclaimer(stocks)}</p>}
			</Section>

			<Section id="rules-allocation" title="5. How a prize is picked">
				<p>
					Opening burns one box and commits to Switchboard randomness before the
					result exists. After the oracle's signed reveal is verified on chain,
					the program assigns a prize first-in, first-out and without
					replacement. Nobody, including the organizer and lootbox.so, can
					choose or change a result. The chest animation replays the recorded
					result.
				</p>
				<p>
					If a reveal stalls, a relayer normally finishes it. After the
					program's timeout, a stalled opening can be forfeited so later
					openings are not blocked; the burned box is not returned.
				</p>
			</Section>

			<Section id="rules-eligibility" title="6. Eligibility">
				{hasStocks
					? (
						<>
							<p>
								Anyone may open a box. To claim a tokenized stock prize you must
								confirm: “{ELIGIBILITY_STATEMENT}” If you cannot, do not claim;
								the prize stays in escrow, bound to your opening.
							</p>
						</>
					)
					: <p>Anyone holding a box may open it and claim its prize.</p>}
			</Section>

			<Section id="rules-delivery" title="7. Delivery">
				<p>
					A prize is delivered from escrow to the wallet that opened the box.
					{hasStocks &&
						" Tokenized stock issuers charge a transfer fee that is deducted on delivery, and they may freeze, pause, or claw back their tokens."}
				</p>
			</Section>

			<Section id="rules-verify" title="8. Checking the results">
				<p>
					Every box, opening, randomness proof, and delivery is public. Start
					from the {link("address", lootbox.template, "treasury account")}{" "}
					or the {link("address", lootbox.boxMint, "box token")}.
				</p>
			</Section>

			<Section id="rules-general" title="9. General">
				<ul>
					<li>Any taxes on a prize are the winner's responsibility.</li>
					<li>Nothing here is investment advice or an offer of securities.</li>
					<li>
						This is experimental software that has not been independently
						audited. Only open boxes you are comfortable losing.
					</li>
				</ul>
			</Section>

			<p>
				<Link to={`/l/${lootbox.slug}`}>Back to the lootbox</Link>
			</p>
		</article>
	);
}
