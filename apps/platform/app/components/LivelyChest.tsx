import {
	ChestFigure,
	type ChestReaction,
	idleFrame,
	restFrame,
} from "@pina-rs/lootbox-brand";

import { useAnimationSeconds, useReducedMotion } from "../lib/animation.js";

/**
 * The chest character, alive: it breathes, blinks, glances about, and hops
 * now and then. With `mood` it keeps that reveal's pose instead, like the
 * sad chest on the error page. It holds still for viewers who prefer less
 * motion.
 */
export function LivelyChest(
	{ mood, className, title }: Readonly<{
		mood?: ChestReaction;
		className?: string;
		/** Accessible name. Without it the chest is decorative. */
		title?: string;
	}>,
) {
	const seconds = useAnimationSeconds(!useReducedMotion());
	const frame = mood ? restFrame(mood, seconds) : idleFrame(seconds);

	return (
		<ChestFigure
			frame={frame}
			{...(className ? { className } : {})}
			{...(title ? { title } : {})}
		/>
	);
}
