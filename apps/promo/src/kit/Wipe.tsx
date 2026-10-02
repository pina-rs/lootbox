/**
 * The lootbox cut: a gold chest strap with ink edges and rivets sweeps
 * across the frame, hiding the switch between scenes at its midpoint.
 * Place it so `at` is the cut frame.
 */
import { Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

import { Sfx } from "./Sound.tsx";

export const WIPE_FRAMES = 14;

export function Wipe({ at }: Readonly<{ at: number }>) {
	const frame = useCurrentFrame();
	const { width, height } = useVideoConfig();
	const half = WIPE_FRAMES / 2;

	if (frame < at - half || frame > at + half) {
		return <Sfx name="whoosh" at={at - half} volume={0.35} />;
	}

	const diagonal = Math.hypot(width, height);
	const band = diagonal * 0.8;
	const x = interpolate(frame, [at - half, at + half], [
		-band - diagonal / 2,
		diagonal / 2 + band,
	], {
		easing: Easing.inOut(Easing.cubic),
	});

	return (
		<>
			<Sfx name="whoosh" at={at - half} volume={0.35} />
			<svg
				style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
				width={width}
				height={height}
			>
				<g
					transform={`translate(${width / 2} ${
						height / 2
					}) rotate(-18) translate(${x} 0)`}
				>
					<rect
						x={-band / 2}
						y={-diagonal}
						width={band}
						height={diagonal * 2}
						fill="var(--gold)"
						stroke="var(--ink)"
						strokeWidth={14}
					/>
					<rect
						x={-band / 2 + band * 0.12}
						y={-diagonal}
						width={band * 0.06}
						height={diagonal * 2}
						fill="var(--gold-soft)"
					/>
					{Array.from({ length: 9 }, (_, index) => (
						<circle
							key={index}
							cx={band * 0.32}
							cy={-diagonal * 0.8 + index * diagonal * 0.2}
							r={16}
							fill="var(--ink)"
						/>
					))}
				</g>
			</svg>
		</>
	);
}
