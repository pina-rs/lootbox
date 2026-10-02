/**
 * Buy boxes from a lootbox's curve, or sell them back, right on its page.
 * The chart lights up the boxes a trade would move, so the price of three
 * boxes is something you can see, not just a number. A box can be bought
 * straight into a friend's wallet.
 */
import {
	BoxCurveError,
	type CurveQuote,
	LootboxClient,
	quoteCurveBuy,
	quoteCurveSell,
} from "@pina-rs/lootbox";
import { CurveChart, formatSolAmount, Stepper } from "@pina-rs/lootbox-ui";
import { address, isAddress } from "@solana/kit";
import { useWalletAccountTransactionSigner } from "@solana/react";
import type { UiWalletAccount } from "@wallet-standard/react";
import { useEffect, useMemo, useState } from "react";
import { useRevalidator } from "react-router";

import { TxProgress, useTxProgress } from "../components/TxProgress.js";
import { chainFor, type ClusterInfo } from "../lib/clusters.js";
import {
	type BoxCurveView,
	curveLeft,
	curvePhase,
	curveTerms,
	withSlippage,
} from "../lib/curve.js";
import { friendlyError } from "../lib/errors.js";
import { formatSol } from "../lib/plan.js";
import { formatDuration } from "../lib/status.js";
import { useHydrated, useWalletUi } from "../wallet/WalletProvider.js";

type Side = "buy" | "sell";

/** Most boxes one trade moves: keeps transactions and surprises small. */
const MAX_TRADE = 50;

function quote(
	curve: BoxCurveView,
	side: Side,
	count: number,
): CurveQuote | null {
	try {
		const terms = curveTerms(curve);

		return side === "buy"
			? quoteCurveBuy(terms, BigInt(count))
			: quoteCurveSell(terms, BigInt(count));
	} catch (error) {
		if (error instanceof BoxCurveError) return null;

		throw error;
	}
}

function plural(count: number): string {
	return count === 1 ? "box" : "boxes";
}

function TradeForm(
	{
		account,
		cluster,
		template,
		boxMint,
		curve,
		side,
		setSide,
		count,
		setCount,
	}: Readonly<{
		account: UiWalletAccount;
		cluster: ClusterInfo;
		template: string;
		boxMint: string;
		curve: BoxCurveView;
		side: Side;
		setSide: (side: Side) => void;
		count: number;
		setCount: (count: number) => void;
	}>,
) {
	const signer = useWalletAccountTransactionSigner(
		account,
		chainFor(cluster.cluster),
	);
	const { steps, progress, reset } = useTxProgress();
	const client = useMemo(
		() => new LootboxClient(cluster.rpcUrl, signer, progress),
		[cluster.rpcUrl, signer, progress],
	);
	const revalidator = useRevalidator();
	const [holding, setHolding] = useState<bigint | null>(null);
	const [gift, setGift] = useState(false);
	const [friend, setFriend] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [done, setDone] = useState<string | null>(null);
	const sold = Number(curve.sold);
	const left = Number(curveLeft(curve));
	const canSell = holding !== null && holding > 0n && sold > 0;
	const max = side === "buy"
		? Math.min(left, MAX_TRADE)
		: Math.min(Number(holding ?? 0n), sold, MAX_TRADE);
	const priced = quote(curve, side, count);
	const friendValid = !gift || isAddress(friend.trim());

	useEffect(() => {
		let live = true;

		client.boxBalance(address(account.address), address(boxMint)).then(
			(balance) => live && setHolding(balance),
			() => live && setHolding(null),
		);

		return () => {
			live = false;
		};
	}, [client, account.address, boxMint, curve.sold]);

	// Selling the last box hides the toggle; don't strand the form in sell mode.
	useEffect(() => {
		if (holding !== null && !canSell && side === "sell") setSide("buy");
	}, [holding, canSell, side, setSide]);

	const trade = async () => {
		if (!priced) return;

		setBusy(true);
		setError(null);
		setDone(null);
		reset();

		try {
			const current = await client.template(address(template));

			if (side === "buy") {
				await client.buyCurveBoxes(
					current,
					BigInt(count),
					withSlippage(priced.total, "buy"),
					gift ? address(friend.trim()) : undefined,
				);
				setDone(
					gift
						? `Sent ${count} ${plural(count)} to your friend.`
						: `You bought ${count} ${plural(count)}.`,
				);
			} else {
				await client.sellCurveBoxes(
					current,
					BigInt(count),
					withSlippage(priced.total, "sell"),
				);
				setDone(
					`Sold ${count} ${plural(count)} back for ${formatSol(priced.total)}.`,
				);
			}

			setCount(1);
		} catch (reason) {
			setError(friendlyError(reason));
		} finally {
			setBusy(false);
			await revalidator.revalidate();
		}
	};

	return (
		<>
			{canSell && (
				<div className="segmented" role="radiogroup" aria-label="Trade">
					{(["buy", "sell"] as const).map((option) => (
						<label key={option}>
							<input
								type="radio"
								name="curve-side"
								checked={side === option}
								onChange={() => {
									setSide(option);
									setCount(1);
								}}
							/>
							<span>{option === "buy" ? "Buy" : "Sell back"}</span>
						</label>
					))}
				</div>
			)}
			<div className="trade-row">
				<Stepper
					label={side === "buy" ? "Boxes to buy" : "Boxes to sell"}
					showLabel
					value={Math.min(count, Math.max(max, 1))}
					min={1}
					max={Math.max(max, 1)}
					onChange={setCount}
					disabled={max === 0 || busy}
				/>
				{priced && (
					<dl className="trade-quote" data-testid="curve-quote">
						<div>
							<dt>{side === "buy" ? "Price" : "Curve pays"}</dt>
							<dd>{formatSol(priced.lamports)}</dd>
						</div>
						<div>
							<dt>Creator fee</dt>
							<dd>{side === "buy" ? "+" : "−"} {formatSol(priced.fee)}</dd>
						</div>
						<div className="total">
							<dt>{side === "buy" ? "You pay" : "You get"}</dt>
							<dd>{formatSol(priced.total)}</dd>
						</div>
					</dl>
				)}
			</div>
			{side === "buy" && (
				<div className="stack gift">
					<label className="check">
						<input
							type="checkbox"
							checked={gift}
							onChange={(event) => setGift(event.currentTarget.checked)}
						/>
						Send the boxes to a friend
					</label>
					{gift && (
						<div className="field">
							<label htmlFor="curve-friend">Friend's wallet</label>
							<input
								id="curve-friend"
								value={friend}
								spellCheck={false}
								autoComplete="off"
								aria-invalid={friend.trim() !== "" && !friendValid}
								onChange={(event) => setFriend(event.currentTarget.value)}
							/>
						</div>
					)}
				</div>
			)}
			<button
				type="button"
				className="button button-primary"
				disabled={busy || !priced || max === 0 || !friendValid ||
					(gift && friend.trim() === "")}
				onClick={() => void trade()}
			>
				{priced
					? side === "buy"
						? `Buy ${count} ${plural(count)} for ${
							formatSolAmount(Number(priced.total))
						} SOL`
						: `Sell ${count} back for ${
							formatSolAmount(Number(priced.total))
						} SOL`
					: side === "buy"
					? "Sold out"
					: "Nothing to sell"}
			</button>
			{holding !== null && holding > 0n && (
				<p className="fine">
					You hold {holding.toLocaleString("en-US")} {plural(Number(holding))}.
				</p>
			)}
			{done && (
				<p className="notice" role="status" data-testid="curve-done">{done}</p>
			)}
			{(steps.length > 0 || error) && (
				<div className="stack">
					<TxProgress steps={steps} cluster={cluster} busy={busy} />
					{error && <p className="form-error" role="alert">{error}</p>}
				</div>
			)}
		</>
	);
}

type Props = Readonly<{
	account: UiWalletAccount | null;
	cluster: ClusterInfo;
	template: string;
	boxMint: string;
	curve: BoxCurveView;
	now: number;
}>;

export function CurveMarket(
	{ account, cluster, template, boxMint, curve, now }: Props,
) {
	const hydrated = useHydrated();
	const { openConnect } = useWalletUi();
	const [side, setSide] = useState<Side>("buy");
	const [count, setCount] = useState(1);
	const phase = curvePhase(curve, now);
	const sold = Number(curve.sold);
	const inventory = Number(curve.inventory);

	return (
		<section className="card stack curve-market" aria-labelledby="curve-title">
			<div className="section-head">
				<h2 id="curve-title">
					{phase === "trading" ? "Get a box" : "The box curve"}
				</h2>
				<span
					className="chip"
					data-tone={phase === "trading" ? "open" : "done"}
				>
					{phase === "trading"
						? `${inventory - sold} of ${inventory} left`
						: phase === "soldOut"
						? "Sold out"
						: "Trading closed"}
				</span>
			</div>
			<CurveChart
				className="ui-animated"
				inventory={inventory}
				sold={sold}
				startPrice={Number(curve.startPrice)}
				priceStep={Number(curve.priceStep)}
				{...(phase === "trading" ? { preview: { side, count } } : {})}
			/>
			{phase === "trading"
				? (
					<>
						<p className="muted">
							Every box costs a little more than the last. Change your mind?
							Sell it back to the curve until it sells out or the reveal in{" "}
							{formatDuration(curve.closesAt - now)}.
						</p>
						{hydrated && account
							? (
								<TradeForm
									account={account}
									cluster={cluster}
									template={template}
									boxMint={boxMint}
									curve={curve}
									side={side}
									setSide={setSide}
									count={count}
									setCount={setCount}
								/>
							)
							: (
								<button
									type="button"
									className="button button-primary"
									disabled={!hydrated}
									onClick={openConnect}
								>
									Connect to buy
								</button>
							)}
					</>
				)
				: (
					<p className="muted">
						{phase === "soldOut"
							? "Every box on the curve found a home."
							: "Trading closed at the reveal. Boxes still trade anywhere tokens do."}
					</p>
				)}
		</section>
	);
}
