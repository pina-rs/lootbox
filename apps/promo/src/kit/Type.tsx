/**
 * Words that move: a Bungee headline whose words spring up one after
 * another, and a caption pill for people watching with the sound off.
 */
import type { CSSProperties } from "react";
import { useCurrentFrame } from "remotion";

import { BOUNCE, enter, mix, progress } from "./motion.ts";

export type Word = Readonly<{
	text: string;
	/** Colour this word, e.g. `var(--teal)`. */
	color?: string;
	/** Draw a gold swoosh under this word once it lands. */
	underline?: boolean;
}>;

export type HeadlineProps = Readonly<{
	words: readonly (string | Word)[];
	/** Frame the first word starts. */
	at: number;
	/** Frames between words. */
	stagger?: number;
	size: number;
	/** Frame the headline leaves; omit to stay. */
	exitAt?: number;
	align?: CSSProperties["textAlign"];
	width?: number;
	color?: string;
	style?: CSSProperties;
}>;

function Swoosh({ reveal }: Readonly<{ reveal: number }>) {
	return (
		<svg
			viewBox="0 0 200 24"
			preserveAspectRatio="none"
			style={{
				position: "absolute",
				left: "-4%",
				right: "-4%",
				bottom: "-0.28em",
				width: "108%",
				height: "0.32em",
				overflow: "visible",
			}}
		>
			<path
				d="M4,16 C60,4 140,4 196,12"
				fill="none"
				stroke="var(--gold)"
				strokeWidth={10}
				strokeLinecap="round"
				pathLength={1}
				strokeDasharray={1}
				strokeDashoffset={1 - reveal}
			/>
		</svg>
	);
}

export function Headline(
	{
		words,
		at,
		stagger = 5,
		size,
		exitAt,
		align = "center",
		width,
		color = "var(--ink)",
		style,
	}: HeadlineProps,
) {
	const frame = useCurrentFrame();
	const leave = exitAt === undefined ? 0 : progress(frame, exitAt, 10);

	return (
		<div
			style={{
				font: `400 ${size}px/1.02 var(--display)`,
				color,
				textAlign: align,
				width,
				textTransform: "uppercase",
				letterSpacing: "0.005em",
				opacity: 1 - leave,
				transform: `translateY(${-leave * size * 0.4}px)`,
				...style,
			}}
		>
			{words.map((entry, index) => {
				const word = typeof entry === "string" ? { text: entry } : entry;
				const start = at + index * stagger;
				const t = enter(frame, start, BOUNCE);
				const drawn = progress(frame, start + 8, 12);

				return (
					<span
						key={`${word.text}-${index}`}
						style={{
							display: "inline-block",
							position: "relative",
							marginInline: "0.14em",
							color: word.color,
							opacity: Math.min(1, t * 1.6),
							transform: `translateY(${mix(size * 0.7, 0, t)}px) rotate(${
								mix(-8, 0, t)
							}deg) scale(${mix(0.6, 1, t)})`,
						}}
					>
						{word.text}
						{word.underline && <Swoosh reveal={drawn} />}
					</span>
				);
			})}
		</div>
	);
}

/** A caption pill: one short line, big enough to read on a phone. */
export function Caption(
	{
		text,
		at,
		until,
		size = 44,
		bottom = 90,
		align = "center",
		maxWidth = "86%",
		inset = "5%",
	}: Readonly<{
		text: string;
		at: number;
		until: number;
		size?: number;
		bottom?: number;
		/** `left` keeps a corner free, e.g. for a face bubble. */
		align?: "center" | "left";
		maxWidth?: string;
		inset?: string;
	}>,
) {
	const frame = useCurrentFrame();

	if (frame < at - 1 || frame > until + 8) return null;

	const t = enter(frame, at);
	const out = progress(frame, until, 8);

	return (
		<div
			style={{
				position: "absolute",
				left: align === "left" ? inset : 0,
				right: 0,
				bottom,
				display: "flex",
				justifyContent: align === "left" ? "flex-start" : "center",
				opacity: Math.min(1, t) * (1 - out),
				transform: `translateY(${mix(24, 0, Math.min(1, t))}px)`,
			}}
		>
			<span
				style={{
					maxWidth,
					padding: `${size * 0.32}px ${size * 0.6}px`,
					border: "4px solid var(--ink)",
					borderRadius: 999,
					background: "var(--white)",
					boxShadow: "0 6px 0 var(--ink)",
					font: `900 ${size}px/1.15 var(--body)`,
					color: "var(--ink)",
					textAlign: "center",
				}}
			>
				{text}
			</span>
		</div>
	);
}
