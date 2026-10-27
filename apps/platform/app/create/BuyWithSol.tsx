/** Direct creators to Jupiter to review and authorize token purchases there. */
export function BuyWithSol(
	{ mint, symbol, onBought }: Readonly<{
		mint: string;
		symbol: string;
		onBought: () => void;
	}>,
) {
	return (
		<section className="swap" aria-labelledby="swap-title" data-testid="swap">
			<h4 id="swap-title">Short on {symbol}?</h4>
			<p className="field-hint">
				Buy {symbol}{" "}
				on Jupiter, then return here and refresh your balance. Review the token,
				amount, and wallet approval on Jupiter.
			</p>
			<div className="button-row">
				<a
					className="button button-small"
					href={`https://jup.ag/swap/SOL-${encodeURIComponent(mint)}`}
					target="_blank"
					rel="noopener noreferrer"
				>
					Buy on Jupiter ↗
				</a>
				<button
					type="button"
					className="button button-quiet button-small"
					onClick={onBought}
				>
					Refresh balance
				</button>
			</div>
		</section>
	);
}
