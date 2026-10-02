/**
 * The chest as a character: the mark with a body. It fills its box, and
 * squash, tilt, and hops pivot on its feet, so landings look planted. The
 * floor shadow stays on the floor and shrinks as the chest rises.
 */
import type { CSSProperties } from "react";

import { ChestMark, type ChestMarkVariant } from "./ChestMark.tsx";
import type { ChestFrame } from "./motion.ts";

/** Where the mark's feet touch the floor, as a fraction of its box. */
const FEET = 0.886;

export type ChestFigureProps = Readonly<{
	frame: ChestFrame;
	variant?: ChestMarkVariant;
	/** Accessible name. Without it the figure is decorative. */
	title?: string;
	className?: string;
	style?: CSSProperties;
}>;

export function ChestFigure(
	{ frame, variant, title, className, style }: ChestFigureProps,
) {
	const lift = Math.max(0, frame.lift);
	const shadow = Math.max(0.4, 1 - lift * 0.9);

	return (
		<div
			className={className}
			role={title ? "img" : undefined}
			aria-label={title}
			aria-hidden={title ? undefined : true}
			style={{ position: "relative", aspectRatio: "1", ...style }}
		>
			<div
				style={{
					position: "absolute",
					left: "10%",
					width: "80%",
					top: `${(FEET + 0.009 - 0.032) * 100}%`,
					height: "6.4%",
					borderRadius: "50%",
					background: "rgb(29 26 20 / 0.14)",
					transform: `scale(${shadow})`,
					opacity: shadow,
				}}
			/>
			<div
				style={{
					position: "absolute",
					inset: 0,
					transformOrigin: `50% ${FEET * 100}%`,
					transform: `translate(${frame.shift * 100}%, ${
						-lift * 100
					}%) rotate(${frame.rotate}deg) scale(${frame.squash.x}, ${frame.squash.y})`,
				}}
			>
				<ChestMark
					size="100%"
					variant={variant}
					open={frame.open}
					look={frame.look}
					blink={frame.blink}
					sparkles={frame.sparkles}
					shadow={false}
					style={{ display: "block", overflow: "visible" }}
				/>
			</div>
		</div>
	);
}
