/**
 * A pointer anchored to the element it presses. Put it inside a positioned
 * parent (the button itself), and it arrives, taps at each frame in `taps`,
 * and leaves: no coordinate guessing, and it follows the button if the
 * layout moves.
 */
import { useCurrentFrame } from "remotion";

import { mix, progress } from "./motion.ts";

export function Tap(
	{ taps, size = 30, x = "70%", y = "55%" }: Readonly<{
		/** Frames at which it presses. */
		taps: readonly number[];
		size?: number;
		x?: string;
		y?: string;
	}>,
) {
	const frame = useCurrentFrame();
	const first = taps[0];
	const last = taps.at(-1);

	if (first === undefined || last === undefined) return null;

	if (frame < first - 14 || frame > last + 14) return null;

	const arrive = progress(frame, first - 14, 10);
	const leave = progress(frame, last + 6, 8);
	const press = Math.max(
		0,
		...taps.map((at) => {
			const t = frame - at;

			return t >= 0 && t < 6 ? Math.sin((t / 6) * Math.PI) : 0;
		}),
	);
	const ring = taps.map((at) => frame - at).find((t) => t >= 0 && t < 14);

	return (
		<span
			style={{
				position: "absolute",
				left: x,
				top: y,
				width: 0,
				height: 0,
				pointerEvents: "none",
				zIndex: 5,
			}}
		>
			{ring !== undefined && (
				<span
					style={{
						position: "absolute",
						left: -size,
						top: -size,
						width: size * 2,
						height: size * 2,
						borderRadius: "50%",
						border: `${size * 0.12}px solid var(--gold)`,
						transform: `scale(${0.3 + (ring / 14) * 0.9})`,
						opacity: 1 - ring / 14,
					}}
				/>
			)}
			<svg
				viewBox="0 0 32 32"
				width={size}
				height={size}
				style={{
					position: "absolute",
					left: -size * 0.18,
					top: -size * 0.08,
					opacity: arrive * (1 - leave),
					transform: `translate(${mix(size * 2, 0, arrive)}px, ${
						mix(size * 2, 0, arrive)
					}px) scale(${1 - press * 0.18})`,
					transformOrigin: "20% 10%",
					filter: "drop-shadow(0 2px 0 rgb(29 26 20 / 0.35))",
				}}
			>
				<path
					d="M6 3 L6 26 L12 20.5 L16 29 L20.5 27 L16.6 18.8 L24.5 18.4 Z"
					fill="var(--white)"
					stroke="var(--ink)"
					strokeWidth={2.4}
					strokeLinejoin="round"
				/>
			</svg>
		</span>
	);
}
