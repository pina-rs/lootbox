/**
 * LOOTBOX in Bungee outlines, where the two O's of LOOT are a pair of
 * cartoon eyes. Pupils follow `look`, and `blink` lowers an eyelid of the
 * letter's own colour, so the word can glance at the chest and wink.
 */
import { type SVGProps, useId } from "react";

import type { Gaze } from "./ChestMark.tsx";
import { clamp, svgId } from "./geometry.ts";
import {
	CAP_HEIGHT,
	LETTERS,
	O_COUNTER,
	O_COUNTER_BOX,
	O_OUTER,
	O_OVERSHOOT,
} from "./glyphs.ts";
import { palette } from "./tokens.ts";

const WORD = ["L", "O", "O", "T", "B", "O", "X"] as const;
/** Letters drawn as eyes: the O's of LOOT. */
const EYE_LETTERS: ReadonlySet<number> = new Set([1, 2]);
const TRACKING = -10;
const PUPIL_WIDTH = 110;
const PUPIL_HEIGHT = 236;

export type WordmarkLetter = Readonly<{
	index: number;
	char: (typeof WORD)[number];
	/** Left edge of the letter's advance box, in wordmark units. */
	x: number;
	advance: number;
}>;

/** Where every letter sits, for animating letters individually. */
export const WORDMARK_LETTERS: readonly WordmarkLetter[] = WORD.reduce<
	WordmarkLetter[]
>((letters, char, index) => {
	const previous = letters.at(-1);
	const x = previous ? previous.x + previous.advance + TRACKING : 0;

	letters.push({ index, char, x, advance: LETTERS[char].advance });

	return letters;
}, []);

// Ink bounds: the L's stem starts at 69 and the X ends 60 short of its advance.
const LAST = WORDMARK_LETTERS.at(-1);
const INK_LEFT = 69;
const INK_RIGHT = (LAST?.x ?? 0) + (LAST?.advance ?? 0) - 60;
const PAD = 12;

/** The wordmark's viewBox: tight to the ink with a small pad. */
export const WORDMARK_VIEWBOX = {
	x: INK_LEFT - PAD,
	y: -CAP_HEIGHT - O_OVERSHOOT - PAD,
	width: INK_RIGHT - INK_LEFT + 2 * PAD,
	height: CAP_HEIGHT + 2 * O_OVERSHOOT + 2 * PAD,
} as const;

/** Width over height, for sizing the wordmark by its height. */
export const WORDMARK_ASPECT = WORDMARK_VIEWBOX.width / WORDMARK_VIEWBOX.height;

/** How the word is drawn and posed. Every field has a logo default. */
export type WordmarkPose = Readonly<{
	/** Letter colour. Ink on light grounds, ivory on dark ones. */
	color?: string | undefined;
	/** Pupil direction. Defaults to a glance up, at whatever is above. */
	look?: Gaze | undefined;
	/** 0 is open, 1 is shut. */
	blink?: number | undefined;
	/** Extra SVG transform per letter, e.g. for a bounce-in. */
	letterTransform?:
		| ((letter: WordmarkLetter) => string | undefined)
		| undefined;
}>;

export type WordmarkProps =
	& WordmarkPose
	& Readonly<{
		/** Accessible name; defaults to "lootbox". Pass "" for decorative use. */
		title?: string;
		/** Rendered height; the width follows the aspect ratio. */
		height?: number | string;
	}>
	& Omit<SVGProps<SVGSVGElement>, "children" | "viewBox" | "height">;

export const WORDMARK_LOOK: Gaze = { x: 0.85, y: -0.8 };

/**
 * The SVG transform that draws `WordmarkArt` `height` tall with its top-left
 * corner at (x, y), matching `Wordmark` at the same place and size.
 */
export function wordmarkTransform(
	x: number,
	y: number,
	height: number,
): string {
	return `translate(${x} ${y}) scale(${
		height / WORDMARK_VIEWBOX.height
	}) translate(${-WORDMARK_VIEWBOX.x} ${-WORDMARK_VIEWBOX.y})`;
}

function EyeO(
	{ id, color, look, blink }: Readonly<{
		id: string;
		color: string;
		look: Gaze;
		blink: number;
	}>,
) {
	const { cx, cy, ry } = O_COUNTER_BOX;
	const px = cx + clamp(look.x, -1, 1) * 30;
	const py = cy + clamp(look.y, -1, 1) * 50;
	const lid = clamp(blink, 0, 1) * ry * 2;

	return (
		<g>
			<clipPath id={id}>
				<path d={O_COUNTER} />
			</clipPath>
			<path d={O_OUTER} fill={color} />
			<path d={O_COUNTER} fill={palette.white} />
			<g clipPath={`url(#${id})`}>
				<rect
					x={px - PUPIL_WIDTH / 2}
					y={py - PUPIL_HEIGHT / 2}
					width={PUPIL_WIDTH}
					height={PUPIL_HEIGHT}
					rx={PUPIL_WIDTH / 2}
					fill={palette.ink}
				/>
				<ellipse
					cx={px - PUPIL_WIDTH * 0.18}
					cy={py - PUPIL_HEIGHT * 0.24}
					rx={PUPIL_WIDTH * 0.17}
					ry={PUPIL_WIDTH * 0.2}
					fill={palette.white}
				/>
				{lid > 0 && (
					<rect
						x={cx - 100}
						y={cy - ry - 1}
						width={200}
						height={lid + 1}
						fill={color}
					/>
				)}
			</g>
		</g>
	);
}

export function Wordmark(
	{
		color,
		look,
		blink,
		letterTransform,
		title = "lootbox",
		height,
		...svg
	}: WordmarkProps,
) {
	const { x, y, width, height: boxHeight } = WORDMARK_VIEWBOX;

	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox={`${x} ${y} ${width} ${boxHeight}`}
			height={height}
			role={title ? "img" : undefined}
			aria-label={title || undefined}
			aria-hidden={title ? undefined : true}
			{...svg}
		>
			<WordmarkArt
				color={color}
				look={look}
				blink={blink}
				letterTransform={letterTransform}
			/>
		</svg>
	);
}

/**
 * The word's shapes in wordmark units, without an `<svg>` of their own. Place
 * it inside another drawing with `wordmarkTransform`.
 */
export function WordmarkArt(
	{
		color = palette.ink,
		look = WORDMARK_LOOK,
		blink = 0,
		letterTransform,
	}: WordmarkPose,
) {
	const id = svgId(useId());

	return (
		<>
			{WORDMARK_LETTERS.map((letter) => {
				const extra = letterTransform?.(letter);
				const transform = `translate(${letter.x} 0)${extra ? ` ${extra}` : ""}`;

				return (
					<g key={letter.index} transform={transform}>
						{EYE_LETTERS.has(letter.index)
							? (
								<EyeO
									id={`${id}-eye${letter.index}`}
									color={color}
									look={look}
									blink={blink}
								/>
							)
							: <path d={LETTERS[letter.char].path} fill={color} />}
					</g>
				);
			})}
		</>
	);
}
