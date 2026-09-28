/**
 * Sell boxes on a bonding curve: pick how many boxes, the first and last
 * price, and a fee, and see the whole staircase and the sell-out take before
 * signing. Once open, the card shows the curve filling up and closes it when
 * the program allows.
 */
import {
	BoxCurveError,
	type LootboxClient,
	MAX_CURVE_FEE_BPS,
	MIN_CURVE_INVENTORY,
	planBoxCurve,
} from "@pina-rs/lootbox";
import {
	ActionCard,
	CurveChart,
	formatSolAmount,
	Stepper,
} from "@pina-rs/lootbox-ui";
import { address } from "@solana/kit";
import { useState } from "react";

import type { LootboxChainView } from "../lib/chain.js";
import {
	type BoxCurveView,
	canCloseCurve,
	curveLeft,
	curvePhase,
} from "../lib/curve.js";
import { formatSol, parseUnits } from "../lib/plan.js";
import { formatDuration } from "../lib/status.js";
import type { Run } from "./AirdropCard.js";

const FEES = [
	{ bps: 0, label: "None" },
	{ bps: 100, label: "1%" },
	{ bps: 250, label: "2.5%" },
	{ bps: MAX_CURVE_FEE_BPS, label: "5%" },
] as const;

type Props = Readonly<{
	client: LootboxClient;
	chain: LootboxChainView;
	balance: bigint | null;
	now: number;
	busy: boolean;
	run: Run;
}>;

/** Average SOL prize per remaining box; tokens and NFTs are not priced. */
export function solPrizePerBox(
	chain: Pick<LootboxChainView, "bundles">,
): bigint | null {
	let lamports = 0n;
	let boxes = 0n;

	for (const bundle of chain.bundles) {
		if (bundle.status !== 1) continue;

		const remaining = BigInt(bundle.remaining);

		boxes += remaining;
		for (const asset of bundle.assets) {
			if (asset.kind === "sol" || asset.kind === "quoteSol") {
				lamports += BigInt(asset.amount) * remaining;
			}
		}
	}

	return boxes === 0n || lamports === 0n ? null : lamports / boxes;
}

function CurveStatus(
	{ curve, now, busy, run, client, chain }: Readonly<{
		curve: BoxCurveView;
		now: number;
		busy: boolean;
		run: Run;
		client: LootboxClient;
		chain: LootboxChainView;
	}>,
) {
	const phase = curvePhase(curve, now);
	const sold = Number(curve.sold);
	const inventory = Number(curve.inventory);
	const left = curveLeft(curve);
	const nextPrice = BigInt(curve.startPrice) +
		BigInt(curve.priceStep) * BigInt(curve.sold);

	return (
		<>
			<CurveChart
				className="ui-animated"
				inventory={inventory}
				sold={sold}
				startPrice={Number(curve.startPrice)}
				priceStep={Number(curve.priceStep)}
			/>
			<div className="stat-row">
				<div className="stat">
					<b data-testid="curve-sold">{sold}/{inventory}</b>
					<span>sold</span>
				</div>
				<div className="stat">
					<b>{formatSol(BigInt(curve.reserve))}</b>
					<span>backing buybacks</span>
				</div>
				{phase === "trading" && (
					<div className="stat">
						<b>{formatSol(nextPrice)}</b>
						<span>next box</span>
					</div>
				)}
			</div>
			<p className="muted">
				{phase === "trading" &&
					`Trading closes at the reveal, in ${
						formatDuration(curve.closesAt - now)
					}. Selling out pays you everything in the curve at once.`}
				{phase === "soldOut" &&
					"Sold out. The curve paid you its whole reserve; close it to recover its rent."}
				{phase === "closed" &&
					`Trading closed at the reveal with ${left} ${
						left === 1n ? "box" : "boxes"
					} unsold. Closing pays you the reserve and returns them.`}
			</p>
			{canCloseCurve(curve, now) && (
				<button
					type="button"
					className="button"
					disabled={busy}
					onClick={() =>
						void run(async () => {
							await client.closeBoxCurve(
								await client.template(address(chain.template)),
							);
						})}
				>
					Close the curve
				</button>
			)}
		</>
	);
}

function CurveForm(
	{ client, chain, balance, now, busy, run }: Omit<Props, "chain"> & {
		chain: LootboxChainView;
	},
) {
	const available = Number(balance ?? 0n);
	const maxBoxes = Math.max(Number(MIN_CURVE_INVENTORY), available);
	const [boxes, setBoxes] = useState(() =>
		Math.max(Number(MIN_CURVE_INVENTORY), Math.min(available, 50))
	);
	const [first, setFirst] = useState("0.01");
	const [last, setLast] = useState("0.05");
	const [feeBps, setFeeBps] = useState(100);
	const perBox = solPrizePerBox(chain);
	const startPrice = parseUnits(first, 9);
	const endPrice = parseUnits(last, 9);
	let plan: ReturnType<typeof planBoxCurve> | null = null;
	let problem: string | null = null;

	if (balance !== null && available < Number(MIN_CURVE_INVENTORY)) {
		return (
			<p className="muted">
				A curve needs at least {MIN_CURVE_INVENTORY.toString()}{" "}
				boxes to find a price, and your wallet holds{" "}
				{available}. Send the rest to a list instead, or make a bigger lootbox
				next time.
			</p>
		);
	}

	if (startPrice === null || endPrice === null) {
		problem = "Enter prices in SOL, such as 0.01.";
	} else {
		try {
			plan = planBoxCurve({
				inventory: BigInt(boxes),
				startPrice,
				endPrice,
				feeBps,
			});
		} catch (error) {
			if (!(error instanceof BoxCurveError)) throw error;

			problem = `${error.message[0]?.toUpperCase() ?? ""}${
				error.message.slice(1)
			}.`;
		}
	}

	return (
		<>
			<div className="form-grid">
				<Stepper
					label="Boxes on the curve"
					showLabel
					value={boxes}
					min={Number(MIN_CURVE_INVENTORY)}
					max={maxBoxes}
					onChange={setBoxes}
					disabled={balance === null}
				/>
				<div className="field">
					<label htmlFor="curve-first">First box (SOL)</label>
					<input
						id="curve-first"
						inputMode="decimal"
						value={first}
						onChange={(event) => setFirst(event.currentTarget.value)}
					/>
				</div>
				<div className="field">
					<label htmlFor="curve-last">Last box (SOL)</label>
					<input
						id="curve-last"
						inputMode="decimal"
						value={last}
						onChange={(event) => setLast(event.currentTarget.value)}
					/>
				</div>
			</div>
			<fieldset className="field">
				<legend className="field-label">Your fee on every trade</legend>
				<div className="segmented">
					{FEES.map((fee) => (
						<label key={fee.bps}>
							<input
								type="radio"
								name="curve-fee"
								checked={feeBps === fee.bps}
								onChange={() => setFeeBps(fee.bps)}
							/>
							<span>{fee.label}</span>
						</label>
					))}
				</div>
			</fieldset>
			{plan && (
				<>
					<CurveChart
						className="ui-animated"
						inventory={Number(plan.inventory)}
						sold={0}
						startPrice={Number(plan.startPrice)}
						priceStep={Number(plan.priceStep)}
					/>
					<dl className="cost-table" data-testid="curve-plan">
						<div>
							<dt>
								If every box sells
								<small>Paid to you the moment the last box sells</small>
							</dt>
							<dd>≈ {formatSolAmount(Number(plan.sellOutLamports))} SOL</dd>
						</div>
						{perBox !== null && (
							<div>
								<dt>
									SOL prizes per box
									<small>Average over the boxes left; tokens not counted</small>
								</dt>
								<dd>{formatSol(perBox)}</dd>
							</div>
						)}
					</dl>
				</>
			)}
			{problem && <p className="form-error" role="status">{problem}</p>}
			<p className="fine">
				Buyers can sell boxes back until the curve sells out or the reveal, in
				{" "}
				{formatDuration(chain.opensAt - now)}, then trading closes. Selling
				chances for money is a lottery in many places; check the rules where you
				live.
			</p>
			<button
				type="button"
				className="button button-teal"
				disabled={busy || plan === null}
				onClick={() =>
					plan &&
					void run(async () => {
						await client.openBoxCurve(
							await client.template(address(chain.template)),
							plan,
						);
					})}
			>
				Put {boxes} boxes on the curve
			</button>
		</>
	);
}

export function CurveCard(props: Props) {
	const { chain, now } = props;
	const curve = chain.curve;
	const phase = curve ? curvePhase(curve, now) : null;

	return (
		<ActionCard
			kind="curve"
			id="curve"
			title="Sell on a curve"
			summary="Each box costs a little more than the last, and buyers can sell back until it sells out."
			{...(phase === "trading"
				? { status: "Trading" }
				: phase === "soldOut"
				? { status: "Sold out" }
				: phase === "closed"
				? { status: "Closed" }
				: {})}
		>
			{curve
				? (
					<CurveStatus
						curve={curve}
						now={now}
						busy={props.busy}
						run={props.run}
						client={props.client}
						chain={chain}
					/>
				)
				: now >= chain.opensAt
				? (
					<p className="muted">
						Curves sell before the reveal. This lootbox is already open.
					</p>
				)
				: <CurveForm {...props} />}
		</ActionCard>
	);
}
