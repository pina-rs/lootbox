/**
 * The creator fills a lootbox in the real wizard: bundles pop in, prizes
 * land in them, copy counts tick up, and the odds strip reflows live. Built
 * from the site's markup and @pina-rs/lootbox-ui, so it is the product. A
 * checklist beside the browser narrates, so nothing covers the page.
 */
import { OddsStrip, Stepper } from "@pina-rs/lootbox-ui";
import type { ReactNode } from "react";
import {
	AbsoluteFill,
	interpolate,
	useCurrentFrame,
	useVideoConfig,
} from "remotion";

import { DEMO_BUNDLES, type DemoBundle, TONE_COLORS } from "../data/demo.ts";
import { Coin, PrizeChip } from "../kit/Coin.tsx";
import { BrowserFrame, SiteBar, SiteViewport } from "../kit/Frames.tsx";
import { enter, mix, POP, progress, SNAP } from "../kit/motion.ts";
import { Sfx } from "../kit/Sound.tsx";
import { Tap } from "../kit/Tap.tsx";

/** When each bundle appears, gets its prize, and counts up. */
type Beat = Readonly<
	{ add: number; prize: number; countFrom: number; countTo: number }
>;

const BEATS: readonly Beat[] = [
	{ add: 30, prize: 46, countFrom: 60, countTo: 60 },
	{ add: 64, prize: 80, countFrom: 88, countTo: 112 },
	{ add: 124, prize: 140, countFrom: 146, countTo: 162 },
	{ add: 176, prize: 190, countFrom: 196, countTo: 208 },
];

/** Each demo bundle with its timing. */
const STAGED = DEMO_BUNDLES.flatMap((bundle, index) => {
	const beat = BEATS[index];

	return beat ? [{ bundle, beat }] : [];
});

export const BUILDER_FRAMES = 248;
const HIGHLIGHT = 214;
const CSS_WIDTH = 920;

const CHECKLIST = [
	{ text: "Add a bundle", from: 0 },
	{ text: "Drop in prizes", from: 44 },
	{ text: "Set how many", from: 86 },
	{ text: "Odds update live", from: 150 },
] as const;

function typed(text: string, frame: number, start: number): string {
	return text.slice(0, Math.max(0, frame - start));
}

function countAt(bundle: DemoBundle, beat: Beat, frame: number): number {
	if (frame < beat.add) return 0;

	if (bundle.boxes === 1 || frame < beat.countFrom) return 1;

	return Math.round(
		interpolate(frame, [beat.countFrom, beat.countTo], [1, bundle.boxes], {
			extrapolateLeft: "clamp",
			extrapolateRight: "clamp",
		}),
	);
}

function tickFrames(bundle: DemoBundle, beat: Beat): number[] {
	const ticks = bundle.boxes - 1;

	return Array.from(
		{ length: ticks },
		(_, tick) =>
			beat.countFrom + ((beat.countTo - beat.countFrom) / ticks) * (tick + 0.5),
	);
}

function BundleCard(
	{ bundle, beat, frame }: Readonly<
		{ bundle: DemoBundle; beat: Beat; frame: number }
	>,
) {
	const t = enter(frame, beat.add, POP);
	const chip = enter(frame, beat.prize, POP);

	return (
		<section
			className="bundle"
			style={{
				opacity: Math.min(1, t * 1.5),
				transform: `translateY(${mix(40, 0, t)}px) scale(${mix(0.85, 1, t)})`,
				transformOrigin: "top center",
				borderLeft: `10px solid ${TONE_COLORS[bundle.tone]}`,
			}}
		>
			<div className="bundle-head" style={{ gridTemplateColumns: "1fr auto" }}>
				<div className="field">
					<label>Bundle name</label>
					<input readOnly value={typed(bundle.label, frame, beat.add + 2)} />
				</div>
				<div style={{ position: "relative" }}>
					<Stepper
						label="Boxes"
						showLabel
						value={countAt(bundle, beat, frame)}
						min={1}
					/>
					{bundle.boxes > 1 && (
						<Tap taps={tickFrames(bundle, beat)} x="86%" y="72%" size={34} />
					)}
				</div>
			</div>
			{frame >= beat.prize && (
				<div
					style={{
						opacity: Math.min(1, chip * 1.4),
						transform: `scale(${mix(0.7, 1, chip)})`,
						transformOrigin: "left center",
					}}
				>
					<PrizeChip
						kind={bundle.kind}
						prize={bundle.prize}
						value={bundle.value}
					/>
				</div>
			)}
		</section>
	);
}

function Checklist({ frame, size }: Readonly<{ frame: number; size: number }>) {
	const current = CHECKLIST.findLastIndex((item) => frame >= item.from);

	return (
		<ol
			style={{
				display: "grid",
				gap: size * 0.7,
				margin: 0,
				padding: 0,
				listStyle: "none",
			}}
		>
			{CHECKLIST.map((item, index) => {
				const t = enter(frame, item.from, POP);
				const done = index < current;
				const active = index === current;

				return (
					<li
						key={item.text}
						style={{
							display: "flex",
							alignItems: "center",
							gap: size * 0.45,
							opacity: frame < item.from ? 0.28 : 1,
							transform: `translateX(${active ? mix(30, 0, t) : 0}px) scale(${
								active ? mix(0.9, 1, t) : 1
							})`,
							transformOrigin: "left center",
						}}
					>
						<span
							style={{
								display: "grid",
								placeItems: "center",
								flex: "none",
								width: size * 1.3,
								height: size * 1.3,
								border: "5px solid var(--ink)",
								borderRadius: "50%",
								background: done
									? "var(--teal-bright)"
									: active
									? "var(--gold)"
									: "var(--paper)",
								font: `400 ${size * 0.62}px/1 var(--display)`,
								color: done ? "var(--white)" : "var(--ink)",
							}}
						>
							{done ? "✓" : index + 1}
						</span>
						<span
							style={{
								font: `400 ${size}px/1.05 var(--display)`,
								textTransform: "uppercase",
							}}
						>
							{item.text}
						</span>
					</li>
				);
			})}
		</ol>
	);
}

function Highlight(
	{ children, on }: Readonly<{ children: ReactNode; on: number }>,
) {
	return (
		<div
			style={{
				borderRadius: 20,
				boxShadow: `0 0 0 ${on * 10}px var(--gold)`,
				transform: `scale(${1 + on * 0.04})`,
			}}
		>
			{children}
		</div>
	);
}

export function Builder() {
	const frame = useCurrentFrame();
	const { width, height } = useVideoConfig();
	const frameWidth = width * 0.62;
	const frameHeight = height * 0.88;
	const left = width * 0.04;
	const top = (height - frameHeight) / 2;
	const arrive = enter(frame, 0, SNAP);
	const scroll = interpolate(frame, [0, 118, 134, 170, 186], [
		0,
		0,
		190,
		190,
		400,
	], {
		extrapolateLeft: "clamp",
		extrapolateRight: "clamp",
	});
	const highlight = progress(frame, HIGHLIGHT, 12);

	const segments = STAGED.filter(({ beat }) => frame >= beat.add).map((
		{ bundle, beat },
	) => ({
		key: bundle.key,
		label: bundle.label,
		count: countAt(bundle, beat, frame),
		tone: bundle.tone,
	}));
	const total = segments.reduce((sum, segment) => sum + segment.count, 0);

	return (
		<AbsoluteFill>
			<BrowserFrame
				url="lootbox.pina.rs/create"
				width={frameWidth}
				height={frameHeight}
				style={{ left, top: top + mix(height, 0, Math.min(1, arrive)) }}
			>
				<SiteViewport
					cssWidth={CSS_WIDTH}
					width={frameWidth}
					height={frameHeight - 64}
				>
					<SiteBar />
					<div className="stack" style={{ padding: "18px 24px 0" }}>
						<div className="section-head">
							<h1 className="display" style={{ fontSize: 36 }}>Prizes</h1>
							<span className="muted">Draft saved</span>
						</div>
						<div
							style={{
								display: "grid",
								gridTemplateColumns: "minmax(0, 1.15fr) minmax(0, 1fr)",
								gap: 20,
								alignItems: "start",
							}}
						>
							<div
								style={{
									height: 470,
									overflow: "hidden",
									padding: 4,
									margin: -4,
								}}
							>
								<div
									className="stack"
									style={{ transform: `translateY(${-scroll}px)` }}
								>
									{STAGED.filter(({ beat }) => frame >= beat.add).map((
										{ bundle, beat },
									) => (
										<BundleCard
											key={bundle.key}
											bundle={bundle}
											beat={beat}
											frame={frame}
										/>
									))}
									<button
										type="button"
										className="button"
										style={{ position: "relative" }}
									>
										+ Add a bundle
										<Tap taps={BEATS.map((beat) => beat.add - 2)} size={34} />
									</button>
								</div>
							</div>
							<Highlight on={highlight}>
								<aside className="card" style={{ margin: 0 }}>
									<h2>Odds preview</h2>
									<p className="muted">
										{total === 0
											? "Add bundles to see the odds."
											: `${total} boxes. Each is one equal ticket.`}
									</p>
									{total > 0 && <OddsStrip segments={segments} />}
								</aside>
							</Highlight>
						</div>
					</div>
				</SiteViewport>
			</BrowserFrame>
			{/* The bottom-right corner stays empty for a face bubble in the creator cuts. */}
			<div
				style={{
					position: "absolute",
					left: left + frameWidth + width * 0.035,
					right: width * 0.03,
					top: height * 0.14,
					display: "grid",
					gap: height * 0.07,
				}}
			>
				<div
					style={{
						display: "flex",
						gap: 12,
						opacity: progress(frame, 40, 10),
					}}
				>
					{(["sol", "bonk", "stock", "nft"] as const).map((kind, index) => (
						<Coin
							key={kind}
							kind={kind}
							size={height * 0.07}
							style={{
								transform: `translateY(${
									Math.sin((frame + index * 9) / 9) * 6
								}px)`,
							}}
						/>
					))}
				</div>
				<Checklist frame={frame} size={height * 0.042} />
			</div>
			{BEATS.map((beat, index) => (
				<Sfx
					key={`add-${index}`}
					name="ui-click"
					at={beat.add - 2}
					volume={0.6}
				/>
			))}
			{BEATS.map((beat, index) => (
				<Sfx key={`pop-${index}`} name="ui-pop" at={beat.prize} />
			))}
			{STAGED.flatMap(({ bundle, beat }, index) =>
				bundle.boxes === 1
					? []
					: tickFrames(bundle, beat).map((at, tick) => (
						<Sfx
							key={`tick-${index}-${tick}`}
							name="blip-up"
							at={at}
							volume={0.35}
						/>
					))
			)}
			<Sfx name="sparkle" at={HIGHLIGHT} volume={0.5} />
		</AbsoluteFill>
	);
}
