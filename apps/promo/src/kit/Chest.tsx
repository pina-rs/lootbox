/**
 * The lootbox chest as a character, placed in composition pixels: the
 * brand's `ChestFigure`, positioned by its feet. Callers compute each value
 * from the frame, or take a whole `ChestFrame` from the brand's motion.
 */
import {
	ChestFigure,
	type ChestFrame,
	type Gaze,
	REST_FRAME,
} from "@pina-rs/lootbox-brand";

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
	/** Height of the feet above the floor, in composition pixels. */
	lift?: number;
	/** A whole pose from the brand's motion; the fields above override it. */
	frame?: ChestFrame;
}>;

/** Where the mark's feet touch the floor, as a fraction of its box. */
const FEET = 0.886;

export function Chest(
	{
		x,
		y,
		size,
		opacity = 1,
		frame = { ...REST_FRAME, open: 0, look: { x: 0, y: 0 } },
		...pose
	}: ChestPose,
) {
	return (
		<ChestFigure
			frame={{
				...frame,
				rotate: pose.rotate ?? frame.rotate,
				squash: pose.squash ?? frame.squash,
				open: pose.open ?? frame.open,
				look: pose.look ?? frame.look,
				blink: pose.blink ?? frame.blink,
				sparkles: pose.sparkles ?? frame.sparkles,
				lift: pose.lift === undefined ? frame.lift : pose.lift / size,
			}}
			style={{
				position: "absolute",
				left: x - size / 2,
				top: y - size * FEET,
				width: size,
				height: size,
				opacity,
			}}
		/>
	);
}
