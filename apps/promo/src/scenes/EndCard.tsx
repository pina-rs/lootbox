/**
 * The last frame people see: the lockup, the chest and the word glancing at
 * each other, and where to go.
 */
import { ChestMark, Wordmark, WORDMARK_ASPECT } from "@pina-rs/lootbox-brand";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";

import { blinks, BOUNCE, enter, float, mix, POP } from "../kit/motion.ts";
import { Sfx } from "../kit/Sound.tsx";

export function EndCard(
	{ line = "Make one at", url = "lootbox.so" }: Readonly<
		{ line?: string; url?: string }
	>,
) {
	const frame = useCurrentFrame();
	const { width, height } = useVideoConfig();
	const stacked = height >= width;
	const unit = stacked ? width * 0.62 : height * 0.46;
	const chest = enter(frame, 0, BOUNCE);
	const word = enter(frame, 6, BOUNCE);
	const cta = enter(frame, 18, POP);
	const wordHeight = stacked ? (unit * 1.3) / WORDMARK_ASPECT : unit * 0.361;
	const bob = float(frame, 4, 70);

	return (
		<AbsoluteFill
			style={{
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				gap: unit * 0.06,
			}}
		>
			<div
				style={{
					display: "flex",
					flexDirection: stacked ? "column" : "row",
					alignItems: stacked ? "center" : "flex-end",
					gap: unit * 0.04,
				}}
			>
				<div
					style={{
						transform: `translateY(${
							mix(-height * 0.4, bob, Math.min(1, chest))
						}px) scale(${mix(0.6, 1, chest)})`,
						transformOrigin: "bottom center",
					}}
				>
					<ChestMark
						size={unit}
						look={stacked ? { x: 0, y: 1 } : { x: 1, y: 0.1 }}
						blink={blinks(frame, [34, 78])}
						style={{
							display: "block",
							marginBottom: stacked ? -unit * 0.1 : unit * 0.1,
						}}
					/>
				</div>
				<div
					style={{
						opacity: Math.min(1, word * 1.5),
						transform: `translateX(${
							mix(stacked ? 0 : 80, 0, word)
						}px) translateY(${mix(stacked ? 60 : 0, 0, word)}px)`,
						paddingBottom: stacked ? 0 : unit * 0.14,
					}}
				>
					<Wordmark
						height={wordHeight}
						width={wordHeight * WORDMARK_ASPECT}
						look={stacked ? { x: 0, y: -1 } : { x: -1, y: 0.55 }}
						blink={blinks(frame, [52])}
					/>
				</div>
			</div>
			<div
				style={{
					display: "flex",
					alignItems: "center",
					gap: unit * 0.04,
					opacity: Math.min(1, cta * 1.4),
					transform: `scale(${mix(0.6, 1, cta)})`,
					font: `900 ${unit * 0.085}px/1 var(--body)`,
					color: "var(--ink-soft)",
				}}
			>
				{line}
				<span
					style={{
						padding: `${unit * 0.03}px ${unit * 0.06}px`,
						border: "5px solid var(--ink)",
						borderRadius: 999,
						background: "var(--gold)",
						boxShadow: "0 7px 0 var(--ink)",
						font: `400 ${unit * 0.09}px/1 var(--display)`,
						color: "var(--ink)",
					}}
				>
					{url}
				</span>
			</div>
			<Sfx name="chest-thud" at={8} volume={0.5} />
			<Sfx name="ui-pop" at={18} volume={0.6} />
		</AbsoluteFill>
	);
}
