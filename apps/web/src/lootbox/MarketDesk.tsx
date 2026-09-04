import {
	bundleAssets,
	type ChainBundle,
	type ChainTemplate,
	createRaydiumCpmmMarketManifest,
	quoteBoxTrade,
	remainingExpectedValue,
	serializeMarketManifest,
} from "@pina-rs/lootbox";
import {
	ArrowRightLeft,
	Check,
	Copy,
	ExternalLink,
	LockKeyhole,
	Scale,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { formatUnits, parseUnits } from "./playground.js";

type Props = Readonly<{
	template: ChainTemplate;
	bundles: readonly ChainBundle[];
	supply: bigint;
	chainTime: bigint;
}>;

function solOnlyValue(bundle: ChainBundle): bigint | undefined {
	const assets = bundleAssets(bundle.data);
	if (!assets.every((asset) => asset.kind === "sol")) return undefined;
	return assets.reduce((total, asset) => total + asset.amount, 0n);
}

function countdown(seconds: bigint): string {
	if (seconds <= 0n) return "Reveal is live";
	const days = seconds / 86_400n;
	const hours = seconds % 86_400n / 3_600n;
	const minutes = seconds % 3_600n / 60n;
	if (days > 0n) return `${days}d ${hours}h until reveal`;
	if (hours > 0n) return `${hours}h ${minutes}m until reveal`;
	return `${minutes}m until reveal`;
}

export function MarketDesk({ template, bundles, supply, chainTime }: Props) {
	const [valuations, setValuations] = useState<Record<string, string>>({});
	const [direction, setDirection] = useState<"buy" | "sell">("buy");
	const [tradeAmount, setTradeAmount] = useState("1");
	const [boxReserve, setBoxReserve] = useState("1");
	const [quoteReserve, setQuoteReserve] = useState("1");
	const [marketPrice, setMarketPrice] = useState("");
	const [copied, setCopied] = useState(false);

	useEffect(() => {
		setValuations({});
		const initialReserve = template.data.totalBundles > 1n
			? template.data.totalBundles / 2n
			: 1n;
		setBoxReserve(initialReserve.toString());
		setCopied(false);
	}, [template.address]);

	useEffect(() => {
		setValuations((current) => {
			let changed = false;
			const next = { ...current };
			for (const bundle of bundles) {
				if (bundle.address in next) continue;
				const value = solOnlyValue(bundle);
				next[bundle.address] = value === undefined ? "" : formatUnits(value);
				changed = true;
			}
			return changed ? next : current;
		});
	}, [bundles]);

	const expectedValue = useMemo(() => {
		const values = bundles.flatMap((bundle, index) => {
			const value = valuations[bundle.address]?.trim();
			if (!value) return [];
			try {
				return [{ index, quoteValue: parseUnits(value, 9) }];
			} catch {
				return [];
			}
		});
		return remainingExpectedValue(template.data, values);
	}, [bundles, template.data, valuations]);

	let quote: ReturnType<typeof quoteBoxTrade> | undefined;
	let quoteError = "";
	try {
		const boxes = parseUnits(boxReserve, 0);
		const quoteLamports = parseUnits(quoteReserve, 9);
		quote = direction === "buy"
			? quoteBoxTrade({
				inputAmount: parseUnits(tradeAmount, 9),
				inputReserve: quoteLamports,
				outputReserve: boxes,
				boxIsOutput: true,
			})
			: quoteBoxTrade({
				inputAmount: parseUnits(tradeAmount, 0),
				inputReserve: boxes,
				outputReserve: quoteLamports,
				boxIsOutput: false,
			});
	} catch (reason) {
		quoteError = reason instanceof Error ? reason.message : "Check pool values";
	}

	let priceSignal = "Enter a market price to compare it with remaining EV.";
	try {
		if (marketPrice && expectedValue.complete) {
			const price = parseUnits(marketPrice, 9);
			priceSignal = price === expectedValue.knownValue
				? "Market price matches estimated remaining EV."
				: price > expectedValue.knownValue
				? `Market premium: ${
					formatUnits(price - expectedValue.knownValue)
				} SOL.`
				: `Market discount: ${
					formatUnits(expectedValue.knownValue - price)
				} SOL.`;
		}
	} catch {
		priceSignal = "Use a valid SOL price with up to 9 decimal places.";
	}

	const copyManifest = async () => {
		try {
			const manifest = createRaydiumCpmmMarketManifest(template.data, {
				initialBoxLiquidity: parseUnits(boxReserve, 0),
				initialQuoteLiquidity: parseUnits(quoteReserve, 9),
			});
			await navigator.clipboard.writeText(serializeMarketManifest(manifest));
			setCopied(true);
		} catch {
			setCopied(false);
		}
	};

	return (
		<section className="market-desk" aria-labelledby="market-desk-title">
			<header className="market-desk__header">
				<div>
					<h2 id="market-desk-title">Market desk</h2>
					<p>
						Trade the sealed opportunity before reveal. Every unit is one whole,
						fungible Token-2022 box backed by this exact inventory.
					</p>
				</div>
				<strong className={chainTime < template.data.opensAt ? "" : "is-live"}>
					{countdown(template.data.opensAt - chainTime)}
				</strong>
			</header>
			<div className="market-proof" aria-label="Market guarantees">
				<span>
					<LockKeyhole size={16} />Treasury immutable
				</span>
				<span>
					<Check size={16} />Mint authority revoked
				</span>
				<span>
					<Scale size={16} />
					{supply.toString()} / {template.data.totalBundles.toString()} issued
				</span>
				<span>
					<ArrowRightLeft size={16} />0 decimals · whole boxes only
				</span>
			</div>

			<div className="market-grid">
				<section className="market-panel" aria-labelledby="ev-title">
					<h3 id="ev-title">Remaining expected value</h3>
					<p>
						SOL-only bundles are filled automatically. Price every token or NFT
						bundle yourself; catalog metadata is never treated as a valuation.
					</p>
					<div className="valuation-list">
						{bundles.map((bundle, index) => (
							<label className="field" key={bundle.address}>
								Bundle {index + 1} value <span>SOL</span>
								<input
									aria-label={`Bundle ${index + 1} value in SOL`}
									inputMode="decimal"
									placeholder="Enter your estimate"
									value={valuations[bundle.address] ?? ""}
									onChange={(event) =>
										setValuations((current) => ({
											...current,
											[bundle.address]: event.target.value,
										}))}
								/>
							</label>
						))}
					</div>
					<div className="ev-readout">
						<span>
							{expectedValue.complete ? "Estimated EV" : "Known EV floor"}
						</span>
						<strong>{formatUnits(expectedValue.knownValue)} SOL / box</strong>
						<small>
							{expectedValue.complete
								? `${expectedValue.remainingCopies} remaining outcomes valued`
								: `${expectedValue.unknownBundleIndexes.length} bundle valuation${
									expectedValue.unknownBundleIndexes.length === 1 ? "" : "s"
								} missing`}
						</small>
					</div>
					<label className="field market-price">
						Observed market price <span>SOL / box</span>
						<input
							aria-label="Observed market price in SOL"
							inputMode="decimal"
							placeholder="0.00"
							value={marketPrice}
							onChange={(event) => setMarketPrice(event.target.value)}
						/>
					</label>
					<p className="market-signal">{priceSignal}</p>
				</section>

				<section className="market-panel" aria-labelledby="trade-title">
					<h3 id="trade-title">Whole-box trade preview</h3>
					<p>
						Model a constant-product pool with a 0.25% fee. This local screen
						does not submit a mainnet trade.
					</p>
					<div
						className="trade-direction"
						role="group"
						aria-label="Trade direction"
					>
						<button
							type="button"
							aria-pressed={direction === "buy"}
							onClick={() => setDirection("buy")}
						>
							Buy boxes
						</button>
						<button
							type="button"
							aria-pressed={direction === "sell"}
							onClick={() => setDirection("sell")}
						>
							Sell boxes
						</button>
					</div>
					<div className="trade-fields">
						<label className="field">
							Pool boxes<input
								aria-label="Pool box reserve"
								type="number"
								min="1"
								step="1"
								value={boxReserve}
								onChange={(event) => setBoxReserve(event.target.value)}
							/>
						</label>
						<label className="field">
							Pool quote <span>SOL</span>
							<input
								aria-label="Pool SOL reserve"
								inputMode="decimal"
								value={quoteReserve}
								onChange={(event) => setQuoteReserve(event.target.value)}
							/>
						</label>
						<label className="field">
							{direction === "buy" ? "Spend" : "Sell"}{" "}
							<span>{direction === "buy" ? "SOL" : "boxes"}</span>
							<input
								aria-label={direction === "buy"
									? "SOL to spend"
									: "Boxes to sell"}
								inputMode="decimal"
								value={tradeAmount}
								onChange={(event) => setTradeAmount(event.target.value)}
							/>
						</label>
					</div>
					<div className="trade-quote" aria-live="polite">
						{quote
							? (
								<>
									<span>Estimated output</span>
									<strong>
										{direction === "buy"
											? `${quote.output} whole box${
												quote.output === 1n ? "" : "es"
											}`
											: `${formatUnits(quote.output)} SOL`}
									</strong>
									<small>
										{quote.minimumUnitSatisfied
											? "Preview only · price impact included"
											: "Amount is too small to receive one indivisible box"}
									</small>
								</>
							)
							: <small>{quoteError}</small>}
					</div>
					<div className="market-actions">
						<button
							type="button"
							className="quiet-button"
							onClick={() => void copyManifest()}
						>
							<Copy size={15} />
							{copied ? "Manifest copied" : "Copy Raydium manifest"}
						</button>
						<a
							className="quiet-button"
							href="https://docs.raydium.io/raydium/pool-creation/creating-a-constant-product-pool"
							target="_blank"
							rel="noreferrer"
						>
							Deployment guide <ExternalLink size={14} />
						</a>
					</div>
					<p className="market-disclosure">
						The copied manifest is checked against fixed supply and is ready for
						a production wallet/Raydium SDK adapter. Pricing, eligibility, and
						jurisdiction controls remain the market operator’s responsibility.
					</p>
				</section>
			</div>
		</section>
	);
}
