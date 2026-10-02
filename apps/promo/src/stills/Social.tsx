/**
 * Stills for social profiles and link previews, drawn from the brand
 * components so they never drift from the logo.
 */
import { ChestMark, Logo, logoAspect } from "@pina-rs/lootbox-brand";
import { AbsoluteFill, useVideoConfig } from "remotion";

import { Coin } from "../kit/Coin.tsx";
import { Paper } from "../kit/Paper.tsx";
import { sparkleD } from "../kit/Particles.tsx";

/** X crops avatars to a circle, so the chest sits well inside it. */
export function Avatar() {
	const { width } = useVideoConfig();

	return (
		<Paper>
			<AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
				<ChestMark
					size={width * 0.86}
					look={{ x: 0.4, y: 0.1 }}
					sparkles={false}
				/>
			</AbsoluteFill>
		</Paper>
	);
}

function Sparkle({ x, y, r }: Readonly<{ x: number; y: number; r: number }>) {
	return (
		<svg
			style={{
				position: "absolute",
				left: x - r,
				top: y - r,
				overflow: "visible",
			}}
			width={r * 2}
			height={r * 2}
		>
			<path
				d={sparkleD(r)}
				transform={`translate(${r} ${r})`}
				fill="var(--gold)"
				stroke="var(--ink)"
				strokeWidth={4}
			/>
		</svg>
	);
}

/**
 * The profile banner. X lays the avatar over the bottom-left, so the lockup
 * and words sit centre-right.
 */
export function Banner() {
	const { width, height } = useVideoConfig();
	const logoHeight = height * 0.42;

	return (
		<Paper>
			<div
				style={{
					position: "absolute",
					left: width * 0.3,
					top: height * 0.16,
					display: "grid",
					gap: height * 0.05,
				}}
			>
				<Logo
					height={logoHeight}
					width={logoHeight * logoAspect("horizontal")}
				/>
				<div
					style={{
						font: `900 ${height * 0.062}px/1.2 var(--body)`,
						color: "var(--ink-soft)",
					}}
				>
					Sealed gifts. Real prizes. Open them on{" "}
					<span
						style={{
							padding: `${height * 0.012}px ${height * 0.03}px`,
							border: "4px solid var(--ink)",
							borderRadius: 999,
							background: "var(--gold)",
							font: `400 ${height * 0.056}px/1 var(--display)`,
							color: "var(--ink)",
						}}
					>
						lootbox.so
					</span>
				</div>
			</div>
			{(["sol", "bonk", "stock", "nft", "sol"] as const).map((kind, index) => (
				<Coin
					key={index}
					kind={kind}
					size={height * (0.13 + (index % 2) * 0.04)}
					style={{
						position: "absolute",
						left: width * (0.06 + index * 0.055),
						top: height * (0.12 + ((index * 37) % 5) * 0.06),
						transform: `rotate(${index * 23 - 30}deg)`,
					}}
				/>
			))}
			<Sparkle x={width * 0.93} y={height * 0.2} r={height * 0.06} />
			<Sparkle x={width * 0.96} y={height * 0.42} r={height * 0.03} />
			<Sparkle x={width * 0.3} y={height * 0.12} r={height * 0.035} />
		</Paper>
	);
}

/** The home page's link preview. */
export function ShareCard() {
	const { width, height } = useVideoConfig();

	return (
		<Paper>
			<AbsoluteFill
				style={{
					justifyContent: "center",
					alignItems: "center",
					gap: height * 0.06,
				}}
			>
				<Logo
					height={height * 0.42}
					width={height * 0.42 * logoAspect("horizontal")}
				/>
				<div
					style={{
						font: `900 ${height * 0.066}px/1.2 var(--body)`,
						color: "var(--ink-soft)",
					}}
				>
					Fill a box with real prizes. Share it. Open it.
				</div>
			</AbsoluteFill>
			<Sparkle x={width * 0.08} y={height * 0.18} r={height * 0.05} />
			<Sparkle x={width * 0.92} y={height * 0.82} r={height * 0.04} />
		</Paper>
	);
}
