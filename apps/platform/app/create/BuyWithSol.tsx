/**
 * "Buy with SOL": when the wallet is short of a prize token, quote a Jupiter
 * swap for the shortfall, show exactly what it costs, and only sign after the
 * creator confirms. The Worker builds the order; the wallet signs; the Worker
 * relays the signed transaction to Jupiter for landing.
 */
import {
	getBase64EncodedWireTransaction,
	getTransactionDecoder,
} from "@solana/kit";
import { useWalletAccountTransactionSigner } from "@solana/react";
import type { UiWalletAccount } from "@wallet-standard/react";
import { useState } from "react";
import { friendlyError } from "../lib/errors.js";

import { fromBase64 } from "../lib/bytes.js";
import { formatSol, formatUnits } from "../lib/plan.js";
import { usePrices } from "./prices.js";

const WSOL = "So11111111111111111111111111111111111111112";
/** Quote a little extra so price movement does not leave the wallet short. */
const BUFFER = 1.03;

type Quote = Readonly<{
	requestId: string;
	inAmount: string;
	outAmount: string;
	priceImpactPct: number;
	slippageBps: number;
	transaction: string | null;
}>;

function isQuote(value: unknown): value is Quote {
	return typeof value === "object" && value !== null &&
		typeof Reflect.get(value, "requestId") === "string" &&
		typeof Reflect.get(value, "inAmount") === "string" &&
		typeof Reflect.get(value, "outAmount") === "string";
}

function errorOf(value: unknown): string {
	const error = typeof value === "object" && value !== null
		? Reflect.get(value, "error")
		: null;

	return typeof error === "string" ? error : "The swap could not be quoted";
}

export function BuyWithSol(
	{ account, mint, symbol, decimals, shortfall, tokenUsd, onBought }: Readonly<{
		account: UiWalletAccount;
		mint: string;
		symbol: string;
		decimals: number;
		shortfall: bigint;
		tokenUsd: number | null;
		onBought: () => void;
	}>,
) {
	const signer = useWalletAccountTransactionSigner(account, "solana:mainnet");
	const prices = usePrices([WSOL]);
	const solUsd = prices.usd[WSOL] ?? null;
	const [quote, setQuote] = useState<Quote | null>(null);
	const [status, setStatus] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const lamports = tokenUsd && solUsd
		? BigInt(
			Math.ceil(
				(Number(shortfall) / 10 ** decimals) * tokenUsd / solUsd * 1e9 * BUFFER,
			),
		)
		: null;

	if (!lamports) {
		return (
			<p className="field-hint">
				No price for {symbol}{" "}
				yet, so it can't be bought here. Add some to your wallet first.
			</p>
		);
	}

	return (
		<section className="swap" aria-labelledby="swap-title" data-testid="swap">
			<h4 id="swap-title">Short on {symbol}?</h4>
			{!quote
				? (
					<button
						type="button"
						className="button button-small"
						disabled={busy}
						onClick={async () => {
							setBusy(true);
							setStatus(null);

							const response = await fetch(
								`/api/swap?outputMint=${mint}&lamports=${lamports}`,
							);
							const body: unknown = await response.json();

							if (response.ok && isQuote(body)) setQuote(body);
							else setStatus(errorOf(body));

							setBusy(false);
						}}
					>
						Buy with SOL (about {formatSol(lamports)})
					</button>
				)
				: (
					<div className="stack">
						<dl className="cost-table" data-testid="swap-quote">
							<div>
								<dt>You pay</dt>
								<dd>{formatSol(BigInt(quote.inAmount))}</dd>
							</div>
							<div>
								<dt>You get (at least, after slippage)</dt>
								<dd>
									{formatUnits(
										BigInt(quote.outAmount) *
											BigInt(10_000 - quote.slippageBps) / 10_000n,
										decimals,
									)} {symbol}
								</dd>
							</div>
							<div>
								<dt>Price impact</dt>
								<dd>{(quote.priceImpactPct * 100).toFixed(2)}%</dd>
							</div>
							<div>
								<dt>Max slippage</dt>
								<dd>{(quote.slippageBps / 100).toFixed(2)}%</dd>
							</div>
						</dl>
						<p className="fine">
							Routed by Jupiter. Nothing happens until you confirm in your
							wallet.
						</p>
						<div className="button-row">
							<button
								type="button"
								className="button button-primary button-small"
								disabled={busy || quote.transaction === null}
								onClick={async () => {
									if (!quote.transaction) return;

									setBusy(true);
									setStatus("Approve the swap in your wallet…");

									try {
										const transaction = getTransactionDecoder().decode(
											fromBase64(quote.transaction),
										);
										const [signed] = await signer.modifyAndSignTransactions([
											transaction,
										]);

										if (!signed) {
											throw new Error("The wallet returned nothing");
										}

										const response = await fetch("/api/swap", {
											method: "POST",
											headers: { "Content-Type": "application/json" },
											body: JSON.stringify({
												signedTransaction: getBase64EncodedWireTransaction(
													signed,
												),
												requestId: quote.requestId,
											}),
										});
										const body: unknown = await response.json();
										const result = typeof body === "object" && body !== null
											? Reflect.get(body, "status")
											: null;

										setStatus(
											result === "Success"
												? `Bought ${symbol}. Your balance is updating.`
												: `Swap did not complete: ${errorOf(body)}`,
										);
										setQuote(null);
										onBought();
									} catch (error) {
										setStatus(friendlyError(error));
									} finally {
										setBusy(false);
									}
								}}
							>
								Confirm swap
							</button>
							<button
								type="button"
								className="button button-quiet button-small"
								onClick={() =>
									setQuote(null)}
							>
								Cancel
							</button>
						</div>
					</div>
				)}
			{status && <p role="status">{status}</p>}
		</section>
	);
}
