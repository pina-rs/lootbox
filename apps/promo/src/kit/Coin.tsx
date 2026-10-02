/**
 * Prize tokens drawn as chunky coins in the chest's style, so prizes can fly
 * through a frame and still read at a glance.
 */
import type { CSSProperties } from "react";

import type { PrizeKind } from "../data/demo.ts";

const FACES: Record<PrizeKind, { fill: string; glyph: string; ink: string }> = {
	sol: { fill: "#9a74c9", glyph: "◎", ink: "var(--white)" },
	bonk: { fill: "#f59e3b", glyph: "B", ink: "var(--ink)" },
	stock: { fill: "var(--teal-bright)", glyph: "↗", ink: "var(--white)" },
	nft: { fill: "var(--gold)", glyph: "★", ink: "var(--ink)" },
};

export function Coin(
	{ kind, size, style }: Readonly<
		{ kind: PrizeKind; size: number; style?: CSSProperties }
	>,
) {
	const face = FACES[kind];

	return (
		<svg
			viewBox="0 0 64 64"
			width={size}
			height={size}
			style={style}
			aria-hidden="true"
		>
			<circle cx={32} cy={35} r={27} fill="var(--ink)" />
			<circle
				cx={32}
				cy={31}
				r={27}
				fill={face.fill}
				stroke="var(--ink)"
				strokeWidth={4}
			/>
			<circle
				cx={32}
				cy={31}
				r={20}
				fill="none"
				stroke="rgb(255 255 255 / 0.35)"
				strokeWidth={3}
			/>
			<text
				x={32}
				y={42}
				textAnchor="middle"
				fill={face.ink}
				style={{ font: "400 30px var(--display)" }}
			>
				{face.glyph}
			</text>
			<path
				d="M14,22 Q18,12 28,9"
				fill="none"
				stroke="rgb(255 255 255 / 0.6)"
				strokeWidth={4}
				strokeLinecap="round"
			/>
		</svg>
	);
}

/** A prize row as the site draws it: coin, amount, and per-box value. */
export function PrizeChip(
	{ kind, prize, value }: Readonly<
		{ kind: PrizeKind; prize: string; value: string }
	>,
) {
	return (
		<div className="prize-row" style={{ justifyContent: "flex-start" }}>
			<Coin kind={kind} size={44} />
			<span>
				{prize}
				<small>{value}</small>
			</span>
		</div>
	);
}
