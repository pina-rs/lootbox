/**
 * A comic speech bubble with an ink outline and a tail pointing at the
 * speaker. It pops in at `at` and out at `until`.
 */
import { useCurrentFrame } from "remotion";

import { BOUNCE, enter, mix, progress } from "./motion.ts";

export function Bubble(
	{ text, at, until, x, y, width, size, tail = "left" }: Readonly<{
		text: string;
		at: number;
		until: number;
		/** Top-left corner of the bubble, in composition pixels. */
		x: number;
		y: number;
		width: number;
		size: number;
		/** Which bottom corner the tail comes from. */
		tail?: "left" | "right";
	}>,
) {
	const frame = useCurrentFrame();

	if (frame < at - 1 || frame > until + 10) return null;

	const t = enter(frame, at, BOUNCE);
	const out = progress(frame, until, 8);
	const tailX = tail === "left" ? width * 0.18 : width * 0.82;
	const lean = tail === "left" ? -1 : 1;

	return (
		<div
			style={{
				position: "absolute",
				left: x,
				top: y,
				width,
				transform: `scale(${mix(0.3, 1, t) * (1 - out * 0.4)}) rotate(${
					mix(lean * 8, lean * 2, t)
				}deg)`,
				transformOrigin: `${tailX}px 110%`,
				opacity: Math.min(1, t * 2) * (1 - out),
				zIndex: 20,
			}}
		>
			<div
				style={{
					position: "relative",
					padding: `${size * 0.5}px ${size * 0.7}px`,
					border: `${Math.max(4, size * 0.1)}px solid var(--ink)`,
					borderRadius: size * 0.9,
					background: "var(--white)",
					boxShadow: `0 ${size * 0.14}px 0 var(--ink)`,
					font: `900 ${size}px/1.15 var(--body)`,
					color: "var(--ink)",
					textAlign: "center",
				}}
			>
				{text}
				<svg
					viewBox="0 0 40 36"
					width={size * 1.3}
					height={size * 1.15}
					style={{
						position: "absolute",
						left: tailX - size * 0.65,
						bottom: -size * 1.05,
						transform: tail === "right" ? "scaleX(-1)" : undefined,
					}}
				>
					<path
						d="M4,0 L10,34 L30,0"
						fill="var(--white)"
						stroke="var(--ink)"
						strokeWidth={4}
						strokeLinejoin="round"
					/>
					<rect x={0} y={-4} width={40} height={6} fill="var(--white)" />
				</svg>
			</div>
		</div>
	);
}
