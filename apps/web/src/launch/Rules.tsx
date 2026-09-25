import { type ReactNode, useEffect, useMemo, useState } from "react";

import { assetUrl } from "./assets.js";
import { BRAND, explorerUrl, readLaunchConfig } from "./config.js";
import { NOT_AFFILIATED, TRACKED_COMPANIES } from "./copy.js";
import {
	connectNetwork,
	ManifestTable,
	type Network,
	PlannedTable,
} from "./LaunchApp.js";
import { buildManifest, snapshotPriceBook } from "./prizes.js";
import { loadSeries, readClient, type SeriesSnapshot } from "./series.js";

type Load<T> =
	| Readonly<{ status: "loading" }>
	| Readonly<{ status: "ready"; value: T }>
	| Readonly<{ status: "error"; message: string }>;

const REPOSITORY = "https://github.com/pina-rs/lootbox";

function formatDate(ms: number): string {
	return new Date(ms).toLocaleString("en-GB", {
		day: "numeric",
		month: "long",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
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

/**
 * Official rules for the series. Dates, inventory and odds are read from the
 * configured treasury on-chain, so the rules never drift from the program.
 */
export default function Rules() {
	const config = useMemo(
		() => readLaunchConfig(import.meta.env, location.search),
		[],
	);
	const book = useMemo(snapshotPriceBook, []);
	const [series, setSeries] = useState<Load<SeriesSnapshot>>({
		status: "loading",
	});
	const [network, setNetwork] = useState<Network | null>(null);

	useEffect(() => {
		document.title = `Official rules — ${BRAND}`;

		const treasury = config.treasury;

		if (!treasury) return;

		connectNetwork(config).then(async (value) => {
			setNetwork(value);
			setSeries({
				status: "ready",
				value: await loadSeries(readClient(value.rpcUrl, treasury), treasury),
			});
		}).catch((reason: unknown) =>
			setSeries({
				status: "error",
				message: reason instanceof Error ? reason.message : String(reason),
			})
		);
	}, [config]);

	const snapshot = series.status === "ready" ? series.value : null;
	const rows = snapshot
		? buildManifest(snapshot.bundles, snapshot.remaining, book, snapshot.labels)
		: [];
	const explorer = { cluster: config.cluster, rpcUrl: network?.rpcUrl ?? "" };
	const treasury = config.treasury;

	return (
		<div className="launch rules">
			<header className="launch-header">
				<a className="brand" href={`${assetUrl("")}${location.search}`}>
					<span className="brand-mark" aria-hidden="true" />
					{BRAND}
				</a>
			</header>
			<main className="rules-body">
				<h1>Official rules</h1>
				<p className="lede">
					{BRAND}{" "}
					is a free giveaway of sealed Solana boxes. No purchase is necessary,
					and buying or selling a box never improves your odds. These rules
					apply to every box in the series.
				</p>

				<Section id="rules-promoter" title="1. Promoter">
					<p>
						The promoter is Ifiok Jr. Contact the promoter by opening an issue
						at <a href={`${REPOSITORY}/issues`}>github.com/pina-rs/lootbox</a>.
					</p>
				</Section>

				<Section id="rules-free" title="2. Free entry">
					<p>
						Boxes are distributed free. No purchase, payment or other
						consideration is required to receive, hold, open or claim. You pay
						only ordinary Solana network fees for your own transactions.
					</p>
				</Section>

				<Section id="rules-eligibility" title="3. Eligibility">
					<p>
						You may open a box wherever you are. To claim a token prize you must
						be 18 or older, and you must not be:
					</p>
					<ul>
						<li>a US person or a resident of the United States;</li>
						<li>
							in a jurisdiction where the prize tokens are restricted by their
							issuer (PreStocks tokens exclude US persons; Backed xStocks
							exclude UK clients);
						</li>
						<li>
							a sanctioned person, or in a sanctioned country or region.
						</li>
					</ul>
					<p>
						Before claiming a token prize you must confirm this in the app. The
						confirmation is not stored. If you cannot confirm it, do not claim:
						the prize stays in escrow, bound to your opening. The Empty Box
						badge and SOL have no eligibility requirement.
					</p>
				</Section>

				<Section id="rules-dates" title="4. Dates">
					<ul>
						<li>
							Distribution: boxes are sent by the promoter from the moment the
							treasury is locked
							{snapshot && snapshot.template.data.lockedAt > 0n
								? ` (${
									formatDate(Number(snapshot.template.data.lockedAt) * 1000)
								})`
								: ""} until they run out.
						</li>
						<li>
							Reveal date:{" "}
							<strong data-testid="rules-reveal">
								{snapshot ? formatDate(snapshot.revealAt) : "to be announced"}
							</strong>. Before then a box can only be held or sent.
						</li>
						<li>
							There is no closing date for opening. Any holder can open after
							the reveal date for as long as boxes remain.
						</li>
					</ul>
				</Section>

				<Section id="rules-prizes" title="5. Prizes, inventory and odds">
					<p>
						Prizes are PreStocks tokens that track SPV exposure to private
						companies. They are not shares and carry no ownership, voting or
						dividend rights. {NOT_AFFILIATED}{" "}
						Some boxes are empty: they deliver an Empty Box badge and 0.001 SOL.
					</p>
					<p>
						The exact inventory below is read from the treasury account on
						chain. Each box has an equal chance of drawing any remaining prize
						copy, so odds equal a bundle's remaining copies divided by all
						remaining copies, and they change after every opening.
					</p>
					{!treasury && <PlannedTable book={book} />}
					{treasury && series.status === "loading" && (
						<p className="muted">Reading the treasury…</p>
					)}
					{series.status === "error" && (
						<p role="alert" className="error">{series.message}</p>
					)}
					{snapshot && <ManifestTable rows={rows} book={book} />}
					{treasury && (
						<p>
							Treasury account:{" "}
							<a href={explorerUrl(explorer, "address", treasury)}>
								{treasury}
							</a>
						</p>
					)}
				</Section>

				<Section id="rules-allocation" title="6. How prizes are allocated">
					<p>
						Opening burns one box and commits to Switchboard On-Demand
						randomness before the result exists. After the oracle's signed
						reveal is verified on-chain, the program allocates a prize first-in,
						first-out, without replacement, from the locked inventory. Nobody,
						including the promoter, can choose or change a result. The chest
						animation only replays the recorded result.
					</p>
					<p>
						If an opening is not revealed within about two minutes, a relayer
						normally completes it. Otherwise, once the program's timeout passes,
						the opening can be forfeited so later openings are not blocked: the
						burned box is not returned and no prize is consumed.
					</p>
				</Section>

				<Section id="rules-delivery" title="7. Delivery">
					<p>
						Prizes are delivered from escrow to the wallet that opened the box
						when it claims. Token issuers charge a transfer fee (typically 1–3%)
						that the token deducts on delivery, so you may receive slightly less
						than the listed amount. Issuers may freeze, pause or claw back their
						tokens at any time.
					</p>
				</Section>

				<Section id="rules-verification" title="8. Public verification">
					<p>
						Every box, opening, randomness proof, allocation and claim is a
						public on-chain record. Winners are identified only by wallet
						address. Anyone can verify them in a block explorer
						{treasury && (
							<>
								{" "}starting from the{" "}
								<a href={explorerUrl(explorer, "address", treasury)}>
									treasury account
								</a>
							</>
						)}.
					</p>
				</Section>

				<Section id="rules-general" title="9. Taxes, risk and advice">
					<ul>
						<li>Any taxes on a prize are the winner's responsibility.</li>
						<li>
							Nothing here is investment advice, an offer, or a recommendation.
							Prize values are estimates and can go to zero.
						</li>
						<li>
							The software is open source and has not been independently
							audited. Use it at your own risk.
						</li>
						<li>Companies tracked: {TRACKED_COMPANIES.join(", ")}.</li>
					</ul>
				</Section>
			</main>
			<footer className="launch-footer">
				<p>
					<a href={`${assetUrl("")}${location.search}`}>Back to {BRAND}</a>
				</p>
				<p className="muted">{NOT_AFFILIATED}</p>
			</footer>
		</div>
	);
}
