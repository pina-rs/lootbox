/**
 * One word per beat, full-screen, slammed in on its own colour. The last
 * word gets the chest peeking up underneath it.
 */
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";

import { Chest } from "../kit/Chest.tsx";
import { BOUNCE, enter, mix, squash } from "../kit/motion.ts";
import { Sfx } from "../kit/Sound.tsx";

export type SlamWord = Readonly<{ text: string; ground: string; ink: string }>;

export function Slam(
	{ words, beat }: Readonly<{ words: readonly SlamWord[]; beat: number }>,
) {
	const frame = useCurrentFrame();
	const { width, height } = useVideoConfig();
	const index = Math.min(words.length - 1, Math.floor(frame / beat));
	const word = words[index];

	if (!word) return null;

	const local = frame - index * beat;
	const hit = enter(local, 0, BOUNCE);
	const shake = local < 6 ? Math.sin(local * 3) * (6 - local) * 2 : 0;
	const last = index === words.length - 1;
	const size = Math.min(
		(width * 0.92) / (Math.max(3, word.text.length) * 0.66),
		height * 0.3,
	);

	return (
		<AbsoluteFill
			style={{
				background: word.ground,
				justifyContent: "center",
				alignItems: "center",
			}}
		>
			<span
				style={{
					font: `400 ${size}px/1 var(--display)`,
					color: word.ink,
					textTransform: "uppercase",
					transform: `translate(${shake}px, ${
						last ? -height * 0.1 : 0
					}px) scale(${mix(2.6, 1, hit)}) rotate(${
						mix(index % 2 ? 8 : -8, index % 2 ? -2 : 2, hit)
					}deg)`,
					textShadow: `0 ${size * 0.06}px 0 rgb(0 0 0 / 0.25)`,
				}}
			>
				{word.text}
			</span>
			{last && (
				<Chest
					x={width / 2}
					y={height * 0.98 - enter(local, 3, BOUNCE) * height * 0.2}
					size={width * 0.6}
					open={1.3}
					look={{ x: 0, y: -1 }}
					squash={squash(local, 3, 0.15)}
					sparkles
				/>
			)}
			{words.map((_, wordIndex) => (
				<Sfx
					key={wordIndex}
					name="chest-thud"
					at={wordIndex * beat}
					volume={0.55}
				/>
			))}
		</AbsoluteFill>
	);
}
