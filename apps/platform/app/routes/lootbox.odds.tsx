import { OddsTable } from "../components/OddsTable.js";
import { prizeViews, stockDisclaimer } from "../lib/prizes.js";
import { useLootbox } from "./lootbox.js";

export default function OddsTab() {
	const { chain, lootbox } = useLootbox();

	if (!chain) {
		return <p className="notice">Odds appear once the chain answers.</p>;
	}

	const prizes = prizeViews(chain.bundles, lootbox.bundles);
	const remaining = prizes.reduce((sum, prize) => sum + prize.remaining, 0n);
	const total = prizes.reduce((sum, prize) => sum + prize.quantity, 0n);
	const stocks = prizes.flatMap((prize) => prize.tracks);

	return (
		<>
			<section className="stat-row" aria-label="Supply">
				<div className="stat">
					<b>{total.toLocaleString("en-US")}</b>
					<span>boxes in total</span>
				</div>
				<div className="stat">
					<b>{remaining.toLocaleString("en-US")}</b>
					<span>still unopened</span>
				</div>
				<div className="stat">
					<b>{prizes.length}</b>
					<span>kinds of prize</span>
				</div>
			</section>
			<section className="card" aria-labelledby="odds-title">
				<h2 id="odds-title">Live odds</h2>
				<OddsTable prizes={prizes} />
				<p className="fine">
					Every unopened box is one equal ticket. A prize's chance is its copies
					left divided by all copies left, so odds shift after each opening.
					There are no hidden weights.
				</p>
				{prizes.some((prize) => prize.issuerStock) && (
					<p className="fine">{stockDisclaimer(stocks)}</p>
				)}
			</section>
		</>
	);
}
