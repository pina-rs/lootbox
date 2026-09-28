/**
 * Celebration, deterministically: confetti and sparkle bursts seeded by
 * name, so a frame looks the same every render.
 */
import { random, useCurrentFrame } from "remotion";

const CONFETTI_COLORS = [
	"var(--gold)",
	"var(--teal-bright)",
	"var(--lock)",
	"var(--sky)",
	"#9a74c9",
	"var(--white)",
];

export function sparkleD(radius: number): string {
	const k = radius * 0.28;

	return `M0,${-radius} Q${k},${-k} ${radius},0 Q${k},${k} 0,${radius} Q${-k},${k} ${-radius},0 Q${-k},${-k} 0,${-radius}Z`;
}

/** A burst of confetti from (x, y) at `at`, falling under gravity. */
export function Confetti(
	{ x, y, at, count = 60, spread = 900, seed = "confetti" }: Readonly<{
		x: number;
		y: number;
		at: number;
		count?: number;
		spread?: number;
		seed?: string;
	}>,
) {
	const frame = useCurrentFrame();
	const t = frame - at;

	if (t < 0 || t > 110) return null;

	return (
		<div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
			{Array.from({ length: count }, (_, index) => {
				const angle = -Math.PI / 2 + (random(`${seed}-a-${index}`) - 0.5) * 2.3;
				const speed = spread * (0.45 + random(`${seed}-s-${index}`) * 0.75) /
					30;
				const spin = (random(`${seed}-r-${index}`) - 0.5) * 40;
				const px = x + Math.cos(angle) * speed * t;
				const py = y + Math.sin(angle) * speed * t + 0.55 * t * t;
				const color = CONFETTI_COLORS[index % CONFETTI_COLORS.length];
				const wide = random(`${seed}-w-${index}`) > 0.5;

				return (
					<span
						key={index}
						style={{
							position: "absolute",
							left: px,
							top: py,
							width: wide ? 22 : 12,
							height: wide ? 12 : 22,
							borderRadius: 3,
							border: "2.5px solid var(--ink)",
							background: color,
							transform: `rotate(${spin * t}deg) scaleX(${
								Math.cos((t + index) / 4)
							})`,
							opacity: t > 80 ? 1 - (t - 80) / 30 : 1,
						}}
					/>
				);
			})}
		</div>
	);
}

/** Gold sparkles that pop around a point and fade. */
export function SparkleBurst(
	{ x, y, at, count = 8, radius = 180, size = 30, seed = "sparkle" }: Readonly<{
		x: number;
		y: number;
		at: number;
		count?: number;
		radius?: number;
		size?: number;
		seed?: string;
	}>,
) {
	const frame = useCurrentFrame();
	const t = frame - at;

	if (t < 0 || t > 40) return null;

	return (
		<svg
			style={{
				position: "absolute",
				inset: 0,
				overflow: "visible",
				pointerEvents: "none",
			}}
			width="100%"
			height="100%"
		>
			{Array.from({ length: count }, (_, index) => {
				const angle = (index / count) * Math.PI * 2 +
					random(`${seed}-${index}`) * 0.6;
				const delay = random(`${seed}-d-${index}`) * 8;
				const local = Math.max(0, t - delay);
				const reach = radius * (0.55 + random(`${seed}-r-${index}`) * 0.5);
				const out = Math.min(1, local / 14);
				const scale = local < 14 ? out : Math.max(0, 1 - (local - 14) / 16);
				const s = size * (0.6 + random(`${seed}-z-${index}`) * 0.8);

				return (
					<path
						key={index}
						d={sparkleD(s)}
						fill="var(--gold)"
						stroke="var(--ink)"
						strokeWidth={4}
						strokeLinejoin="round"
						transform={`translate(${x + Math.cos(angle) * reach * out} ${
							y + Math.sin(angle) * reach * out
						}) scale(${scale}) rotate(${local * 6})`}
					/>
				);
			})}
		</svg>
	);
}
