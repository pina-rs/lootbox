/**
 * Sell on a curve: buyers pile in, each box a little dearer than the last,
 * someone sells two back, and the curve sells out and pays the creator. The
 * chart is the site's CurveChart; the numbers are the program's pricing.
 */
import { ActionCard, CurveChart, formatSolAmount } from "@pina-rs/lootbox-ui";
import {
	AbsoluteFill,
	interpolate,
	useCurrentFrame,
	useVideoConfig,
} from "remotion";

import { DEMO_CURVE, DEMO_WALLETS } from "../data/demo.ts";
import { Chest } from "../kit/Chest.tsx";
import { blinks, BOUNCE, enter, mix, POP } from "../kit/motion.ts";
import { Confetti, SparkleBurst } from "../kit/Particles.tsx";
import { Sfx } from "../kit/Sound.tsx";
import { Caption } from "../kit/Type.tsx";

export const CURVE_FRAMES = 465;

type Trade = Readonly<{ at: number; count: number; wallet: number }>;

/** Positive counts buy, negative counts sell back. */
const TRADES: readonly Trade[] = [
	{ at: 14, count: 1, wallet: 0 },
	{ at: 36, count: 2, wallet: 1 },
	{ at: 70, count: 1, wallet: 2 },
	{ at: 95, count: 3, wallet: 3 },
	{ at: 124, count: -2, wallet: 1 },
	{ at: 150, count: 1, wallet: 4 },
	{ at: 178, count: 2, wallet: 5 },
	{ at: 200, count: 1, wallet: 6 },
	{ at: 222, count: 2, wallet: 7 },
	{ at: 244, count: 3, wallet: 8 },
	{ at: 266, count: 1, wallet: 9 },
	{ at: 286, count: 2, wallet: 2 },
	{ at: 306, count: 1, wallet: 0 },
	{ at: 324, count: 2, wallet: 4 },
];
const PREVIEW = 9;
const SOLD_OUT = (TRADES.at(-1)?.at ?? 0) + PREVIEW;

const soldAfter = TRADES.reduce<number[]>((sums, trade) => {
	sums.push((sums.at(-1) ?? 0) + trade.count);

	return sums;
}, []);

const price = (position: number) =>
	DEMO_CURVE.startPrice + DEMO_CURVE.priceStep * position;

function reserveFor(sold: number): number {
	let total = 0;

	for (let position = 0; position < sold; position++) total += price(position);

	return total;
}

/** Sold count at a frame, easing between trades once each preview ends. */
function soldAt(frame: number): number {
	let sold = 0;

	for (const [index, trade] of TRADES.entries()) {
		const settle = trade.at + PREVIEW;
		const next = soldAfter[index] ?? sold;

		if (frame < settle) break;

		sold = frame < settle + 6
			? interpolate(frame, [settle, settle + 6], [sold, next])
			: next;
	}

	return sold;
}

export function CurveSale(
	{ captions = true }: Readonly<{
		/** `false` leaves the captions out, e.g. under someone talking. */
		captions?: boolean;
	}> = {},
) {
	const frame = useCurrentFrame();
	const { width, height } = useVideoConfig();
	const slam = enter(frame, 0, BOUNCE);
	const sold = soldAt(frame);
	const settledSold = Math.round(sold);
	const pending = TRADES.find((trade) =>
		frame >= trade.at && frame < trade.at + PREVIEW
	);
	const soldOut = frame >= SOLD_OUT;
	const cardWidth = width * 0.56;
	const scale = cardWidth / 620;
	const feed = TRADES.filter((trade) => frame >= trade.at).slice(-6).reverse();
	const stamp = enter(frame, SOLD_OUT + 6, BOUNCE);
	const chestRise = enter(frame, SOLD_OUT + 10, BOUNCE);

	return (
		<AbsoluteFill>
			<div
				style={{
					position: "absolute",
					left: width * 0.05,
					top: height * 0.08,
					width: 620,
					transform: `scale(${scale * mix(1.25, 1, slam)})`,
					transformOrigin: "top left",
				}}
			>
				<ActionCard
					kind="curve"
					title="Sell on a curve"
					summary="Each box costs a little more than the last, and buyers can sell back until it sells out."
					status={soldOut ? "Sold out" : "Trading"}
				>
					<CurveChart
						inventory={DEMO_CURVE.inventory}
						sold={sold}
						startPrice={DEMO_CURVE.startPrice}
						priceStep={DEMO_CURVE.priceStep}
						{...(pending
							? {
								preview: {
									side: pending.count > 0 ? "buy" : "sell",
									count: Math.abs(pending.count),
								},
							}
							: {})}
					/>
					<div className="stat-row">
						<div className="stat">
							<b>{settledSold}/{DEMO_CURVE.inventory}</b>
							<span>sold</span>
						</div>
						<div className="stat">
							<b>
								{formatSolAmount(soldOut ? 0 : reserveFor(settledSold))} SOL
							</b>
							<span>backing buybacks</span>
						</div>
						<div className="stat">
							<b>
								{soldOut ? "—" : `${formatSolAmount(price(settledSold))} SOL`}
							</b>
							<span>next box</span>
						</div>
					</div>
				</ActionCard>
			</div>
			<div
				style={{
					position: "absolute",
					left: width * 0.66,
					top: height * 0.1,
					width: width * 0.3,
					display: "grid",
					gap: height * 0.016,
				}}
			>
				<span style={{ font: `400 ${height * 0.032}px/1 var(--display)` }}>
					Live trades
				</span>
				{feed.map((trade) => {
					const wallet = DEMO_WALLETS[trade.wallet];
					const pop = enter(frame, trade.at, POP);
					const buy = trade.count > 0;

					return (
						<div
							key={trade.at}
							style={{
								display: "flex",
								alignItems: "center",
								gap: 14,
								padding: `${height * 0.012}px ${height * 0.016}px`,
								border: "4px solid var(--ink)",
								borderRadius: 18,
								background: buy ? "var(--paper)" : "#fbe0da",
								boxShadow: "0 5px 0 var(--ink)",
								font: `800 ${height * 0.024}px/1.1 var(--body)`,
								transform: `translateX(${
									mix(120, 0, Math.min(1, pop))
								}px) scale(${mix(0.8, 1, Math.min(1, pop))})`,
								opacity: Math.min(1, pop * 1.5),
							}}
						>
							<span
								style={{
									width: height * 0.04,
									height: height * 0.04,
									flex: "none",
									borderRadius: "50%",
									border: "3px solid var(--ink)",
									background: wallet?.color ?? "var(--gold)",
								}}
							/>
							<span style={{ flex: 1, fontFamily: "ui-monospace, monospace" }}>
								{wallet?.address}
							</span>
							<b style={{ color: buy ? "var(--teal)" : "var(--coral)" }}>
								{buy ? `bought ${trade.count}` : `sold ${-trade.count} back`}
							</b>
						</div>
					);
				})}
			</div>
			{soldOut && (
				<div
					style={{
						position: "absolute",
						left: width * 0.62,
						top: height * 0.56,
						padding: `${height * 0.02}px ${height * 0.04}px`,
						border: "6px solid var(--ink)",
						borderRadius: 22,
						background: "var(--gold)",
						boxShadow: "0 9px 0 var(--ink)",
						textAlign: "center",
						transform: `rotate(-6deg) scale(${mix(2.4, 1, stamp)})`,
						opacity: Math.min(1, stamp * 2),
						zIndex: 5,
					}}
				>
					<div style={{ font: `400 ${height * 0.07}px/1 var(--display)` }}>
						Sold out
					</div>
					<div
						style={{
							marginTop: 8,
							font: `900 ${height * 0.03}px/1.2 var(--body)`,
						}}
					>
						≈ {formatSolAmount(reserveFor(DEMO_CURVE.inventory))}{" "}
						SOL paid to the creator
					</div>
				</div>
			)}
			{soldOut && (
				<Chest
					x={width * 0.86}
					y={height + height * 0.2 - chestRise * height * 0.36}
					size={height * 0.36}
					open={1.4}
					look={{ x: -1, y: -0.4 }}
					blink={blinks(frame, [SOLD_OUT + 40])}
					sparkles
				/>
			)}
			<SparkleBurst
				x={width * 0.75}
				y={height * 0.62}
				at={SOLD_OUT + 6}
				radius={height * 0.3}
				size={height * 0.035}
			/>
			<Confetti
				x={width * 0.75}
				y={height * 0.6}
				at={SOLD_OUT + 4}
				count={90}
				seed="sold-out"
			/>
			{captions && (
				<>
					<Caption
						text="Every box costs a little more than the last"
						at={20}
						until={SOLD_OUT - 10}
						size={42}
						bottom={height * 0.05}
					/>
					<Caption
						text="Sell out, and the whole reserve is paid to you"
						at={SOLD_OUT + 20}
						until={CURVE_FRAMES}
						size={42}
						bottom={height * 0.05}
					/>
				</>
			)}
			{TRADES.map((trade) => (
				<Sfx
					key={trade.at}
					name={trade.count > 0 ? "coin-clink" : "blip-down"}
					at={trade.at}
					volume={0.45}
				/>
			))}
			<Sfx name="coins-cascade" at={SOLD_OUT} volume={0.7} />
			<Sfx name="cash-register" at={SOLD_OUT + 8} volume={0.6} />
		</AbsoluteFill>
	);
}
