/**
 * The lootbox chest as a character: the brand mark with a body. Position and
 * squash pivot on its feet, so landings look planted and hops push off the
 * floor. Callers compute each value from the frame.
 */
import { ChestMark, type Gaze } from "@pina-rs/lootbox-brand";
import type { CSSProperties } from "react";

export type ChestPose = Readonly<{
	/** Centre of the feet, in composition pixels. */
	x: number;
	y: number;
	size: number;
	rotate?: number;
	/** Horizontal and vertical scale for squash and stretch. */
	squash?: Readonly<{ x: number; y: number }>;
	open?: number;
	look?: Gaze;
	blink?: number;
	sparkles?: boolean;
	opacity?: number;
	/** The floor shadow shrinks as the chest rises; pass the height above it. */
	lift?: number;
}>;

export function Chest(
	{
		x,
		y,
		size,
		rotate = 0,
		squash = { x: 1, y: 1 },
		open = 0,
		look = { x: 0, y: 0 },
		blink = 0,
		sparkles = false,
		opacity = 1,
		lift = 0,
	}: ChestPose,
) {
	// The mark's feet sit at about 89% of its box height.
	const feet = size * 0.89;
	const shadowScale = Math.max(0.35, 1 - lift / (size * 1.6));
	// A chest far above the floor casts no shadow yet.
	const shadowOpacity = Math.max(0, Math.min(1, 1.4 - lift / size));
	const style: CSSProperties = {
		position: "absolute",
		left: x - size / 2,
		top: y - feet - lift,
		width: size,
		height: size,
		opacity,
		transformOrigin: `50% ${feet}px`,
		transform: `rotate(${rotate}deg) scale(${squash.x}, ${squash.y})`,
	};

	return (
		<>
			<div
				style={{
					position: "absolute",
					left: x - size * 0.34,
					top: y - size * 0.03,
					width: size * 0.68,
					height: size * 0.06,
					borderRadius: "50%",
					background: "rgb(29 26 20 / 0.16)",
					transform: `scale(${shadowScale})`,
					opacity: opacity * shadowOpacity,
				}}
			/>
			<div style={style}>
				<ChestMark
					size={size}
					open={open}
					look={look}
					blink={blink}
					sparkles={sparkles}
					shadow={false}
				/>
			</div>
		</>
	);
}
