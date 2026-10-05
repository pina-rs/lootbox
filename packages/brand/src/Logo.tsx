/**
 * Lockups of the mark and the wordmark as one image. In both layouts the
 * chest and the word look at each other: side by side they trade glances,
 * and stacked the chest peers down while the word looks up.
 */
import type { SVGProps } from "react";

import { ChestArt, chestTransform } from "./ChestMark.tsx";
import { palette } from "./tokens.ts";
import {
	WORDMARK_ASPECT,
	WordmarkArt,
	wordmarkTransform,
} from "./Wordmark.tsx";

export type LogoLayout = "horizontal" | "stacked";

/** `light` is ink type for light grounds; `dark` is ivory type for dark ones. */
export type LogoTone = "light" | "dark";

export type LogoProps =
	& Readonly<{
		layout?: LogoLayout;
		tone?: LogoTone;
		/** Rendered height; the width follows. */
		height?: number | string;
		title?: string;
	}>
	& Omit<SVGProps<SVGSVGElement>, "children" | "viewBox" | "height">;

const UNIT = 100;

type Frame = Readonly<{ width: number; height: number }>;

type Placement = Readonly<{
	frame: Frame;
	mark: Readonly<{ x: number; y: number; size: number }>;
	word: Readonly<{ x: number; y: number; height: number }>;
}>;

function placement(layout: LogoLayout): Placement {
	if (layout === "stacked") {
		const wordWidth = 1.3 * UNIT;
		const wordHeight = wordWidth / WORDMARK_ASPECT;
		const markY = 0;
		// Clear the chest's floor shadow by about the horizontal lockup's gap.
		const wordY = 0.96 * UNIT;

		return {
			frame: { width: wordWidth, height: wordY + wordHeight },
			mark: { x: (wordWidth - UNIT) / 2, y: markY, size: UNIT },
			word: { x: 0, y: wordY, height: wordHeight },
		};
	}

	// The word's caps span exactly the chest body, rim to base, so the lid
	// peeks out above the type. Cap height is 720 of the word box's 774 units.
	const wordHeight = 0.361 * UNIT;
	const gap = 0.04 * UNIT;

	return {
		frame: { width: UNIT + gap + wordHeight * WORDMARK_ASPECT, height: UNIT },
		mark: { x: 0, y: 0, size: UNIT },
		word: { x: UNIT + gap, y: 0.488 * UNIT, height: wordHeight },
	};
}

/** The lockup's aspect ratio (width / height), for layout reservations. */
export function logoAspect(layout: LogoLayout): number {
	const { frame } = placement(layout);

	return frame.width / frame.height;
}

export function Logo(
	{
		layout = "horizontal",
		tone = "light",
		height,
		title = "lootbox",
		...svg
	}: LogoProps,
) {
	const { frame, mark, word } = placement(layout);
	const stacked = layout === "stacked";

	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox={`0 0 ${frame.width.toFixed(2)} ${frame.height.toFixed(2)}`}
			height={height}
			role={title ? "img" : undefined}
			aria-label={title || undefined}
			aria-hidden={title ? undefined : true}
			{...svg}
		>
			{/* Groups, not nested <svg>s, so every design tool reads the file alike. */}
			<g transform={chestTransform(mark.x, mark.y, mark.size)}>
				<ChestArt look={stacked ? { x: 0, y: 1 } : { x: 1, y: 0.1 }} />
			</g>
			<g transform={wordmarkTransform(word.x, word.y, word.height)}>
				<WordmarkArt
					color={tone === "light" ? palette.ink : palette.ivory}
					look={stacked ? { x: 0, y: -1 } : { x: -1, y: 0.55 }}
				/>
			</g>
		</svg>
	);
}
