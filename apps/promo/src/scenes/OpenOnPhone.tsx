/**
 * The holder's side, on a phone: a box arrives, you hold the chest until the
 * ring fills, randomness picks, the chest leaps, and the prize is yours. The
 * chest plays the brand's motion on the site's own timeline, so this is what
 * the page does.
 */
import { ChestFigure, ChestMark } from "@pina-rs/lootbox-brand";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";

import { DEMO_TITLE } from "../data/demo.ts";
import { chestFlowFrame } from "../kit/chestFlow.ts";
import { Coin } from "../kit/Coin.tsx";
import { PhoneFrame, SiteViewport } from "../kit/Frames.tsx";
import { BOUNCE, enter, FPS, mix, progress, SNAP } from "../kit/motion.ts";
import { Confetti } from "../kit/Particles.tsx";
import { Sfx } from "../kit/Sound.tsx";
import { Tap } from "../kit/Tap.tsx";
import { Caption } from "../kit/Type.tsx";

export const OPEN_FRAMES = 372;
const NOTIFY = 12;
const TAP_NOTE = 44;
const PAGE = 56;
const HOLD = 80;
const CHARGED = 140;
const REVEAL = 160;
const CARD = 252;
const CLAIM = 318;

function Notification({ frame }: Readonly<{ frame: number }>) {
	const drop = enter(frame, NOTIFY, BOUNCE);
	const leave = progress(frame, TAP_NOTE + 4, 8);

	return (
		<div
			style={{
				position: "absolute",
				left: 12,
				right: 12,
				top: 58,
				display: "flex",
				gap: 12,
				alignItems: "center",
				padding: "12px 14px",
				border: "2.5px solid var(--ink)",
				borderRadius: 20,
				background: "var(--white)",
				boxShadow: "0 4px 0 var(--ink)",
				transform: `translateY(${
					mix(-160, 0, Math.min(1.05, drop)) - leave * 160
				}px)`,
				zIndex: 10,
			}}
		>
			<ChestMark
				variant="compact"
				size={44}
				look={{ x: 0, y: 0.05 }}
				style={{ flex: "none" }}
			/>
			<span style={{ display: "grid", gap: 2, flex: 1 }}>
				<b style={{ font: "900 15px/1.2 var(--body)" }}>You got a lootbox</b>
				<span
					style={{
						font: "600 14px/1.25 var(--body)",
						color: "var(--ink-soft)",
					}}
				>
					1 box from {DEMO_TITLE}. Hold the chest to open it.
				</span>
			</span>
			<Tap taps={[TAP_NOTE]} x="80%" y="60%" size={26} />
		</div>
	);
}

function LockScreen({ frame }: Readonly<{ frame: number }>) {
	return (
		<div
			style={{
				position: "absolute",
				inset: 0,
				display: "grid",
				placeItems: "center",
				alignContent: "center",
				gap: 6,
				background: "linear-gradient(180deg, var(--teal-deep), var(--teal))",
				color: "var(--ivory)",
				opacity: 1 - progress(frame, PAGE - 6, 8),
			}}
		>
			<span style={{ font: "400 84px/1 var(--display)" }}>9:41</span>
			<span style={{ font: "800 18px/1 var(--body)", opacity: 0.8 }}>
				Friday, 3 October
			</span>
		</div>
	);
}

function Ring(
	{ charge, busy, frame }: Readonly<
		{ charge: number; busy: boolean; frame: number }
	>,
) {
	return (
		<svg
			viewBox="0 0 100 100"
			style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }}
		>
			<circle
				cx={50}
				cy={50}
				r={47}
				fill="none"
				stroke="var(--line)"
				strokeWidth={0.8}
			/>
			<circle
				cx={50}
				cy={50}
				r={47}
				fill="none"
				stroke={busy ? "var(--gold)" : "var(--teal)"}
				strokeWidth={2.6}
				strokeLinecap="round"
				pathLength={1}
				strokeDasharray={busy ? "0.22 0.78" : "1"}
				strokeDashoffset={busy ? -frame / 30 : 1 - charge}
				opacity={charge > 0 || busy ? 1 : 0}
			/>
		</svg>
	);
}

function PrizeCard({ frame }: Readonly<{ frame: number }>) {
	const rise = enter(frame, CARD, BOUNCE);
	const claimed = frame >= CLAIM + 6;

	return (
		<section
			className="card"
			style={{
				position: "absolute",
				left: 14,
				right: 14,
				bottom: 18,
				display: "grid",
				gap: 12,
				justifyItems: "center",
				textAlign: "center",
				transform: `translateY(${mix(420, 0, rise)}px)`,
				zIndex: 8,
			}}
		>
			<span
				style={{
					font: "900 13px/1 var(--body)",
					letterSpacing: "0.12em",
					color: "var(--muted)",
				}}
			>
				YOU WON
			</span>
			<div style={{ display: "flex", alignItems: "center", gap: 12 }}>
				<Coin kind="sol" size={56} />
				<b style={{ font: "400 40px/1 var(--display)" }}>1 SOL</b>
			</div>
			<span
				style={{ font: "700 14px/1.3 var(--body)", color: "var(--ink-soft)" }}
			>
				The grand prize: 1 in 20 boxes
			</span>
			<button
				type="button"
				className={claimed ? "button" : "button button-primary"}
				style={{ width: "100%", position: "relative" }}
			>
				{claimed ? "Delivered to your wallet ✓" : "Claim to wallet"}
				<Tap taps={[CLAIM]} x="62%" y="55%" size={26} />
			</button>
		</section>
	);
}

export function OpenOnPhone(
	{ captions = true }: Readonly<{
		/** `false` leaves the captions out, e.g. under someone talking. */
		captions?: boolean;
	}> = {},
) {
	const frame = useCurrentFrame();
	const { width, height } = useVideoConfig();
	const phoneWidth = Math.min(width * 0.72, height * 0.37);
	const phoneLeft = (width - phoneWidth) / 2;
	const phoneTop = height * 0.035;
	const arrive = enter(frame, 0, SNAP);
	const charge = progress(frame, HOLD, CHARGED - HOLD, (t) => t);
	const busy = frame >= CHARGED && frame < REVEAL;

	const revealing = frame >= REVEAL;
	const chest = chestFlowFrame({
		holdAt: HOLD / FPS,
		waitAt: CHARGED / FPS,
		revealAt: REVEAL / FPS,
		reaction: "big-prize",
	}, frame / FPS);
	const inner = phoneWidth - 36;

	return (
		<AbsoluteFill>
			<PhoneFrame
				width={phoneWidth}
				style={{
					left: phoneLeft,
					top: phoneTop + mix(height, 0, Math.min(1, arrive)),
					transform: `rotate(${mix(-6, -1.5, Math.min(1, arrive))}deg)`,
				}}
			>
				<SiteViewport
					cssWidth={390}
					width={inner}
					height={phoneWidth * 2.05 - 36}
				>
					<div className="stack" style={{ padding: "70px 18px 0", gap: 14 }}>
						<p className="button-row" style={{ gap: 8 }}>
							<span className="chip" data-tone="open">Open now</span>
							<span className="chip">
								You have {frame >= REVEAL ? 0 : 1} box
							</span>
						</p>
						<h1 className="display" style={{ fontSize: 40 }}>{DEMO_TITLE}</h1>
						<div
							style={{
								position: "relative",
								width: 356,
								height: 356,
								marginInline: "auto",
								marginTop: 10,
							}}
						>
							<div
								style={{
									position: "absolute",
									inset: "10%",
									borderRadius: "50%",
									background:
										"radial-gradient(circle, rgb(240 180 41 / 0.45), transparent 70%)",
									opacity: charge + (revealing ? 1 : 0),
									transform: `scale(${1 + charge * 0.3})`,
								}}
							/>
							{!revealing && <Ring charge={charge} busy={busy} frame={frame} />}
							<ChestFigure
								frame={chest}
								style={{
									position: "absolute",
									left: "6%",
									top: "6%",
									width: "88%",
								}}
							/>
							{frame >= HOLD - 10 && frame < CHARGED + 4 && (
								<span
									style={{
										position: "absolute",
										left: "50%",
										top: "56%",
										width: 70,
										height: 70,
										marginLeft: -35,
										marginTop: -35,
										borderRadius: "50%",
										border: "4px solid var(--ink)",
										background: "rgb(255 253 247 / 0.55)",
										transform: `scale(${
											frame < HOLD
												? mix(1.6, 1, progress(frame, HOLD - 10, 10))
												: 0.92
										})`,
										opacity: frame < HOLD
											? progress(frame, HOLD - 10, 10)
											: 1 - progress(frame, CHARGED, 4),
									}}
								/>
							)}
						</div>
						<p
							className="chest-hint"
							style={{ marginInline: "auto", opacity: revealing ? 0 : 1 }}
						>
							{busy
								? "Opening… the oracle is picking your prize."
								: "Press and hold the chest to open a box."}
						</p>
					</div>
					{frame >= CARD && <PrizeCard frame={frame} />}
					{frame < PAGE + 4 && <LockScreen frame={frame} />}
					{frame >= NOTIFY - 2 && frame < PAGE && (
						<Notification
							frame={frame}
						/>
					)}
				</SiteViewport>
			</PhoneFrame>
			<Confetti
				x={width / 2}
				y={height * 0.55}
				at={CARD + 4}
				count={80}
				seed="open"
			/>
			{captions && (
				<>
					<Caption
						text="Hold the chest to open it"
						at={PAGE + 8}
						until={CHARGED}
						size={50}
						bottom={height * 0.07}
					/>
					<Caption
						text="Verifiable randomness picks the prize"
						at={CHARGED + 2}
						until={CARD - 6}
						size={52}
						bottom={height * 0.05}
					/>
					<Caption
						text="Real prizes, straight to your wallet"
						at={CARD + 6}
						until={OPEN_FRAMES}
						size={50}
						bottom={height * 0.07}
					/>
				</>
			)}
			<Sfx name="notification" at={NOTIFY + 2} volume={0.7} />
			<Sfx name="ui-click" at={TAP_NOTE} volume={0.6} />
			<Sfx name="drumroll" at={HOLD} volume={0.6} />
			<Sfx name="chest-creak" at={REVEAL + 20} volume={0.5} />
			<Sfx name="fanfare-short" at={CARD} volume={0.7} />
			<Sfx name="cash-register" at={CLAIM + 4} volume={0.6} />
		</AbsoluteFill>
	);
}

/** Frames spent on each phase, for captions in other cuts. */
export const OPEN_MARKS = {
	page: PAGE,
	hold: HOLD,
	charged: CHARGED,
	reveal: REVEAL,
	card: CARD,
	claim: CLAIM,
} as const;
