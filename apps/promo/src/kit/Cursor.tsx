/**
 * A pointer that glides between keyframes and taps where the story clicks.
 * Keyframes are absolute composition pixels at absolute frames.
 */
import { Easing, interpolate, useCurrentFrame } from "remotion";

export type CursorKey = Readonly<{
	frame: number;
	x: number;
	y: number;
	/** Press here: the pointer dips and a ring spreads. */
	click?: boolean;
}>;

export function Cursor(
	{ keys, size = 56, hideAfter }: Readonly<{
		keys: readonly CursorKey[];
		size?: number;
		hideAfter?: number;
	}>,
) {
	const frame = useCurrentFrame();
	const first = keys[0];

	if (!first || frame < first.frame - 8) return null;

	if (hideAfter !== undefined && frame > hideAfter + 8) return null;

	const frames = keys.map((key) => key.frame);
	const options = {
		easing: Easing.inOut(Easing.cubic),
		extrapolateLeft: "clamp",
		extrapolateRight: "clamp",
	} as const;
	const x = keys.length > 1
		? interpolate(frame, frames, keys.map((key) => key.x), options)
		: first.x;
	const y = keys.length > 1
		? interpolate(frame, frames, keys.map((key) => key.y), options)
		: first.y;
	const clicks = keys.filter((key) => key.click);
	const press = Math.max(
		0,
		...clicks.map((key) => {
			const t = frame - key.frame;

			return t >= 0 && t < 8 ? Math.sin((t / 8) * Math.PI) : 0;
		}),
	);
	const fade = Math.min(
		interpolate(frame, [first.frame - 8, first.frame], [0, 1], {
			extrapolateLeft: "clamp",
			extrapolateRight: "clamp",
		}),
		hideAfter === undefined
			? 1
			: interpolate(frame, [hideAfter, hideAfter + 8], [1, 0], {
				extrapolateLeft: "clamp",
				extrapolateRight: "clamp",
			}),
	);

	return (
		<div
			style={{
				position: "absolute",
				inset: 0,
				pointerEvents: "none",
				opacity: fade,
			}}
		>
			{clicks.map((key) => {
				const t = frame - key.frame;

				if (t < 0 || t > 18) return null;

				const grow = t / 18;

				return (
					<span
						key={key.frame}
						style={{
							position: "absolute",
							left: key.x - 40,
							top: key.y - 40,
							width: 80,
							height: 80,
							borderRadius: "50%",
							border: "5px solid var(--gold)",
							transform: `scale(${0.3 + grow * 0.9})`,
							opacity: 1 - grow,
						}}
					/>
				);
			})}
			<svg
				viewBox="0 0 32 32"
				width={size}
				height={size}
				style={{
					position: "absolute",
					left: x - size * 0.18,
					top: y - size * 0.08,
					transform: `scale(${1 - press * 0.16})`,
					transformOrigin: "20% 10%",
					filter: "drop-shadow(0 4px 0 rgb(29 26 20 / 0.35))",
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
		</div>
	);
}
